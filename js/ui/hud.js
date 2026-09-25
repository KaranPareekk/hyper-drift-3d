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
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Find bounding box of track
        const pts = track.trackPoints;
        if (!pts || pts.length === 0) return;

        // Auto scale to fit minimap
        const scale = 0.22;
        const centerX = w * 0.5;
        const centerY = h * 0.5;

        // Draw track curve
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 0; i < pts.length; i += 4) {
            const px = centerX + pts[i].x * scale;
            const pz = centerY + pts[i].z * scale;
            if (i === 0) ctx.moveTo(px, pz);
            else ctx.lineTo(px, pz);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw opponents
        opponents.forEach(opp => {
            const pos = opp.physics.root.position;
            const ox = centerX + pos.x * scale;
            const oz = centerY + pos.z * scale;
            ctx.fillStyle = '#ff0055';
            ctx.beginPath();
            ctx.arc(ox, oz, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw player marker (bright cyan triangle with heading)
        const pPos = playerPhys.root.position;
        const px = centerX + pPos.x * scale;
        const pz = centerY + pPos.z * scale;

        ctx.save();
        ctx.translate(px, pz);
        ctx.rotate(-playerPhys.heading);

        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(-4, 5);
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
