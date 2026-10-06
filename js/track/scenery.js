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

    createBuildingTexture(theme = 'amber') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Dark skyscraper facade base
        ctx.fillStyle = '#0a0d16';
        ctx.fillRect(0, 0, 512, 1024);

        // Architectural vertical mullions
        ctx.fillStyle = '#06080f';
        for (let col = 0; col < 512; col += 32) {
            ctx.fillRect(col, 0, 4, 1024);
        }

        // Floors and illuminated windows
        const floorHeight = 22;
        const windowWidth = 20;
        const windowHeight = 12;

        for (let y = 10; y < 1010; y += floorHeight) {
            // Floor slab
            ctx.fillStyle = '#0f131f';
            ctx.fillRect(0, y + windowHeight + 2, 512, floorHeight - windowHeight - 2);

            for (let x = 8; x < 504; x += 32) {
                const rand = Math.random();
                if (rand > 0.42) {
                    // Lit window
                    if (theme === 'cyan') {
                        ctx.fillStyle = (rand > 0.85) ? '#00f0ff' : (rand > 0.65 ? '#0088cc' : '#e6fbff');
                    } else if (theme === 'magenta') {
                        ctx.fillStyle = (rand > 0.85) ? '#ff0077' : (rand > 0.65 ? '#990055' : '#ffd6eb');
                    } else {
                        // Amber / golden office lighting
                        ctx.fillStyle = (rand > 0.85) ? '#ffb338' : (rand > 0.65 ? '#ff8c00' : '#fff3d1');
                    }
                    ctx.fillRect(x, y, windowWidth, windowHeight);
                } else if (rand > 0.25) {
                    // Dim interior reflection
                    ctx.fillStyle = '#141824';
                    ctx.fillRect(x, y, windowWidth, windowHeight);
                } else {
                    // Dark unlit window
                    ctx.fillStyle = '#06070e';
                    ctx.fillRect(x, y, windowWidth, windowHeight);
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 2);
        return texture;
    }

    buildSkyscrapers() {
        const count = 110;
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);

        const texAmber = this.createBuildingTexture('amber');
        const texCyan = this.createBuildingTexture('cyan');
        const texMagenta = this.createBuildingTexture('magenta');

        const materials = [
            new THREE.MeshStandardMaterial({
                map: texAmber,
                emissiveMap: texAmber,
                emissive: 0x332211,
                emissiveIntensity: 0.60,
                roughness: 0.40,
                metalness: 0.85
            }),
            new THREE.MeshStandardMaterial({
                map: texCyan,
                emissiveMap: texCyan,
                emissive: 0x0a2233,
                emissiveIntensity: 0.65,
                roughness: 0.40,
                metalness: 0.85
            }),
            new THREE.MeshStandardMaterial({
                map: texMagenta,
                emissiveMap: texMagenta,
                emissive: 0x330a22,
                emissiveIntensity: 0.60,
                roughness: 0.40,
                metalness: 0.85
            })
        ];

        const neonColors = [0x00f0ff, 0xff0055, 0x7928ca, 0x00ff88, 0xffaa00];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
            const ring = i % 2;
            let dist = (ring === 0 ? 280 : 370) + Math.random() * 120;
            let x = Math.cos(angle) * dist;
            let z = Math.sin(angle) * dist;

            // Apartment building dimensions
            const width = 11 + Math.random() * 13;
            const depth = 11 + Math.random() * 13;
            const height = 24 + Math.random() * 52;

            // Clearance check
            const clearanceRadius = Math.max(width, depth) * 0.85 + (this.track.roadWidth * 0.5) + 14.0;
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
                dist += 95;
                x = Math.cos(angle) * dist;
                z = Math.sin(angle) * dist;
            }

            const baseMat = materials[i % materials.length];
            const building = new THREE.Mesh(boxGeo, baseMat);
            building.scale.set(width, height, depth);
            building.position.set(x, height * 0.5 - 1, z);
            this.root.add(building);

            // Rooftop elevator penthouse / utility structure
            const roofBox = new THREE.Mesh(boxGeo, baseMat);
            roofBox.scale.set(width * 0.38, 2.8, depth * 0.38);
            roofBox.position.set(x, height + 1.4, z);
            this.root.add(roofBox);

            // Glowing vertical neon edge ribbon on select high-rises
            if (i % 3 === 0) {
                const neonColor = neonColors[i % neonColors.length];
                const stripGeo = new THREE.BoxGeometry(0.3, height, 0.3);
                const stripMat = new THREE.MeshBasicMaterial({ color: neonColor });
                const strip = new THREE.Mesh(stripGeo, stripMat);
                // Position at building corner
                strip.position.set(x + width * 0.5, height * 0.5 - 1, z + depth * 0.5);
                this.root.add(strip);
            }

            // Glowing rooftop neon beacon / antenna
            if (Math.random() > 0.25) {
                const antennaHeight = 6 + Math.random() * 6;
                const beaconGeo = new THREE.CylinderGeometry(0.2, 0.2, antennaHeight, 8);
                const beaconMat = new THREE.MeshBasicMaterial({
                    color: neonColors[Math.floor(Math.random() * neonColors.length)]
                });
                const beacon = new THREE.Mesh(beaconGeo, beaconMat);
                beacon.position.set(x, height + 2.8 + antennaHeight * 0.5, z);
                this.root.add(beacon);
            }
        }
    }

    createBillboardCanvas(text, colorHex, subText = "SYSTEM ACTIVE") {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Dark digital background
        ctx.fillStyle = '#060810';
        ctx.fillRect(0, 0, 512, 256);

        // Neon outer border
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 496, 240);

        // Scanlines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        for (let y = 12; y < 244; y += 4) {
            ctx.fillRect(12, y, 488, 2);
        }

        // Title text
        ctx.font = '900 44px "Impact", "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colorHex;
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = 18;
        ctx.fillText(text, 256, 108);

        // Subtitle & technical telemetry
        ctx.shadowBlur = 0;
        ctx.font = '600 16px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`// ${subText} // 240 FPS`, 256, 172);

        // Audio visualizer equalizer bars
        const barCount = 20;
        const barWidth = 14;
        const startX = 256 - (barCount * 18) / 2;
        for (let b = 0; b < barCount; b++) {
            const h = 10 + Math.random() * 26;
            ctx.fillStyle = colorHex;
            ctx.fillRect(startX + b * 18, 218 - h, barWidth, h);
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    buildHolographicBillboards() {
        const billboardData = [
            { text: "APEX TURBO", color: "#00f0ff", hex: 0x00f0ff, sub: "V-MAX NITRO" },
            { text: "NEON DRIFT", color: "#ff0077", hex: 0xff0077, sub: "DRIFT KING" },
            { text: "NITRO BOOST", color: "#00ffaa", hex: 0x00ffaa, sub: "HYPERCHARGE" },
            { text: "LIMITLESS", color: "#ffbb00", hex: 0xffbb00, sub: "MAX VELOCITY" },
            { text: "CYBER CIRCUIT", color: "#00f0ff", hex: 0x00f0ff, sub: "SECTOR 07" },
            { text: "OVERDRIVE", color: "#ff0055", hex: 0xff0055, sub: "SYSTEM WARP" },
            { text: "VORTEX GT", color: "#aa00ff", hex: 0xaa00ff, sub: "PRECISION PBR" },
            { text: "HYPER SPEED", color: "#00e5ff", hex: 0x00e5ff, sub: "NO LIMITS" }
        ];

        const step = Math.floor(this.track.samplesCount / 8);

        for (let i = 0; i < 8; i++) {
            const sampleIdx = i * step;
            const pt = this.track.trackPoints[sampleIdx];
            const binormal = this.track.trackBinormals[sampleIdx];

            const side = (i % 2 === 0) ? 1 : -1;
            const pos = pt.clone().addScaledVector(binormal, side * (this.track.roadWidth * 0.5 + 10));
            pos.y += 12 + Math.random() * 6;

            const boardGroup = new THREE.Group();
            boardGroup.position.copy(pos);
            boardGroup.lookAt(pt);

            const data = billboardData[i % billboardData.length];
            const bbTex = this.createBillboardCanvas(data.text, data.color, data.sub);

            // Glowing frame
            const frameGeo = new THREE.BoxGeometry(22, 11, 0.4);
            const frameMat = new THREE.MeshBasicMaterial({
                color: data.hex,
                wireframe: true
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            boardGroup.add(frame);

            // Inner glowing panel with graphic canvas texture
            const panelGeo = new THREE.PlaneGeometry(21.4, 10.4);
            const panelMat = new THREE.MeshBasicMaterial({
                map: bbTex,
                transparent: true,
                opacity: 0.92,
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
        const step = 24;
        const lampGeo = new THREE.CylinderGeometry(0.2, 0.3, 9, 8);
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x222633, metalness: 0.9 });
        const bulbGeo = new THREE.SphereGeometry(0.6, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

        // Volumetric downward light cone geometry
        const coneGeo = new THREE.CylinderGeometry(0.4, 3.8, 12, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
            color: 0x00d8ff,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < this.track.samplesCount; i += step) {
            const pt = this.track.trackPoints[i];
            const binormal = this.track.trackBinormals[i];
            const norm = this.track.trackNormals[i] || new THREE.Vector3(0, 1, 0);
            const side = (Math.floor(i / step) % 2 === 0) ? -1 : 1;

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
                const lightSource = new THREE.PointLight(0x70d8ff, 2.6, 45, 1.4);
                lightSource.position.set(bulbPos.x, polePos.y + 8.2, bulbPos.z);
                this.root.add(lightSource);

                // Volumetric downward beam cone
                const lightBeam = new THREE.Mesh(coneGeo, coneMat);
                lightBeam.position.set(bulbPos.x, bulbPos.y - 5.5, bulbPos.z);
                this.root.add(lightBeam);
            }
        }
    }

    buildAtmosphericParticles() {
        const particleCount = 700;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 800;
            positions[i * 3 + 1] = Math.random() * 85;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 800;

            const rand = Math.random();
            if (rand > 0.6) {
                colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0; // Cyan
            } else if (rand > 0.3) {
                colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.1; colors[i * 3 + 2] = 0.6; // Magenta
            } else {
                colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 0.2; // Amber
            }
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMat = new THREE.PointsMaterial({
            size: 2.0,
            vertexColors: true,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(particleGeo, particleMat);
        this.root.add(this.particles);
    }

    update(dt) {
        if (this.particles) {
            this.particles.rotation.y += 0.02 * dt;
        }

        const t = performance.now() * 0.003;
        this.animatedProps.forEach(item => {
            if (item.type === 'billboard') {
                item.mesh.opacity = 0.85 + Math.sin(t) * 0.10;
            }
        });
    }
}
