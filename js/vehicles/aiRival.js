import * as THREE from 'three';
import { VehiclePhysics } from './vehiclePhysics.js';

export class AIRival {
    constructor(carObject, track, slotIndex = 1, config = {}) {
        this.car = carObject;
        this.track = track;
        this.physics = new VehiclePhysics(carObject, config);
        this.slotIndex = slotIndex;

        // AI personality attributes
        this.skill = config.skill || (0.75 + Math.random() * 0.2); // 0.75 - 0.95
        this.laneOffset = (slotIndex % 2 === 0 ? 1 : -1) * (2.5 + Math.random() * 2.0); // racing lane
        this.targetSpeedKmh = 190 * this.skill;

        // Position car at starting grid
        const spawn = this.track.getSpawnTransform(slotIndex);
        this.physics.root.position.copy(spawn.position);
        this.physics.heading = spawn.heading;
        this.physics.root.rotation.y = spawn.heading;
    }

    update(dt) {
        if (!this.track) return;

        const currentPos = this.physics.root.position;
        const trackInfo = this.track.getNearestTrackInfo(currentPos);

        // Look-ahead target on the track spline
        const lookAheadDistance = 28 + (this.physics.speed * 0.4);
        const lookAheadIdx = Math.floor(trackInfo.index + (lookAheadDistance / 5)) % this.track.samplesCount;
        const targetSplinePt = this.track.trackPoints[lookAheadIdx];
        const targetBinormal = this.track.trackBinormals[lookAheadIdx];

        // Apply preferred lane offset
        const targetPos = targetSplinePt.clone().addScaledVector(targetBinormal, this.laneOffset);

        // Compute desired world heading towards target position
        const toTarget = targetPos.clone().sub(currentPos);
        const desiredHeading = Math.atan2(-toTarget.x, -toTarget.z);

        // Compute true world heading of the car
        const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.physics.root.quaternion);
        const currentWorldHeading = Math.atan2(-carForward.x, -carForward.z);

        let angleDiff = desiredHeading - currentWorldHeading;
        // Normalize angle diff to -PI .. PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Smooth analogue AI steering
        this.physics.input.left = THREE.MathUtils.clamp(angleDiff * 3.0, 0, 1);
        this.physics.input.right = THREE.MathUtils.clamp(-angleDiff * 3.0, 0, 1);

        // AI Throttle & Brake based on corner sharpness
        const cornerSharpness = Math.abs(angleDiff);
        const speedKmh = this.physics.getSpeedKmh();

        if (cornerSharpness > 0.38 && speedKmh > 115) {
            // Hard corner: brake & initiate drift
            this.physics.input.forward = 0;
            this.physics.input.backward = 1;
            this.physics.input.handbrake = (cornerSharpness > 0.55);
            this.physics.input.nitro = false;
        } else {
            // Straight or gentle curve
            this.physics.input.forward = (speedKmh < this.targetSpeedKmh) ? 1 : 0.4;
            this.physics.input.backward = 0;
            this.physics.input.handbrake = false;

            // Use nitro on long straights
            this.physics.input.nitro = (cornerSharpness < 0.10 && this.physics.nitro > 35 && speedKmh > 110);
        }

        // Run vehicle physics simulation
        this.physics.update(dt, this.track);
    }
}
