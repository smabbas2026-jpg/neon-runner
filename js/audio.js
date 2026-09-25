/**
 * Street Runner - High-Energy Cyberpunk Synthwave Procedural Audio Engine
 * Pure Web Audio API: 128 BPM electronic action soundtrack, ambient menu theme, and punchy retro SFX.
 */
(function() {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let musicFilter = null;
    let isInitialized = false;

    // Music scheduler state
    let isPlayingMusic = false;
    let currentMusicMode = 'none'; // 'menu', 'game', 'none'
    let schedulerTimer = null;
    let nextStepTime = 0;
    let currentStep = 0;

    // Tempo settings
    const TEMPO_GAME = 128; // BPM
    const TEMPO_MENU = 88;  // BPM
    let currentBPM = TEMPO_GAME;

    function initAudio() {
        if (isInitialized && ctx) {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            return;
        }

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            ctx = new AudioCtx();

            masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
            masterGain.connect(ctx.destination);

            sfxGain = ctx.createGain();
            sfxGain.gain.setValueAtTime(0.85, ctx.currentTime);
            sfxGain.connect(masterGain);

            musicFilter = ctx.createBiquadFilter();
            musicFilter.type = 'lowpass';
            musicFilter.frequency.setValueAtTime(18000, ctx.currentTime);
            musicFilter.connect(masterGain);

            musicGain = ctx.createGain();
            musicGain.gain.setValueAtTime(0.65, ctx.currentTime);
            musicGain.connect(musicFilter);

            isInitialized = true;
        } catch (e) {
            console.warn('AudioContext initialization failed', e);
        }
    }

    function checkReady() {
        if (!ctx) initAudio();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
        return isInitialized && ctx;
    }

    // Helper: Create noise buffer for snare and hats
    let cachedNoiseBuffer = null;
    function getNoiseBuffer() {
        if (!ctx) return null;
        if (cachedNoiseBuffer) return cachedNoiseBuffer;
        const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        cachedNoiseBuffer = buffer;
        return buffer;
    }

    const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

    /* ==========================================================
       SYNTH INSTRUMENTS (Pure Web Audio Nodes)
       ========================================================== */

    // 1. Kick Drum (Punchy sub-bass pitch drop)
    function synthKick(time, gainScale = 1.0) {
        if (!ctx || !musicGain) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

        gain.gain.setValueAtTime(0.8 * gainScale, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

        osc.connect(gain);
        gain.connect(musicGain);

        osc.start(time);
        osc.stop(time + 0.22);
    }

    // 2. Snare / Cyber Clap (White noise burst + snappy tone)
    function synthSnare(time, gainScale = 1.0) {
        if (!ctx || !musicGain) return;
        const noise = getNoiseBuffer();
        if (noise) {
            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = noise;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1100, time);

            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.42 * gainScale, time);
            nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

            noiseSrc.connect(filter);
            filter.connect(nGain);
            nGain.connect(musicGain);

            noiseSrc.start(time);
            noiseSrc.stop(time + 0.18);
        }

        const osc = ctx.createOscillator();
        const tGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(230, time);
        osc.frequency.exponentialRampToValueAtTime(115, time + 0.08);

        tGain.gain.setValueAtTime(0.35 * gainScale, time);
        tGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.connect(tGain);
        tGain.connect(musicGain);

        osc.start(time);
        osc.stop(time + 0.1);
    }

    // 3. Hi-Hat (Filtered noise slice)
    function synthHiHat(time, open = false, gainScale = 1.0) {
        if (!ctx || !musicGain) return;
        const noise = getNoiseBuffer();
        if (!noise) return;
        const duration = open ? 0.11 : 0.045;
        const src = ctx.createBufferSource();
        src.buffer = noise;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 8500;
        filter.Q.value = 4.5;

        const gain = ctx.createGain();
        const baseVol = open ? 0.24 : 0.16;
        gain.gain.setValueAtTime(baseVol * gainScale, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);

        src.start(time);
        src.stop(time + duration);
    }

    // 4. Rolling Synthwave Sawtooth Bass
    function synthBass(time, freq, dur = 0.11, accent = false) {
        if (!ctx || !musicGain) return;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const startCutoff = accent ? 1200 : 750;
        const endCutoff = 160;
        filter.frequency.setValueAtTime(startCutoff, time);
        filter.frequency.exponentialRampToValueAtTime(endCutoff, time + dur);
        filter.Q.value = 5.0; // resonant analog bite

        const vol = accent ? 0.45 : 0.35;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);

        osc.start(time);
        osc.stop(time + dur);
    }

    // 5. Warm Polyphonic Synth Chords (Pads)
    function synthChord(time, freqs, duration = 1.5, volume = 0.16) {
        if (!ctx || !musicGain) return;
        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            osc.detune.setValueAtTime((idx - 1) * 7, time); // detune for wide lush sound

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, time);
            filter.frequency.linearRampToValueAtTime(700, time + duration);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(musicGain);

            osc.start(time);
            osc.stop(time + duration);
        });
    }

    // 6. Cyberpunk Lead Melody / Arpeggio
    function synthLead(time, freq, dur = 0.13, volume = 0.18) {
        if (!ctx || !musicGain) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600, time);
        filter.frequency.exponentialRampToValueAtTime(800, time + dur);
        filter.Q.value = 3.5;

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);

        osc.start(time);
        osc.stop(time + dur);
    }

    /* ==========================================================
       MUSICAL COMPOSITIONS (D Minor Synthwave)
       ========================================================== */

    // Frequencies
    const D2 = 73.42, D3 = 146.83, D4 = 293.66, D5 = 587.33;
    const Bb1 = 58.27, Bb2 = 116.54, Bb3 = 233.08, Bb4 = 466.16;
    const F2 = 87.31, F3 = 174.61, F4 = 349.23, F5 = 698.46;
    const C2 = 65.41, C3 = 130.81, C4 = 261.63, C5 = 523.25;
    const A2 = 110.00, A3 = 220.00, A4 = 440.00, A5 = 880.00;
    const G3 = 196.00, G4 = 392.00;
    const E4 = 329.63, E5 = 659.25;

    // Chord definitions: 4 bars loop (Dm -> Bb -> F -> C)
    const CHORDS = [
        [D3, F3, A3, D4],    // Dm
        [Bb2, D3, F3, Bb3],  // Bb
        [F2, A2, C3, F3],    // F
        [C3, E3, G3, C4]     // C
    ];

    const BASS_ROOTS = [
        [D2, D3],
        [Bb1, Bb2],
        [F2, F3],
        [C2, C3]
    ];

    // 64-step Lead Arp pattern (16 steps per bar)
    const GAME_LEAD_PATTERN = [
        // Bar 1 (Dm)
        D4, F4, A4, D5,  A4, F4, D4, F4,  A4, D5, F5, D5,  A4, F4, E4, D4,
        // Bar 2 (Bb)
        D4, F4, Bb4, D5, Bb4, F4, D4, F4, Bb4, D5, F5, D5, Bb4, F4, G4, F4,
        // Bar 3 (F)
        C4, F4, A4, C5,  A4, F4, C4, F4,  A4, C5, F5, C5,  A4, F4, G4, F4,
        // Bar 4 (C)
        C4, E4, G4, C5,  G4, E4, C4, E4,  G4, C5, E5, C5,  G4, A4, C5, E5
    ];

    // Ambient Menu Arp (Gentle, spaced out)
    const MENU_LEAD_PATTERN = [
        D4, 0, A4, 0,  F4, 0, D4, 0,  E4, 0, A4, 0,  D5, 0, 0, 0,
        Bb3, 0, F4, 0, D4, 0, Bb3, 0, C4, 0, G4, 0,  F4, 0, 0, 0,
        F3, 0, C4, 0,  A4, 0, F4, 0,  G4, 0, D4, 0,  C4, 0, 0, 0,
        C4, 0, G4, 0,  E4, 0, C4, 0,  D4, 0, A4, 0,  D4, 0, 0, 0
    ];

    /* ==========================================================
       PRECISION WEB AUDIO LOOKAHEAD SCHEDULER
       ========================================================== */

    function scheduleMusic() {
        if (!isPlayingMusic || !ctx || ctx.state === 'suspended') return;

        const settings = window.GameState ? window.GameState.get().settings : {};
        if (settings.musicMuted) return;

        const secondsPer16th = (60 / currentBPM) / 4;
        const scheduleAheadTime = 0.12; // schedule 120ms into future

        while (nextStepTime < ctx.currentTime + scheduleAheadTime) {
            const time = nextStepTime;
            const barIndex = Math.floor(currentStep / 16) % 4;
            const stepInBar = currentStep % 16;

            if (currentMusicMode === 'game') {
                // ---- GAME ACTION MODE (High Energy 128 BPM) ----

                // 1. Kick on every quarter note (beats 1, 2, 3, 4)
                if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
                    synthKick(time);
                }

                // 2. Snare on beats 2 and 4 (steps 4 and 12)
                if (stepInBar === 4 || stepInBar === 12) {
                    synthSnare(time);
                }

                // 3. Hi-Hats: 16th notes with open hats on upbeats
                const isOpenHat = (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14);
                synthHiHat(time, isOpenHat, isOpenHat ? 1.2 : 0.85);

                // 4. Rolling 16th Bassline (octave pumping)
                const bassRoot = BASS_ROOTS[barIndex];
                const isOctaveHigh = (stepInBar % 2 === 1);
                const bassFreq = isOctaveHigh ? bassRoot[1] : bassRoot[0];
                const isAccent = (stepInBar === 0 || stepInBar === 8);
                synthBass(time, bassFreq, secondsPer16th * 0.9, isAccent);

                // 5. Chords on start of each bar
                if (stepInBar === 0) {
                    synthChord(time, CHORDS[barIndex], secondsPer16th * 15, 0.14);
                }

                // 6. Lead Arpeggio Melody
                const leadNote = GAME_LEAD_PATTERN[currentStep % GAME_LEAD_PATTERN.length];
                if (leadNote) {
                    synthLead(time, leadNote, secondsPer16th * 0.85, 0.18);
                }

            } else if (currentMusicMode === 'menu') {
                // ---- AMBIENT MENU MODE (Chill Cyber Synthpad 88 BPM) ----

                // Warm chord pad at start of bar
                if (stepInBar === 0) {
                    synthChord(time, CHORDS[barIndex], secondsPer16th * 15.5, 0.22);
                }

                // Gentle low bass note on bar start
                if (stepInBar === 0) {
                    synthBass(time, BASS_ROOTS[barIndex][0], secondsPer16th * 6, false);
                }

                // Sparse, gentle ambient arpeggio
                const menuNote = MENU_LEAD_PATTERN[currentStep % MENU_LEAD_PATTERN.length];
                if (menuNote && menuNote > 0) {
                    synthLead(time, menuNote, secondsPer16th * 2.0, 0.11);
                }
            }

            // Advance step
            nextStepTime += secondsPer16th;
            currentStep = (currentStep + 1) % 64;
        }
    }

    function startScheduler(mode = 'game') {
        if (!checkReady()) return;

        currentMusicMode = mode;
        currentBPM = (mode === 'menu') ? TEMPO_MENU : TEMPO_GAME;

        if (musicGain && ctx) {
            const settings = window.GameState ? window.GameState.get().settings : {};
            const targetGain = settings.musicMuted ? 0.0 : (mode === 'menu' ? 0.50 : 0.65);
            musicGain.gain.setValueAtTime(targetGain, ctx.currentTime);
        }

        if (musicFilter && ctx) {
            musicFilter.frequency.setValueAtTime(18000, ctx.currentTime);
        }

        if (isPlayingMusic) {
            // Mode changed while already playing - keep sync
            return;
        }

        isPlayingMusic = true;
        currentStep = 0;
        nextStepTime = ctx.currentTime + 0.05;

        if (schedulerTimer) clearInterval(schedulerTimer);
        schedulerTimer = setInterval(scheduleMusic, 25);
    }

    function stopMusicEngine() {
        isPlayingMusic = false;
        currentMusicMode = 'none';
        if (schedulerTimer) {
            clearInterval(schedulerTimer);
            schedulerTimer = null;
        }
        if (musicGain && ctx) {
            musicGain.gain.setValueAtTime(0.001, ctx.currentTime);
        }
    }

    /* ==========================================================
       PUBLIC AUDIO API
       ========================================================== */

    const Sound = {
        init: initAudio,

        playClick: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

            osc.connect(gain);
            gain.connect(sfxGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        },

        playSwipe: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1200, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.22, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(sfxGain);

            osc.start();
            osc.stop(ctx.currentTime + 0.09);
        },

        playJump: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(160, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.22);

            gain.gain.setValueAtTime(0.28, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(sfxGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        },

        playSlide: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const noise = getNoiseBuffer();
            if (!noise) return;

            const src = ctx.createBufferSource();
            src.buffer = noise;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.25);
            filter.Q.value = 3;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            src.connect(filter);
            filter.connect(gain);
            gain.connect(sfxGain);

            src.start();
            src.stop(ctx.currentTime + 0.25);
        },

        playDiamond: function(comboCount) {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const noteIdx = Math.min((comboCount || 0), PENTATONIC.length - 1);
            const freq = PENTATONIC[noteIdx] || 523.25;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const oscSparkle = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';
            oscSparkle.type = 'sine';

            osc1.frequency.setValueAtTime(freq, ctx.currentTime);
            osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime);
            oscSparkle.frequency.setValueAtTime(freq * 4, ctx.currentTime);

            gain.gain.setValueAtTime(0.26, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            osc1.connect(gain);
            osc2.connect(gain);
            oscSparkle.connect(gain);
            gain.connect(sfxGain);

            osc1.start();
            osc2.start();
            oscSparkle.start();
            osc1.stop(ctx.currentTime + 0.25);
            osc2.stop(ctx.currentTime + 0.25);
            oscSparkle.stop(ctx.currentTime + 0.25);
        },

        playCoin: function(comboCount) {
            this.playDiamond(comboCount);
        },

        playPowerup: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const now = ctx.currentTime;
            const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
            notes.forEach((f, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(f, now + i * 0.05);

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2000, now + i * 0.05);

                gain.gain.setValueAtTime(0.22, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);

                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.22);
            });
        },

        playShieldHit: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.35);

            gain.gain.setValueAtTime(0.45, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

            osc.connect(gain);
            gain.connect(sfxGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        },

        playCrash: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            // Deep sub-bass punch
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.45);
            oscGain.gain.setValueAtTime(0.5, ctx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            osc.connect(oscGain);
            oscGain.connect(sfxGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.45);

            // Explosive white noise burst
            const noise = getNoiseBuffer();
            if (noise) {
                const src = ctx.createBufferSource();
                src.buffer = noise;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(900, ctx.currentTime);
                filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.55);

                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0.42, ctx.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

                src.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(sfxGain);
                src.start();
                src.stop(ctx.currentTime + 0.55);
            }
        },

        /* ---- MUSIC CONTROL METHODS ---- */

        // Start high-octane in-game action music
        startMusic: function(mode = 'game') {
            startScheduler(mode);
        },

        // Explicit method for game action track
        playActionMusic: function() {
            startScheduler('game');
        },

        // Explicit method for ambient menu track
        playMenuMusic: function() {
            startScheduler('menu');
        },

        stopMusic: function() {
            stopMusicEngine();
        },

        // Muffle music when paused (club bathroom effect)
        pauseMusic: function() {
            if (musicFilter && ctx) {
                musicFilter.frequency.setTargetAtTime(450, ctx.currentTime, 0.08);
            }
            if (musicGain && ctx) {
                musicGain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.08);
            }
        },

        // Restore crisp full frequency when unpaused
        resumeMusic: function() {
            if (musicFilter && ctx) {
                musicFilter.frequency.setTargetAtTime(18000, ctx.currentTime, 0.08);
            }
            if (musicGain && ctx) {
                const targetGain = (currentMusicMode === 'menu') ? 0.50 : 0.65;
                musicGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
            }
        },

        setSfxVolume: function(vol) {
            if (sfxGain && ctx) {
                sfxGain.gain.setValueAtTime(vol, ctx.currentTime);
            }
        },

        setMusicVolume: function(vol) {
            if (musicGain && ctx) {
                musicGain.gain.setValueAtTime(vol, ctx.currentTime);
            }
        }
    };

    window.AudioEngine = Sound;

    // Auto-listen to first touch/click anywhere to initialize AudioContext & start menu music
    ['touchstart', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, function onUserInteraction() {
            if (checkReady()) {
                const settings = window.GameState ? window.GameState.get().settings : {};
                if (!settings.musicMuted && !isPlayingMusic) {
                    Sound.playMenuMusic();
                }
                window.removeEventListener(evt, onUserInteraction);
            }
        }, { once: false, passive: true });
    });
})();
