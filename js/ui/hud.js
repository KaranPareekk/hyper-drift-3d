export class HUD {
    constructor() {
        this.speedVal = document.getElementById('hudSpeed');
        this.gearVal = document.getElementById('hudGear');
        this.rpmBar = document.getElementById('hudRpmBar');
        this.nitroBar = document.getElementById('hudNitroBar');
        this.lapVal = document.getElementById('hudLap');
        this.timeVal = document.getElementById('hudTime');
        this.bestVal = document.getElementById('hudBest');
        this.posVal = document.getElementById('hudPosition');
        this.banner = document.getElementById('hudBanner');
        this.driftScoreEl = document.getElementById('hudDriftScore');

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        // Speed Lines Canvas
        this.speedLinesCanvas = document.getElementById('speedLinesCanvas');
        this.speedLinesCtx = this.speedLinesCanvas ? this.speedLinesCanvas.getContext('2d') : null;
        if (this.speedLinesCanvas) {
            this.speedLinesCanvas.width = window.innerWidth;
            this.speedLinesCanvas.height = window.innerHeight;
            window.addEventListener('resize', () => {
                if (this.speedLinesCanvas) {
                    this.speedLinesCanvas.width = window.innerWidth;
                    this.speedLinesCanvas.height = window.innerHeight;
                }
            });
        }

        // BGM Toggle
        this.btnToggleBgm = document.getElementById('btnToggleBgm');
        if (this.btnToggleBgm) {
            this.btnToggleBgm.addEventListener('click', () => {
                if (window.game && window.game.sound) {
                    const isPlaying = window.game.sound.toggleMusic();
                    this.btnToggleBgm.innerText = isPlaying ? "🎵 BGM: ON" : "🔇 BGM: MUTED";
                    if (isPlaying) this.btnToggleBgm.classList.remove('muted');
                    else this.btnToggleBgm.classList.add('muted');
                }
            });
        }

        // Sensitivity Hud Controls
        this.sliderSensHud = document.getElementById('sliderSensitivityHud');
        this.txtSensHud = document.getElementById('txtSensitivityHud');
        if (this.sliderSensHud) {
            this.sliderSensHud.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (this.txtSensHud) this.txtSensHud.innerText = `${val.toFixed(1)}x`;
                const menuSlider = document.getElementById('sliderSensitivityMenu');
                const menuTxt = document.getElementById('txtSensitivityMenu');
                if (menuSlider) menuSlider.value = val;
                if (menuTxt) menuTxt.innerText = `${val.toFixed(1)}x`;
                if (window.game && window.game.playerPhysics) {
                    window.game.playerPhysics.steeringSensitivity = val;
                }
            });
        }

        this.hudScreen = document.getElementById('hudScreen');
        this.bannerTimeout = null;
    }

    update(physics, opponents = [], track = null) {
        if (!physics) return;

        const speedKmh = physics.getSpeedKmh();
        if (this.speedVal) this.speedVal.innerText = speedKmh;
        if (this.gearVal) this.gearVal.innerText = physics.gear;

        // RPM bar
        if (this.rpmBar) {
            const rpmPct = Math.min(100, Math.max(0, ((physics.rpm - 1000) / 7000) * 100));
            this.rpmBar.style.width = `${rpmPct}%`;
        }

        // Nitro bar
        if (this.nitroBar) {
            this.nitroBar.style.width = `${physics.nitro}%`;
            if (physics.isNitro) {
                this.nitroBar.classList.add('active-boost');
            } else {
                this.nitroBar.classList.remove('active-boost');
            }
        }

        // Lap & Time
        if (this.lapVal) this.lapVal.innerText = `${physics.currentLap}/3`;
        if (this.timeVal) this.timeVal.innerText = this.formatTime(physics.currentLapTime);
        if (this.bestVal) {
            this.bestVal.innerText = physics.bestLapTime < Infinity ? this.formatTime(physics.bestLapTime) : '--:--.--';
        }

        // Drift score popup
        if (this.driftScoreEl) {
            if (physics.isDrifting) {
                this.driftScoreEl.style.opacity = '1';
                this.driftScoreEl.innerText = `+${Math.round(physics.driftScore)} DRIFT`;
            } else {
                this.driftScoreEl.style.opacity = '0';
            }
        }

        // Race position ranking
        if (this.posVal && track) {
            let rank = 1;
            const myProgress = (physics.currentLap - 1) + physics.checkpointProgress;
            opponents.forEach(opp => {
                const oppProg = (opp.physics.currentLap - 1) + opp.physics.checkpointProgress;
                if (oppProg > myProgress) rank++;
            });
            const suffix = rank === 1 ? 'ST' : (rank === 2 ? 'ND' : (rank === 3 ? 'RD' : 'TH'));
            this.posVal.innerText = `${rank}${suffix}`;
        }

        // Draw dynamic minimap
        if (this.minimapCtx && track) {
            this.drawMinimap(track, physics, opponents);
        }

        // Draw dynamic warp speed lines
        this.drawSpeedLines(physics);
    }

    drawSpeedLines(physics) {
        if (!this.speedLinesCtx || !this.speedLinesCanvas) return;
        const ctx = this.speedLinesCtx;
        const w = this.speedLinesCanvas.width;
        const h = this.speedLinesCanvas.height;
        const speedKmh = physics.getSpeedKmh();

        const shouldShow = (speedKmh > 165 || physics.isNitro);
        if (!shouldShow) {
            if (this.speedLinesCanvas.style.opacity !== '0') {
                this.speedLinesCanvas.style.opacity = '0';
                ctx.clearRect(0, 0, w, h);
            }
            return;
        }

        this.speedLinesCanvas.style.opacity = '1';
        ctx.clearRect(0, 0, w, h);

        const cx = w * 0.5;
        const cy = h * 0.48;
        const numLines = physics.isNitro ? 28 : 18;

        ctx.strokeStyle = physics.isNitro ? 'rgba(0, 240, 255, 0.45)' : 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = physics.isNitro ? 2.5 : 1.5;

        for (let i = 0; i < numLines; i++) {
            const angle = Math.random() * Math.PI * 2;
            const innerR = Math.min(w, h) * (0.28 + Math.random() * 0.20);
            const outerR = Math.min(w, h) * (0.55 + Math.random() * 0.40);

            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * outerR;
            const y2 = cy + Math.sin(angle) * outerR;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    drawMinimap(track, playerPhys, opponents) {
        if (!this.minimapCtx || !this.minimapCanvas) return;
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        const pts = track.trackPoints;
        if (!pts || pts.length === 0) return;

        // Auto-compute bounding box once per track or when track changes
        if (!this.minimapBounds || this.minimapBounds.trackRef !== track) {
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (let i = 0; i < pts.length; i += 2) {
                const p = pts[i];
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.z < minZ) minZ = p.z;
                if (p.z > maxZ) maxZ = p.z;
            }
            const trackW = Math.max(10, maxX - minX);
            const trackH = Math.max(10, maxZ - minZ);
            const padding = 18;
            const availW = w - padding * 2;
            const availH = h - padding * 2;
            const scale = Math.min(availW / trackW, availH / trackH);
            const midX = (minX + maxX) * 0.5;
            const midZ = (minZ + maxZ) * 0.5;
            this.minimapBounds = { trackRef: track, scale, midX, midZ };
        }

        const { scale, midX, midZ } = this.minimapBounds;
        const cx = w * 0.5;
        const cy = h * 0.5;

        const toScreenX = (wx) => cx + (wx - midX) * scale;
        const toScreenY = (wz) => cy + (wz - midZ) * scale;

        // Draw track outline glow
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 3) {
            const sx = toScreenX(pts[i].x);
            const sy = toScreenY(pts[i].z);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.closePath();

        // Neon track circuit
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
        ctx.shadowBlur = 6;
        ctx.stroke();

        // Start/Finish Line Indicator
        if (pts.length > 0) {
            const startX = toScreenX(pts[0].x);
            const startY = toScreenY(pts[0].z);
            ctx.fillStyle = '#ffea00';
            ctx.shadowColor = '#ffea00';
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(startX, startY, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Draw AI Opponents (crimson pulsing blips)
        opponents.forEach(opp => {
            if (!opp.physics || !opp.physics.root) return;
            const pos = opp.physics.root.position;
            const ox = toScreenX(pos.x);
            const oz = toScreenY(pos.z);

            ctx.save();
            ctx.fillStyle = '#ff1155';
            ctx.shadowColor = '#ff0044';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(ox, oz, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Draw Player Marker (vivid cyan directional arrowhead aligned to car world orientation)
        const pPos = playerPhys.root.position;
        const px = toScreenX(pPos.x);
        const pz = toScreenY(pPos.z);

        // Derive car forward vector in 3D world space
        const fwdX = -Math.sin(playerPhys.root.rotation.y || 0);
        const fwdZ = -Math.cos(playerPhys.root.rotation.y || 0);
        const headingAngle = Math.atan2(fwdZ, fwdX) + Math.PI / 2;

        ctx.save();
        ctx.translate(px, pz);
        ctx.rotate(headingAngle);

        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00f7ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(4.5, 5);
        ctx.lineTo(0, 3);
        ctx.lineTo(-4.5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    showBanner(text, duration = 2000) {
        if (!this.banner) return;
        this.banner.innerText = text;
        this.banner.classList.add('visible');

        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.bannerTimeout = setTimeout(() => {
            this.banner.classList.remove('visible');
        }, duration);
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}
