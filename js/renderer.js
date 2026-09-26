import * as THREE from 'three';

export class GameRenderer {
    constructor(canvasContainer) {
        this.container = canvasContainer;

        // Scene & Atmosphere (High visibility twilight)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c1426);
        this.scene.fog = new THREE.FogExp2(0x0c1426, 0.0009);

        // Camera 1 (Player 1 / Single Player)
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(65, aspect, 0.2, 2500);

        // Camera 2 (Player 2 for Local Split-Screen)
        this.camera2 = new THREE.PerspectiveCamera(65, (window.innerWidth / 2) / window.innerHeight, 0.2, 2500);
        this.isSplitScreen = false;

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        this.setupLights();

        // Skid marks system
        this.setupSkidmarkSystem();

        // Spark particles system for barrier scrapes
        this.setupSparkSystem();

        // Camera chase parameters
        this.cameraOffset = new THREE.Vector3(0, 3.4, 7.8);
        this.cameraLookOffset = new THREE.Vector3(0, 1.3, 5.0);
        this.baseFov = 65;
        this.currentFov = 65;
        this.currentFov2 = 65;
        this.cameraShake = 0;
        this.currentCameraRoll = 0;
        this.currentCamera2Roll = 0;

        // Window resize
        window.addEventListener('resize', () => this.onResize());
    }

    setupLights() {
        // Ambient Sky & Ground bounce (High visibility)
        const hemiLight = new THREE.HemisphereLight(0x7a99cc, 0x141a29, 1.5);
        this.scene.add(hemiLight);

        // Key directional stadium / moon light
        this.dirLight = new THREE.DirectionalLight(0xddeeff, 2.0);
        this.dirLight.position.set(150, 260, 100);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 650;
        const d = 130;
        this.dirLight.shadow.camera.left = -d;
        this.dirLight.shadow.camera.right = d;
        this.dirLight.shadow.camera.top = d;
        this.dirLight.shadow.camera.bottom = -d;
        this.dirLight.shadow.bias = -0.0004;
        this.scene.add(this.dirLight);

        // Camera fill light to highlight car paint curves and carbon fiber
        this.cameraLight = new THREE.DirectionalLight(0xffffff, 0.9);
        this.cameraLight.position.set(0, 4, 8);
        this.camera.add(this.cameraLight);
        this.scene.add(this.camera);

        // Player 2 Camera fill light
        this.camera2Light = new THREE.DirectionalLight(0xffffff, 0.9);
        this.camera2Light.position.set(0, 4, 8);
        this.camera2.add(this.camera2Light);
        this.scene.add(this.camera2);
    }

    setupSkidmarkSystem() {
        this.maxSkidPoints = 1200;
        this.skidGeo = new THREE.BufferGeometry();
        this.skidPositions = new Float32Array(this.maxSkidPoints * 3);
        this.skidAlphas = new Float32Array(this.maxSkidPoints);
        this.skidIndex = 0;

        this.skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
        this.skidMat = new THREE.LineBasicMaterial({
            color: 0x111111,
            linewidth: 3,
            transparent: true,
            opacity: 0.75
        });

        this.skidGeo.setDrawRange(0, 0);
        this.skidLine = new THREE.LineSegments(this.skidGeo, this.skidMat);
        this.scene.add(this.skidLine);
    }

    addSkidMark(p1, p2) {
        if (this.skidIndex >= this.maxSkidPoints - 6) {
            this.skidIndex = 0; // ring buffer
        }

        const pos = this.skidPositions;
        const i = this.skidIndex;

        pos[i] = p1.x; pos[i + 1] = p1.y + 0.04; pos[i + 2] = p1.z;
        pos[i + 3] = p2.x; pos[i + 4] = p2.y + 0.04; pos[i + 5] = p2.z;

        this.skidIndex += 6;
        this.skidCount = Math.min(this.maxSkidPoints, (this.skidCount || 0) + 2);
        this.skidGeo.setDrawRange(0, this.skidCount);
        this.skidGeo.attributes.position.needsUpdate = true;
    }

    setupSparkSystem() {
        this.maxSparks = 200;
        this.sparkGeo = new THREE.BufferGeometry();
        this.sparkPositions = new Float32Array(this.maxSparks * 3);
        this.sparkVelocities = [];
        this.sparkLives = new Float32Array(this.maxSparks);

        for (let i = 0; i < this.maxSparks; i++) {
            this.sparkPositions[i * 3] = 0;
            this.sparkPositions[i * 3 + 1] = -9999;
            this.sparkPositions[i * 3 + 2] = 0;
            this.sparkVelocities.push(new THREE.Vector3());
            this.sparkLives[i] = 0;
        }

        this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
        this.sparkMat = new THREE.PointsMaterial({
            color: 0xffb733,
            size: 0.35,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        this.sparkPoints = new THREE.Points(this.sparkGeo, this.sparkMat);
        this.scene.add(this.sparkPoints);
    }

    emitSparks(pos, count = 10, dir = null) {
        if (!this.sparkVelocities) return;
        let spawned = 0;
        for (let i = 0; i < this.maxSparks && spawned < count; i++) {
            if (this.sparkLives[i] <= 0) {
                this.sparkLives[i] = 0.25 + Math.random() * 0.22;
                const idx = i * 3;
                this.sparkPositions[idx] = pos.x + (Math.random() - 0.5) * 0.3;
                this.sparkPositions[idx + 1] = pos.y + 0.15 + Math.random() * 0.25;
                this.sparkPositions[idx + 2] = pos.z + (Math.random() - 0.5) * 0.3;

                const v = this.sparkVelocities[i];
                if (dir) {
                    v.copy(dir).multiplyScalar(5 + Math.random() * 7);
                    v.x += (Math.random() - 0.5) * 5;
                    v.y += Math.random() * 4 + 1.5;
                    v.z += (Math.random() - 0.5) * 5;
                } else {
                    v.set(
                        (Math.random() - 0.5) * 10,
                        Math.random() * 5 + 2,
                        (Math.random() - 0.5) * 10
                    );
                }
                spawned++;
            }
        }
        this.sparkGeo.attributes.position.needsUpdate = true;
    }

    updateSparks(dt) {
        if (!this.sparkVelocities) return;
        let hasActive = false;
        for (let i = 0; i < this.maxSparks; i++) {
            if (this.sparkLives[i] > 0) {
                this.sparkLives[i] -= dt;
                const idx = i * 3;
                const v = this.sparkVelocities[i];
                v.y -= 16.0 * dt; // gravity

                this.sparkPositions[idx] += v.x * dt;
                this.sparkPositions[idx + 1] += v.y * dt;
                this.sparkPositions[idx + 2] += v.z * dt;
                hasActive = true;

                if (this.sparkLives[i] <= 0) {
                    this.sparkPositions[idx + 1] = -9999;
                }
            }
        }
        if (hasActive) {
            this.sparkGeo.attributes.position.needsUpdate = true;
        }
    }

    snapCamera(targetPhysics) {
        if (!targetPhysics) return;
        const carRoot = targetPhysics.root;
        const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(carRoot.quaternion).normalize();
        const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carRoot.quaternion).normalize();
        const idealCameraPos = carRoot.position.clone()
            .addScaledVector(carForward, -this.cameraOffset.z)
            .addScaledVector(carUp, this.cameraOffset.y);
        this.camera.position.copy(idealCameraPos);
        const lookTarget = carRoot.position.clone()
            .addScaledVector(carForward, this.cameraLookOffset.z)
            .addScaledVector(carUp, this.cameraLookOffset.y);
        this.camera.lookAt(lookTarget);
    }

    snapCamera2(targetPhysics) {
        if (!targetPhysics) return;
        const carRoot = targetPhysics.root;
        const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(carRoot.quaternion).normalize();
        const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carRoot.quaternion).normalize();
        const idealCameraPos = carRoot.position.clone()
            .addScaledVector(carForward, -this.cameraOffset.z)
            .addScaledVector(carUp, this.cameraOffset.y);
        this.camera2.position.copy(idealCameraPos);
        const lookTarget = carRoot.position.clone()
            .addScaledVector(carForward, this.cameraLookOffset.z)
            .addScaledVector(carUp, this.cameraLookOffset.y);
        this.camera2.lookAt(lookTarget);
    }

    updateCamera(targetPhysics, dt) {
        if (!targetPhysics) return;

        // Update active spark particles
        this.updateSparks(dt);

        const carRoot = targetPhysics.root;
        const speedKmh = targetPhysics.getSpeedKmh();

        // Dynamic FOV for warp speed sensation
        const targetFov = this.baseFov + (speedKmh / 240) * 16 + (targetPhysics.isNitro ? 10 : 0);
        this.currentFov += (targetFov - this.currentFov) * 8 * dt;
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();

        // 3D Orientation-aware camera follow
        const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(carRoot.quaternion).normalize();
        const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carRoot.quaternion).normalize();

        const idealCameraPos = carRoot.position.clone()
            .addScaledVector(carForward, -this.cameraOffset.z)
            .addScaledVector(carUp, this.cameraOffset.y);

        // Camera shake when drifting or nitro
        if (targetPhysics.isDrifting || targetPhysics.isNitro) {
            const intensity = targetPhysics.isNitro ? 0.12 : 0.06;
            idealCameraPos.x += (Math.random() - 0.5) * intensity;
            idealCameraPos.y += (Math.random() - 0.5) * intensity;
            idealCameraPos.z += (Math.random() - 0.5) * intensity;
        }

        const lerpRate = Math.min(1.0, 12 * dt);
        this.camera.position.lerp(idealCameraPos, lerpRate);

        const lookTarget = carRoot.position.clone()
            .addScaledVector(carForward, this.cameraLookOffset.z)
            .addScaledVector(carUp, this.cameraLookOffset.y);
        this.camera.lookAt(lookTarget);

        const targetRoll = -THREE.MathUtils.clamp(
            (targetPhysics.yawRate * 0.045 + targetPhysics.steerAngle * 0.035),
            -0.06, 0.06
        );
        this.currentCameraRoll += (targetRoll - this.currentCameraRoll) * 6.0 * dt;
        if (Math.abs(this.currentCameraRoll) > 0.0005) {
            this.camera.rotateZ(this.currentCameraRoll);
        }

        this.dirLight.position.x = carRoot.position.x + 100;
        this.dirLight.position.z = carRoot.position.z + 100;
        this.dirLight.target = carRoot;

        // Skidmarks
        if (targetPhysics.isDrifting && targetPhysics.wheels && speedKmh > 35) {
            const rlPos = new THREE.Vector3();
            targetPhysics.wheels.rearLeft.getWorldPosition(rlPos);
            const rrPos = new THREE.Vector3();
            targetPhysics.wheels.rearRight.getWorldPosition(rrPos);

            if (this.lastRlPos) {
                this.addSkidMark(this.lastRlPos, rlPos);
                this.addSkidMark(this.lastRrPos, rrPos);
            }
            this.lastRlPos = rlPos.clone();
            this.lastRrPos = rrPos.clone();
        } else {
            this.lastRlPos = null;
            this.lastRrPos = null;
        }
    }

    updateSplitCameras(p1Physics, p2Physics, dt) {
        // Update sparks
        this.updateSparks(dt);

        // --- Player 1 Camera (Left Viewport) ---
        if (p1Physics) {
            const car1 = p1Physics.root;
            const speed1 = p1Physics.getSpeedKmh();
            const targetFov1 = this.baseFov + (speed1 / 240) * 14 + (p1Physics.isNitro ? 10 : 0);
            this.currentFov += (targetFov1 - this.currentFov) * 8 * dt;
            this.camera.fov = this.currentFov;
            this.camera.updateProjectionMatrix();

            const fwd1 = new THREE.Vector3(0, 0, -1).applyQuaternion(car1.quaternion).normalize();
            const up1 = new THREE.Vector3(0, 1, 0).applyQuaternion(car1.quaternion).normalize();

            const idealPos1 = car1.position.clone()
                .addScaledVector(fwd1, -this.cameraOffset.z)
                .addScaledVector(up1, this.cameraOffset.y);

            if (p1Physics.isDrifting || p1Physics.isNitro) {
                const intens = p1Physics.isNitro ? 0.12 : 0.05;
                idealPos1.x += (Math.random() - 0.5) * intens;
                idealPos1.y += (Math.random() - 0.5) * intens;
            }

            this.camera.position.lerp(idealPos1, Math.min(1.0, 12 * dt));
            const look1 = car1.position.clone()
                .addScaledVector(fwd1, this.cameraLookOffset.z)
                .addScaledVector(up1, this.cameraLookOffset.y);
            this.camera.lookAt(look1);

            const roll1 = -THREE.MathUtils.clamp((p1Physics.yawRate * 0.045 + p1Physics.steerAngle * 0.035), -0.06, 0.06);
            this.currentCameraRoll += (roll1 - this.currentCameraRoll) * 6.0 * dt;
            if (Math.abs(this.currentCameraRoll) > 0.0005) {
                this.camera.rotateZ(this.currentCameraRoll);
            }
        }

        // --- Player 2 Camera (Right Viewport) ---
        if (p2Physics) {
            const car2 = p2Physics.root;
            const speed2 = p2Physics.getSpeedKmh();
            const targetFov2 = this.baseFov + (speed2 / 240) * 14 + (p2Physics.isNitro ? 10 : 0);
            this.currentFov2 += (targetFov2 - this.currentFov2) * 8 * dt;
            this.camera2.fov = this.currentFov2;
            this.camera2.updateProjectionMatrix();

            const fwd2 = new THREE.Vector3(0, 0, -1).applyQuaternion(car2.quaternion).normalize();
            const up2 = new THREE.Vector3(0, 1, 0).applyQuaternion(car2.quaternion).normalize();

            const idealPos2 = car2.position.clone()
                .addScaledVector(fwd2, -this.cameraOffset.z)
                .addScaledVector(up2, this.cameraOffset.y);

            if (p2Physics.isDrifting || p2Physics.isNitro) {
                const intens2 = p2Physics.isNitro ? 0.12 : 0.05;
                idealPos2.x += (Math.random() - 0.5) * intens2;
                idealPos2.y += (Math.random() - 0.5) * intens2;
            }

            this.camera2.position.lerp(idealPos2, Math.min(1.0, 12 * dt));
            const look2 = car2.position.clone()
                .addScaledVector(fwd2, this.cameraLookOffset.z)
                .addScaledVector(up2, this.cameraLookOffset.y);
            this.camera2.lookAt(look2);

            const roll2 = -THREE.MathUtils.clamp((p2Physics.yawRate * 0.045 + p2Physics.steerAngle * 0.035), -0.06, 0.06);
            this.currentCamera2Roll += (roll2 - this.currentCamera2Roll) * 6.0 * dt;
            if (Math.abs(this.currentCamera2Roll) > 0.0005) {
                this.camera2.rotateZ(this.currentCamera2Roll);
            }
        }

        // Center shadow frustum at midpoint between cars
        if (p1Physics && p2Physics) {
            this.dirLight.position.x = (p1Physics.root.position.x + p2Physics.root.position.x) * 0.5 + 100;
            this.dirLight.position.z = (p1Physics.root.position.z + p2Physics.root.position.z) * 0.5 + 100;
        }
    }

    render() {
        if (!this.isSplitScreen) {
            this.renderer.setScissorTest(false);
            this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            this.renderer.render(this.scene, this.camera);
        } else {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const halfW = Math.floor(width / 2);

            this.renderer.setScissorTest(true);

            // Left Screen: Player 1
            this.renderer.setViewport(0, 0, halfW, height);
            this.renderer.setScissor(0, 0, halfW, height);
            this.camera.aspect = halfW / height;
            this.camera.updateProjectionMatrix();
            this.renderer.render(this.scene, this.camera);

            // Right Screen: Player 2
            this.renderer.setViewport(halfW, 0, width - halfW, height);
            this.renderer.setScissor(halfW, 0, width - halfW, height);
            this.camera2.aspect = (width - halfW) / height;
            this.camera2.updateProjectionMatrix();
            this.renderer.render(this.scene, this.camera2);

            this.renderer.setScissorTest(false);
        }
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        if (!this.isSplitScreen) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        } else {
            const halfW = Math.floor(width / 2);
            this.camera.aspect = halfW / height;
            this.camera.updateProjectionMatrix();
            this.camera2.aspect = (width - halfW) / height;
            this.camera2.updateProjectionMatrix();
        }
        this.renderer.setSize(width, height);
    }
}
