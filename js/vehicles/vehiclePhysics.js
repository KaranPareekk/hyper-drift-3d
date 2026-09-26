import * as THREE from 'three';

export class VehiclePhysics {
    constructor(carObject, config = {}) {
        this.car = carObject;
        this.root = carObject.root;
        this.chassis = carObject.chassis;
        this.wheels = carObject.wheels;
        this.animated = carObject.animated;

        // Tuning parameters
        this.type = config.type || 'apex';
        this.isApex = this.type === 'apex';

        // Vehicle specifications (tuned for high-performance responsive arcade feel)
        this.mass = 1250; // kg
        this.wheelbase = 2.7; // m
        this.frontAxleDist = 1.35; // a (m)
        this.rearAxleDist = 1.35; // b (m)
        this.inertia = 1450; // kg*m^2 (yaw inertia)

        // Performance envelope
        this.topSpeedKmh = this.isApex ? 260 : 245;
        this.topSpeedMs = this.topSpeedKmh / 3.6;
        this.enginePower = this.isApex ? 6800 : 7200; // drive force (N)
        this.brakeForce = 14000; // N
        this.handbrakeBrakeForce = 18000; // N (rear wheels lock)

        // Tire friction parameters - tuned for razor-sharp steering response
        this.baseGripFront = this.isApex ? 1.55 : 1.45;
        this.baseGripRear = this.isApex ? 1.40 : 1.30;
        this.corneringStiffnessFront = 52000;
        this.corneringStiffnessRear = 42000;

        // Velocity vector in car's local road-plane coordinates (m/s)
        // vLong: forward/backward velocity (positive = forward)
        // vLat: lateral velocity (positive = sliding right)
        this.vLong = 0;
        this.vLat = 0;
        this.yawRate = 0; // rad/s (angular velocity)

        // 3D Road-relative orientation & position
        this.carHeadingAngle = 0; // heading angle relative to track tangent (radians)
        this.steerAngle = 0; // current wheel steering angle (radians)

        // Dynamic State
        this.nitro = 100;
        this.isNitro = false;
        this.isHandbrake = false;
        this.isDrifting = false;
        this.driftScore = 0;
        this.driftAngle = 0; // actual physical slip angle (radians)
        this.gear = 1;
        this.rpm = 1000;
        this.inBarrierContact = false;
        this.justHitBarrier = false;
        this.justHitObstacle = false;
        this.impactSeverity = 0;
        this.justHitBoostPad = false;
        this.steeringSensitivity = 1.0;

        // Dynamic visual lean (suspension weight transfer)
        this.chassisRoll = 0;
        this.chassisPitch = 0;
        this.suspensionY = 0;
        this.wheelSpin = 0;

        // Lap & Race Progress
        this.currentLap = 1;
        this.checkpointProgress = 0;
        this.lastProgress = 0;
        this.distanceTraveled = 0;
        this.lapTimes = [];
        this.currentLapTime = 0;
        this.bestLapTime = Infinity;
        this.finished = false;

        // Inputs
        this.input = {
            forward: 0,
            backward: 0,
            left: 0,
            right: 0,
            handbrake: false,
            nitro: false
        };

        // Cache vectors to eliminate garbage collection stutters
        this._carForward = new THREE.Vector3();
        this._carRight = new THREE.Vector3();
        this._carUp = new THREE.Vector3();
        this._rotMatrix = new THREE.Matrix4();
        this._carQuat = new THREE.Quaternion();
    }

    update(dt, track) {
        if (dt > 0.05) dt = 0.05; // Prevent physics explosion on lag spikes
        if (!track) return;

        // 1. Process Inputs & Speed-Dependent Steering
        this.processInputs(dt);

        // 2. Query Exact Continuous Road Surface at current position
        let roadInfo = track.getRoadSurfaceAt(this.root.position);

        // 3. Compute Longitudinal & Lateral Tire Forces (Physics Core)
        this.computePhysicsForces(dt, roadInfo);

        // 4. Integrate Velocities and Update Position in 3D Space
        roadInfo = this.integrateMovement(dt, track, roadInfo);

        // 5. Conform Car 3D Orientation Flush with Banked Track Normal
        this.alignOrientationWithTrack(roadInfo);

        // 6. Handle Guardrails and Track Boundaries with Deflection Recovery
        this.handleTrackBoundaries(roadInfo, track, dt);

        // 7. Handle Kinetic Hazard Obstacles (Pulsing Shield Spheres) Collision
        this.handleObstacleCollisions(track, dt);

        // 8. Visual Updates: Chassis Weight Transfer, Wheels, RPM, Lights
        this.updateVisuals(dt);

        // 8. Track Lap & Checkpoint Progress
        this.updateLapProgress(roadInfo, dt);

        // 9. Check On-Track Neon Boost Pads
        if (track && track.boostPads && this.vLong > 1.0) {
            const now = performance.now();
            for (const pad of track.boostPads) {
                const distSq = this.root.position.distanceToSquared(pad.point);
                if (distSq < (pad.radius * pad.radius)) {
                    if (!pad.lastTriggerTime || now - pad.lastTriggerTime > 2500) {
                        pad.lastTriggerTime = now;
                        // Controlled, smooth boost surge (+16 km/h) without sudden erratic spikes
                        this.vLong = Math.min(this.vLong + 4.5, this.topSpeedMs * 1.04);
                        this.nitro = Math.min(100, this.nitro + 25); // +25% nitro recharge
                        this.justHitBoostPad = true;
                    }
                }
            }
        }
    }

    processInputs(dt) {
        const speedKmh = Math.abs(this.vLong * 3.6);

        // Speed-dependent steering limit with high-speed aerodynamic stabilization:
        // Tighter, precision racing envelope scaled by player's sensitivity preference
        const speedFactor = 1.0 / (1.0 + Math.pow(speedKmh / 85.0, 1.3));
        const sens = this.steeringSensitivity || 1.0;
        const maxSteer = THREE.MathUtils.lerp(0.13, 0.29, speedFactor) * sens;

        const rawSteerInput = (this.input.left - this.input.right); // positive = left turn
        const targetSteer = rawSteerInput * maxSteer;

        // Fast, crisp steering transition rate with snappy self-centering
        const isCounterSteer = (this.vLat * rawSteerInput < -0.1);
        const steerSpeed = (rawSteerInput === 0 ? 17.0 : (isCounterSteer ? 22.0 : 14.0)) * THREE.MathUtils.clamp(sens, 0.8, 1.4);
        this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, steerSpeed * dt);

        // Spacebar = BOOST (Nitro). Spacebar NEVER activates brakes or handbrake!
        const wantsBoost = Boolean(this.input.nitro && this.nitro > 2);
        this.isNitro = wantsBoost;
        if (this.isNitro) {
            this.nitro = Math.max(0, this.nitro - 28 * dt);
        } else {
            // Recharge boost naturally over time, faster during cornering
            const rechargeRate = this.isDrifting ? 20.0 : 8.0;
            this.nitro = Math.min(100, this.nitro + rechargeRate * dt);
        }

        // Handbrake is permanently disabled from Spacebar
        this.isHandbrake = false;
    }

    computePhysicsForces(dt, roadInfo) {
        const speedKmh = this.vLong * 3.6;
        const absSpeed = Math.abs(this.vLong);
        const g = 9.81;

        // 1. Dynamic Normal Loads & Weight Transfer
        const staticLoadFront = (this.rearAxleDist / this.wheelbase) * this.mass * g;
        const staticLoadRear = (this.frontAxleDist / this.wheelbase) * this.mass * g;

        // Downforce increases normal force quadratically with speed
        const downforceCoeff = this.isApex ? 1.8 : 1.4;
        const downforce = 0.5 * downforceCoeff * (this.vLong * this.vLong);

        // Pitch weight transfer (braking transfers weight to front, accelerating to rear)
        const accelEst = (this.input.forward - (this.input.backward * 1.5)) * 8.0;
        const deltaWeight = (this.mass * accelEst * 0.35) / this.wheelbase;

        const fzFront = Math.max(1000, staticLoadFront - deltaWeight + downforce * 0.45);
        const fzRear = Math.max(1000, staticLoadRear + deltaWeight + downforce * 0.55);

        // 2. Longitudinal Forces (Drive, Braking, Drag, Rolling Resistance)
        let fDrive = 0;
        let fBrake = 0;

        // Engine drive force & Spacebar Boost (W key only, or nitro)
        const boostActive = this.isNitro && this.nitro > 0;
        if (this.input.forward > 0 || boostActive) {
            if (this.vLong < -0.4) {
                // Moving in reverse: W acts as strong service brake to quickly stop backward motion
                fBrake = (this.input.forward || 1.0) * this.brakeForce;
            } else {
                // Forward drive
                const nitroMult = boostActive ? 2.15 : 1.0;
                const topSpeed = this.topSpeedMs * (boostActive ? 1.35 : 1.0);
                const speedRatio = THREE.MathUtils.clamp(Math.max(0, this.vLong) / topSpeed, 0, 1);
                // High torque in low/mid gear, tapering smoothly near top speed
                const torqueCurve = Math.max(0.20, 1.0 - Math.pow(speedRatio, 1.4));
                const throttle = THREE.MathUtils.clamp(this.input.forward + (boostActive ? 1.0 : 0.0), 0, 1);
                fDrive = throttle * this.enginePower * nitroMult * torqueCurve;
            }
        }

        // Foot brake & Reverse (S key only)
        if (this.input.backward > 0) {
            if (this.vLong > 0.4) {
                // Moving forward: Apply service brake
                fBrake = this.input.backward * this.brakeForce;
            } else {
                // Stationary or in reverse: Strong, responsive Reverse gear
                const maxReverse = 15.0; // ~54 km/h reverse
                if (this.vLong > -maxReverse) {
                    fDrive = -this.input.backward * (this.enginePower * 0.95);
                }
            }
        }

        // Aerodynamic Drag & Rolling resistance
        const cd = this.isApex ? 0.32 : 0.38;
        const fDrag = 0.5 * 1.225 * cd * 2.2 * (this.vLong * absSpeed);
        const fRoll = 0.015 * this.mass * g * Math.sign(this.vLong);

        // Net longitudinal force
        const totalBrake = fBrake;
        const fLong = fDrive - (totalBrake * Math.sign(this.vLong || 1)) - fDrag - fRoll;

        // 3. Lateral Tire Slip Angles (Bicycle Model) - handles both forward and reverse
        const isReversing = this.vLong < -0.2;
        const forwardSign = isReversing ? -1 : 1;
        const denomSpeed = Math.max(1.2, absSpeed);
        const alphaFront = Math.atan2(this.vLat + (this.frontAxleDist * this.yawRate * forwardSign), denomSpeed) - (this.steerAngle * forwardSign);
        const alphaRear = Math.atan2(this.vLat - (this.rearAxleDist * this.yawRate * forwardSign), denomSpeed);

        // 4. Friction Limits
        let muFront = this.baseGripFront;
        let muRear = this.baseGripRear;

        // Off-road / Kerb grip modifier
        if (roadInfo.isOffroad) {
            muFront *= 0.65;
            muRear *= 0.65;
        } else if (roadInfo.isKerb) {
            muFront *= 0.92;
            muRear *= 0.92;
        }

        // Lateral forces using smooth saturation curve (simplified Pacejka)
        const maxLatFront = muFront * fzFront;
        const maxLatRear = muRear * fzRear;

        const fLatFront = -THREE.MathUtils.clamp(this.corneringStiffnessFront * alphaFront, -maxLatFront, maxLatFront);
        const fLatRear = -THREE.MathUtils.clamp(this.corneringStiffnessRear * alphaRear, -maxLatRear, maxLatRear);

        // 5. Yaw Torque & Angular Acceleration
        const yawTorque = (this.frontAxleDist * fLatFront * Math.cos(this.steerAngle)) - (this.rearAxleDist * fLatRear);
        const yawDamping = -this.yawRate * (680 + absSpeed * 32);

        const yawAccel = (yawTorque + yawDamping) / this.inertia;

        // Natural gravity forces on banked & sloped road
        const gLong = -g * (roadInfo.tangent ? roadInfo.tangent.y : 0);
        const gLat = -g * (roadInfo.binormal ? roadInfo.binormal.y : 0);

        // Lateral and longitudinal accelerations
        const aLat = ((fLatFront * Math.cos(this.steerAngle)) + fLatRear) / this.mass - (this.yawRate * this.vLong) + gLat;
        const aLong = fLong / this.mass + (this.yawRate * this.vLat) + gLong;

        // 6. Integrate Local Velocities & Agile Yaw Assist
        this.vLong += aLong * dt;
        this.vLat += aLat * dt;

        // Direct low-speed kinematic turning authority:
        // Controlled, subtle pivoting without over-rotating
        const rawSteerInput = (this.input.left - this.input.right);
        if (absSpeed < 12.0 && Math.abs(rawSteerInput) > 0.05) {
            const lowSpeedPivot = rawSteerInput * (0.65 * (1.0 - absSpeed / 12.0) + (absSpeed / 12.0) * 0.45);
            this.yawRate = THREE.MathUtils.lerp(this.yawRate, lowSpeedPivot, 0.16);
        } else {
            this.yawRate += yawAccel * dt;
        }

        // Low-speed damping to bring stationary car to a crisp rest without vibrating (preserve yaw if player is steering)
        if (absSpeed < 0.35 && this.input.forward === 0 && this.input.backward === 0) {
            this.vLong *= Math.pow(0.5, dt * 30);
            this.vLat *= Math.pow(0.5, dt * 30);
            if (rawSteerInput === 0) {
                this.yawRate *= Math.pow(0.5, dt * 30);
            }
        }

        // Detect Physical Drift State (only active when traveling forward at racing speeds)
        if (this.vLong > 5.5) {
            this.driftAngle = Math.atan2(this.vLat, this.vLong);
            const isSlipping = Math.abs(this.driftAngle) > 0.14;
            this.isDrifting = isSlipping;
            if (this.isDrifting) {
                this.driftScore += Math.abs(this.driftAngle) * (absSpeed * 3.6) * dt * 3.0;
            }
        } else {
            this.isDrifting = false;
            this.driftAngle = 0;
        }
    }

    integrateMovement(dt, track, roadInfo) {
        // Integrate heading angle in the road surface tangent plane
        this.carHeadingAngle += this.yawRate * dt;

        // Keep heading normalized
        while (this.carHeadingAngle > Math.PI) this.carHeadingAngle -= Math.PI * 2;
        while (this.carHeadingAngle < -Math.PI) this.carHeadingAngle += Math.PI * 2;

        // Compute forward and right unit vectors on the 3D road surface plane
        // roadInfo.tangent (T) = along track
        // roadInfo.binormal (B) = lateral across track
        // roadInfo.normal (N) = perpendicular to road surface
        const T = roadInfo.tangent;
        const B = roadInfo.binormal;
        const N = roadInfo.normal;

        const cosH = Math.cos(this.carHeadingAngle);
        const sinH = Math.sin(this.carHeadingAngle);

        // Car forward vector on road plane: T * cos(heading) - B * sin(heading)
        this._carForward.copy(T).multiplyScalar(cosH).addScaledVector(B, -sinH).normalize();

        // Car right vector on road plane: B * cos(heading) + T * sin(heading)
        this._carRight.copy(B).multiplyScalar(cosH).addScaledVector(T, sinH).normalize();

        this._carUp.copy(N).normalize();

        // World displacement vector from local road-plane velocity:
        // move = carForward * vLong + carRight * vLat
        const dx = (this._carForward.x * this.vLong + this._carRight.x * this.vLat) * dt;
        const dy = (this._carForward.y * this.vLong + this._carRight.y * this.vLat) * dt;
        const dz = (this._carForward.z * this.vLong + this._carRight.z * this.vLat) * dt;

        this.root.position.x += dx;
        this.root.position.y += dy;
        this.root.position.z += dz;
        this.distanceTraveled += Math.sqrt(dx * dx + dy * dy + dz * dz);

        // EXACT ROAD ATTACHMENT:
        // Query the updated exact road surface directly underneath the car's NEW position!
        const updatedRoad = track.getRoadSurfaceAt(this.root.position);
        const surfacePt = updatedRoad.surfacePoint;

        // Snap car flush to the updated road surface at the new position
        this.root.position.copy(surfacePt);

        return updatedRoad;
    }

    alignOrientationWithTrack(roadInfo) {
        // Construct complete 3D orthonormal basis:
        // X = carRight, Y = carUp (road normal), -Z = carForward
        this._rotMatrix.makeBasis(
            this._carRight,
            this._carUp,
            this._carForward.clone().negate()
        );

        this._carQuat.setFromRotationMatrix(this._rotMatrix);

        // Smoothly slerp root orientation so the car glides over banking and crests
        this.root.quaternion.slerp(this._carQuat, 0.45);
    }

    handleTrackBoundaries(roadInfo, track, dt = 1.0 / 60.0) {
        const d = roadInfo.signedLateralDist;
        const absD = Math.abs(d);
        const barrierDist = roadInfo.barrierDist || 10.4;
        const barrierLimit = barrierDist - 1.0; // Collision boundary cushion (~9.4m)
        const sign = Math.sign(d); // +1 = right wall (+B), -1 = left wall (-B)

        // 1. Near-boundary recovery assist:
        // If player is steering AWAY from the barrier, give crisp, responsive recovery steering torque
        // Right wall (sign > 0): steering away = turning LEFT (positive yawRate, input.left > 0)
        // Left wall (sign < 0): steering away = turning RIGHT (negative yawRate, input.right > 0)
        if (absD > barrierLimit - 1.5) {
            const isSteeringAway = (sign > 0 && (this.input.left > 0 || this.steerAngle > 0.04)) ||
                                   (sign < 0 && (this.input.right > 0 || this.steerAngle < -0.04));
            if (isSteeringAway) {
                // Controlled, gentle steering torque away from the wall toward track center
                this.yawRate += sign * 4.5 * dt;
                // Subtle lateral velocity assist pushing car back onto the racing line
                this.vLat += -sign * 3.0 * dt;
            }
        }

        // 2. Physical boundary collision deflection
        if (absD > barrierLimit) {
            const penetration = absD - barrierLimit;
            // Proportional collision severity (0.2 for light brush up to 1.0 for hard impact)
            const severity = THREE.MathUtils.clamp(penetration / 0.40, 0.20, 1.0);

            // Gravity effect on tilted / banked turns:
            // gLat = -9.81 * binormal.y
            // If sign * gLat > 0, gravity pulls the car into this barrier (lower wall on banked curve)
            const gLat = -9.81 * (roadInfo.binormal ? roadInfo.binormal.y : 0);
            const wallGravityPull = Math.max(0, sign * gLat);

            // Clear car position back onto the track just inside the boundary cushion
            const clearanceDist = penetration + 0.18;
            this.root.position.addScaledVector(roadInfo.binormal, -sign * clearanceDist);
            if (track) {
                const surfaceSnap = track.getRoadSurfaceAt(this.root.position);
                this.root.position.copy(surfaceSnap.surfacePoint);
            }

            // Controlled physical lateral deflection toward the track center (-sign direction)
            // Extra deflection velocity comfortably overcomes slope gravity on the lower wall
            const baseDeflect = 4.2 + (severity * 3.8) + (wallGravityPull * 0.90);

            // Apply deflection away from the wall
            if (this.vLat * sign > -0.5) {
                this.vLat = -sign * baseDeflect;
            } else {
                // Already moving away from wall: guarantee minimum escape velocity
                this.vLat = -sign * Math.max(Math.abs(this.vLat), baseDeflect * 0.75);
            }

            // Impact detection & Deceleration Penalty:
            // "make the car loose it seped by 30% if it hits wall"
            const isNewImpact = !this.inBarrierContact;
            this.inBarrierContact = true;

            if (isNewImpact) {
                this.justHitBarrier = true;
                this.impactSeverity = severity;
                if (this.vLong > 1.0) {
                    this.vLong *= 0.70; // Lose 30% of forward speed on wall hit!
                }
            } else if (this.vLong > 1.0) {
                // Continuous scraping friction along the wall
                const scrapeFriction = THREE.MathUtils.lerp(0.985, 0.965, severity);
                this.vLong *= Math.pow(scrapeFriction, dt * 60);
                if (this.input.forward > 0) {
                    this.vLong = Math.max(3.5, this.vLong);
                }
            }
            // If in reverse (vLong < 0) or braking (input.backward > 0), DO NOT clamp or alter forward momentum!
            // Reverse is completely uninhibited so the player can effortlessly back up and pull away.

            // Natural glance heading deflection:
            // Only rotate heading if the car's nose is currently pointing INTO the wall!
            // Right wall (sign = +1): pointed into wall when carHeadingAngle < 0.
            // Left wall (sign = -1): pointed into wall when carHeadingAngle > 0.
            if (sign * this.carHeadingAngle < 0) {
                // Subtle glance angle inward toward the circuit
                const targetHeading = sign * THREE.MathUtils.lerp(0.02, 0.07, severity);
                this.carHeadingAngle = THREE.MathUtils.lerp(this.carHeadingAngle, targetHeading, 0.20);
                this.yawRate = sign * THREE.MathUtils.lerp(0.5, 1.2, severity);
            }

            // Dampen front wheels ONLY if the player is turning deeper INTO the wall
            if (sign > 0 && this.steerAngle < -0.05 && this.input.left === 0) {
                this.steerAngle *= 0.3;
            } else if (sign < 0 && this.steerAngle > 0.05 && this.input.right === 0) {
                this.steerAngle *= 0.3;
            }
        } else {
            this.inBarrierContact = false;
        }
    }

    handleObstacleCollisions(track, dt = 1.0 / 60.0) {
        this.justHitObstacle = false;
        if (!track || !track.kineticObstacles || track.kineticObstacles.length === 0) return;

        const carPos = this.root.position;
        const carRadius = 1.85;

        for (const obs of track.kineticObstacles) {
            const obsPos = obs.position;
            const dist = carPos.distanceTo(obsPos);
            const minDist = obs.radius + carRadius;

            if (dist < minDist && (!obs.hitCooldown || obs.hitCooldown <= 0)) {
                obs.hitCooldown = 0.9; // Prevent multiple collisions in consecutive frames
                this.justHitObstacle = true;

                // Compute horizontal push vector away from obstacle center
                const pushDir = carPos.clone().sub(obsPos);
                pushDir.y = 0;
                if (pushDir.lengthSq() < 0.001) {
                    pushDir.set(1, 0, 0);
                } else {
                    pushDir.normalize();
                }

                // Push car out of intersection boundary
                const penetration = minDist - dist;
                this.root.position.addScaledVector(pushDir, penetration + 0.25);
                if (track) {
                    const snap = track.getRoadSurfaceAt(this.root.position);
                    this.root.position.copy(snap.surfacePoint);
                }

                // Calculate impulse projection relative to car orientation
                const dotRight = pushDir.dot(this._carRight);

                // Elastic collision impulse
                const impulse = Math.max(10.0, Math.abs(this.vLong) * 0.45);
                this.vLat += (dotRight >= 0 ? 1 : -1) * impulse;

                // Kinetic impact deceleration penalty (-35%)
                if (this.vLong > 2.0) {
                    this.vLong *= 0.65;
                }

                // Spin torque reaction
                this.yawRate += (dotRight >= 0 ? 1.8 : -1.8);

                // Visual flash on obstacle ring
                if (obs.ring && obs.ring.material) {
                    obs.ring.material.emissive.setHex(0xffffff);
                    obs.ring.material.emissiveIntensity = 5.0;
                    setTimeout(() => {
                        if (obs.ring && obs.ring.material) {
                            obs.ring.material.emissive.setHex(0xff4400);
                            obs.ring.material.emissiveIntensity = 2.4;
                        }
                    }, 240);
                }

                this.impactSeverity = 0.85;
                break;
            }
        }
    }

    updateVisuals(dt) {
        // Dynamic suspension weight transfer on the visual chassis:
        // Lateral body lean during cornering
        const lateralG = (this.vLat * 0.15 + this.yawRate * (this.vLong * 0.08)) / 9.81;
        const targetRoll = -THREE.MathUtils.clamp(lateralG * 0.28, -0.16, 0.16);
        this.chassisRoll += (targetRoll - this.chassisRoll) * 12 * dt;

        // Pitch squat under acceleration and dive under braking
        let targetPitch = 0;
        if (this.input.forward > 0) targetPitch = -0.035; // squat
        if (this.input.backward > 0 || this.isHandbrake) targetPitch = 0.055; // dive
        this.chassisPitch += (targetPitch - this.chassisPitch) * 10 * dt;

        if (this.chassis) {
            this.chassis.rotation.z = this.chassisRoll;
            this.chassis.rotation.x = this.chassisPitch;
        }

        // Steer front wheels smoothly
        if (this.wheels) {
            if (this.wheels.steerLeft) this.wheels.steerLeft.rotation.y = this.steerAngle;
            if (this.wheels.steerRight) this.wheels.steerRight.rotation.y = this.steerAngle;

            // Rotate wheels according to forward road travel
            const wheelCircumference = Math.PI * 0.76;
            const rotDelta = (this.vLong * dt) / wheelCircumference * (Math.PI * 2);
            this.wheelSpin += rotDelta;

            if (this.wheels.frontLeft) this.wheels.frontLeft.rotation.x = this.wheelSpin;
            if (this.wheels.frontRight) this.wheels.frontRight.rotation.x = this.wheelSpin;
            if (this.wheels.rearLeft) this.wheels.rearLeft.rotation.x = this.wheelSpin;
            if (this.wheels.rearRight) this.wheels.rearRight.rotation.x = this.wheelSpin;
        }

        // Active aero wing (Apex Phantom)
        if (this.animated && this.animated.activeWing) {
            const isHardBraking = (this.input.backward > 0 || this.isHandbrake) && this.vLong > 15;
            const targetWingAngle = isHardBraking ? -0.44 : -0.06;
            const targetWingY = isHardBraking ? 0.98 : 0.80;
            this.animated.activeWing.rotation.x += (targetWingAngle - this.animated.activeWing.rotation.x) * 15 * dt;
            this.animated.activeWing.position.y += (targetWingY - this.animated.activeWing.position.y) * 15 * dt;
        }

        // Exhaust backfire & nitro flames
        if (this.animated && this.animated.flames) {
            const flameIntensity = this.isNitro ? (0.85 + Math.random() * 0.35) : 0.0;
            this.animated.flames.forEach(flame => {
                flame.material.opacity = flameIntensity;
                if (flameIntensity > 0) {
                    flame.scale.set(1 + Math.random() * 0.3, 1 + Math.random() * 0.5, 1);
                }
            });
        }

        // Engine RPM & Gear calculation
        this.updateGearAndRPM();
    }

    updateGearAndRPM() {
        const speedKmh = Math.abs(this.vLong * 3.6);
        const gearThresholds = [0, 48, 95, 145, 195, 240, 320];

        let g = 1;
        for (let i = 1; i < gearThresholds.length; i++) {
            if (speedKmh > gearThresholds[i]) g = i + 1;
        }
        this.gear = Math.min(6, g);

        const minGearSpeed = gearThresholds[this.gear - 1];
        const maxGearSpeed = gearThresholds[this.gear] || 320;
        const gearProgress = (speedKmh - minGearSpeed) / (maxGearSpeed - minGearSpeed);

        this.rpm = 1200 + Math.min(1.0, Math.max(0, gearProgress)) * 7200;
    }

    updateLapProgress(roadInfo, dt) {
        this.currentLapTime += dt;
        const progress = roadInfo.progress;

        // Detect forward finish line crossing (progress rolls from ~0.95 to ~0.05)
        if (this.lastProgress > 0.85 && progress < 0.15) {
            if (this.currentLapTime > 12) { // Debounce
                this.lapTimes.push(this.currentLapTime);
                if (this.currentLapTime < this.bestLapTime) {
                    this.bestLapTime = this.currentLapTime;
                }
                this.currentLap++;
                this.currentLapTime = 0;
            }
        }

        this.lastProgress = progress;
        this.checkpointProgress = progress;
    }

    getSpeedKmh() {
        return Math.round(Math.abs(this.vLong * 3.6));
    }

    // Alias for legacy compatibility
    get speed() {
        return this.vLong;
    }
    set speed(val) {
        this.vLong = val;
    }

    get heading() {
        return this.carHeadingAngle;
    }
    set heading(val) {
        this.carHeadingAngle = val;
    }
}
