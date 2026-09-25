import * as THREE from 'three';

export class MultiplayerManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.isHost = false;
        this.roomCode = null;
        this.connections = new Map(); // peerId -> connection
        this.remotePlayers = new Map(); // peerId -> { car, physicsProxy, targetState, currentState }
        this.broadcastInterval = null;
    }

    createRoom(customCode = null) {
        return new Promise((resolve, reject) => {
            const code = customCode || 'RACE-' + Math.floor(1000 + Math.random() * 9000);
            this.roomCode = code;
            this.isHost = true;

            try {
                // Initialize PeerJS with room code
                this.peer = new window.Peer(code, {
                    debug: 1
                });

                this.peer.on('open', (id) => {
                    console.log('Host room created with ID:', id);
                    this.startBroadcasting();
                    resolve(code);
                });

                this.peer.on('connection', (conn) => {
                    this.handleIncomingConnection(conn);
                });

                this.peer.on('error', (err) => {
                    console.warn('Peer error:', err);
                    if (err.type === 'unavailable-id') {
                        // Retry with new random code
                        this.createRoom().then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    joinRoom(code) {
        return new Promise((resolve, reject) => {
            this.roomCode = code;
            this.isHost = false;

            try {
                this.peer = new window.Peer({
                    debug: 1
                });

                this.peer.on('open', (id) => {
                    console.log('Guest peer opened:', id);
                    const conn = this.peer.connect(code, { reliable: false });

                    conn.on('open', () => {
                        console.log('Connected to host:', code);
                        this.connections.set('host', conn);
                        this.setupConnectionHandlers(conn, 'host');
                        this.startBroadcasting();

                        // Request track seed and race state
                        conn.send({
                            type: 'join',
                            carType: this.game.selectedCarType,
                            colorHex: this.game.selectedCarColor
                        });

                        resolve(code);
                    });

                    conn.on('error', (err) => {
                        reject(err);
                    });
                });

                this.peer.on('error', (err) => {
                    reject(err);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    handleIncomingConnection(conn) {
        conn.on('open', () => {
            console.log('New peer connected:', conn.peer);
            this.connections.set(conn.peer, conn);
            this.setupConnectionHandlers(conn, conn.peer);

            // Send current track seed and race setup to guest
            conn.send({
                type: 'init_track',
                seed: this.game.trackSeed,
                hostCarType: this.game.selectedCarType,
                hostColorHex: this.game.selectedCarColor
            });

            if (typeof this.onPeerConnected === 'function') {
                this.onPeerConnected(conn.peer);
            }
        });
    }

    setupConnectionHandlers(conn, peerId) {
        conn.on('data', (data) => {
            this.handleMessage(peerId, data);
        });

        conn.on('close', () => {
            console.log('Peer disconnected:', peerId);
            this.removeRemotePlayer(peerId);
            this.connections.delete(peerId);
        });
    }

    handleMessage(peerId, msg) {
        if (!msg || !msg.type) return;

        switch (msg.type) {
            case 'init_track':
                // Client synchronizes track seed with host
                if (!this.isHost) {
                    console.log('Received track seed from host:', msg.seed);
                    if (this.game.trackSeed !== msg.seed) {
                        this.game.loadTrack(msg.seed);
                    }
                }
                break;

            case 'join':
                // Spawn remote vehicle for joined guest
                this.spawnRemotePlayer(peerId, msg.carType || 'vortex', msg.colorHex || 0xff0055);
                break;

            case 'state':
                this.updateRemotePlayerState(peerId, msg);
                break;
        }
    }

    spawnRemotePlayer(peerId, carType, colorHex) {
        if (this.remotePlayers.has(peerId)) return;

        const carObj = this.game.carBuilder.createCar(carType, colorHex);
        this.game.scene.add(carObj.root);

        const slot = this.remotePlayers.size + 1;
        const spawn = this.game.track.getSpawnTransform(slot);
        carObj.root.position.copy(spawn.position);
        carObj.root.rotation.y = spawn.heading;

        this.remotePlayers.set(peerId, {
            car: carObj,
            targetPos: spawn.position.clone(),
            targetRot: new THREE.Euler(0, spawn.heading, 0),
            targetSteer: 0,
            isNitro: false,
            isDrifting: false,
            speedKmh: 0,
            lastReceived: performance.now()
        });

        if (this.game.hud) {
            this.game.hud.showBanner(`RIVAL CONNECTED!`, 2000);
        }
    }

    updateRemotePlayerState(peerId, msg) {
        let player = this.remotePlayers.get(peerId);
        if (!player) {
            this.spawnRemotePlayer(peerId, msg.carType || 'vortex', msg.colorHex || 0xff0055);
            player = this.remotePlayers.get(peerId);
        }

        if (player) {
            player.targetPos.set(msg.x, msg.y, msg.z);
            player.targetRot.set(msg.rx, msg.ry, msg.rz);
            player.targetSteer = msg.steer || 0;
            player.isNitro = !!msg.nitro;
            player.isDrifting = !!msg.drift;
            player.speedKmh = msg.speed || 0;
            player.lastReceived = performance.now();
        }
    }

    removeRemotePlayer(peerId) {
        const player = this.remotePlayers.get(peerId);
        if (player) {
            this.game.scene.remove(player.car.root);
            this.remotePlayers.delete(peerId);
        }
    }

    startBroadcasting() {
        if (this.broadcastInterval) clearInterval(this.broadcastInterval);

        // Broadcast local car state at 30 Hz
        this.broadcastInterval = setInterval(() => {
            if (!this.game.playerPhysics) return;

            const phys = this.game.playerPhysics;
            const state = {
                type: 'state',
                x: Number(phys.root.position.x.toFixed(2)),
                y: Number(phys.root.position.y.toFixed(2)),
                z: Number(phys.root.position.z.toFixed(2)),
                rx: Number(phys.root.rotation.x.toFixed(3)),
                ry: Number(phys.root.rotation.y.toFixed(3)),
                rz: Number(phys.root.rotation.z.toFixed(3)),
                steer: Number(phys.steerAngle.toFixed(3)),
                speed: phys.getSpeedKmh(),
                nitro: phys.isNitro,
                drift: phys.isDrifting,
                carType: this.game.selectedCarType,
                colorHex: this.game.selectedCarColor
            };

            this.connections.forEach((conn) => {
                if (conn.open) {
                    conn.send(state);
                }
            });
        }, 33);
    }

    update(dt) {
        // Smoothly interpolate remote players (dead reckoning / lerp)
        const lerpFactor = Math.min(1.0, 18 * dt);

        this.remotePlayers.forEach((player) => {
            const root = player.car.root;
            root.position.lerp(player.targetPos, lerpFactor);

            // Interpolate rotation
            root.rotation.y += (player.targetRot.y - root.rotation.y) * lerpFactor;
            root.rotation.x += (player.targetRot.x - root.rotation.x) * lerpFactor;
            root.rotation.z += (player.targetRot.z - root.rotation.z) * lerpFactor;

            // Wheels steer
            if (player.car.wheels) {
                player.car.wheels.steerLeft.rotation.y = player.targetSteer;
                player.car.wheels.steerRight.rotation.y = player.targetSteer;
            }

            // Nitro flames
            if (player.car.animated && player.car.animated.flames) {
                player.car.animated.flames.forEach(flame => {
                    flame.material.opacity = player.isNitro ? 0.9 : 0.0;
                });
            }
        });
    }
}
