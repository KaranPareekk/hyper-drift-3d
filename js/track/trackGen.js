import * as THREE from 'three';

// Seeded PRNG (Mulberry32)
function createPRNG(seedStr) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
        h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    }
    return function() {
        h = Math.imul(h ^ (h >>> 15), h | 1);
        h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
        return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };
}

export class ProceduralTrack {
    constructor(seed = "RACE-1") {
        this.seed = seed;
        this.rng = createPRNG(seed.toString());
        this.roadWidth = 18;
        this.samplesCount = 600;

        this.curve = null;
        this.trackPoints = [];
        this.trackTangents = [];
        this.trackNormals = [];
        this.trackBinormals = [];
        this.elevations = [];

        this.roadMesh = null;
        this.kerbMesh = null;
        this.barrierMesh = null;
        this.gantryGroup = null;
        this.checkpointGates = [];
        this.boostPads = [];
        this.kineticObstacles = [];

        this.generateSpline();
    }

    generateSpline() {
        const numPoints = 16 + Math.floor(this.rng() * 6); // 16 to 22 control points
        const baseRadius = 260 + this.rng() * 80;
        const rawPoints = [];

        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            // Radial variation
            const rVariation = (this.rng() - 0.5) * 160;
            const r = Math.max(120, baseRadius + rVariation);

            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            // 3D Elevation changes (rolling hills and thrilling drops)
            const y = Math.sin(angle * 2 + this.rng() * 2) * 16 + 
                      Math.cos(angle * 3) * 10 + 
                      (this.rng() - 0.5) * 8;

            rawPoints.push(new THREE.Vector3(x, Math.max(1.5, y + 10), z));
        }

        // Smooth out points to avoid sharp kinks
        const smoothedPoints = [];
        for (let i = 0; i < rawPoints.length; i++) {
            const prev = rawPoints[(i - 1 + rawPoints.length) % rawPoints.length];
            const curr = rawPoints[i];
            const next = rawPoints[(i + 1) % rawPoints.length];

            const smX = prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25;
            const smY = prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25;
            const smZ = prev.z * 0.25 + curr.z * 0.5 + next.z * 0.25;
            smoothedPoints.push(new THREE.Vector3(smX, smY, smZ));
        }

        this.curve = new THREE.CatmullRomCurve3(smoothedPoints, true, 'centripetal', 0.5);

        // Pre-sample points along the spline
        this.trackPoints = [];
        this.trackTangents = [];
        this.trackBinormals = [];

        const worldUp = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < this.samplesCount; i++) {
            const u = i / this.samplesCount;
            const pt = this.curve.getPointAt(u);
            const tan = this.curve.getTangentAt(u).normalize();

            // Next tangent to estimate curvature for banking
            const uNext = ((i + 1) % this.samplesCount) / this.samplesCount;
            const tanNext = this.curve.getTangentAt(uNext).normalize();

            // Binormal = cross(tangent, worldUp)
            let binormal = new THREE.Vector3().crossVectors(tan, worldUp).normalize();
            if (binormal.lengthSq() < 0.001) {
                binormal.set(1, 0, 0);
            }

            // Normal = cross(binormal, tangent)
            let normal = new THREE.Vector3().crossVectors(binormal, tan).normalize();

            // Dynamic banking based on corner curvature
            const curveTurn = tan.x * tanNext.z - tan.z * tanNext.x;
            const bankAngle = THREE.MathUtils.clamp(curveTurn * 25.0, -0.22, 0.22);
            if (Math.abs(bankAngle) > 0.01) {
                binormal.applyAxisAngle(tan, bankAngle);
                normal.applyAxisAngle(tan, bankAngle);
            }

            this.trackPoints.push(pt);
            this.trackTangents.push(tan);
            this.trackNormals.push(normal);
            this.trackBinormals.push(binormal);
        }
    }

    buildMeshes(scene) {
        const root = new THREE.Group();
        root.name = "proceduralTrack";

        // 1. Road Surface Mesh (Asphalt + Racing Line)
        const roadGeo = new THREE.BufferGeometry();
        const roadPositions = [];
        const roadUvs = [];
        const roadIndices = [];

        // 2. Kerb Meshes (Red & White Rumble Strips)
        const kerbPositions = [];
        const kerbColors = [];
        const kerbIndices = [];

        // 3. Glowing Neon Barrier Guardrails
        const barrierPositions = [];
        const barrierColors = [];
        const barrierIndices = [];

        const halfWidth = this.roadWidth * 0.5;
        const kerbWidth = 1.4;
        const barrierHeight = 1.1;

        for (let i = 0; i <= this.samplesCount; i++) {
            const idx = i % this.samplesCount;
            const pt = this.trackPoints[idx];
            const binormal = this.trackBinormals[idx];
            const tangent = this.trackTangents[idx];

            // Road Left & Right edges
            const pLeft = pt.clone().addScaledVector(binormal, -halfWidth);
            const pRight = pt.clone().addScaledVector(binormal, halfWidth);

            roadPositions.push(pLeft.x, pLeft.y, pLeft.z);
            roadPositions.push(pRight.x, pRight.y, pRight.z);

            const vCoord = (i / this.samplesCount) * 80;
            roadUvs.push(0, vCoord);
            roadUvs.push(1, vCoord);

            if (i < this.samplesCount) {
                const base = i * 2;
                roadIndices.push(base, base + 1, base + 2);
                roadIndices.push(base + 1, base + 3, base + 2);
            }

            // Kerbs on inner/outer edges
            const kL_out = pLeft.clone().addScaledVector(binormal, -kerbWidth);
            const kR_out = pRight.clone().addScaledVector(binormal, kerbWidth);

            const kBase = i * 4;
            kerbPositions.push(pLeft.x, pLeft.y + 0.05, pLeft.z);
            kerbPositions.push(kL_out.x, kL_out.y + 0.12, kL_out.z);
            kerbPositions.push(pRight.x, pRight.y + 0.05, pRight.z);
            kerbPositions.push(kR_out.x, kR_out.y + 0.12, kR_out.z);

            // Alternating red/white stripes
            const isRed = Math.floor(i / 3) % 2 === 0;
            const rVal = isRed ? 0.95 : 0.9;
            const gVal = isRed ? 0.1 : 0.9;
            const bVal = isRed ? 0.15 : 0.9;

            for (let c = 0; c < 4; c++) {
                kerbColors.push(rVal, gVal, bVal);
            }

            if (i < this.samplesCount) {
                // Left kerb quad
                kerbIndices.push(kBase, kBase + 1, kBase + 4);
                kerbIndices.push(kBase + 1, kBase + 5, kBase + 4);
                // Right kerb quad
                kerbIndices.push(kBase + 2, kBase + 3, kBase + 6);
                kerbIndices.push(kBase + 3, kBase + 7, kBase + 6);
            }

            // Neon Barriers
            const bBase = i * 4;
            const bL_top = kL_out.clone().add(new THREE.Vector3(0, barrierHeight, 0));
            const bR_top = kR_out.clone().add(new THREE.Vector3(0, barrierHeight, 0));

            barrierPositions.push(kL_out.x, kL_out.y, kL_out.z);
            barrierPositions.push(bL_top.x, bL_top.y, bL_top.z);
            barrierPositions.push(kR_out.x, kR_out.y, kR_out.z);
            barrierPositions.push(bR_top.x, bR_top.y, bR_top.z);

            // Glowing cyan/magenta neon strip color
            for (let c = 0; c < 2; c++) {
                barrierColors.push(0.0, 0.9, 1.0); // Cyan glow on left
            }
            for (let c = 0; c < 2; c++) {
                barrierColors.push(1.0, 0.1, 0.6); // Magenta glow on right
            }

            if (i < this.samplesCount) {
                barrierIndices.push(bBase, bBase + 1, bBase + 4);
                barrierIndices.push(bBase + 1, bBase + 5, bBase + 4);
                barrierIndices.push(bBase + 2, bBase + 3, bBase + 6);
                barrierIndices.push(bBase + 3, bBase + 7, bBase + 6);
            }
        }

        // Create high-visibility asphalt texture with center dashed lines & side boundaries
        const roadTexCanvas = document.createElement('canvas');
        roadTexCanvas.width = 512;
        roadTexCanvas.height = 1024;
        const rctx = roadTexCanvas.getContext('2d');

        // Asphalt base
        rctx.fillStyle = '#22252c';
        rctx.fillRect(0, 0, 512, 1024);

        // Asphalt grain
        rctx.fillStyle = '#1c1e24';
        for (let g = 0; g < 4000; g++) {
            const gx = Math.random() * 512;
            const gy = Math.random() * 1024;
            rctx.fillRect(gx, gy, 2, 2);
        }

        // Solid white edge boundary lines (outer margin)
        rctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        rctx.fillRect(24, 0, 8, 1024);   // left edge line
        rctx.fillRect(480, 0, 8, 1024);  // right edge line

        // Subtle racing lane guides
        rctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        rctx.fillRect(140, 0, 2, 1024);
        rctx.fillRect(370, 0, 2, 1024);

        // Dashed bright white center line
        rctx.fillStyle = '#ffffff';
        const dashLen = 48;
        const gapLen = 48;
        for (let y = 0; y < 1024; y += dashLen + gapLen) {
            rctx.fillRect(252, y, 8, dashLen);
        }

        const roadTexture = new THREE.CanvasTexture(roadTexCanvas);
        roadTexture.wrapS = THREE.RepeatWrapping;
        roadTexture.wrapT = THREE.RepeatWrapping;
        roadTexture.repeat.set(1, 1);

        // Road Material (High visibility asphalt)
        roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
        roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
        roadGeo.setIndex(roadIndices);
        roadGeo.computeVertexNormals();

        const roadMat = new THREE.MeshStandardMaterial({
            map: roadTexture,
            roughness: 0.82,
            metalness: 0.1
        });
        this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
        this.roadMesh.receiveShadow = true;
        root.add(this.roadMesh);

        // Kerbs
        const kerbGeo = new THREE.BufferGeometry();
        kerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbPositions, 3));
        kerbGeo.setAttribute('color', new THREE.Float32BufferAttribute(kerbColors, 3));
        kerbGeo.setIndex(kerbIndices);
        kerbGeo.computeVertexNormals();
        const kerbMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.35,
            metalness: 0.2
        });
        this.kerbMesh = new THREE.Mesh(kerbGeo, kerbMat);
        root.add(this.kerbMesh);

        // High-visibility glowing neon barriers
        const barrierGeo = new THREE.BufferGeometry();
        barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(barrierPositions, 3));
        barrierGeo.setAttribute('color', new THREE.Float32BufferAttribute(barrierColors, 3));
        barrierGeo.setIndex(barrierIndices);
        barrierGeo.computeVertexNormals();
        const barrierMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.15,
            metalness: 0.9,
            emissive: 0x004466,
            emissiveIntensity: 0.85,
            side: THREE.DoubleSide
        });
        this.barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
        root.add(this.barrierMesh);

        // Start / Finish Line Gantry
        this.buildStartGantry(root);

        // Checkpoint holographic arches
        this.buildCheckpointGates(root);

        // Glowing Neon Boost Pads
        this.buildBoostPads(root);

        // High-Tech Kinetic Energy Hazard Obstacles (Pulsing Shield Spheres)
        this.buildKineticObstacles(root);

        // Ground terrain under the track
        this.buildTerrain(root);

        scene.add(root);
        return root;
    }

    buildBoostPads(root) {
        this.boostPads = [];
        const numPads = 5;
        for (let i = 1; i <= numPads; i++) {
            const sampleIdx = Math.floor((i / (numPads + 0.5)) * this.samplesCount) % this.samplesCount;
            const pt = this.trackPoints[sampleIdx];
            const tan = this.trackTangents[sampleIdx];
            const norm = this.trackNormals[sampleIdx];
            const binorm = this.trackBinormals[sampleIdx];

            const padGroup = new THREE.Group();
            padGroup.position.copy(pt).addScaledVector(norm, 0.05);

            // Construct basis to lay flat on road surface pointing along tangent
            const rotMat = new THREE.Matrix4();
            rotMat.makeBasis(binorm, norm, tan.clone().negate());
            padGroup.quaternion.setFromRotationMatrix(rotMat);

            // 3 glowing chevron speed chevrons
            const chevronMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                side: THREE.DoubleSide
            });

            for (let c = 0; c < 3; c++) {
                const zOffset = (c - 1) * 2.0;
                const wingGeo = new THREE.BoxGeometry(3.2, 0.04, 0.6);
                const wingL = new THREE.Mesh(wingGeo, chevronMat);
                wingL.position.set(-1.25, 0, zOffset);
                wingL.rotation.y = 0.52;
                padGroup.add(wingL);

                const wingR = new THREE.Mesh(wingGeo, chevronMat);
                wingR.position.set(1.25, 0, zOffset);
                wingR.rotation.y = -0.52;
                padGroup.add(wingR);
            }

            // Glowing cyan point light above boost pad
            const padLight = new THREE.PointLight(0x00f0ff, 2.0, 8.0);
            padLight.position.set(0, 0.6, 0);
            padGroup.add(padLight);

            root.add(padGroup);

            this.boostPads.push({
                point: pt.clone(),
                tangent: tan.clone(),
                progress: sampleIdx / this.samplesCount,
                radius: 5.5,
                group: padGroup,
                lastTriggerTime: 0
            });
        }
    }

    buildKineticObstacles(root) {
        this.kineticObstacles = [];
        // Place 4 dynamic kinetic hazard spheres across the track
        const obstacleProgresses = [0.20, 0.44, 0.68, 0.90];
        const lateralOffsets = [-0.35, 0.38, -0.32, 0.35]; // offset fraction across track width

        obstacleProgresses.forEach((prog, idx) => {
            const sampleIdx = Math.floor(prog * this.samplesCount) % this.samplesCount;
            const pt = this.trackPoints[sampleIdx];
            const binorm = this.trackBinormals[sampleIdx];
            const norm = this.trackNormals[sampleIdx];
            const tan = this.trackTangents[sampleIdx];

            const lateralDist = lateralOffsets[idx] * (this.roadWidth * 0.5);
            const obsCenter = pt.clone().addScaledVector(binorm, lateralDist).addScaledVector(norm, 1.45);

            const obsGroup = new THREE.Group();
            obsGroup.position.copy(obsCenter);

            // Construct road-relative orientation so obstacle aligns with the banked surface
            const rotMat = new THREE.Matrix4();
            rotMat.makeBasis(binorm, norm, tan.clone().negate());
            obsGroup.quaternion.setFromRotationMatrix(rotMat);

            // 1. High-Tech Kinetic Hazard Sphere (Dark chrome alloy with emissive orange core)
            const sphereGeo = new THREE.SphereGeometry(1.35, 24, 20);
            const sphereMat = new THREE.MeshStandardMaterial({
                color: 0x161a26,
                metalness: 0.92,
                roughness: 0.22,
                emissive: 0x220c00,
                emissiveIntensity: 0.8
            });
            const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
            obsGroup.add(sphereMesh);

            // 2. Equatorial Revolving Hazard Warning Ring
            const ringGeo = new THREE.TorusGeometry(1.85, 0.14, 16, 36);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0xff5500,
                emissive: 0xff4400,
                emissiveIntensity: 2.4,
                metalness: 0.8,
                roughness: 0.2
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            obsGroup.add(ringMesh);

            // 3. Pulsing Neon Strobe / Warning Point Light
            const warningLight = new THREE.PointLight(0xff5500, 2.8, 14, 1.8);
            warningLight.position.set(0, 0, 0);
            obsGroup.add(warningLight);

            // 4. Ground Shadow Projection Decal on Road Surface
            const shadowGeo = new THREE.CircleGeometry(1.65, 24);
            shadowGeo.rotateX(-Math.PI / 2);
            const shadowMat = new THREE.MeshBasicMaterial({
                color: 0x05070a,
                transparent: true,
                opacity: 0.7
            });
            const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
            shadowMesh.position.y = -1.38;
            obsGroup.add(shadowMesh);

            root.add(obsGroup);

            this.kineticObstacles.push({
                group: obsGroup,
                sphere: sphereMesh,
                ring: ringMesh,
                light: warningLight,
                baseY: obsCenter.y,
                position: obsCenter,
                radius: 1.75,
                hitCooldown: 0
            });
        });
    }

    buildStartGantry(root) {
        const p0 = this.trackPoints[0];
        const tan0 = this.trackTangents[0];
        const bi0 = this.trackBinormals[0];

        const gantry = new THREE.Group();
        gantry.position.copy(p0);

        // Look along tangent
        const lookTarget = p0.clone().add(tan0);
        gantry.lookAt(lookTarget);

        // Gantry Arch
        const archMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a24,
            metalness: 0.85,
            roughness: 0.25
        });

        const postGeo = new THREE.BoxGeometry(0.8, 8.5, 0.8);
        const postL = new THREE.Mesh(postGeo, archMat);
        postL.position.set(-this.roadWidth * 0.5 - 2, 4.2, 0);
        const postR = postL.clone();
        postR.position.set(this.roadWidth * 0.5 + 2, 4.2, 0);
        gantry.add(postL);
        gantry.add(postR);

        const beamGeo = new THREE.BoxGeometry(this.roadWidth + 5.5, 1.4, 1.2);
        const beam = new THREE.Mesh(beamGeo, archMat);
        beam.position.set(0, 8.0, 0);
        gantry.add(beam);

        // Glowing FINISH / START sign
        const signGeo = new THREE.PlaneGeometry(10, 1.2);
        const signMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            side: THREE.DoubleSide
        });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, 8.0, 0.65);
        gantry.add(sign);

        // Start lights (5 glowing pods)
        for (let i = -2; i <= 2; i++) {
            const lightGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16);
            lightGeo.rotateX(Math.PI / 2);
            const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(i * 1.2, 6.8, 0.6);
            gantry.add(light);
        }

        // Checkered finish line on the asphalt (black & white checkerboard texture)
        const checkCanvas = document.createElement('canvas');
        checkCanvas.width = 256;
        checkCanvas.height = 64;
        const cctx = checkCanvas.getContext('2d');
        const rows = 4;
        const cols = 16;
        const tileW = 256 / cols;
        const tileH = 64 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                cctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
                cctx.fillRect(c * tileW, r * tileH, tileW, tileH);
            }
        }
        const checkTex = new THREE.CanvasTexture(checkCanvas);
        checkTex.wrapS = THREE.RepeatWrapping;
        checkTex.wrapT = THREE.RepeatWrapping;

        const checkGeo = new THREE.PlaneGeometry(this.roadWidth, 3.2);
        const checkMat = new THREE.MeshBasicMaterial({
            map: checkTex,
            side: THREE.DoubleSide
        });
        const checkMesh = new THREE.Mesh(checkGeo, checkMat);
        checkMesh.rotation.x = -Math.PI / 2;
        checkMesh.position.set(0, 0.06, 0);
        gantry.add(checkMesh);

        root.add(gantry);
        this.gantryGroup = gantry;
    }

    buildCheckpointGates(root) {
        const checkpointsProgress = [0.25, 0.5, 0.75];
        checkpointsProgress.forEach((prog, idx) => {
            const sampleIdx = Math.floor(prog * this.samplesCount);
            const pt = this.trackPoints[sampleIdx];
            const tan = this.trackTangents[sampleIdx];

            const gate = new THREE.Group();
            gate.position.copy(pt);
            gate.lookAt(pt.clone().add(tan));

            // Holographic Torus Arch
            const archGeo = new THREE.TorusGeometry(this.roadWidth * 0.58, 0.22, 12, 32, Math.PI);
            const gateMat = new THREE.MeshBasicMaterial({
                color: idx === 1 ? 0xff0066 : 0x00ffcc,
                transparent: true,
                opacity: 0.75
            });
            const arch = new THREE.Mesh(archGeo, gateMat);
            arch.rotation.z = -Math.PI;
            arch.position.y = 0.5;
            gate.add(arch);

            root.add(gate);
            this.checkpointGates.push({ progress: prog, position: pt });
        });
    }

    buildTerrain(root) {
        // Futuristic vast dark grid terrain
        const gridGeo = new THREE.PlaneGeometry(1600, 1600, 60, 60);
        gridGeo.rotateX(-Math.PI / 2);

        const gridMat = new THREE.MeshStandardMaterial({
            color: 0x090a10,
            roughness: 0.95,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(gridGeo, gridMat);
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        root.add(ground);

        // Neon grid lines overlay
        const gridHelper = new THREE.GridHelper(1600, 80, 0x1f293d, 0x0e1422);
        gridHelper.position.y = -0.4;
        root.add(gridHelper);
    }

    // Fast lookup for car tracking
    getNearestTrackInfo(pos) {
        return this.getRoadSurfaceAt(pos);
    }

    // Exact continuous 3D road surface projection
    getRoadSurfaceAt(pos) {
        let minDistSq = Infinity;
        let bestIdx = 0;

        // 1. Find closest sampled point
        for (let i = 0; i < this.samplesCount; i += 2) {
            const p = this.trackPoints[i];
            const dx = pos.x - p.x;
            const dy = pos.y - p.y;
            const dz = pos.z - p.z;
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq < minDistSq) {
                minDistSq = dSq;
                bestIdx = i;
            }
        }

        // Refine with adjacent points
        const checkRange = [-3, -2, -1, 0, 1, 2, 3];
        for (let offset of checkRange) {
            const idx = (bestIdx + offset + this.samplesCount) % this.samplesCount;
            const p = this.trackPoints[idx];
            const dSq = pos.distanceToSquared(p);
            if (dSq < minDistSq) {
                minDistSq = dSq;
                bestIdx = idx;
            }
        }

        // 2. Continuous sub-sample projection along spline segment
        const p0 = this.trackPoints[bestIdx];
        const tan0 = this.trackTangents[bestIdx];
        const proj = pos.clone().sub(p0).dot(tan0);

        let idxA = bestIdx;
        let idxB = (bestIdx + (proj >= 0 ? 1 : -1) + this.samplesCount) % this.samplesCount;
        if (proj < 0) {
            const tmp = idxA; idxA = idxB; idxB = tmp;
        }

        const ptA = this.trackPoints[idxA];
        const ptB = this.trackPoints[idxB];
        const seg = ptB.clone().sub(ptA);
        const segLenSq = seg.lengthSq();
        const s = segLenSq > 0.0001 ? THREE.MathUtils.clamp(pos.clone().sub(ptA).dot(seg) / segLenSq, 0, 1) : 0;

        // Continuous interpolated spline vectors
        const centerPoint = ptA.clone().lerp(ptB, s);
        const tangent = this.trackTangents[idxA].clone().lerp(this.trackTangents[idxB], s).normalize();
        const normal = this.trackNormals[idxA].clone().lerp(this.trackNormals[idxB], s).normalize();
        const binormal = this.trackBinormals[idxA].clone().lerp(this.trackBinormals[idxB], s).normalize();

        // Signed lateral distance across track (d = positive on right, negative on left)
        const toPos = pos.clone().sub(centerPoint);
        const signedLateralDist = toPos.dot(binormal);

        // Exact 3D point on the visible road surface
        const surfacePoint = centerPoint.clone().addScaledVector(binormal, signedLateralDist);

        // Height of query position above road surface
        const heightAboveSurface = toPos.dot(normal);

        const halfWidth = this.roadWidth * 0.5;
        const kerbWidth = 1.4;
        const barrierDist = halfWidth + kerbWidth;

        const absLat = Math.abs(signedLateralDist);
        const isKerb = absLat > (halfWidth - kerbWidth) && absLat <= halfWidth;
        const isOffroad = absLat > halfWidth;
        const isBarrierHit = absLat >= (barrierDist - 0.5);

        const progress = (idxA + s) / this.samplesCount;

        return {
            index: idxA,
            subProgress: s,
            progress: progress,
            point: centerPoint,
            surfacePoint: surfacePoint,
            tangent: tangent,
            normal: normal,
            binormal: binormal,
            signedLateralDist: signedLateralDist,
            distanceFromCenter: absLat,
            heightAboveSurface: heightAboveSurface,
            halfWidth: halfWidth,
            barrierDist: barrierDist,
            isKerb: isKerb,
            isOffroad: isOffroad,
            isBarrierHit: isBarrierHit,
            totalDistance: Math.sqrt(minDistSq)
        };
    }

    getProgressAt(pos) {
        return this.getRoadSurfaceAt(pos).progress;
    }

    getSpawnTransform(slotIndex = 0) {
        // Spawn positions behind start line in grid layout
        const startPt = this.trackPoints[0];
        const tan0 = this.trackTangents[0];
        const bi0 = this.trackBinormals[0];

        const row = Math.floor(slotIndex / 2);
        const col = (slotIndex % 2 === 0) ? -1 : 1;

        const backDist = -(row * 12 + 6);
        const lateralDist = col * 3.5;

        const rawPos = startPt.clone()
            .addScaledVector(tan0, backDist)
            .addScaledVector(bi0, lateralDist);

        const surfaceData = this.getRoadSurfaceAt(rawPos);
        const pos = surfaceData.surfacePoint.clone();

        const heading = Math.atan2(-surfaceData.tangent.x, -surfaceData.tangent.z);

        return {
            position: pos,
            heading: heading,
            tangent: surfaceData.tangent,
            normal: surfaceData.normal,
            binormal: surfaceData.binormal
        };
    }

    update(dt) {
        if (!this.kineticObstacles || this.kineticObstacles.length === 0) return;
        const time = performance.now() * 0.003;
        for (let i = 0; i < this.kineticObstacles.length; i++) {
            const obs = this.kineticObstacles[i];
            if (obs.ring) {
                obs.ring.rotation.z += 2.2 * dt;
            }
            if (obs.sphere) {
                obs.sphere.rotation.y += 0.8 * dt;
            }
            if (obs.group) {
                obs.group.position.y = obs.baseY + Math.sin(time * 2.0 + i * 1.5) * 0.15;
            }
            if (obs.hitCooldown > 0) {
                obs.hitCooldown -= dt;
            }
        }
    }
}
