import * as THREE from 'three';

export class GameRenderer {
    constructor(canvasContainer) {
        this.container = canvasContainer || document.getElementById('gameCanvasContainer') || document.body;

        // Scene & Atmosphere (High visibility twilight)
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x061124);
        this.scene.fog = new THREE.FogExp2(0x09152a, 0.00075);

        // Cinematic Follow Camera
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
        this.renderer.toneMappingExposure = 1.22;
        this.container.appendChild(this.renderer.domElement);

        // Atmosphere & Sky Dome
        this.setupAtmosphere();

        // Lights
        this.setupLights();

        // Skid marks system
        this.setupSkidmarkSystem();

        // Spark particles system for barrier scrapes
        this.setupSparkSystem();

        // Tire smoke particle system for authentic drifting
        this.setupTireSmokeSystem();

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

    setupAtmosphere() {
        this.skyGroup = new THREE.Group();
        this.skyGroup.name = "celestialAtmosphere";

        // 1. Inverted celestial sphere dome with smooth night twilight gradient
        const skyGeo = new THREE.SphereGeometry(1800, 32, 24);
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 512;
        skyCanvas.height = 1024;
        const sctx = skyCanvas.getContext('2d');

        const grad = sctx.createLinearGradient(0, 0, 0, 1024);
        grad.addColorStop(0.00, '#020108'); // Cosmic deep zenith
        grad.addColorStop(0.32, '#090518'); // Deep synthwave purple
        grad.addColorStop(0.58, '#140c2e'); // Neon twilight atmospheric shelf
        grad.addColorStop(0.78, '#172244'); // Horizon indigo haze
        grad.addColorStop(0.91, '#093256'); // Luminous cyan horizon glow
        grad.addColorStop(0.97, '#081729'); // Ground level atmospheric rim
        grad.addColorStop(1.00, '#050c18'); // Sub-surface nadir
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 512, 1024);

        const skyTexture = new THREE.CanvasTexture(skyCanvas);
        const skyMat = new THREE.MeshBasicMaterial({
            map: skyTexture,
            side: THREE.BackSide,
            depthWrite: false
        });
        const skyDome = new THREE.Mesh(skyGeo, skyMat);
        this.skyGroup.add(skyDome);

        // 2. Cosmic Starfield Particles in upper atmosphere
        const starCount = 1200;
        const starGeo = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const u = Math.random();
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - u * 0.88); // Concentrate towards upper sky
            const r = 1750;

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = Math.max(140, r * Math.cos(phi));
            const z = r * Math.sin(phi) * Math.sin(theta);

            starPositions[i * 3] = x;
            starPositions[i * 3 + 1] = y;
            starPositions[i * 3 + 2] = z;

            // Star tint: crisp white, diamond cyan, warm gold, cosmic magenta
            const colorChoice = Math.random();
            if (colorChoice > 0.8) {
                starColors[i * 3] = 0.45; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 1.0; // Cyan
            } else if (colorChoice > 0.65) {
                starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 0.6; // Gold
            } else if (colorChoice > 0.5) {
                starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.55; starColors[i * 3 + 2] = 1.0; // Violet
            } else {
                starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.98; starColors[i * 3 + 2] = 1.0; // White
            }
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 2.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.90,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const starfield = new THREE.Points(starGeo, starMat);
        this.skyGroup.add(starfield);

        // 3. Cyber Moon / Giant Synthwave Celestial Orb
        const moonGroup = new THREE.Group();
        moonGroup.position.set(480, 260, -1200);

        // Outer radial halo glow
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = 256;
        glowCanvas.height = 256;
        const gctx = glowCanvas.getContext('2d');
        const radGrad = gctx.createRadialGradient(128, 128, 15, 128, 128, 128);
        radGrad.addColorStop(0.0, 'rgba(0, 240, 255, 0.95)');
        radGrad.addColorStop(0.25, 'rgba(60, 140, 255, 0.65)');
        radGrad.addColorStop(0.55, 'rgba(180, 50, 255, 0.30)');
        radGrad.addColorStop(0.85, 'rgba(255, 0, 128, 0.10)');
        radGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        gctx.fillStyle = radGrad;
        gctx.fillRect(0, 0, 256, 256);

        const haloTexture = new THREE.CanvasTexture(glowCanvas);
        const haloMat = new THREE.MeshBasicMaterial({
            map: haloTexture,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), haloMat);
        moonGroup.add(haloMesh);

        // Inner glowing core disc
        const moonDiscMat = new THREE.MeshBasicMaterial({
            color: 0xd6f7ff,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(75, 32), moonDiscMat);
        moonDisc.position.z = 1;
        moonGroup.add(moonDisc);

        moonGroup.lookAt(0, 50, 0);
        this.skyGroup.add(moonGroup);

        this.scene.add(this.skyGroup);
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

        // Studio Showroom Spotlight directly overhead
        const showroomSpot = new THREE.SpotLight(0x00f0ff, 3.5, 25, Math.PI / 3, 0.5, 1.0);
        showroomSpot.position.set(0, 8, 2);
        showroomSpot.target.position.set(0, 1.3, 0);
        this.scene.add(showroomSpot);
        this.scene.add(showroomSpot.target);

        // Warm rim light from the rear left to highlight body curves
        const rimLight = new THREE.DirectionalLight(0xff0077, 1.8);
        rimLight.position.set(-6, 4, -6);
        this.scene.add(rimLight);
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

    setupTireSmokeSystem() {
        this.maxSmoke = 160;
        this.smokeGeo = new THREE.BufferGeometry();
        this.smokePositions = new Float32Array(this.maxSmoke * 3);
        this.smokeVelocities = [];
        this.smokeLives = new Float32Array(this.maxSmoke);

        for (let i = 0; i < this.maxSmoke; i++) {
            this.smokePositions[i * 3] = 0;
            this.smokePositions[i * 3 + 1] = -9999;
            this.smokePositions[i * 3 + 2] = 0;
            this.smokeVelocities.push(new THREE.Vector3());
            this.smokeLives[i] = 0;
        }

        this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
        this.smokeMat = new THREE.PointsMaterial({
            color: 0xdddddd,
            size: 1.1,
            transparent: true,
            opacity: 0.30,
            depthWrite: false
        });

        this.smokePoints = new THREE.Points(this.smokeGeo, this.smokeMat);
        this.scene.add(this.smokePoints);
    }

    emitTireSmoke(pos, count = 2) {
        if (!this.smokeVelocities) return;
        let spawned = 0;
        for (let i = 0; i < this.maxSmoke && spawned < count; i++) {
            if (this.smokeLives[i] <= 0) {
                this.smokeLives[i] = 0.45 + Math.random() * 0.3;
                const idx = i * 3;
                this.smokePositions[idx] = pos.x + (Math.random() - 0.5) * 0.35;
                this.smokePositions[idx + 1] = pos.y + 0.12 + Math.random() * 0.1;
                this.smokePositions[idx + 2] = pos.z + (Math.random() - 0.5) * 0.35;

                const v = this.smokeVelocities[i];
                v.set(
                    (Math.random() - 0.5) * 1.5,
                    Math.random() * 1.0 + 0.6,
                    (Math.random() - 0.5) * 1.5
                );
                spawned++;
            }
        }
        this.smokeGeo.attributes.position.needsUpdate = true;
    }

    updateTireSmoke(dt) {
        if (!this.smokeVelocities) return;
        let hasActive = false;
        for (let i = 0; i < this.maxSmoke; i++) {
            if (this.smokeLives[i] > 0) {
                this.smokeLives[i] -= dt;
                const idx = i * 3;
                const v = this.smokeVelocities[i];

                this.smokePositions[idx] += v.x * dt;
                this.smokePositions[idx + 1] += v.y * dt;
                this.smokePositions[idx + 2] += v.z * dt;
                hasActive = true;

                if (this.smokeLives[i] <= 0) {
                    this.smokePositions[idx + 1] = -9999;
                }
            }
        }
        if (hasActive) {
            this.smokeGeo.attributes.position.needsUpdate = true;
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

        // Update active particles (sparks & tire smoke)
        this.updateSparks(dt);
        this.updateTireSmoke(dt);

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

        // Keep atmospheric sky dome centered around camera
        if (this.skyGroup) {
            this.skyGroup.position.x = this.camera.position.x;
            this.skyGroup.position.z = this.camera.position.z;
        }

        // Skidmarks & Tire Smoke
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

            this.emitTireSmoke(rlPos, 1);
            this.emitTireSmoke(rrPos, 1);
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
