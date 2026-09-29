import * as THREE from 'three';
import { GameRenderer } from './renderer.js';
import { CarModelBuilder } from './vehicles/carModel.js';
import { VehiclePhysics } from './vehicles/vehiclePhysics.js';
import { ProceduralTrack } from './track/trackGen.js';
import { SceneryBuilder } from './track/scenery.js';
import { AIRival } from './vehicles/aiRival.js';
import { MultiplayerManager } from './network/multiplayer.js';
import { SoundFX } from './audio/soundFX.js';
import { HUD } from './ui/hud.js';
import { LobbyUI } from './ui/lobby.js';

class Game {
    constructor() {
        this.renderer = new GameRenderer(document.getElementById('gameCanvasContainer'));
        this.scene = this.renderer.scene;

        this.carBuilder = new CarModelBuilder();
        this.sound = new SoundFX();
        this.hud = new HUD();
        this.multiplayer = new MultiplayerManager(this);

        // State
        this.gameState = 'LOBBY'; // 'LOBBY', 'COUNTDOWN', 'RACING', 'FINISHED'
        this.selectedCarType = 'apex';
        this.selectedCarColor = 0x00e5ff;
        this.trackSeed = 'DRIFT-X9';
        this.selectedSensitivity = 1.0;

        // World objects
        this.track = null;
        this.trackMesh = null;
        this.scenery = null;
        this.playerCar = null;
        this.playerPhysics = null;
        this.aiRivals = [];

        // Showroom turntable car
        this.showroomCar = null;

        // Clock & Inputs
        this.clock = new THREE.Clock();
        this.keys = {};
        this.touchSteerLeft = false;
        this.touchSteerRight = false;
        this.btnTouchLeft = document.getElementById('btnTouchLeft');
        this.btnTouchRight = document.getElementById('btnTouchRight');

        this.initShowroom();
        this.setupInputs();

        this.lobbyUI = new LobbyUI(this);

        // Start main animation loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initShowroom() {
        // Build initial showroom preview car
        this.updateShowroomCar();
    }

    updateShowroomCar() {
        if (this.showroomCar) {
            this.scene.remove(this.showroomCar.root);
        }
        if (this.showroomTurntable) {
            this.scene.remove(this.showroomTurntable);
        }

        // Showroom glowing rotating turntable pedestal
        const platformGeo = new THREE.CylinderGeometry(2.8, 3.0, 0.15, 32);
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x111624,
            metalness: 0.9,
            roughness: 0.2
        });
        this.showroomTurntable = new THREE.Mesh(platformGeo, platformMat);
        this.showroomTurntable.position.set(0, 1.15, 0);

        // Glowing cyan perimeter ring on turntable
        const ringGeo = new THREE.TorusGeometry(2.9, 0.04, 16, 64);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = 0.08;
        this.showroomTurntable.add(ringMesh);

        this.scene.add(this.showroomTurntable);

        this.showroomCar = this.carBuilder.createCar(this.selectedCarType, this.selectedCarColor);
        this.showroomCar.root.position.set(0, 1.32, 0);
        this.scene.add(this.showroomCar.root);

        // Position camera higher and tilted down to showcase car prominently in the open space
        this.renderer.camera.position.set(0, 4.4, 7.2);
        this.renderer.camera.lookAt(0, 1.6, 0);
    }

    setCarType(type) {
        this.selectedCarType = type;
        if (this.gameState === 'LOBBY') {
            this.updateShowroomCar();
        }
    }

    setCarColor(colorHex) {
        this.selectedCarColor = colorHex;
        if (this.gameState === 'LOBBY' && this.showroomCar) {
            this.showroomCar.paintMaterial.color.setHex(colorHex);
        }
    }

    setTrackSeed(seed) {
        this.trackSeed = seed;
    }

    loadTrack(seed) {
        this.trackSeed = seed;

        // Cleanup old track
        if (this.trackMesh) this.scene.remove(this.trackMesh);
        if (this.scenery && this.scenery.root) this.scene.remove(this.scenery.root);

        // Remove showroom turntable and car if starting/running a race
        if (this.gameState !== 'LOBBY') {
            if (this.showroomCar) {
                this.scene.remove(this.showroomCar.root);
                this.showroomCar = null;
            }
            if (this.showroomTurntable) {
                this.scene.remove(this.showroomTurntable);
                this.showroomTurntable = null;
            }
        }

        // Generate new procedural track
        this.track = new ProceduralTrack(this.trackSeed);
        this.trackMesh = this.track.buildMeshes(this.scene);

        // Generate futuristic neon scenery
        this.scenery = new SceneryBuilder(this.scene, this.track);
        this.scenery.build();
    }

    startRace(isMultiplayer = false) {
        // Remove showroom car & turntable
        if (this.showroomCar) {
            this.scene.remove(this.showroomCar.root);
            this.showroomCar = null;
        }
        if (this.showroomTurntable) {
            this.scene.remove(this.showroomTurntable);
            this.showroomTurntable = null;
        }

        // Clean up any old player car
        if (this.playerCar) {
            this.scene.remove(this.playerCar.root);
            this.playerCar = null;
            this.playerPhysics = null;
        }

        // Build procedural track if not already built
        this.loadTrack(this.trackSeed);

        // Spawn Player Car
        this.playerCar = this.carBuilder.createCar(this.selectedCarType, this.selectedCarColor);
        this.scene.add(this.playerCar.root);

        this.playerPhysics = new VehiclePhysics(this.playerCar, {
            type: this.selectedCarType
        });
        this.playerPhysics.steeringSensitivity = this.selectedSensitivity || 1.0;

        // Place at grid slot 0 flush with the road surface
        const spawn = this.track.getSpawnTransform(0);
        this.playerPhysics.root.position.copy(spawn.position);
        this.playerPhysics.carHeadingAngle = 0;
        this.playerPhysics.vLong = 0;
        this.playerPhysics.vLat = 0;
        this.playerPhysics.yawRate = 0;
        const roadInfo = this.track.getRoadSurfaceAt(spawn.position);
        this.playerPhysics.alignOrientationWithTrack(roadInfo);
        this.renderer.snapCamera(this.playerPhysics);

        // Spawn AI Rivals for Solo Race
        this.aiRivals = [];
        if (!isMultiplayer) {
            const rivalColors = [0xff0055, 0xffbb00, 0x9900ff];
            const rivalTypes = ['vortex', 'apex', 'vortex'];

            for (let i = 1; i <= 2; i++) {
                const rivalCar = this.carBuilder.createCar(rivalTypes[i - 1], rivalColors[i - 1]);
                this.scene.add(rivalCar.root);
                const rival = new AIRival(rivalCar, this.track, i, {
                    type: rivalTypes[i - 1],
                    skill: 0.82 + i * 0.06
                });
                this.aiRivals.push(rival);
            }
        }

        // Clear stale inputs and blur any focused text inputs
        this.clearInputs();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
        window.focus();

        // Start Countdown sequence
        this.startCountdown();
    }

    startCountdown() {
        this.gameState = 'COUNTDOWN';
        let count = 3;

        this.hud.showBanner(count.toString(), 950);
        this.sound.playCountdownBeep(false);

        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                this.hud.showBanner(count.toString(), 950);
                this.sound.playCountdownBeep(false);
            } else if (count === 0) {
                this.hud.showBanner("GO!", 1200);
                this.sound.playCountdownBeep(true);
                this.gameState = 'RACING';
                clearInterval(timer);
            }
        }, 1000);
    }

    clearInputs() {
        this.keys = {};
        this.touchSteerLeft = false;
        this.touchSteerRight = false;
        if (this.btnTouchLeft) this.btnTouchLeft.classList.remove('active');
        if (this.btnTouchRight) this.btnTouchRight.classList.remove('active');
        if (this.playerPhysics) {
            this.playerPhysics.input.left = 0;
            this.playerPhysics.input.right = 0;
            this.playerPhysics.input.forward = 0;
            this.playerPhysics.input.backward = 0;
            this.playerPhysics.input.nitro = false;
            this.playerPhysics.input.handbrake = false;
        }
    }

    setupInputs() {
        const handleKeyDown = (e) => {
            // Do not capture gameplay inputs if the user is typing in a lobby text box
            const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
            if (isTyping && this.gameState === 'LOBBY') {
                return;
            }

            // Prevent gameplay keys from triggering browser scrolling or navigation
            const code = e.code || '';
            const key = e.key ? e.key.toLowerCase() : '';
            if (code === 'Space' || key === ' ' || 
                code === 'ArrowUp' || code === 'ArrowDown' || 
                code === 'ArrowLeft' || code === 'ArrowRight' ||
                code === 'KeyW' || key === 'w' ||
                code === 'KeyA' || key === 'a' ||
                code === 'KeyS' || key === 's' ||
                code === 'KeyD' || key === 'd' ||
                code === 'KeyQ' || key === 'q' ||
                code === 'KeyE' || key === 'e' ||
                code === 'KeyR' || key === 'r' ||
                ((code === 'Enter' || code === 'NumpadEnter' || key === 'enter') && (this.gameState === 'RACING' || this.gameState === 'COUNTDOWN'))) {
                e.preventDefault();
            }

            if (e.code) this.keys[e.code] = true;
            if (e.key) {
                this.keys[e.key.toLowerCase()] = true;
                this.keys[e.key.toUpperCase()] = true;
                this.keys[e.key] = true;
            }
            if (e.keyCode) {
                this.keys[e.keyCode] = true;
                this.keys['keyCode_' + e.keyCode] = true;
            }
            if (e.which) {
                this.keys[e.which] = true;
                this.keys['which_' + e.which] = true;
            }

            // Reset car key ('R')
            if ((code === 'KeyR' || key === 'r' || e.keyCode === 82) && this.gameState === 'RACING') {
                this.resetPlayerToTrack();
            }

            // Audio init on user gesture
            if (!this.sound.initialized) {
                this.sound.init();
            }
        };

        const handleKeyUp = (e) => {
            if (e.code) this.keys[e.code] = false;
            if (e.key) {
                this.keys[e.key.toLowerCase()] = false;
                this.keys[e.key.toUpperCase()] = false;
                this.keys[e.key] = false;
            }
            if (e.keyCode) {
                this.keys[e.keyCode] = false;
                this.keys['keyCode_' + e.keyCode] = false;
            }
            if (e.which) {
                this.keys[e.which] = false;
                this.keys['which_' + e.which] = false;
            }

            // Turbo flutter sound when releasing throttle at high RPM
            if ((e.code === 'KeyW' || e.key === 'w' || e.key === 'W' || e.code === 'ArrowUp') && 
                this.playerPhysics && this.playerPhysics.rpm > 5500) {
                this.sound.playTurboFlutter();
            }
        };

        // Attach listeners cleanly to window
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleKeyUp, { passive: false });

        // Wipe inputs on window blur to prevent keys getting stuck
        window.addEventListener('blur', () => this.clearInputs());

        // Wire On-Screen Side Control Buttons (Mouse & Touch & Stylus)
        const setupSideButton = (btn, onStart, onEnd) => {
            if (!btn) return;
            const startHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.focus();
                if (!this.sound.initialized) this.sound.init();
                onStart();
            };
            const endHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                onEnd();
            };

            btn.addEventListener('pointerdown', startHandler);
            btn.addEventListener('pointerup', endHandler);
            btn.addEventListener('pointercancel', endHandler);
            btn.addEventListener('pointerleave', endHandler);

            btn.addEventListener('touchstart', startHandler, { passive: false });
            btn.addEventListener('touchend', endHandler, { passive: false });
            btn.addEventListener('touchcancel', endHandler, { passive: false });

            btn.addEventListener('mousedown', startHandler);
            btn.addEventListener('mouseup', endHandler);
            btn.addEventListener('mouseleave', endHandler);
        };

        this.btnTouchLeft = document.getElementById('btnTouchLeft');
        this.btnTouchRight = document.getElementById('btnTouchRight');

        setupSideButton(this.btnTouchLeft, 
            () => { this.touchSteerLeft = true; this.touchSteerRight = false; }, 
            () => { this.touchSteerLeft = false; }
        );

        setupSideButton(this.btnTouchRight, 
            () => { this.touchSteerRight = true; this.touchSteerLeft = false; }, 
            () => { this.touchSteerRight = false; }
        );

        // Visibility change: clear keys when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.clearInputs();
            }
        });

        // Ensure canvas / window focus on click anywhere
        window.addEventListener('click', () => {
            window.focus();
        });
        document.addEventListener('click', () => {
            window.focus();
        });
    }

    updatePlayerInputs() {
        if (!this.playerPhysics) return;

        if (this.gameState === 'RACING') {
            // Full multi-layout keyboard & on-screen support
            const isW = Boolean(
                this.keys['KeyW'] || this.keys['w'] || this.keys['W'] || this.keys[87] || this.keys['keyCode_87'] ||
                this.keys['Enter'] || this.keys['NumpadEnter'] || this.keys['enter'] || this.keys[13] || this.keys['keyCode_13'] ||
                this.keys['ArrowUp'] || this.keys['Up'] || this.keys[38] || this.keys['keyCode_38'] ||
                this.keys['Numpad8']
            );
            const isS = Boolean(
                this.keys['KeyS'] || this.keys['s'] || this.keys['S'] || this.keys[83] || this.keys['keyCode_83'] ||
                this.keys['ArrowDown'] || this.keys['Down'] || this.keys[40] || this.keys['keyCode_40'] ||
                this.keys['Numpad2'] || this.keys['Numpad5']
            );
            const isA = Boolean(
                this.keys['KeyA'] || this.keys['a'] || this.keys['A'] || this.keys[65] || this.keys['keyCode_65'] ||
                this.keys['ArrowLeft'] || this.keys['Left'] || this.keys[37] || this.keys['keyCode_37'] ||
                this.keys['KeyQ'] || this.keys['q'] || this.keys['Q'] || this.keys[81] || this.keys['keyCode_81'] ||
                this.keys['Numpad4'] || this.touchSteerLeft
            );
            const isD = Boolean(
                this.keys['KeyD'] || this.keys['d'] || this.keys['D'] || this.keys[68] || this.keys['keyCode_68'] ||
                this.keys['ArrowRight'] || this.keys['Right'] || this.keys[39] || this.keys['keyCode_39'] ||
                this.keys['Numpad6'] || this.touchSteerRight
            );
            const isBoost = Boolean(
                this.keys['Space'] || this.keys[' '] || this.keys[32] || this.keys['keyCode_32'] ||
                this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['Shift'] || this.keys[16] || this.keys['keyCode_16'] ||
                this.keys['KeyE'] || this.keys['e'] || this.keys['E'] || this.keys[69] || this.keys['keyCode_69']
            );

            this.playerPhysics.input.forward = isW ? 1 : 0;
            this.playerPhysics.input.backward = isS ? 1 : 0;
            this.playerPhysics.input.left = isA ? 1 : 0;
            this.playerPhysics.input.right = isD ? 1 : 0;
            this.playerPhysics.input.nitro = isBoost;
            this.playerPhysics.input.handbrake = false;

            // Reflect visual active glow on side controls for instant confirmation
            if (this.btnTouchLeft) {
                if (isA) this.btnTouchLeft.classList.add('active');
                else this.btnTouchLeft.classList.remove('active');
            }
            if (this.btnTouchRight) {
                if (isD) this.btnTouchRight.classList.add('active');
                else this.btnTouchRight.classList.remove('active');
            }
        } else {
            // Locked during countdown
            this.playerPhysics.input.forward = 0;
            this.playerPhysics.input.backward = 0;
            this.playerPhysics.input.left = 0;
            this.playerPhysics.input.right = 0;
            this.playerPhysics.input.handbrake = false;
            this.playerPhysics.input.nitro = false;

            if (this.btnTouchLeft) this.btnTouchLeft.classList.remove('active');
            if (this.btnTouchRight) this.btnTouchRight.classList.remove('active');
        }
    }

    resetPlayerToTrack() {
        if (!this.playerPhysics || !this.track) return;
        const trackInfo = this.track.getRoadSurfaceAt(this.playerPhysics.root.position);
        this.playerPhysics.root.position.copy(trackInfo.surfacePoint);
        this.playerPhysics.carHeadingAngle = 0;
        this.playerPhysics.vLong = 0;
        this.playerPhysics.vLat = 0;
        this.playerPhysics.yawRate = 0;
        this.playerPhysics.steerAngle = 0;
        this.playerPhysics.alignOrientationWithTrack(trackInfo);
        this.hud.showBanner("CAR RESET", 1000);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const dt = this.clock.getDelta();

        if (this.gameState === 'LOBBY') {
            // Rotate showroom turntable & car
            if (this.showroomCar) {
                this.showroomCar.root.rotation.y += 0.45 * dt;
            }
            if (this.showroomTurntable) {
                this.showroomTurntable.rotation.y += 0.45 * dt;
            }
        } else {
            // Update inputs
            this.updatePlayerInputs();

            // --- RACE SIMULATION LOOP ---
            if (this.playerPhysics) {
                this.playerPhysics.update(dt, this.track);

                // Update sound engine
                const rpmRatio = (this.playerPhysics.rpm - 1000) / 7000;
                const throttle = this.playerPhysics.input.forward;
                const speedKmh = this.playerPhysics.getSpeedKmh();
                const speedRatio = speedKmh / 240;
                this.sound.updateEngine(rpmRatio, throttle, speedRatio);
                this.sound.updateDrift(this.playerPhysics.isDrifting ? Math.abs(this.playerPhysics.driftAngle) : 0);
                this.sound.setNitro(this.playerPhysics.isNitro);
                this.sound.updateWind(speedKmh);

                if (this.playerPhysics.justHitBarrier) {
                    this.sound.playBarrierImpact(this.playerPhysics.impactSeverity || 0.6);
                    this.sound.playSparkSound();
                    if (this.renderer && this.renderer.emitSparks) {
                        this.renderer.emitSparks(this.playerPhysics.root.position, 16);
                    }
                    this.playerPhysics.justHitBarrier = false;
                }

                if (this.playerPhysics.justHitObstacle) {
                    this.sound.playBarrierImpact(0.85);
                    this.sound.playSparkSound();
                    if (this.renderer && this.renderer.emitSparks) {
                        this.renderer.emitSparks(this.playerPhysics.root.position, 28);
                    }
                    this.renderer.cameraShake = Math.max(this.renderer.cameraShake, 0.45);
                    this.hud.showBanner("HAZARD COLLISION! 💥", 900);
                    this.playerPhysics.justHitObstacle = false;
                }

                if (this.playerPhysics.justHitBoostPad) {
                    this.sound.playBoostPad();
                    this.hud.showBanner("BOOST PAD! ⚡", 1100);
                    this.playerPhysics.justHitBoostPad = false;
                }

                if (this.playerPhysics.newRecordBanner) {
                    this.hud.showBanner("⚡ NEW LAP RECORD! " + this.hud.formatTime(this.playerPhysics.bestLapTime), 3200);
                    this.sound.playBoostPad();
                    this.playerPhysics.newRecordBanner = false;
                }

                // Update Camera & sparks
                this.renderer.updateCamera(this.playerPhysics, dt);

                // Check finish condition (3 laps)
                if (this.playerPhysics.currentLap > 3 && this.gameState === 'RACING') {
                    this.gameState = 'FINISHED';
                    this.hud.showBanner("RACE COMPLETE! 🏆", 5000);
                }
            }

            // Update dynamic track props (kinetic hazard spheres, gates)
            if (this.track && typeof this.track.update === 'function') {
                this.track.update(dt);
            }

            // Update AI Rivals
            this.aiRivals.forEach(ai => ai.update(dt));

            // Update Multiplayer remote players
            this.multiplayer.update(dt);

            // Update scenery animations (particles, pulsating signs)
            if (this.scenery) {
                this.scenery.update(dt);
            }

            // Update HUD
            this.hud.update(this.playerPhysics, this.aiRivals, this.track);
        }

        // Render scene
        this.renderer.render();
    }
}

// Reliable multi-state boot sequence (prevents missed DOMContentLoaded in ES modules)
function launchGame() {
    if (!window.game) {
        try {
            window.game = new Game();
            console.log("Hyper Drift 3D initialized successfully.");
        } catch (e) {
            console.error("Fatal error starting Hyper Drift 3D:", e);
        }
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', launchGame);
    window.addEventListener('load', launchGame);
} else {
    launchGame();
}
