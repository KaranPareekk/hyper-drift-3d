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

        // Split-Screen Elements
        this.p1Pos = document.getElementById('p1Pos');
        this.p1Lap = document.getElementById('p1Lap');
        this.p1Speed = document.getElementById('p1Speed');
        this.p1Gear = document.getElementById('p1Gear');
        this.p1NitroBar = document.getElementById('p1NitroBar');

        this.p2Pos = document.getElementById('p2Pos');
        this.p2Lap = document.getElementById('p2Lap');
        this.p2Speed = document.getElementById('p2Speed');
        this.p2Gear = document.getElementById('p2Gear');
        this.p2NitroBar = document.getElementById('p2NitroBar');
    }

    setSplitScreenMode(enabled) {
        if (this.hudScreen) {
            if (enabled) {
                this.hudScreen.classList.add('split-mode');
            } else {
                this.hudScreen.classList.remove('split-mode');
            }
        }
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

    updateSplit(p1Physics, p2Physics, track = null) {
        if (!p1Physics || !p2Physics) return;

        // --- Player 1 Telemetry ---
        const speed1 = p1Physics.getSpeedKmh();
        if (this.p1Speed) this.p1Speed.innerText = speed1;
        if (this.p1Gear) this.p1Gear.innerText = p1Physics.gear;
        if (this.p1Lap) this.p1Lap.innerText = `${Math.min(3, p1Physics.currentLap)}/3`;
        if (this.p1NitroBar) {
            this.p1NitroBar.style.width = `${p1Physics.nitro}%`;
        }

        // --- Player 2 Telemetry ---
        const speed2 = p2Physics.getSpeedKmh();
        if (this.p2Speed) this.p2Speed.innerText = speed2;
        if (this.p2Gear) this.p2Gear.innerText = p2Physics.gear;
        if (this.p2Lap) this.p2Lap.innerText = `${Math.min(3, p2Physics.currentLap)}/3`;
        if (this.p2NitroBar) {
            this.p2NitroBar.style.width = `${p2Physics.nitro}%`;
        }

        // Calculate dynamic relative race ranking
        if (this.p1Pos && this.p2Pos && track) {
            const p1Prog = (p1Physics.currentLap - 1) + p1Physics.checkpointProgress;
            const p2Prog = (p2Physics.currentLap - 1) + p2Physics.checkpointProgress;

            if (p1Prog >= p2Prog) {
                this.p1Pos.innerText = "1ST";
                this.p1Pos.style.color = "#00f0ff";
                this.p2Pos.innerText = "2ND";
                this.p2Pos.style.color = "#ff88aa";
            } else {
                this.p1Pos.innerText = "2ND";
                this.p1Pos.style.color = "#8fa0c0";
                this.p2Pos.innerText = "1ST";
                this.p2Pos.style.color = "#ff0055";
            }
        }

        // Draw split speed lines for P1 and P2
        this.drawSplitSpeedLines(p1Physics, p2Physics);
    }

    drawSplitSpeedLines(p1Physics, p2Physics) {
        if (!this.speedLinesCtx || !this.speedLinesCanvas) return;
        const ctx = this.speedLinesCtx;
        const w = this.speedLinesCanvas.width;
        const h = this.speedLinesCanvas.height;
        const halfW = w * 0.5;

        const p1Active = p1Physics && (p1Physics.getSpeedKmh() > 165 || p1Physics.isNitro);
        const p2Active = p2Physics && (p2Physics.getSpeedKmh() > 165 || p2Physics.isNitro);

        if (!p1Active && !p2Active) {
            if (this.speedLinesCanvas.style.opacity !== '0') {
                this.speedLinesCanvas.style.opacity = '0';
                ctx.clearRect(0, 0, w, h);
            }
            return;
        }

        this.speedLinesCanvas.style.opacity = '1';
        ctx.clearRect(0, 0, w, h);

        if (p1Active) {
            const cx1 = halfW * 0.5;
            const cy1 = h * 0.48;
            const num = p1Physics.isNitro ? 20 : 12;
            ctx.strokeStyle = p1Physics.isNitro ? 'rgba(0, 240, 255, 0.45)' : 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1.8;
            for (let i = 0; i < num; i++) {
                const angle = Math.random() * Math.PI * 2;
                const innerR = Math.min(halfW, h) * (0.28 + Math.random() * 0.20);
                const outerR = Math.min(halfW, h) * (0.55 + Math.random() * 0.35);
                ctx.beginPath();
                ctx.moveTo(cx1 + Math.cos(angle) * innerR, cy1 + Math.sin(angle) * innerR);
                ctx.lineTo(cx1 + Math.cos(angle) * outerR, cy1 + Math.sin(angle) * outerR);
                ctx.stroke();
            }
        }

        if (p2Active) {
            const cx2 = halfW + halfW * 0.5;
            const cy2 = h * 0.48;
            const num = p2Physics.isNitro ? 20 : 12;
            ctx.strokeStyle = p2Physics.isNitro ? 'rgba(255, 0, 85, 0.45)' : 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1.8;
            for (let i = 0; i < num; i++) {
                const angle = Math.random() * Math.PI * 2;
                const innerR = Math.min(halfW, h) * (0.28 + Math.random() * 0.20);
                const outerR = Math.min(halfW, h) * (0.55 + Math.random() * 0.35);
                ctx.beginPath();
                ctx.moveTo(cx2 + Math.cos(angle) * innerR, cy2 + Math.sin(angle) * innerR);
                ctx.lineTo(cx2 + Math.cos(angle) * outerR, cy2 + Math.sin(angle) * outerR);
                ctx.stroke();
            }
        }
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}
