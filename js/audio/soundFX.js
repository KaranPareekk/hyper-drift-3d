// Web Audio API procedural sound effects & dynamic synth engine
export class SoundFX {
    constructor() {
        this.ctx = null;
        this.initialized = false;

        // Engine sound nodes
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineSubOsc = null;
        this.engineFilter = null;
        this.engineGain = null;

        // Tire screech nodes
        this.screechSource = null;
        this.screechFilter = null;
        this.screechGain = null;

        // Nitro roar nodes
        this.nitroSource = null;
        this.nitroGain = null;
        this.nitroFilter = null;

        // High-speed aerodynamic wind rush nodes
        this.windSource = null;
        this.windGain = null;
        this.windFilter = null;

        // Music state & master volume
        this.musicPlaying = false;
        this.musicMuted = false;
        this.musicGain = null;
        this.musicInterval = null;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.setupEngineSynth();
            this.setupScreechSynth();
            this.setupNitroSynth();
            this.setupWindSynth();

            // Dedicated music master gain
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            this.musicGain.connect(this.ctx.destination);

            this.initialized = true;
            this.startMusic();
        } catch (e) {
            console.warn("Web Audio initialization error:", e);
        }
    }

    setupEngineSynth() {
        // Dual oscillator for rich, aggressive engine growl
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);

        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'triangle';
        this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

        this.engineSubOsc = this.ctx.createOscillator();
        this.engineSubOsc.type = 'sine';
        this.engineSubOsc.frequency.setValueAtTime(28, this.ctx.currentTime);

        // Lowpass filter for throatiness
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
        this.engineFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        // Routing
        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineSubOsc.connect(this.engineGain);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);

        this.engineOsc1.start();
        this.engineOsc2.start();
        this.engineSubOsc.start();
    }

    setupScreechSynth() {
        // Procedural white noise buffer for tire friction
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.screechSource = this.ctx.createBufferSource();
        this.screechSource.buffer = noiseBuffer;
        this.screechSource.loop = true;

        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        this.screechFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.screechSource.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.ctx.destination);

        this.screechSource.start();
    }

    setupNitroSynth() {
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.nitroSource = this.ctx.createBufferSource();
        this.nitroSource.buffer = noiseBuffer;
        this.nitroSource.loop = true;

        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'lowpass';
        this.nitroFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.nitroSource.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.ctx.destination);

        this.nitroSource.start();
    }

    setupWindSynth() {
        // High speed aerodynamic wind whoosh
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = noiseBuffer;
        this.windSource.loop = true;

        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
        this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

        this.windGain = this.ctx.createGain();
        this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.windSource.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.ctx.destination);

        this.windSource.start();
    }

    updateWind(speedKmh) {
        if (!this.initialized || !this.ctx || !this.windGain) return;
        const t = this.ctx.currentTime;
        // Wind starts becoming audible above 110 km/h, reaching peak at top speed
        const speedNorm = Math.min(1.0, Math.max(0, (speedKmh - 110) / 140));
        const targetVol = speedNorm * 0.28;
        this.windGain.gain.setTargetAtTime(targetVol, t, 0.08);

        // Filter opens with speed
        const cutoff = 400 + speedNorm * 850;
        this.windFilter.frequency.setTargetAtTime(cutoff, t, 0.08);
    }

    updateEngine(rpmRatio, throttle, speedRatio) {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Base frequency calculation (idle ~ 50Hz, max RPM ~ 380Hz)
        const baseFreq = 48 + rpmRatio * 320;
        this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.05);
        this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.05);
        this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.05);

        // Filter opens with throttle
        const filterCutoff = 350 + throttle * 1600 + rpmRatio * 1800;
        this.engineFilter.frequency.setTargetAtTime(filterCutoff, t, 0.06);

        // Engine volume
        const targetVol = 0.15 + throttle * 0.25 + rpmRatio * 0.15;
        this.engineGain.gain.setTargetAtTime(targetVol, t, 0.05);
    }

    updateDrift(driftIntensity) {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        const targetVol = Math.min(1.0, Math.max(0, driftIntensity)) * 0.35;
        this.screechGain.gain.setTargetAtTime(targetVol, t, 0.05);

        const freq = 1200 + driftIntensity * 600;
        this.screechFilter.frequency.setTargetAtTime(freq, t, 0.05);
    }

    setNitro(active) {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.nitroGain.gain.setTargetAtTime(active ? 0.38 : 0.0, t, 0.08);
    }

    playTurboFlutter() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Procedural flutter burst
        for (let i = 0; i < 4; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const startTime = t + i * 0.06;
            osc.frequency.setValueAtTime(700 - i * 60, startTime);
            osc.frequency.exponentialRampToValueAtTime(300, startTime + 0.05);

            gain.gain.setValueAtTime(0.08 * (1 - i * 0.2), startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.06);
        }
    }

    playCountdownBeep(highPitch = false) {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(highPitch ? 880 : 440, t);

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (highPitch ? 0.5 : 0.25));

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + (highPitch ? 0.55 : 0.28));
    }

    playCheckpoint() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 arpeggio
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.05);
            gain.gain.setValueAtTime(0.18, t + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t + idx * 0.05);
            osc.stop(t + idx * 0.05 + 0.22);
        });
    }

    playBarrierImpact(severity = 0.5) {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);

            const vol = Math.min(0.7, Math.max(0.2, 0.25 + severity * 0.4));
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.24);
        } catch (e) {}
    }

    playBoostPad() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            // Sci-fi high velocity charge sound
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(1100, now + 0.35);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.45);
        } catch (e) {}
    }

    playSparkSound() {
        if (!this.initialized || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1800 + Math.random() * 400, now);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    toggleMusic() {
        this.musicMuted = !this.musicMuted;
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0.0 : 0.7, this.ctx.currentTime, 0.05);
        }
        return !this.musicMuted;
    }

    // Procedural dynamic cyberpunk electronic synth soundtrack
    startMusic() {
        if (this.musicPlaying || !this.ctx) return;
        this.musicPlaying = true;

        const bpm = 132;
        const stepTime = (60 / bpm) / 4; // 16th notes
        const bassNotes = [36.7, 36.7, 43.65, 41.2, 36.7, 49.0, 43.65, 38.89]; // D1 minor pattern
        const leadNotes = [293.66, 349.23, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0];
        let step = 0;

        const targetDestination = this.musicGain || this.ctx.destination;

        this.musicInterval = setInterval(() => {
            if (!this.ctx || this.ctx.state !== 'running') return;
            const t = this.ctx.currentTime;

            // Bass synth pulse on 8th notes
            if (step % 2 === 0) {
                const noteIndex = Math.floor(step / 4) % bassNotes.length;
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(bassNotes[noteIndex], t);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(600, t);
                filter.frequency.exponentialRampToValueAtTime(120, t + 0.15);

                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(targetDestination);
                osc.start(t);
                osc.stop(t + 0.2);
            }

            // High arp melody
            if (step % 4 === 1 || step % 8 === 6) {
                const leadIdx = (step * 3) % leadNotes.length;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(leadNotes[leadIdx], t);

                gain.gain.setValueAtTime(0.035, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

                osc.connect(gain);
                gain.connect(targetDestination);
                osc.start(t);
                osc.stop(t + 0.16);
            }

            // Kick pulse on beat 1, 5, 9, 13
            if (step % 4 === 0) {
                const kickOsc = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kickOsc.frequency.setValueAtTime(140, t);
                kickOsc.frequency.exponentialRampToValueAtTime(38, t + 0.08);

                kickGain.gain.setValueAtTime(0.2, t);
                kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

                kickOsc.connect(kickGain);
                kickGain.connect(targetDestination);
                kickOsc.start(t);
                kickOsc.stop(t + 0.13);
            }

            step = (step + 1) % 64;
        }, stepTime * 1000);
    }
}
