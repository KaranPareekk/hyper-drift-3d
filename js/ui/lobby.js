export class LobbyUI {
    constructor(game) {
        this.game = game;

        // UI elements
        this.menuScreen = document.getElementById('menuScreen');
        this.hudScreen = document.getElementById('hudScreen');

        // Car Select buttons
        this.btnApex = document.getElementById('btnSelectApex');
        this.btnVortex = document.getElementById('btnSelectVortex');
        this.colorButtons = document.querySelectorAll('.color-dot');

        // Track seed buttons
        this.seedInput = document.getElementById('trackSeedInput');
        this.btnRandomSeed = document.getElementById('btnRandomSeed');

        // Game mode buttons
        this.btnStartSolo = document.getElementById('btnStartSolo');
        this.btnCreateRoom = document.getElementById('btnCreateRoom');
        this.btnJoinRoom = document.getElementById('btnJoinRoom');
        this.roomCodeInput = document.getElementById('roomCodeInput');
        this.roomStatusEl = document.getElementById('roomStatus');

        this.setupListeners();
    }

    setupListeners() {
        // Car selection
        if (this.btnApex) {
            this.btnApex.addEventListener('click', () => {
                this.selectCar('apex');
            });
        }
        if (this.btnVortex) {
            this.btnVortex.addEventListener('click', () => {
                this.selectCar('vortex');
            });
        }

        // Color buttons
        this.colorButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hexStr = e.target.getAttribute('data-color');
                const colorHex = parseInt(hexStr, 16);
                this.colorButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.game.setCarColor(colorHex);
            });
        });

        // Track seed
        if (this.btnRandomSeed) {
            this.btnRandomSeed.addEventListener('click', () => {
                const randomSeed = "TRACK-" + Math.floor(100 + Math.random() * 900);
                if (this.seedInput) this.seedInput.value = randomSeed;
                this.game.setTrackSeed(randomSeed);
            });
        }

        if (this.seedInput) {
            this.seedInput.addEventListener('change', (e) => {
                this.game.setTrackSeed(e.target.value.trim() || "TRACK-1");
            });
        }

        // Steering Sensitivity Slider
        this.sliderSensMenu = document.getElementById('sliderSensitivityMenu');
        this.txtSensMenu = document.getElementById('txtSensitivityMenu');
        if (this.sliderSensMenu) {
            this.sliderSensMenu.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (this.txtSensMenu) this.txtSensMenu.innerText = `${val.toFixed(1)}x`;
                this.game.selectedSensitivity = val;
                const hudSlider = document.getElementById('sliderSensitivityHud');
                const hudTxt = document.getElementById('txtSensitivityHud');
                if (hudSlider) hudSlider.value = val;
                if (hudTxt) hudTxt.innerText = `${val.toFixed(1)}x`;
            });
        }

        // Solo Race
        if (this.btnStartSolo) {
            this.btnStartSolo.addEventListener('click', () => {
                this.startGame(false);
            });
        }

        // Multiplayer Create Room
        if (this.btnCreateRoom) {
            this.btnCreateRoom.addEventListener('click', async () => {
                if (this.roomStatusEl) this.roomStatusEl.innerText = "Creating room...";
                try {
                    const code = await this.game.multiplayer.createRoom();
                    if (this.roomStatusEl) {
                        this.roomStatusEl.innerHTML = `
                            <div style="background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; border-radius: 8px; padding: 0.6rem; margin-top: 0.4rem;">
                                <div>Room Code: <strong style="color:#00f0ff; font-size:1.25rem; letter-spacing: 2px;">${code}</strong></div>
                                <div style="font-size: 0.78rem; color: #8fa0c0; margin: 4px 0;">Share this code with your friend. Waiting for opponent...</div>
                                <button id="btnHostStartNow" class="btn-primary" style="padding: 0.45rem; font-size: 0.8rem; margin-top: 4px;">START RACE NOW</button>
                            </div>
                        `;
                        const startNowBtn = document.getElementById('btnHostStartNow');
                        if (startNowBtn) {
                            startNowBtn.addEventListener('click', () => {
                                this.startGame(true);
                            });
                        }
                    }

                    // Auto-launch when friend joins
                    this.game.multiplayer.onPeerConnected = (peerId) => {
                        if (this.roomStatusEl) {
                            this.roomStatusEl.innerHTML = `<strong style="color:#00ff88; font-size: 1.05rem;">OPPONENT CONNECTED! 🏎️ Launching race...</strong>`;
                        }
                        setTimeout(() => {
                            this.startGame(true);
                        }, 1200);
                    };
                } catch (e) {
                    if (this.roomStatusEl) this.roomStatusEl.innerText = "Failed to connect to room server. Starting solo...";
                    setTimeout(() => this.startGame(false), 1500);
                }
            });
        }

        // Multiplayer Join Room
        if (this.btnJoinRoom) {
            this.btnJoinRoom.addEventListener('click', async () => {
                const code = this.roomCodeInput.value.trim().toUpperCase();
                if (!code) {
                    alert("Please enter a room code!");
                    return;
                }
                if (this.roomStatusEl) this.roomStatusEl.innerText = `Connecting to room ${code}...`;
                try {
                    await this.game.multiplayer.joinRoom(code);
                    if (this.roomStatusEl) this.roomStatusEl.innerHTML = `<strong style="color:#00ff88; font-size: 1.05rem;">CONNECTED! 🏎️ Loading track and joining race...</strong>`;
                    setTimeout(() => {
                        this.startGame(true);
                    }, 1000);
                } catch (e) {
                    if (this.roomStatusEl) this.roomStatusEl.innerText = "Could not find room with that code. Make sure the host has created it!";
                }
            });
        }
    }

    selectCar(type) {
        if (type === 'apex') {
            this.btnApex.classList.add('active');
            this.btnVortex.classList.remove('active');
        } else {
            this.btnVortex.classList.add('active');
            this.btnApex.classList.remove('active');
        }
        this.game.setCarType(type);
    }

    startGame(isMultiplayer = false) {
        // Init sound on user gesture
        if (this.game.sound) {
            this.game.sound.init();
        }

        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        window.focus();

        if (this.menuScreen) this.menuScreen.style.display = 'none';
        if (this.hudScreen) this.hudScreen.style.display = 'block';

        this.game.startRace(isMultiplayer);
    }
}
