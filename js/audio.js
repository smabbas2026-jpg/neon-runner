/**
 * Street Runner - High-Energy Cyberpunk Electronic Audio Engine
 * Pure Web Audio API: 130 BPM Electronic Action Soundtrack (with Sidechain Ducking,
 * Multi-Section Arrangement, Punchy 909 Drums & Supersaw Leads), Ambient Downtempo
 * Menu Theme, and Crisp Retro SFX.
 */
(function() {
    'use strict';

    let ctx = null;
    let masterCompressor = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let musicFilter = null;
    let duckingGain = null;
    let drumBus = null;
    let isInitialized = false;

    // Music scheduler state
    let isPlayingMusic = false;
    let currentMusicMode = 'none'; // 'menu', 'game', 'none'
    let schedulerTimer = null;
    let nextStepTime = 0;
    let currentStep = 0;

    // Tempo settings
    const TEMPO_GAME = 130; // BPM Electronic Dance Music
    const TEMPO_MENU = 96;  // BPM Chillwave Electronica
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

            // 1. Master Dynamics Compressor (Mastering Bus Limiter / Glue)
            masterCompressor = ctx.createDynamicsCompressor();
            masterCompressor.threshold.setValueAtTime(-14, ctx.currentTime);
            masterCompressor.knee.setValueAtTime(20, ctx.currentTime);
            masterCompressor.ratio.setValueAtTime(4.5, ctx.currentTime);
            masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
            masterCompressor.release.setValueAtTime(0.18, ctx.currentTime);
            masterCompressor.connect(ctx.destination);

            // 2. Master Gain
            masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
            masterGain.connect(masterCompressor);

            // 3. Sound Effects Bus
            sfxGain = ctx.createGain();
            sfxGain.gain.setValueAtTime(0.85, ctx.currentTime);
            sfxGain.connect(masterGain);

            // 4. Music Gain Bus
            musicGain = ctx.createGain();
            musicGain.gain.setValueAtTime(0.65, ctx.currentTime);
            musicGain.connect(masterGain);

            // 5. Music Master Lowpass Filter (for pause muffling / club effect)
            musicFilter = ctx.createBiquadFilter();
            musicFilter.type = 'lowpass';
            musicFilter.frequency.setValueAtTime(19000, ctx.currentTime);
            musicFilter.Q.setValueAtTime(1.0, ctx.currentTime);
            musicFilter.connect(musicGain);

            // 6. Drum Bus (Bypasses sidechain ducking so drums hit with full punch)
            drumBus = ctx.createGain();
            drumBus.gain.setValueAtTime(1.0, ctx.currentTime);
            drumBus.connect(musicFilter);

            // 7. Melodic Ducking Bus (Sidechain pumping effect on bass, chords & leads)
            duckingGain = ctx.createGain();
            duckingGain.gain.setValueAtTime(1.0, ctx.currentTime);
            duckingGain.connect(musicFilter);

            isInitialized = true;
        } catch (e) {
            console.warn('AudioContext initialization failed', e);
        }
    }

    function checkReady() {
        if (!ctx) initAudio();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        return isInitialized && ctx;
    }

    // Helper: Create cached noise buffer for snare, claps, hats, and risers
    let cachedNoiseBuffer = null;
    function getNoiseBuffer() {
        if (!ctx) return null;
        if (cachedNoiseBuffer) return cachedNoiseBuffer;
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        cachedNoiseBuffer = buffer;
        return buffer;
    }

    // Sidechain Compression Trigger (The signature pumping effect of Electronic Music)
    function triggerSidechain(time, depth = 0.22, duration = 0.17) {
        if (!ctx || !duckingGain) return;
        try {
            duckingGain.gain.cancelScheduledValues(time);
            duckingGain.gain.setValueAtTime(depth, time);
            duckingGain.gain.exponentialRampToValueAtTime(1.0, time + duration);
        } catch (e) {}
    }

    const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

    /* ==========================================================
       ELECTRONIC DRUM SYNTHESIZERS (Pure Web Audio)
       ========================================================== */

    // 1. Electronic 909-Style Cyber Kick (Punchy pitch drop + click transient)
    function synthKick(time, gainScale = 1.0) {
        if (!ctx || !drumBus) return;

        // Trigger sidechain ducking on instruments
        triggerSidechain(time, 0.18, 0.17);

        // Body: deep pitch sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(175, time);
        osc.frequency.exponentialRampToValueAtTime(36, time + 0.14);

        gain.gain.setValueAtTime(0.85 * gainScale, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

        osc.connect(gain);
        gain.connect(drumBus);

        osc.start(time);
        osc.stop(time + 0.24);

        // Click Transient: 8ms high-frequency bite
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(1200, time);
        clickOsc.frequency.exponentialRampToValueAtTime(260, time + 0.008);

        clickGain.gain.setValueAtTime(0.40 * gainScale, time);
        clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);

        clickOsc.connect(clickGain);
        clickGain.connect(drumBus);

        clickOsc.start(time);
        clickOsc.stop(time + 0.009);
    }

    // 2. Electronic Snare & Cyber Clap
    function synthSnare(time, gainScale = 1.0, withClap = true) {
        if (!ctx || !drumBus) return;
        const noise = getNoiseBuffer();

        // Layer 1: Filtered Snappy Noise
        if (noise) {
            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = noise;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1600, time);
            filter.Q.setValueAtTime(2.2, time);

            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.45 * gainScale, time);
            nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.20);

            noiseSrc.connect(filter);
            filter.connect(nGain);
            nGain.connect(drumBus);

            noiseSrc.start(time);
            noiseSrc.stop(time + 0.20);
        }

        // Layer 2: Snare Fundamental Body Tone
        const osc = ctx.createOscillator();
        const tGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(210, time);
        osc.frequency.exponentialRampToValueAtTime(105, time + 0.09);

        tGain.gain.setValueAtTime(0.40 * gainScale, time);
        tGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

        osc.connect(tGain);
        tGain.connect(drumBus);

        osc.start(time);
        osc.stop(time + 0.11);

        // Layer 3: Clap Pre-Flam (Authentic EDM clap snap)
        if (withClap && noise) {
            const flamSrc = ctx.createBufferSource();
            flamSrc.buffer = noise;
            const flamFilter = ctx.createBiquadFilter();
            flamFilter.type = 'highpass';
            flamFilter.frequency.setValueAtTime(1200, time);

            const flamGain = ctx.createGain();
            flamGain.gain.setValueAtTime(0.25 * gainScale, time);
            flamGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

            flamSrc.connect(flamFilter);
            flamFilter.connect(flamGain);
            flamGain.connect(drumBus);

            flamSrc.start(time);
            flamSrc.stop(time + 0.02);
        }
    }

    // 3. Electronic Hi-Hat (Crisp Metallic Noise)
    function synthHiHat(time, open = false, gainScale = 1.0) {
        if (!ctx || !drumBus) return;
        const noise = getNoiseBuffer();
        if (!noise) return;

        const duration = open ? 0.13 : 0.042;
        const src = ctx.createBufferSource();
        src.buffer = noise;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(8800, time);
        filter.Q.setValueAtTime(5.5, time);

        const gain = ctx.createGain();
        const baseVol = open ? 0.28 : 0.18;
        gain.gain.setValueAtTime(baseVol * gainScale, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(drumBus);

        src.start(time);
        src.stop(time + duration);
    }

    // 4. White-Noise Riser (Electronic Buildup Sweeper)
    function synthRiser(time, duration = 1.8) {
        if (!ctx || !drumBus) return;
        const noise = getNoiseBuffer();
        if (!noise) return;

        const src = ctx.createBufferSource();
        src.buffer = noise;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.exponentialRampToValueAtTime(8500, time + duration);
        filter.Q.setValueAtTime(4.0, time);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, time);
        gain.gain.linearRampToValueAtTime(0.35, time + duration * 0.9);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(drumBus);

        src.start(time);
        src.stop(time + duration);
    }

    /* ==========================================================
       ELECTRONIC SYNTH INSTRUMENTS (Routed through Ducking Bus)
       ========================================================== */

    // 5. Rolling Electronic Sawtooth Bass + Sub Sine Layer
    function synthBass(time, freq, dur = 0.12, accent = false) {
        if (!ctx || !duckingGain) return;

        // Primary Sawtooth Oscillator (Aggressive Cyber Biting Tone)
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        const startCutoff = accent ? 1800 : 950;
        const endCutoff = 180;
        filter.frequency.setValueAtTime(startCutoff, time);
        filter.frequency.exponentialRampToValueAtTime(endCutoff, time + dur);
        filter.Q.setValueAtTime(5.0, time); // resonant bite

        const vol = accent ? 0.46 : 0.36;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(duckingGain);

        osc.start(time);
        osc.stop(time + dur);

        // Sub-Bass Sine Layer (Deep chest thump)
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq / 2, time);

        subGain.gain.setValueAtTime(accent ? 0.42 : 0.32, time);
        subGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        subOsc.connect(subGain);
        subGain.connect(duckingGain);

        subOsc.start(time);
        subOsc.stop(time + dur);
    }

    // 6. Polyphonic Supersaw Stabs (Syncopated Electro Chords)
    function synthChordStab(time, freqs, duration = 0.22, volume = 0.16) {
        if (!ctx || !duckingGain) return;

        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            osc.detune.setValueAtTime((idx - 1.5) * 9, time); // detuned supersaw spread

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2400, time);
            filter.frequency.exponentialRampToValueAtTime(600, time + duration);
            filter.Q.setValueAtTime(2.5, time);

            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(duckingGain);

            osc.start(time);
            osc.stop(time + duration);
        });
    }

    // 7. Lush Ambient Synth Chords (Pads for Menu & Transitions)
    function synthPad(time, freqs, duration = 1.6, volume = 0.18) {
        if (!ctx || !duckingGain) return;

        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            osc.detune.setValueAtTime((idx - 1) * 8, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1500, time);
            filter.frequency.linearRampToValueAtTime(750, time + duration);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(duckingGain);

            osc.start(time);
            osc.stop(time + duration);
        });
    }

    // 8. Soaring Cyberpunk Electronic Lead Melody Synth
    function synthLead(time, freq, dur = 0.15, volume = 0.22, octaveUp = true) {
        if (!ctx || !duckingGain) return;

        // Primary Lead (Dual Detuned Sawtooth)
        [-7, 7].forEach(detune => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            osc.detune.setValueAtTime(detune, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(3200, time);
            filter.frequency.exponentialRampToValueAtTime(1000, time + dur);
            filter.Q.setValueAtTime(4.0, time);

            gain.gain.setValueAtTime(volume * 0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(duckingGain);

            osc.start(time);
            osc.stop(time + dur);
        });

        // Harmonic High Octave Sheen
        if (octaveUp) {
            const highOsc = ctx.createOscillator();
            const highGain = ctx.createGain();
            highOsc.type = 'triangle';
            highOsc.frequency.setValueAtTime(freq * 2, time);

            highGain.gain.setValueAtTime(volume * 0.35, time);
            highGain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.8);

            highOsc.connect(highGain);
            highGain.connect(duckingGain);

            highOsc.start(time);
            highOsc.stop(time + dur * 0.8);
        }
    }

    // 9. Crystalline Electronic Arpeggio Pluck
    function synthPluck(time, freq, dur = 0.12, volume = 0.16) {
        if (!ctx || !duckingGain) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, time);
        filter.frequency.exponentialRampToValueAtTime(400, time + dur);
        filter.Q.setValueAtTime(3.0, time);

        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(duckingGain);

        osc.start(time);
        osc.stop(time + dur);
    }

    /* ==========================================================
       ELECTRONIC MUSIC COMPOSITIONS & ARRANGEMENTS
       Key: D Minor (D, E, F, G, A, Bb, C)
       ========================================================== */

    const D2 = 73.42, D3 = 146.83, D4 = 293.66, D5 = 587.33;
    const Bb1 = 58.27, Bb2 = 116.54, Bb3 = 233.08, Bb4 = 466.16;
    const F2 = 87.31, F3 = 174.61, F4 = 349.23, F5 = 698.46;
    const C2 = 65.41, C3 = 130.81, C4 = 261.63, C5 = 523.25;
    const A2 = 110.00, A3 = 220.00, A4 = 440.00, A5 = 880.00;
    const G2 = 98.00, G3 = 196.00, G4 = 392.00, G5 = 783.99;
    const E2 = 82.41, E3 = 164.81, E4 = 329.63, E5 = 659.25;

    // 4-Bar Chord Loop (Dm -> Bb -> F -> C)
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

    // High-Energy Electronic Hook Melody (Section 1 Drop Lead)
    const GAME_HOOK_MELODY = [
        // Bar 1 (Dm)
        D5, 0, D5, A4,  0, F4, G4, A4,  D5, 0, E5, F5,  E5, D5, A4, 0,
        // Bar 2 (Bb)
        D5, 0, F5, D5,  0, Bb4, C5, D5, F5, 0, G5, F5,  D5, C5, Bb4, 0,
        // Bar 3 (F)
        C5, 0, C5, A4,  0, F4, G4, A4,  C5, 0, D5, C5,  A4, G4, F4, 0,
        // Bar 4 (C)
        G4, 0, C5, E5,  0, G5, F5, E5,  D5, 0, E5, D5,  C5, A4, C5, E5
    ];

    // Cascading Fast 16th Electronic Arpeggio (Section 2)
    const GAME_CASCADE_ARP = [
        // Bar 1 (Dm)
        D4, F4, A4, D5,  F5, D5, A4, F4,  D4, F4, A4, D5,  F5, D5, E5, D5,
        // Bar 2 (Bb)
        D4, F4, Bb4, D5, F5, D5, Bb4, F4, D4, F4, Bb4, D5, F5, D5, G5, F5,
        // Bar 3 (F)
        C4, F4, A4, C5,  F5, C5, A4, F4,  C4, F4, A4, C5,  F5, C5, G5, F5,
        // Bar 4 (C)
        C4, E4, G4, C5,  E5, C5, G4, E4,  C4, E4, G4, C5,  E5, D5, C5, E5
    ];

    // Downtempo Chillwave Electronic Menu Arp (96 BPM)
    const MENU_CHILL_ARP = [
        D4, 0, A4, 0,  F4, 0, D5, 0,  A4, 0, E5, 0,  D5, 0, 0, 0,
        Bb3, 0, F4, 0, D4, 0, Bb4, 0, F4, 0, D5, 0,  C5, 0, 0, 0,
        F3, 0, C4, 0,  A4, 0, F4, 0,  C5, 0, A4, 0,  G4, 0, 0, 0,
        C4, 0, G4, 0,  E4, 0, C5, 0,  G4, 0, E5, 0,  D5, 0, 0, 0
    ];

    /* ==========================================================
       PRECISION WEB AUDIO LOOKAHEAD SCHEDULER
       ========================================================== */

    function scheduleMusic() {
        if (!isPlayingMusic || !ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
            return;
        }

        const settings = window.GameState ? window.GameState.get().settings : {};
        if (settings.musicMuted) return;

        const secondsPer16th = (60 / currentBPM) / 4;
        const scheduleAheadTime = 0.12; // 120ms lookahead

        if (nextStepTime < ctx.currentTime) {
            nextStepTime = ctx.currentTime + 0.02;
        }

        while (nextStepTime < ctx.currentTime + scheduleAheadTime) {
            const time = Math.max(ctx.currentTime, nextStepTime);

            try {
                // Total 256 steps = 16 bars (4 bars per section)
                const globalBar = Math.floor(currentStep / 16) % 16;
                const section = Math.floor(globalBar / 4); // 0, 1, 2, 3
                const barIndex = globalBar % 4; // 0, 1, 2, 3
                const stepInBar = currentStep % 16;

            if (currentMusicMode === 'game') {
                // ======================================================
                // HIGH-ENERGY ELECTRONIC GAMEPLAY TRACK (130 BPM)
                // ======================================================

                const isBuildup = (section === 3);

                // --- 1. KICK DRUM (Four-on-the-floor beat) ---
                if (!isBuildup || barIndex >= 2) {
                    if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
                        synthKick(time);
                    }
                } else if (isBuildup && barIndex === 0) {
                    // Buildup Bar 0: Quarter note kicks
                    if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
                        synthKick(time, 0.7);
                    }
                }

                // --- 2. SNARE / CLAP ---
                if (!isBuildup) {
                    // Snare on beats 2 and 4 (steps 4 and 12)
                    if (stepInBar === 4 || stepInBar === 12) {
                        const withClap = (section === 1 || section === 2);
                        synthSnare(time, 1.0, withClap);
                    }
                } else {
                    // Buildup acceleration: 8th notes -> 16th notes -> roll
                    if (barIndex === 0 || barIndex === 1) {
                        if (stepInBar % 4 === 0) synthSnare(time, 0.65, false);
                    } else if (barIndex === 2) {
                        if (stepInBar % 2 === 0) synthSnare(time, 0.75, false);
                    } else if (barIndex === 3) {
                        if (stepInBar < 12) {
                            synthSnare(time, 0.85, true);
                        } else if (stepInBar === 12) {
                            // Turnaround crash / silence tension
                            synthSnare(time, 1.2, true);
                        }
                    }
                }

                // --- 3. CRISP HI-HATS ---
                if (!isBuildup || barIndex < 2) {
                    // Open hat on upbeats (steps 2, 6, 10, 14)
                    const isOpen = (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14);
                    const isClosed = (stepInBar % 2 === 0);
                    if (isOpen) {
                        synthHiHat(time, true, 1.1);
                    } else if (isClosed) {
                        synthHiHat(time, false, 0.75);
                    }
                }

                // --- 4. WHITE NOISE RISER BEFORE THE DROP ---
                if (isBuildup && barIndex === 2 && stepInBar === 0) {
                    synthRiser(time, secondsPer16th * 30);
                }

                // --- 5. ROLLING 16TH ELECTRONIC BASSLINE ---
                if (!isBuildup || barIndex < 2) {
                    const bassRoot = BASS_ROOTS[barIndex];
                    // Octave bouncing pattern: Low, Low, High, Low
                    const isOctaveHigh = (stepInBar % 4 === 2);
                    const freq = isOctaveHigh ? bassRoot[1] : bassRoot[0];
                    const isAccent = (stepInBar === 0 || stepInBar === 8);
                    synthBass(time, freq, secondsPer16th * 0.88, isAccent);
                }

                // --- 6. SYNCOPATED SUPERSAW CHORD STABS ---
                // Stabs on off-beats (e.g., step 3, 6, 11, 14) for pumping rhythm
                if (section === 0 || section === 1) {
                    if (stepInBar === 3 || stepInBar === 6 || stepInBar === 11 || stepInBar === 14) {
                        synthChordStab(time, CHORDS[barIndex], secondsPer16th * 2.2, 0.16);
                    }
                } else if (section === 2) {
                    // Sustained pad backdrop behind the cascade arp
                    if (stepInBar === 0) {
                        synthPad(time, CHORDS[barIndex], secondsPer16th * 15, 0.14);
                    }
                }

                // --- 7. MELODIC HOOK / LEAD & ARP ---
                if (section === 1) {
                    // SECTION 1: THE MAIN DROP & LEAD HOOK
                    const hookNote = GAME_HOOK_MELODY[currentStep % GAME_HOOK_MELODY.length];
                    if (hookNote && hookNote > 0) {
                        synthLead(time, hookNote, secondsPer16th * 1.4, 0.22, true);
                    }
                } else if (section === 2) {
                    // SECTION 2: FAST CASCADING 16TH ARPEGGIO RUN
                    const arpNote = GAME_CASCADE_ARP[currentStep % GAME_CASCADE_ARP.length];
                    if (arpNote) {
                        synthPluck(time, arpNote, secondsPer16th * 0.9, 0.18);
                    }
                } else if (section === 0) {
                    // SECTION 0: INTRO / VERSE FILTERED PLUCK GROOVE
                    if (stepInBar % 2 === 0) {
                        const introNote = GAME_CASCADE_ARP[currentStep % GAME_CASCADE_ARP.length];
                        if (introNote) synthPluck(time, introNote, secondsPer16th * 1.1, 0.12);
                    }
                }

            } else if (currentMusicMode === 'menu') {
                // ======================================================
                // DOWNTEMPO CHILLWAVE ELECTRONIC MENU THEME (96 BPM)
                // ======================================================

                // Smooth 808-Style Sub Kick on beat 1 & beat 3+
                if (stepInBar === 0 || stepInBar === 10) {
                    synthKick(time, 0.55);
                }

                // Soft electronic rimshot / snare on beat 3
                if (stepInBar === 8) {
                    synthSnare(time, 0.40, false);
                }

                // Soft closed hi-hat groove
                if (stepInBar % 2 === 0) {
                    synthHiHat(time, false, 0.45);
                }

                // Warm polyphonic supersaw pad at start of bar
                if (stepInBar === 0) {
                    synthPad(time, CHORDS[barIndex], secondsPer16th * 15.5, 0.22);
                    synthBass(time, BASS_ROOTS[barIndex][0], secondsPer16th * 6.0, false);
                }

                // Crystalline ambient electronic pluck melody
                const chillNote = MENU_CHILL_ARP[currentStep % MENU_CHILL_ARP.length];
                if (chillNote && chillNote > 0) {
                    synthPluck(time, chillNote, secondsPer16th * 2.2, 0.16);
                }
            }
            } catch (err) {
                // Safeguard against individual note scheduling issues
            }

            // Advance to next 16th note step
            nextStepTime += secondsPer16th;
            currentStep = (currentStep + 1) % 256;
        }
    }

    function startScheduler(mode = 'game') {
        if (!checkReady()) return;

        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        currentMusicMode = mode;
        currentBPM = (mode === 'menu') ? TEMPO_MENU : TEMPO_GAME;

        if (musicGain && ctx) {
            const settings = window.GameState ? window.GameState.get().settings : {};
            const targetGain = settings.musicMuted ? 0.0 : (mode === 'menu' ? 0.55 : 0.68);
            musicGain.gain.setValueAtTime(targetGain, ctx.currentTime);
        }

        if (musicFilter && ctx) {
            musicFilter.frequency.setValueAtTime(19000, ctx.currentTime);
        }

        if (isPlayingMusic) {
            // Already running, mode switch happens smoothly in scheduler
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
            musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
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
            osc.frequency.setValueAtTime(820, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.05);

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
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.08);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1300, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.24, ctx.currentTime);
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
            osc.frequency.setValueAtTime(170, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 0.22);

            gain.gain.setValueAtTime(0.30, ctx.currentTime);
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
            filter.frequency.setValueAtTime(950, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.25);
            filter.Q.value = 3.2;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.26, ctx.currentTime);
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

            gain.gain.setValueAtTime(0.28, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.26);

            osc1.connect(gain);
            osc2.connect(gain);
            oscSparkle.connect(gain);
            gain.connect(sfxGain);

            osc1.start();
            osc2.start();
            oscSparkle.start();
            osc1.stop(ctx.currentTime + 0.26);
            osc2.stop(ctx.currentTime + 0.26);
            oscSparkle.stop(ctx.currentTime + 0.26);
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
                filter.frequency.setValueAtTime(2200, now + i * 0.05);

                gain.gain.setValueAtTime(0.24, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.24);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);

                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.24);
            });
        },

        playShieldHit: function() {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(850, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.35);

            gain.gain.setValueAtTime(0.48, ctx.currentTime);
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
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.48);
            oscGain.gain.setValueAtTime(0.55, ctx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
            osc.connect(oscGain);
            oscGain.connect(sfxGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.48);

            // Explosive white noise burst
            const noise = getNoiseBuffer();
            if (noise) {
                const src = ctx.createBufferSource();
                src.buffer = noise;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(950, ctx.currentTime);
                filter.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.58);

                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0.46, ctx.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.58);

                src.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(sfxGain);
                src.start();
                src.stop(ctx.currentTime + 0.58);
            }
        },

        /* ---- MUSIC CONTROL METHODS ---- */

        startMusic: function(mode = 'game') {
            startScheduler(mode);
        },

        playActionMusic: function() {
            startScheduler('game');
        },

        playMenuMusic: function() {
            startScheduler('menu');
        },

        stopMusic: function() {
            stopMusicEngine();
        },

        // Muffle music when paused (club bathroom effect)
        pauseMusic: function() {
            if (musicFilter && ctx) {
                musicFilter.frequency.setTargetAtTime(420, ctx.currentTime, 0.08);
            }
            if (musicGain && ctx) {
                musicGain.gain.setTargetAtTime(0.30, ctx.currentTime, 0.08);
            }
        },

        // Restore crisp full electronic frequencies when unpaused
        resumeMusic: function() {
            if (musicFilter && ctx) {
                musicFilter.frequency.setTargetAtTime(19000, ctx.currentTime, 0.08);
            }
            if (musicGain && ctx) {
                const settings = window.GameState ? window.GameState.get().settings : {};
                const targetGain = settings.musicMuted ? 0.0 : ((currentMusicMode === 'menu') ? 0.55 : 0.68);
                musicGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
            }
        },

        isMusicPlaying: function() {
            return isPlayingMusic;
        },

        getCurrentMode: function() {
            return currentMusicMode;
        },

        setSfxVolume: function(vol) {
            if (sfxGain && ctx) {
                sfxGain.gain.setValueAtTime(vol, ctx.currentTime);
            }
        },

        initAudio: function() {
            try {
                return checkReady();
            } catch (e) {
                console.warn('initAudio error suppressed', e);
                return false;
            }
        },

        setMusicVolume: function(vol) {
            if (musicGain && ctx) {
                musicGain.gain.setValueAtTime(vol, ctx.currentTime);
            }
        }
    };

    window.AudioEngine = Sound;

    // Auto-listen to first touch/click/pointer anywhere to initialize AudioContext & start electronic menu music
    function unlockAudio() {
        if (checkReady()) {
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (!settings.musicMuted && !isPlayingMusic) {
                Sound.playMenuMusic();
            }
        }
        ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown'].forEach(evt => {
            window.removeEventListener(evt, unlockAudio);
        });
    }

    ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown'].forEach(evt => {
        window.addEventListener(evt, unlockAudio, { passive: true });
    });
})();
