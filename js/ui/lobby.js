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

        // Multiplayer System (Temporarily Disabled - Shows Coming Soon notice)
        const showComingSoonNotice = () => {
            if (this.roomStatusEl) {
                this.roomStatusEl.innerHTML = `
                    <div class="coming-soon-badge">
                        <span>🔒 Coming Soon / Not Yet Available</span>
                    </div>
                `;
            }
        };

        if (this.btnCreateRoom) {
            this.btnCreateRoom.addEventListener('click', () => {
                showComingSoonNotice();
            });
        }

        if (this.btnJoinRoom) {
            this.btnJoinRoom.addEventListener('click', () => {
                showComingSoonNotice();
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

        this.game.startRace(isMultiplayer);
    }
}
