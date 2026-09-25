import * as THREE from 'three';

export class GameRenderer {
    constructor(canvasContainer) {
        this.container = canvasContainer;

        // Scene & Atmosphere (High visibility twilight)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0c1426);
        this.scene.fog = new THREE.FogExp2(0x0c1426, 0.0009);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(65, aspect, 0.2, 2500);

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
        this.cameraShake = 0;
        this.currentCameraRoll = 0;

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

        // 3D Orientation-aware camera follow:
        // Get car's actual 3D forward and up vectors in world space
        const carForward = new THREE.Vector3(0, 0, -1).applyQuaternion(carRoot.quaternion).normalize();
        const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carRoot.quaternion).normalize();

        // Ideal position: behind the car along its forward vector, raised along its up vector
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

        // Smooth camera follow (lerp)
        const lerpRate = Math.min(1.0, 12 * dt);
        this.camera.position.lerp(idealCameraPos, lerpRate);

        // Look target ahead of the car along its forward vector
        const lookTarget = carRoot.position.clone()
            .addScaledVector(carForward, this.cameraLookOffset.z)
            .addScaledVector(carUp, this.cameraLookOffset.y);
        this.camera.lookAt(lookTarget);

        // Dynamic camera roll: subtle bank into corners (~3.5 deg max)
        const targetRoll = -THREE.MathUtils.clamp(
            (targetPhysics.yawRate * 0.045 + targetPhysics.steerAngle * 0.035),
            -0.06, 0.06
        );
        this.currentCameraRoll += (targetRoll - this.currentCameraRoll) * 6.0 * dt;
        if (Math.abs(this.currentCameraRoll) > 0.0005) {
            this.camera.rotateZ(this.currentCameraRoll);
        }

        // Keep directional shadow frustum centered around car
        this.dirLight.position.x = carRoot.position.x + 100;
        this.dirLight.position.z = carRoot.position.z + 100;
        this.dirLight.target = carRoot;

        // Add skidmarks if drifting
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

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}
