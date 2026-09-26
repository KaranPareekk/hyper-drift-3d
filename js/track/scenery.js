import * as THREE from 'three';

export class SceneryBuilder {
    constructor(scene, track) {
        this.scene = scene;
        this.track = track;
        this.root = new THREE.Group();
        this.root.name = "scenery";
        this.animatedProps = [];
    }

    build() {
        this.buildSkyscrapers();
        this.buildHolographicBillboards();
        this.buildTrackLights();
        this.buildAtmosphericParticles();
        this.scene.add(this.root);
    }

    buildSkyscrapers() {
        // Instantiate a neon skyline around the outer perimeter
        const count = 75;
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);

        const buildingColors = [0x0d111a, 0x111624, 0x090d14, 0x141a29];
        const neonColors = [0x00f0ff, 0xff0055, 0x7928ca, 0x00ff88];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
            let dist = 380 + Math.random() * 340;
            let x = Math.cos(angle) * dist;
            let z = Math.sin(angle) * dist;

            const width = 25 + Math.random() * 35;
            const depth = 25 + Math.random() * 35;
            const height = 80 + Math.random() * 220;

            // Clearance check: Ensure building footprint NEVER intersects or encroaches within the roadway corridor
            const clearanceRadius = Math.max(width, depth) * 0.85 + (this.track.roadWidth * 0.5) + 16.0;
            let tooClose = false;
            if (this.track && this.track.trackPoints) {
                for (let s = 0; s < this.track.samplesCount; s += 6) {
                    const pt = this.track.trackPoints[s];
                    const dx = pt.x - x;
                    const dz = pt.z - z;
                    if ((dx * dx + dz * dz) < (clearanceRadius * clearanceRadius)) {
                        tooClose = true;
                        break;
                    }
                }
            }

            if (tooClose) {
                // Push building safely outside the track boundary
                dist += 140;
                x = Math.cos(angle) * dist;
                z = Math.sin(angle) * dist;
            }

            const baseMat = new THREE.MeshStandardMaterial({
                color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
                roughness: 0.6,
                metalness: 0.8
            });

            const building = new THREE.Mesh(boxGeo, baseMat);
            building.scale.set(width, height, depth);
            building.position.set(x, height * 0.5 - 2, z);
            this.root.add(building);

            // Glowing rooftop neon beacon / antenna
            if (Math.random() > 0.3) {
                const beaconGeo = new THREE.CylinderGeometry(0.5, 0.5, 18, 8);
                const beaconMat = new THREE.MeshBasicMaterial({
                    color: neonColors[Math.floor(Math.random() * neonColors.length)]
                });
                const beacon = new THREE.Mesh(beaconGeo, beaconMat);
                beacon.position.set(x, height + 8, z);
                this.root.add(beacon);
            }
        }
    }

    buildHolographicBillboards() {
        const billboardTexts = ["APEX TURBO", "NEON DRIFT", "NITRO BOOST", "LIMITLESS"];
        const billboardColors = [0x00f0ff, 0xff0077, 0x00ffaa, 0xffbb00];

        // Place 8 billboards along the track at elevated positions
        const step = Math.floor(this.track.samplesCount / 8);

        for (let i = 0; i < 8; i++) {
            const sampleIdx = i * step;
            const pt = this.track.trackPoints[sampleIdx];
            const binormal = this.track.trackBinormals[sampleIdx];
            const tangent = this.track.trackTangents[sampleIdx];

            const side = (i % 2 === 0) ? 1 : -1;
            const pos = pt.clone().addScaledVector(binormal, side * (this.track.roadWidth * 0.5 + 10));
            pos.y += 12 + Math.random() * 6;

            const boardGroup = new THREE.Group();
            boardGroup.position.copy(pos);
            boardGroup.lookAt(pt);

            // Glowing frame
            const frameGeo = new THREE.BoxGeometry(22, 10, 0.4);
            const frameMat = new THREE.MeshBasicMaterial({
                color: billboardColors[i % billboardColors.length],
                wireframe: true
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            boardGroup.add(frame);

            // Inner glowing panel
            const panelGeo = new THREE.PlaneGeometry(21, 9);
            const panelMat = new THREE.MeshBasicMaterial({
                color: billboardColors[i % billboardColors.length],
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide
            });
            const panel = new THREE.Mesh(panelGeo, panelMat);
            boardGroup.add(panel);

            // Supporting pylons
            const pylonGeo = new THREE.CylinderGeometry(0.5, 0.5, pos.y, 8);
            const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.8 });
            const pylon = new THREE.Mesh(pylonGeo, pylonMat);
            pylon.position.set(0, -pos.y * 0.5, 0);
            boardGroup.add(pylon);

            this.root.add(boardGroup);
            this.animatedProps.push({ type: 'billboard', mesh: panelMat });
        }
    }

    buildTrackLights() {
        // High-tech curved streetlights along the track every 20 samples
        const step = 24;
        const lampGeo = new THREE.CylinderGeometry(0.2, 0.3, 9, 8);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x222633, metalness: 0.9 });
        const bulbGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

        for (let i = 0; i < this.track.samplesCount; i += step) {
            const pt = this.track.trackPoints[i];
            const binormal = this.track.trackBinormals[i];
            const norm = this.track.trackNormals[i] || new THREE.Vector3(0, 1, 0);
            const side = (Math.floor(i / step) % 2 === 0) ? -1 : 1;

            // Placed well outside the barrier guardrails
            const polePos = pt.clone().addScaledVector(binormal, side * (this.track.roadWidth * 0.5 + 3.5));

            const pole = new THREE.Mesh(lampGeo, lampMat);
            pole.position.set(polePos.x, polePos.y + 4.5, polePos.z);
            this.root.add(pole);

            // Glowing light head
            const bulb = new THREE.Mesh(bulbGeo, bulbMat);
            const bulbPos = polePos.clone().addScaledVector(binormal, -side * 1.5).addScaledVector(norm, 4.2);
            bulb.position.set(bulbPos.x, bulbPos.y, bulbPos.z);
            this.root.add(bulb);

            // Add real illumination pool every few lamps along the road
            if (i % (step * 2) === 0) {
                const lightSource = new THREE.PointLight(0x70d8ff, 2.4, 45, 1.4);
                lightSource.position.set(bulbPos.x, polePos.y + 8.2, bulbPos.z);
                this.root.add(lightSource);
            }
        }
    }

    buildAtmosphericParticles() {
        // Ambient neon dust particles drifting through the scene
        const particleCount = 600;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 800;
            positions[i + 1] = Math.random() * 70;
            positions[i + 2] = (Math.random() - 0.5) * 800;
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particleMat = new THREE.PointsMaterial({
            color: 0x00d8ff,
            size: 1.8,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particleGeo, particleMat);
        this.root.add(this.particles);
    }

    update(dt) {
        // Gently rotate & pulse atmospheric particles
        if (this.particles) {
            this.particles.rotation.y += 0.02 * dt;
        }

        // Pulse billboards
        const t = performance.now() * 0.003;
        this.animatedProps.forEach(item => {
            if (item.type === 'billboard') {
                item.mesh.opacity = 0.3 + Math.sin(t) * 0.12;
            }
        });
    }
}
