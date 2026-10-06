import * as THREE from 'three';

export class CarModelBuilder {
    constructor() {
        // Shared materials cache to maximize performance & GPU efficiency
        this.carbonMaterial = new THREE.MeshStandardMaterial({
            color: 0x16171a,
            roughness: 0.28,
            metalness: 0.88
        });

        this.darkTrimMaterial = new THREE.MeshStandardMaterial({
            color: 0x0c0d10,
            roughness: 0.75,
            metalness: 0.3
        });

        this.glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x0f1422,
            transparent: true,
            opacity: 0.85,
            roughness: 0.04,
            metalness: 0.95,
            reflectivity: 0.98,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04
        });

        this.rubberMaterial = new THREE.MeshStandardMaterial({
            color: 0x151618,
            roughness: 0.9,
            metalness: 0.08
        });

        this.rotorMaterial = new THREE.MeshStandardMaterial({
            color: 0x9fa3a8,
            roughness: 0.25,
            metalness: 0.92
        });

        this.caliperApexMat = new THREE.MeshBasicMaterial({ color: 0xddff00 }); // Acid yellow Brembo
        this.caliperVortexMat = new THREE.MeshBasicMaterial({ color: 0xee0022 }); // Crimson red Brembo

        this.mirrorGlassMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.05
        });

        this.stripeWhiteMat = new THREE.MeshStandardMaterial({
            color: 0xf0f5ff,
            metalness: 0.6,
            roughness: 0.25
        });

        this.exhaustTitaniumMat = new THREE.MeshStandardMaterial({
            color: 0x3d5a80,
            metalness: 0.96,
            roughness: 0.18
        });
    }

    createCar(type = 'apex', colorHex = 0x00e5ff) {
        const root = new THREE.Group();
        root.name = type;

        // Visual chassis container (pitches & rolls dynamically with suspension/handling)
        const chassis = new THREE.Group();
        chassis.name = "chassis";
        root.add(chassis);

        const paintMaterial = new THREE.MeshPhysicalMaterial({
            color: colorHex,
            metalness: 0.92,
            roughness: 0.12,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            reflectivity: 0.96
        });

        let wheelsData = null;
        let animatedParts = {};

        if (type === 'apex') {
            const data = this.buildApexPhantom(chassis, paintMaterial, colorHex);
            wheelsData = data.wheels;
            animatedParts = data.animated;
        } else {
            const data = this.buildVortexGT(chassis, paintMaterial, colorHex);
            wheelsData = data.wheels;
            animatedParts = data.animated;
        }

        // Forward LED projector headlights with realistic forward beam cone
        const leftHeadlight = new THREE.SpotLight(0xe8f4ff, 3.2, 75, Math.PI / 5, 0.35, 1.2);
        leftHeadlight.position.set(-0.65, 0.52, -2.0);
        leftHeadlight.target.position.set(-0.65, -0.2, -35);
        chassis.add(leftHeadlight);
        chassis.add(leftHeadlight.target);

        const rightHeadlight = new THREE.SpotLight(0xe8f4ff, 3.2, 75, Math.PI / 5, 0.35, 1.2);
        rightHeadlight.position.set(0.65, 0.52, -2.0);
        rightHeadlight.target.position.set(0.65, -0.2, -35);
        chassis.add(rightHeadlight);
        chassis.add(rightHeadlight.target);

        // Volumetric forward headlight beams (god-ray glow cones)
        const beamGeo = new THREE.CylinderGeometry(0.12, 1.6, 28, 16, 1, true);
        const beamMatL = new THREE.MeshBasicMaterial({
            color: 0xd6f2ff,
            transparent: true,
            opacity: 0.13,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const leftBeam = new THREE.Mesh(beamGeo, beamMatL);
        leftBeam.rotation.x = Math.PI / 2 + 0.03;
        leftBeam.position.set(-0.65, 0.42, -15.5);
        chassis.add(leftBeam);

        const beamMatR = beamMatL.clone();
        const rightBeam = new THREE.Mesh(beamGeo, beamMatR);
        rightBeam.rotation.x = Math.PI / 2 + 0.03;
        rightBeam.position.set(0.65, 0.42, -15.5);
        chassis.add(rightBeam);
        animatedParts.headlightBeams = [leftBeam, rightBeam];

        // Dynamic soft radial underglow neon
        const underglowColor = (type === 'apex') ? 0x00f0ff : 0xff0055;
        const underglowLight = new THREE.PointLight(underglowColor, 3.2, 5.2);
        underglowLight.position.set(0, 0.22, 0);
        chassis.add(underglowLight);

        // Ground soft exponential glow texture
        const ugCanvas = document.createElement('canvas');
        ugCanvas.width = 256;
        ugCanvas.height = 256;
        const ugCtx = ugCanvas.getContext('2d');
        const ugGrad = ugCtx.createRadialGradient(128, 128, 15, 128, 128, 128);
        const ugRgb = (type === 'apex') ? '0, 240, 255' : '255, 0, 85';
        ugGrad.addColorStop(0.00, `rgba(${ugRgb}, 0.85)`);
        ugGrad.addColorStop(0.35, `rgba(${ugRgb}, 0.50)`);
        ugGrad.addColorStop(0.70, `rgba(${ugRgb}, 0.18)`);
        ugGrad.addColorStop(1.00, `rgba(${ugRgb}, 0)`);
        ugCtx.fillStyle = ugGrad;
        ugCtx.fillRect(0, 0, 256, 256);

        const ugTexture = new THREE.CanvasTexture(ugCanvas);
        const underglowGeo = new THREE.PlaneGeometry(3.2, 5.8);
        const underglowMat = new THREE.MeshBasicMaterial({
            map: ugTexture,
            transparent: true,
            opacity: 0.70,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
        underglowMesh.rotation.x = -Math.PI / 2;
        underglowMesh.position.y = 0.05;
        chassis.add(underglowMesh);

        return {
            root,
            chassis,
            paintMaterial,
            wheels: wheelsData,
            animated: animatedParts,
            underglowLight,
            underglowMesh
        };
    }

    // ==========================================
    // 1. APEX PHANTOM (Le Mans Prototype Hypercar)
    // ==========================================
    buildApexPhantom(chassis, paintMat, colorHex) {
        // 1. Sleek Central Monocoque Body
        const monocoqueGeo = new THREE.BoxGeometry(1.82, 0.44, 4.3);
        const monocoque = new THREE.Mesh(monocoqueGeo, paintMat);
        monocoque.position.set(0, 0.44, 0);
        monocoque.castShadow = true;
        monocoque.receiveShadow = true;
        chassis.add(monocoque);

        // 2. Sculpted Coke-Bottle Waist Sills (Aerodynamic side channels)
        const sideChannelGeo = new THREE.BoxGeometry(0.12, 0.28, 2.2);
        const leftChannel = new THREE.Mesh(sideChannelGeo, this.carbonMaterial);
        leftChannel.position.set(-0.95, 0.32, 0);
        const rightChannel = leftChannel.clone();
        rightChannel.position.set(0.95, 0.32, 0);
        chassis.add(leftChannel);
        chassis.add(rightChannel);

        // 3. Pronounced Front Wheel Haunches & Nose Cone
        const noseGeo = new THREE.CylinderGeometry(0.92, 0.78, 1.4, 8);
        noseGeo.rotateX(Math.PI / 2);
        noseGeo.scale(1.0, 0.32, 1.0);
        const nose = new THREE.Mesh(noseGeo, paintMat);
        nose.position.set(0, 0.38, -2.15);
        chassis.add(nose);

        // Front Aero Splitter with Winglets
        const splitterGeo = new THREE.BoxGeometry(2.1, 0.06, 0.95);
        const splitter = new THREE.Mesh(splitterGeo, this.carbonMaterial);
        splitter.position.set(0, 0.16, -2.35);
        chassis.add(splitter);

        // Splitter vertical endplate fences
        const fenceGeo = new THREE.BoxGeometry(0.04, 0.18, 0.35);
        const fenceL = new THREE.Mesh(fenceGeo, this.carbonMaterial);
        fenceL.position.set(-1.06, 0.22, -2.35);
        const fenceR = fenceL.clone();
        fenceR.position.set(1.06, 0.22, -2.35);
        chassis.add(fenceL);
        chassis.add(fenceR);

        // 4. Dual Racing Livery Stripes (Twin central racing stripes)
        const stripeGeo = new THREE.BoxGeometry(0.18, 0.02, 4.32);
        const stripeL = new THREE.Mesh(stripeGeo, this.stripeWhiteMat);
        stripeL.position.set(-0.16, 0.67, 0);
        const stripeR = stripeL.clone();
        stripeR.position.set(0.16, 0.67, 0);
        chassis.add(stripeL);
        chassis.add(stripeR);

        // 5. Swept Teardrop Cockpit Canopy
        const cockpitGeo = new THREE.ConeGeometry(0.86, 2.3, 6);
        cockpitGeo.rotateX(Math.PI / 2);
        cockpitGeo.scale(1.0, 0.52, 1.25);
        const cockpit = new THREE.Mesh(cockpitGeo, this.glassMaterial);
        cockpit.position.set(0, 0.81, -0.1);
        chassis.add(cockpit);

        // Cockpit interior: Driver helmet silhouette
        const helmetGeo = new THREE.SphereGeometry(0.16, 12, 10);
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.9 });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.set(-0.24, 0.82, -0.1);
        chassis.add(helmet);

        // 6. Central Shark Fin Stabilizer & Roof Air Intake
        const finGeo = new THREE.BoxGeometry(0.05, 0.42, 1.9);
        const fin = new THREE.Mesh(finGeo, this.carbonMaterial);
        fin.position.set(0, 0.96, 0.65);
        chassis.add(fin);

        const scoopGeo = new THREE.BoxGeometry(0.32, 0.16, 0.45);
        const scoop = new THREE.Mesh(scoopGeo, this.carbonMaterial);
        scoop.position.set(0, 0.98, -0.4);
        chassis.add(scoop);

        // 7. Aerodynamic Side Mirrors
        const mirrorArmGeo = new THREE.BoxGeometry(0.24, 0.04, 0.06);
        const mirrorHeadGeo = new THREE.BoxGeometry(0.16, 0.1, 0.22);
        [-0.96, 0.96].forEach((x, idx) => {
            const mGroup = new THREE.Group();
            mGroup.position.set(x, 0.72, -0.6);
            const arm = new THREE.Mesh(mirrorArmGeo, this.carbonMaterial);
            const head = new THREE.Mesh(mirrorHeadGeo, paintMat);
            head.position.set(idx === 0 ? -0.12 : 0.12, 0.03, 0);
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), this.mirrorGlassMat);
            glass.position.set(idx === 0 ? -0.12 : 0.12, 0.03, 0.11);
            mGroup.add(arm);
            mGroup.add(head);
            mGroup.add(glass);
            chassis.add(mGroup);
        });

        // 8. Massive Rear Carbon Diffuser with Strakes
        const diffuserGeo = new THREE.BoxGeometry(2.0, 0.32, 1.25);
        const diffuser = new THREE.Mesh(diffuserGeo, this.carbonMaterial);
        diffuser.position.set(0, 0.26, 2.1);
        chassis.add(diffuser);

        // 4 Diffuser vertical fins
        for (let i = -0.75; i <= 0.75; i += 0.5) {
            const finStrake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 1.1), this.carbonMaterial);
            finStrake.position.set(i, 0.22, 2.1);
            chassis.add(finStrake);
        }

        // 9. Quad Heat-Treated Titanium Exhaust Tips
        const exhaustGroup = new THREE.Group();
        exhaustGroup.position.set(0, 0.42, 2.28);
        for (let i = -1.5; i <= 1.5; i += 1.0) {
            const tipGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.22, 16);
            tipGeo.rotateX(Math.PI / 2);
            const tip = new THREE.Mesh(tipGeo, this.exhaustTitaniumMat);
            tip.position.set(i * 0.15, 0, 0);

            // Glowing blue inner core
            const innerCore = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12),
                new THREE.MeshBasicMaterial({ color: 0x00c8ff })
            );
            innerCore.rotateX(Math.PI / 2);
            innerCore.position.set(i * 0.15, 0, 0.08);
            exhaustGroup.add(tip);
            exhaustGroup.add(innerCore);
        }
        chassis.add(exhaustGroup);

        // 10. Active Dynamic Rear Wing
        const wingRoot = new THREE.Group();
        wingRoot.position.set(0, 0.82, 1.85);

        const pylonGeo = new THREE.BoxGeometry(0.05, 0.38, 0.2);
        const pylonL = new THREE.Mesh(pylonGeo, this.carbonMaterial);
        pylonL.position.set(-0.6, 0.16, 0);
        const pylonR = pylonL.clone();
        pylonR.position.set(0.6, 0.16, 0);
        wingRoot.add(pylonL);
        wingRoot.add(pylonR);

        const wingBladeGeo = new THREE.BoxGeometry(2.18, 0.06, 0.46);
        const wingBlade = new THREE.Mesh(wingBladeGeo, this.carbonMaterial);
        wingBlade.position.set(0, 0.36, 0);

        const endplateGeo = new THREE.BoxGeometry(0.04, 0.28, 0.58);
        const endplateL = new THREE.Mesh(endplateGeo, paintMat);
        endplateL.position.set(-1.1, 0.36, 0);
        const endplateR = endplateL.clone();
        endplateR.position.set(1.1, 0.36, 0);
        wingBlade.add(endplateL);
        wingBlade.add(endplateR);

        wingRoot.add(wingBlade);
        chassis.add(wingRoot);

        // 11. LED Projector Headlights with DRL Eyebrows
        const headLightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const hlGeo = new THREE.BoxGeometry(0.42, 0.07, 0.2);
        const hlL = new THREE.Mesh(hlGeo, headLightMat);
        hlL.position.set(-0.72, 0.48, -2.18);
        hlL.rotation.y = 0.2;
        const hlR = hlL.clone();
        hlR.position.set(0.72, 0.48, -2.18);
        hlR.rotation.y = -0.2;
        chassis.add(hlL);
        chassis.add(hlR);

        // Dynamic forward road headlights illumination
        const headSpot = new THREE.SpotLight(0xd8f4ff, 2.8, 55, Math.PI / 5.5, 0.45, 1.4);
        headSpot.position.set(0, 0.55, -2.1);
        headSpot.target.position.set(0, 0, -28);
        chassis.add(headSpot);
        chassis.add(headSpot.target);

        // 12. Full-Width Glowing Rear LED Light Bar
        const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
        const tailGeo = new THREE.BoxGeometry(1.86, 0.06, 0.08);
        const tailLight = new THREE.Mesh(tailGeo, tailLightMat);
        tailLight.position.set(0, 0.62, 2.22);
        chassis.add(tailLight);

        // Nitro exhaust flames
        const flames = this.createNitroFlames(exhaustGroup);

        // Wheels with 5-Spoke Alloy Rims & Brembo Calipers
        const wheels = this.createWheelSet(chassis, 0.98, 1.35, 1.45, 'apex');

        return {
            wheels,
            animated: {
                activeWing: wingRoot,
                flames,
                exhaustGroup
            }
        };
    }

    // ==========================================
    // 2. VORTEX GT (Widebody Track & Drift Beast)
    // ==========================================
    buildVortexGT(chassis, paintMat, colorHex) {
        // 1. Muscular Widebody Chassis
        const bodyGeo = new THREE.BoxGeometry(1.92, 0.52, 4.25);
        const body = new THREE.Mesh(bodyGeo, paintMat);
        body.position.set(0, 0.48, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        chassis.add(body);

        // 2. Sculpted GT Cabin with Carbon Roof Panel
        const cabinGeo = new THREE.BoxGeometry(1.4, 0.46, 2.0);
        const cabin = new THREE.Mesh(cabinGeo, paintMat);
        cabin.position.set(0, 0.88, 0.1);
        chassis.add(cabin);

        const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.04, 1.5), this.carbonMaterial);
        roofPanel.position.set(0, 1.12, 0.15);
        chassis.add(roofPanel);

        // Windshield and Windows
        const winGeo = new THREE.BoxGeometry(1.42, 0.41, 1.92);
        const windows = new THREE.Mesh(winGeo, this.glassMaterial);
        windows.position.set(0, 0.9, 0.1);
        chassis.add(windows);

        // Interior Racing Roll Cage
        const cageGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);
        const cageMat = new THREE.MeshStandardMaterial({ color: 0xee2200, roughness: 0.3 });
        const cageL = new THREE.Mesh(cageGeo, cageMat);
        cageL.position.set(-0.55, 0.9, 0.4);
        cageL.rotation.z = 0.2;
        const cageR = cageL.clone();
        cageR.position.set(0.55, 0.9, 0.4);
        cageR.rotation.z = -0.2;
        chassis.add(cageL);
        chassis.add(cageR);

        // 3. Vented Carbon Hood with Twin Extraction Louvers
        const hoodGeo = new THREE.BoxGeometry(1.5, 0.12, 1.6);
        const hood = new THREE.Mesh(hoodGeo, this.carbonMaterial);
        hood.position.set(0, 0.65, -1.35);
        chassis.add(hood);

        // Twin Louver Vents
        [-0.35, 0.35].forEach(x => {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.6), this.darkTrimMaterial);
            vent.position.set(x, 0.72, -1.35);
            chassis.add(vent);
        });

        // 4. Bold Flared Widebody Fenders (Bolt-on Rocket Bunny stance)
        const flareFrontGeo = new THREE.BoxGeometry(2.14, 0.42, 1.15);
        const frontFlares = new THREE.Mesh(flareFrontGeo, paintMat);
        frontFlares.position.set(0, 0.42, -1.35);
        const flareRearGeo = new THREE.BoxGeometry(2.16, 0.45, 1.25);
        const rearFlares = new THREE.Mesh(flareRearGeo, paintMat);
        rearFlares.position.set(0, 0.44, 1.35);
        chassis.add(frontFlares);
        chassis.add(rearFlares);

        // Carbon Side Skirt extensions
        const skirtGeo = new THREE.BoxGeometry(2.15, 0.06, 1.7);
        const skirt = new THREE.Mesh(skirtGeo, this.carbonMaterial);
        skirt.position.set(0, 0.16, 0);
        chassis.add(skirt);

        // 5. Front Deep Splitter with Dual Strut Rods & Canards
        const splitterGeo = new THREE.BoxGeometry(2.18, 0.07, 0.95);
        const splitter = new THREE.Mesh(splitterGeo, this.carbonMaterial);
        splitter.position.set(0, 0.16, -2.35);
        chassis.add(splitter);

        // Dual Carbon Bumper Canards (dive planes)
        [-1.02, 1.02].forEach((x, idx) => {
            const canardGeo = new THREE.BoxGeometry(0.22, 0.03, 0.35);
            const canard = new THREE.Mesh(canardGeo, this.carbonMaterial);
            canard.position.set(x, 0.36, -2.15);
            canard.rotation.z = idx === 0 ? -0.2 : 0.2;
            chassis.add(canard);
        });

        // Side Racing Mirrors
        [-1.02, 1.02].forEach((x, idx) => {
            const mGroup = new THREE.Group();
            mGroup.position.set(x, 0.76, -0.55);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.06), this.carbonMaterial);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.22), paintMat);
            head.position.set(idx === 0 ? -0.12 : 0.12, 0.02, 0);
            const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), this.mirrorGlassMat);
            glass.position.set(idx === 0 ? -0.12 : 0.12, 0.02, 0.11);
            mGroup.add(arm);
            mGroup.add(head);
            mGroup.add(glass);
            chassis.add(mGroup);
        });

        // 6. High Swan-Neck GT Racing Wing
        const wingRoot = new THREE.Group();
        wingRoot.position.set(0, 0.92, 1.9);

        const swanPylonGeo = new THREE.BoxGeometry(0.06, 0.58, 0.32);
        const pylonL = new THREE.Mesh(swanPylonGeo, this.carbonMaterial);
        pylonL.position.set(-0.55, 0.2, 0);
        pylonL.rotation.x = -0.22;
        const pylonR = pylonL.clone();
        pylonR.position.set(0.55, 0.2, 0);
        pylonR.rotation.x = -0.22;
        wingRoot.add(pylonL);
        wingRoot.add(pylonR);

        const gtWingGeo = new THREE.BoxGeometry(2.28, 0.08, 0.52);
        const gtWing = new THREE.Mesh(gtWingGeo, this.carbonMaterial);
        gtWing.position.set(0, 0.52, 0.05);

        const epGeo = new THREE.BoxGeometry(0.04, 0.46, 0.68);
        const epL = new THREE.Mesh(epGeo, paintMat);
        epL.position.set(-1.14, 0.52, 0.05);
        const epR = epL.clone();
        epR.position.set(1.14, 0.52, 0.05);
        gtWing.add(epL);
        gtWing.add(epR);

        wingRoot.add(gtWing);
        chassis.add(wingRoot);

        // 7. Dual 4-Inch Angled Cannon Exhausts with Titanium Burn Tips
        const exhaustGroup = new THREE.Group();
        exhaustGroup.position.set(0, 0.28, 2.2);

        [-0.55, 0.55].forEach(x => {
            const pipeGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.38, 16);
            pipeGeo.rotateX(Math.PI / 2);
            const pipe = new THREE.Mesh(pipeGeo, this.exhaustTitaniumMat);
            pipe.position.set(x, 0, 0);
            pipe.rotation.y = (x < 0 ? -0.12 : 0.12); // aggressive angled toe-out
            exhaustGroup.add(pipe);

            const innerGlow = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12),
                new THREE.MeshBasicMaterial({ color: 0xff4400 })
            );
            innerGlow.rotateX(Math.PI / 2);
            innerGlow.position.set(x, 0, 0.18);
            exhaustGroup.add(innerGlow);
        });
        chassis.add(exhaustGroup);

        // 8. Aggressive Headlights with Glowing Yellow Endurance DRLs
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        const hlGeo = new THREE.BoxGeometry(0.38, 0.1, 0.16);
        const hlL = new THREE.Mesh(hlGeo, hlMat);
        hlL.position.set(-0.76, 0.52, -2.15);
        const hlR = hlL.clone();
        hlR.position.set(0.76, 0.52, -2.15);
        chassis.add(hlL);
        chassis.add(hlR);

        // Dynamic forward road headlights illumination
        const vortexHeadSpot = new THREE.SpotLight(0xfffae0, 2.8, 55, Math.PI / 5.5, 0.45, 1.4);
        vortexHeadSpot.position.set(0, 0.58, -2.1);
        vortexHeadSpot.target.position.set(0, 0, -28);
        chassis.add(vortexHeadSpot);
        chassis.add(vortexHeadSpot.target);

        // 9. Smoked Dual Taillight Clusters
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff1500 });
        const tlGeo = new THREE.BoxGeometry(0.42, 0.12, 0.1);
        const tlL = new THREE.Mesh(tlGeo, tlMat);
        tlL.position.set(-0.76, 0.62, 2.15);
        const tlR = tlL.clone();
        tlR.position.set(0.76, 0.62, 2.15);
        chassis.add(tlL);
        chassis.add(tlR);

        // Nitro exhaust flames
        const flames = this.createNitroFlames(exhaustGroup);

        // Wheels with Deep-Dish Bronze Racing Rims & Red Brembo Calipers
        const wheels = this.createWheelSet(chassis, 1.05, 1.35, 1.35, 'vortex');

        return {
            wheels,
            animated: {
                activeWing: null,
                flames,
                exhaustGroup
            }
        };
    }

    // Nitro exhaust flame meshes
    createNitroFlames(parent) {
        const flameMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending
        });

        const flameGeo = new THREE.ConeGeometry(0.14, 1.25, 8);
        flameGeo.rotateX(-Math.PI / 2);

        const flame1 = new THREE.Mesh(flameGeo, flameMat);
        flame1.position.set(-0.35, 0, 0.6);
        parent.add(flame1);

        const flame2 = new THREE.Mesh(flameGeo, flameMat.clone());
        flame2.position.set(0.35, 0, 0.6);
        parent.add(flame2);

        return [flame1, flame2];
    }

    // High detail wheel set with steering hubs, 5-spoke alloy rims, and Brembo calipers
    createWheelSet(parent, halfTrack, frontZ, rearZ, style) {
        const wheels = {
            frontLeft: null,
            frontRight: null,
            rearLeft: null,
            rearRight: null,
            steerLeft: new THREE.Group(),
            steerRight: new THREE.Group()
        };

        // Front left steering assembly
        wheels.steerLeft.position.set(-halfTrack, 0.38, -frontZ);
        parent.add(wheels.steerLeft);
        wheels.frontLeft = this.createSingleWheel(style, true);
        wheels.steerLeft.add(wheels.frontLeft);

        // Front right steering assembly
        wheels.steerRight.position.set(halfTrack, 0.38, -frontZ);
        parent.add(wheels.steerRight);
        wheels.frontRight = this.createSingleWheel(style, false);
        wheels.steerRight.add(wheels.frontRight);

        // Rear wheels
        wheels.rearLeft = this.createSingleWheel(style, true);
        wheels.rearLeft.position.set(-halfTrack, 0.38, rearZ);
        parent.add(wheels.rearLeft);

        wheels.rearRight = this.createSingleWheel(style, false);
        wheels.rearRight.position.set(halfTrack, 0.38, rearZ);
        parent.add(wheels.rearRight);

        return wheels;
    }

    createSingleWheel(style, isLeft) {
        const wheelGroup = new THREE.Group();

        const tireRadius = 0.38;
        const tireWidth = 0.34;

        // 1. High Performance Rubber Tire
        const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
        tireGeo.rotateZ(Math.PI / 2);
        const tire = new THREE.Mesh(tireGeo, this.rubberMaterial);
        tire.castShadow = true;
        wheelGroup.add(tire);

        // 2. Outer Rim Lip / Deep Barrel
        const rimColor = (style === 'apex') ? 0xd0d5dd : 0xd49b37; // Satin silver vs deep racing bronze/gold
        const rimMat = new THREE.MeshStandardMaterial({
            color: rimColor,
            metalness: 0.94,
            roughness: 0.18
        });
        const barrelGeo = new THREE.CylinderGeometry(tireRadius * 0.74, tireRadius * 0.74, tireWidth * 1.02, 20);
        barrelGeo.rotateZ(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, rimMat);
        wheelGroup.add(barrel);

        // 3. 5-Spoke Lightweight Alloy Star Face
        const faceX = isLeft ? -tireWidth * 0.51 : tireWidth * 0.51;
        const spokeGroup = new THREE.Group();
        spokeGroup.position.set(faceX, 0, 0);

        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            const spokeGeo = new THREE.BoxGeometry(0.04, 0.055, tireRadius * 0.65);
            const spoke = new THREE.Mesh(spokeGeo, rimMat);
            spoke.position.set(0, Math.sin(angle) * (tireRadius * 0.32), Math.cos(angle) * (tireRadius * 0.32));
            spoke.rotation.x = -angle;
            spokeGroup.add(spoke);
        }

        // Center hub with racing center-lock nut
        const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12);
        hubGeo.rotateZ(Math.PI / 2);
        const hubNutMat = new THREE.MeshStandardMaterial({
            color: (style === 'apex') ? 0x00f0ff : 0xff0044, // Anodized center lock
            metalness: 0.9,
            roughness: 0.2
        });
        const hub = new THREE.Mesh(hubGeo, hubNutMat);
        spokeGroup.add(hub);
        wheelGroup.add(spokeGroup);

        // 4. Ventilated Cross-Drilled Brake Rotor
        const rotorGeo = new THREE.CylinderGeometry(tireRadius * 0.56, tireRadius * 0.56, 0.02, 18);
        rotorGeo.rotateZ(Math.PI / 2);
        const rotor = new THREE.Mesh(rotorGeo, this.rotorMaterial);
        rotor.position.x = isLeft ? 0.04 : -0.04;
        wheelGroup.add(rotor);

        // 5. Brembo Painted Brake Caliper
        const caliperGeo = new THREE.BoxGeometry(0.06, 0.16, 0.11);
        const caliperMat = (style === 'apex') ? this.caliperApexMat : this.caliperVortexMat;
        const caliper = new THREE.Mesh(caliperGeo, caliperMat);
        // Mounted firmly at the 10 o'clock position
        caliper.position.set(isLeft ? 0.05 : -0.05, 0.15, -0.04);
        wheelGroup.add(caliper);

        return wheelGroup;
    }
}
