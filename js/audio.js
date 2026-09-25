/**
 * Neon Runner - Procedural Web Audio Engine
 * Pure synthesized retro-synthwave SFX and electronic background arpeggiator.
 */
(function() {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let musicInterval = null;
    let isInitialized = false;

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
            sfxGain.gain.setValueAtTime(0.8, ctx.currentTime);
            sfxGain.connect(masterGain);

            musicGain = ctx.createGain();
            musicGain.gain.setValueAtTime(0.4, ctx.currentTime);
            musicGain.connect(masterGain);

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

    // Helper: Create noise buffer
    function createNoiseBuffer(duration) {
        if (!ctx) return null;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

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

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
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

            gain.gain.setValueAtTime(0.18, ctx.currentTime);
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

            gain.gain.setValueAtTime(0.25, ctx.currentTime);
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

            const noise = createNoiseBuffer(0.25);
            if (!noise) return;

            const src = ctx.createBufferSource();
            src.buffer = noise;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.25);
            filter.Q.value = 3;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.22, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            src.connect(filter);
            filter.connect(gain);
            gain.connect(sfxGain);

            src.start();
            src.stop(ctx.currentTime + 0.25);
        },

        playCoin: function(comboCount) {
            if (!checkReady()) return;
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.sfxMuted) return;

            const noteIdx = Math.min((comboCount || 0), PENTATONIC.length - 1);
            const freq = PENTATONIC[noteIdx] || 523.25;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';

            osc1.frequency.setValueAtTime(freq, ctx.currentTime);
            osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime);

            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(sfxGain);

            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 0.18);
            osc2.stop(ctx.currentTime + 0.18);
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

                gain.gain.setValueAtTime(0.18, now + i * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGain);

                osc.start(now + i * 0.05);
                osc.stop(now + i * 0.05 + 0.2);
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

            gain.gain.setValueAtTime(0.4, ctx.currentTime);
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
            oscGain.gain.setValueAtTime(0.4, ctx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            osc.connect(oscGain);
            oscGain.connect(sfxGain);
            osc.start();
            osc.stop(ctx.currentTime + 0.45);

            // Explosive white noise burst
            const noise = createNoiseBuffer(0.5);
            if (noise) {
                const src = ctx.createBufferSource();
                src.buffer = noise;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, ctx.currentTime);
                filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.5);

                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0.35, ctx.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

                src.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(sfxGain);
                src.start();
                src.stop(ctx.currentTime + 0.5);
            }
        },

        /* Procedural Synthwave Bass & Arpeggio Engine */
        startMusic: function() {
            if (!checkReady()) return;
            if (musicInterval) return;

            const bassline = [65.41, 65.41, 73.42, 73.42, 82.41, 82.41, 73.42, 65.41]; // C2, D2, E2, D2
            const leadNotes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 329.63];
            let step = 0;

            const stepDuration = 145; // ~103 BPM 16th notes

            musicInterval = setInterval(() => {
                const settings = window.GameState ? window.GameState.get().settings : {};
                if (settings.musicMuted || !ctx || ctx.state === 'suspended') return;

                const now = ctx.currentTime;

                // Bass synth pulse on every beat
                if (step % 2 === 0) {
                    const bassFreq = bassline[Math.floor(step / 2) % bassline.length];
                    const bassOsc = ctx.createOscillator();
                    const bassGain = ctx.createGain();
                    const bassFilter = ctx.createBiquadFilter();

                    bassOsc.type = 'sawtooth';
                    bassOsc.frequency.setValueAtTime(bassFreq, now);

                    bassFilter.type = 'lowpass';
                    bassFilter.frequency.setValueAtTime(450, now);
                    bassFilter.frequency.exponentialRampToValueAtTime(100, now + 0.18);

                    bassGain.gain.setValueAtTime(0.2, now);
                    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

                    bassOsc.connect(bassFilter);
                    bassFilter.connect(bassGain);
                    bassGain.connect(musicGain);

                    bassOsc.start(now);
                    bassOsc.stop(now + 0.2);
                }

                // Cyber hi-hat noise on off-beats
                if (step % 2 === 1) {
                    const hatNoise = createNoiseBuffer(0.04);
                    if (hatNoise) {
                        const hatSrc = ctx.createBufferSource();
                        hatSrc.buffer = hatNoise;
                        const hatFilter = ctx.createBiquadFilter();
                        hatFilter.type = 'highpass';
                        hatFilter.frequency.value = 7000;

                        const hatGain = ctx.createGain();
                        hatGain.gain.setValueAtTime(0.08, now);
                        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

                        hatSrc.connect(hatFilter);
                        hatFilter.connect(hatGain);
                        hatGain.connect(musicGain);

                        hatSrc.start(now);
                        hatSrc.stop(now + 0.04);
                    }
                }

                // Lead arpeggio synth
                const leadFreq = leadNotes[step % leadNotes.length];
                const leadOsc = ctx.createOscillator();
                const leadGain = ctx.createGain();
                leadOsc.type = 'triangle';
                leadOsc.frequency.setValueAtTime(leadFreq, now);

                leadGain.gain.setValueAtTime(0.06, now);
                leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

                leadOsc.connect(leadGain);
                leadGain.connect(musicGain);

                leadOsc.start(now);
                leadOsc.stop(now + 0.12);

                step = (step + 1) % 16;
            }, stepDuration);
        },

        stopMusic: function() {
            if (musicInterval) {
                clearInterval(musicInterval);
                musicInterval = null;
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

    // Auto-listen to first touch/click anywhere to awaken AudioContext
    ['touchstart', 'click', 'keydown'].forEach(evt => {
        window.addEventListener(evt, function onUserInteraction() {
            if (checkReady()) {
                window.removeEventListener(evt, onUserInteraction);
            }
        }, { once: false, passive: true });
    });
})();
