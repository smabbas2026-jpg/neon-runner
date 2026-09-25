/**
 * Neon Runner - Game State & Persistence Manager
 */
(function() {
    'use strict';

    const STORAGE_KEY = 'neon_runner_save_v1';

    const SKINS = {
        default: {
            id: 'default',
            name: 'CYBER CYAN',
            tagline: 'Standard issue neural racer',
            price: 0,
            primaryColor: '#00f3ff',
            secondaryColor: '#0077ff',
            visorColor: '#ffffff',
            thrusterColor: '#00ffff',
            glowColor: 'rgba(0, 243, 255, 0.8)',
            trailColor: '#00e1ff'
        },
        magenta_fury: {
            id: 'magenta_fury',
            name: 'NEON VALKYRIE',
            tagline: 'High-voltage synthwave fury',
            price: 150,
            primaryColor: '#ff007f',
            secondaryColor: '#8a00e6',
            visorColor: '#ffe5f1',
            thrusterColor: '#ff00aa',
            glowColor: 'rgba(255, 0, 127, 0.85)',
            trailColor: '#ff007f'
        },
        solar_flare: {
            id: 'solar_flare',
            name: 'HYPERION GOLD',
            tagline: 'Solar-forged kinetic frame',
            price: 350,
            primaryColor: '#ffb700',
            secondaryColor: '#ff5100',
            visorColor: '#fff8db',
            thrusterColor: '#ffaa00',
            glowColor: 'rgba(255, 183, 0, 0.85)',
            trailColor: '#ffbb00'
        },
        toxic_glow: {
            id: 'toxic_glow',
            name: 'VIPER MATRIX',
            tagline: 'Overclocked bio-synthetic reactor',
            price: 600,
            primaryColor: '#00ff73',
            secondaryColor: '#009944',
            visorColor: '#d6ffea',
            thrusterColor: '#39ff14',
            glowColor: 'rgba(0, 255, 115, 0.85)',
            trailColor: '#00ff66'
        },
        phantom_void: {
            id: 'phantom_void',
            name: 'QUANTUM SHADOW',
            tagline: 'Experimental void cloaking unit',
            price: 1000,
            primaryColor: '#b700ff',
            secondaryColor: '#4d00ff',
            visorColor: '#ffffff',
            thrusterColor: '#d540ff',
            glowColor: 'rgba(183, 0, 255, 0.85)',
            trailColor: '#b700ff'
        }
    };

    const UPGRADE_CONFIG = {
        magnet: {
            name: 'QUANTUM MAGNET',
            desc: 'Pulls nearby energy coins automatically',
            icon: '🧲',
            baseDuration: 7,
            durationPerLvl: 1.5,
            maxLvl: 5,
            costs: [75, 150, 300, 500, 800]
        },
        shield: {
            name: 'NEXUS SHIELD',
            desc: 'Deflects deadly collision impacts',
            icon: '🛡️',
            baseDuration: 12,
            durationPerLvl: 2,
            maxLvl: 5,
            costs: [100, 200, 400, 650, 1000]
        },
        overdrive: {
            name: 'OVERDRIVE BOOST',
            desc: 'Hyperspeed invincibility smashing all obstacles',
            icon: '⚡',
            baseDuration: 5,
            durationPerLvl: 1.2,
            maxLvl: 5,
            costs: [120, 250, 450, 750, 1200]
        },
        multiplier: {
            name: 'MATRIX 2X BOOST',
            desc: 'Doubles all score gains while active',
            icon: '✖️2',
            baseDuration: 8,
            durationPerLvl: 2,
            maxLvl: 5,
            costs: [80, 160, 320, 550, 900]
        }
    };

    const DEFAULT_DATA = {
        highScore: 0,
        bestDistance: 0,
        coins: 0,
        totalRuns: 0,
        equippedSkin: 'default',
        unlockedSkins: ['default'],
        upgrades: {
            magnet: 1,
            shield: 1,
            overdrive: 1,
            multiplier: 1
        },
        settings: {
            sfxMuted: false,
            musicMuted: false,
            sfxVolume: 0.8,
            musicVolume: 0.5,
            vibration: true,
            touchControls: false // show on-screen buttons
        }
    };

    let state = null;

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                state = Object.assign({}, DEFAULT_DATA, parsed);
                // Also migrate legacy Colab best score if present
                const legacyBest = Number(localStorage.getItem('neonRunnerBest')) || 0;
                if (legacyBest > state.highScore) {
                    state.highScore = legacyBest;
                }
                // Ensure default skin is unlocked
                if (!state.unlockedSkins.includes('default')) {
                    state.unlockedSkins.push('default');
                }
            } else {
                state = JSON.parse(JSON.stringify(DEFAULT_DATA));
                const legacyBest = Number(localStorage.getItem('neonRunnerBest')) || 0;
                if (legacyBest > 0) state.highScore = legacyBest;
            }
        } catch (e) {
            console.warn('Failed to parse saved state, using default', e);
            state = JSON.parse(JSON.stringify(DEFAULT_DATA));
        }
        return state;
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            localStorage.setItem('neonRunnerBest', state.highScore.toString());
        } catch (e) {
            console.warn('Failed to save state to localStorage', e);
        }
    }

    window.GameState = {
        SKINS,
        UPGRADE_CONFIG,
        get: function() {
            if (!state) loadState();
            return state;
        },
        save: saveState,
        addCoins: function(amount) {
            state.coins = Math.max(0, state.coins + amount);
            saveState();
            return state.coins;
        },
        updateHighScore: function(score, dist) {
            let isNewBest = false;
            if (score > state.highScore) {
                state.highScore = score;
                isNewBest = true;
            }
            if (dist > (state.bestDistance || 0)) {
                state.bestDistance = dist;
            }
            state.totalRuns++;
            saveState();
            return isNewBest;
        },
        unlockSkin: function(skinId) {
            const skin = SKINS[skinId];
            if (!skin) return { success: false, reason: 'Invalid skin' };
            if (state.unlockedSkins.includes(skinId)) {
                return { success: true, reason: 'Already unlocked' };
            }
            if (state.coins < skin.price) {
                return { success: false, reason: 'Not enough coins' };
            }
            state.coins -= skin.price;
            state.unlockedSkins.push(skinId);
            state.equippedSkin = skinId;
            saveState();
            return { success: true };
        },
        equipSkin: function(skinId) {
            if (!state.unlockedSkins.includes(skinId)) return false;
            state.equippedSkin = skinId;
            saveState();
            return true;
        },
        upgradeItem: function(key) {
            const config = UPGRADE_CONFIG[key];
            if (!config) return { success: false, reason: 'Invalid upgrade' };
            const currentLvl = state.upgrades[key] || 1;
            if (currentLvl >= config.maxLvl) {
                return { success: false, reason: 'Max level reached' };
            }
            const cost = config.costs[currentLvl - 1];
            if (state.coins < cost) {
                return { success: false, reason: 'Not enough coins' };
            }
            state.coins -= cost;
            state.upgrades[key] = currentLvl + 1;
            saveState();
            return { success: true, newLevel: state.upgrades[key] };
        },
        getPowerupDuration: function(key) {
            const config = UPGRADE_CONFIG[key];
            if (!config) return 7;
            const lvl = (state.upgrades && state.upgrades[key]) || 1;
            return config.baseDuration + (lvl - 1) * config.durationPerLvl;
        },
        getCurrentSkin: function() {
            return SKINS[state.equippedSkin] || SKINS.default;
        }
    };

    loadState();
})();
