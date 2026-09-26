/**
 * Street Runner // 3D Cyber Highway
 * Core 3D Game Engine & 3-Lane Control System
 * 
 * Features:
 * - True 3D perspective highway with 3 lanes (Left: 0, Center: 1, Right: 2)
 * - Dynamic progressive speed acceleration: START_SPEED = 3.0, MAX_SPEED = 14.5, ACCELERATION = 0.075
 * - Smooth banking ship tilting & thruster particle emissions
 * - 3D obstacles: Low laser barriers (jump), high plasma gates (slide), cyber barricades & vehicles (dodge)
 * - Rotating 3D gemstone diamonds with combo multipliers and magnetic attraction
 * - Cyber garage skins & upgradeable power-ups (Shield, Magnet, Overdrive, Multiplier)
 * - Safe audio handling and full mobile swipe / tactile touch controls
 */
(function() {
    'use strict';

    const requestAnimFrame = (typeof window !== 'undefined' && window.requestAnimationFrame)
        ? window.requestAnimationFrame.bind(window)
        : (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16));

    const STATE = {
        MENU: 'menu',
        PLAYING: 'playing',
        PAUSED: 'paused',
        GAMEOVER: 'gameover'
    };

    let currentState = STATE.MENU;

    // Speed progression settings ("a little slow at first but it get faster as the game progresses")
    const START_SPEED = 3.0; // Gentle, easily readable starting pace
    const MAX_SPEED = 14.5;  // High-octane cyber highway velocity
    const ACCELERATION = 0.075; // Progressive smooth speed increase

    let game_speed = START_SPEED;
    let speed = game_speed; // alias for renderer references
    let elapsed_time = 0;
    let score = 0;
    let diamondsCollected = 0;
    let distance = 0;
    let spawnTimer = 0;
    let powerupSpawnTimer = 16000;
    let diamondCombo = 0;
    let comboResetTimer = 0;

    let obstacles = [];
    let diamondObjects = [];
    let coinObjects = diamondObjects; // alias for backwards compatibility
    let powerupObjects = [];

    let lastTime = 0;
    let invulnerableTimer = 0;

    // Player 3D entity state
    const player = {
        lane: 1, // 0: Left, 1: Center, 2: Right
        x: 0,
        y: 0,
        vx: 0,
        width: 46,
        height: 70,
        jumpHeight: 0,
        jumpVelocity: 0,
        jumping: false,
        sliding: false,
        slideTimer: 0,

        // Power-up states
        hasShield: false,
        hasMagnet: false,
        hasOverdrive: false,
        hasMultiplier: false,
        shieldTimer: 0,
        magnetTimer: 0,
        overdriveTimer: 0,
        multiplierTimer: 0
    };

    function safeAudio(fn) {
        try {
            if (window.AudioEngine) fn(window.AudioEngine);
        } catch (e) {
            console.warn('Audio operation non-fatal notice:', e);
        }
    }

    function triggerHaptic(pattern) {
        try {
            const settings = window.GameState ? window.GameState.get().settings : {};
            if (settings.vibration !== false && navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } catch (e) {}
    }

    function init() {
        const canvas = document.getElementById('canvas');
        if (canvas && window.GameRenderer) {
            window.GameRenderer.init(canvas);
        }

        window.addEventListener('resize', () => {
            if (window.GameRenderer) {
                window.GameRenderer.resize();
                player.x = window.GameRenderer.laneX(player.lane, 1.0);
                player.y = window.GameRenderer.H - 140;
            }
        });

        initControls();
        initUI();
        updateMenuStats();
        updateLaneIndicator();

        // Initial 3D player placement in Center Lane (1)
        if (window.GameRenderer) {
            player.x = window.GameRenderer.laneX(1, 1.0);
            player.y = window.GameRenderer.H - 140;
        }

        // Launch ambient background loop
        requestAnimFrame(renderLoop);
    }

    function updateMenuStats() {
        if (!window.GameState) return;
        const data = window.GameState.get();
        const currentDiamonds = data.diamonds !== undefined ? data.diamonds : data.coins;
        const menuBest = document.getElementById('menuBest');
        const menuDiamonds = document.getElementById('menuDiamonds');
        const shopDiamonds = document.getElementById('shopDiamonds');

        if (menuBest) menuBest.textContent = data.highScore || 0;
        if (menuDiamonds) menuDiamonds.textContent = `💎 ${currentDiamonds || 0}`;
        if (shopDiamonds) shopDiamonds.textContent = currentDiamonds || 0;
    }

    function updateLaneIndicator() {
        const dot0 = document.getElementById('dotLane0');
        const dot1 = document.getElementById('dotLane1');
        const dot2 = document.getElementById('dotLane2');
        if (!dot0 || !dot1 || !dot2) return;

        dot0.classList.toggle('active', player.lane === 0);
        dot1.classList.toggle('active', player.lane === 1);
        dot2.classList.toggle('active', player.lane === 2);
    }

    /* ==========================================================
       GAME LIFECYCLE
       ========================================================== */

    function startGame(e) {
        if (e && e.stopPropagation) e.stopPropagation();

        currentState = STATE.PLAYING;

        // Reset variables
        score = 0;
        diamondsCollected = 0;
        distance = 0;
        elapsed_time = 0;
        game_speed = START_SPEED;
        speed = game_speed;

        spawnTimer = 900;
        powerupSpawnTimer = 16000;
        diamondCombo = 0;
        comboResetTimer = 0;
        invulnerableTimer = 0;

        obstacles = [];
        diamondObjects = [];
        coinObjects = diamondObjects;
        powerupObjects = [];

        if (window.Particles) {
            window.Particles.clear();
        }

        // Center lane start
        player.lane = 1;
        if (window.GameRenderer) {
            player.x = window.GameRenderer.laneX(1, 1.0);
            player.y = window.GameRenderer.H - 140;
        }
        player.vx = 0;
        player.jumpHeight = 0;
        player.jumpVelocity = 0;
        player.jumping = false;
        player.sliding = false;
        player.slideTimer = 0;

        player.hasShield = false;
        player.hasMagnet = false;
        player.hasOverdrive = false;
        player.hasMultiplier = false;
        player.shieldTimer = 0;
        player.magnetTimer = 0;
        player.overdriveTimer = 0;
        player.multiplierTimer = 0;

        // Update modal displays
        const menu = document.getElementById('menu');
        if (menu) {
            menu.classList.add('hidden');
            menu.style.display = 'none';
        }
        const gameOver = document.getElementById('gameOver');
        if (gameOver) {
            gameOver.classList.add('hidden');
            gameOver.style.display = 'none';
        }
        const pauseScreen = document.getElementById('pauseScreen');
        if (pauseScreen) pauseScreen.classList.add('hidden');
        const shopModal = document.getElementById('shopModal');
        if (shopModal) shopModal.classList.add('hidden');

        const hud = document.getElementById('hud');
        if (hud) {
            hud.classList.remove('hidden');
            hud.style.display = 'flex';
        }

        updateHUD();
        updateLaneIndicator();
        triggerHaptic([30]);

        safeAudio(a => {
            if (a.initAudio) a.initAudio();
            else if (a.init) a.init();
            if (a.playActionMusic) a.playActionMusic();
        });

        lastTime = performance.now();
        requestAnimFrame(gameLoop);
    }

    function togglePause() {
        if (currentState === STATE.PLAYING) {
            currentState = STATE.PAUSED;
            const pauseScreen = document.getElementById('pauseScreen');
            if (pauseScreen) pauseScreen.classList.remove('hidden');
            if (typeof updateAudioButtons === 'function') updateAudioButtons();
            safeAudio(a => a.pauseMusic && a.pauseMusic());
        } else if (currentState === STATE.PAUSED) {
            resumeGame();
        }
    }

    function resumeGame() {
        if (currentState !== STATE.PAUSED) return;
        currentState = STATE.PLAYING;
        const pauseScreen = document.getElementById('pauseScreen');
        if (pauseScreen) pauseScreen.classList.add('hidden');
        safeAudio(a => a.resumeMusic && a.resumeMusic());
        lastTime = performance.now();
        requestAnimFrame(gameLoop);
    }

    function showMenu() {
        currentState = STATE.MENU;
        const menu = document.getElementById('menu');
        if (menu) {
            menu.classList.remove('hidden');
            menu.style.display = 'flex';
        }
        const gameOver = document.getElementById('gameOver');
        if (gameOver) gameOver.classList.add('hidden');
        const pauseScreen = document.getElementById('pauseScreen');
        if (pauseScreen) pauseScreen.classList.add('hidden');
        const shopModal = document.getElementById('shopModal');
        if (shopModal) shopModal.classList.add('hidden');
        const helpModal = document.getElementById('helpModal');
        if (helpModal) helpModal.classList.add('hidden');

        const hud = document.getElementById('hud');
        if (hud) hud.classList.add('hidden');

        if (typeof updateAudioButtons === 'function') updateAudioButtons();

        safeAudio(a => a.playMenuMusic && a.playMenuMusic());
        updateMenuStats();
    }

    function endGame() {
        currentState = STATE.GAMEOVER;

        safeAudio(a => {
            if (a.playCrash) a.playCrash();
            setTimeout(() => {
                if (currentState === STATE.GAMEOVER && a.playMenuMusic) {
                    a.playMenuMusic();
                }
            }, 750);
        });

        triggerHaptic([50, 40, 100]);
        if (window.GameRenderer) window.GameRenderer.triggerShake(18, 450);
        if (window.Particles) {
            window.Particles.emitExplosion(player.x, player.y - player.jumpHeight, '#ff0055', 40);
        }

        // Save high score and diamonds
        let isNewBest = false;
        if (window.GameState) {
            isNewBest = window.GameState.updateHighScore(score, Math.floor(distance));
            window.GameState.addDiamonds(diamondsCollected);
        }

        // Show Game Over UI
        const finalScore = document.getElementById('finalScore');
        if (finalScore) finalScore.textContent = score;
        const finalDiamonds = document.getElementById('finalDiamonds');
        if (finalDiamonds) finalDiamonds.textContent = `💎 ${diamondsCollected}`;
        const finalDistance = document.getElementById('finalDistance');
        if (finalDistance) finalDistance.textContent = Math.floor(distance) + 'm';
        const finalBest = document.getElementById('finalBest');
        if (finalBest && window.GameState) finalBest.textContent = window.GameState.get().highScore;

        const newBestBadge = document.getElementById('newBestBadge');
        if (newBestBadge) {
            if (isNewBest) newBestBadge.classList.remove('hidden');
            else newBestBadge.classList.add('hidden');
        }

        const gameOver = document.getElementById('gameOver');
        if (gameOver) {
            gameOver.classList.remove('hidden');
            gameOver.style.display = 'flex';
        }
        const hud = document.getElementById('hud');
        if (hud) hud.classList.add('hidden');

        updateMenuStats();
    }

    /* ==========================================================
       3-LANE PLAYER ACTIONS
       ========================================================== */

    function moveLeft() {
        if (currentState !== STATE.PLAYING) return;
        if (player.lane > 0) {
            player.lane--;
            updateLaneIndicator();
            safeAudio(a => a.playSwipe && a.playSwipe());
            triggerHaptic([15]);
        }
    }

    function moveRight() {
        if (currentState !== STATE.PLAYING) return;
        if (player.lane < 2) {
            player.lane++;
            updateLaneIndicator();
            safeAudio(a => a.playSwipe && a.playSwipe());
            triggerHaptic([15]);
        }
    }

    function jump() {
        if (currentState !== STATE.PLAYING) return;
        if (!player.jumping && !player.sliding) {
            player.jumping = true;
            player.jumpVelocity = -15.5;
            safeAudio(a => a.playJump && a.playJump());
            triggerHaptic([20]);
        }
    }

    function slide() {
        if (currentState !== STATE.PLAYING) return;
        if (!player.jumping) {
            player.sliding = true;
            player.slideTimer = 480;
            safeAudio(a => a.playSlide && a.playSlide());
            triggerHaptic([25]);
        }
    }

    /* ==========================================================
       POWER-UPS
       ========================================================== */

    function activatePowerup(type) {
        const durationSec = window.GameState ? window.GameState.getPowerupDuration(type) : 8;
        const durationMs = durationSec * 1000;

        safeAudio(a => a.playPowerup && a.playPowerup());
        triggerHaptic([30, 20, 50]);

        if (type === 'shield') {
            player.hasShield = true;
            player.shieldTimer = durationMs;
            if (window.Particles) window.Particles.addFloatingText('SHIELD ONLINE!', player.x, player.y - 60, '#00f3ff');
        } else if (type === 'magnet') {
            player.hasMagnet = true;
            player.magnetTimer = durationMs;
            if (window.Particles) window.Particles.addFloatingText('MAGNET ACTIVE!', player.x, player.y - 60, '#00bfff');
        } else if (type === 'overdrive') {
            player.hasOverdrive = true;
            player.overdriveTimer = durationMs;
            if (window.GameRenderer) window.GameRenderer.triggerShake(8, 300);
            if (window.Particles) window.Particles.addFloatingText('⚡ OVERDRIVE!', player.x, player.y - 60, '#ff00ff');
        } else if (type === 'multiplier') {
            player.hasMultiplier = true;
            player.multiplierTimer = durationMs;
            if (window.Particles) window.Particles.addFloatingText('2X MULTIPLIER!', player.x, player.y - 60, '#ffb700');
        }
    }

    /* ==========================================================
       SPAWNING (3 LANES & DYNAMIC DIFFICULTY)
       ========================================================== */

    function spawnObstaclePattern() {
        if (!window.GameRenderer) return;

        const types = ['low', 'high', 'barricade', 'barricade'];
        // At early/low speeds, only block 1 lane so player learns smoothly.
        // At higher speeds (> 7.5), occasionally block 2 lanes (guaranteeing 1 clear lane).
        const blockedCount = (speed > 7.5 && Math.random() > 0.45) ? 2 : 1;
        const safeLane = Math.floor(Math.random() * 3);

        for (let lane = 0; lane < 3; lane++) {
            if (blockedCount === 2 && lane === safeLane) continue;
            if (blockedCount === 1 && lane !== ((safeLane + 1) % 3)) continue;

            const type = types[Math.floor(Math.random() * types.length)];
            obstacles.push({
                lane: lane,
                x: window.GameRenderer.laneX(lane, 0.0),
                y: window.GameRenderer.H * 0.38 - 30,
                width: 58,
                height: type === 'high' ? 70 : 62,
                type: type,
                progress: 0.0
            });
        }
    }

    function spawnDiamondStreak() {
        if (!window.GameRenderer) return;
        const lane = Math.floor(Math.random() * 3);
        const count = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            diamondObjects.push({
                lane: lane,
                x: window.GameRenderer.laneX(lane, 0.0),
                y: (window.GameRenderer.H * 0.38) - 40 - (i * 55),
                radius: 13,
                collected: false,
                progress: -(i * 0.08),
                seed: Math.random() * 100
            });
        }
    }
    const spawnCoinStreak = spawnDiamondStreak;

    function spawnPowerup() {
        if (!window.GameRenderer) return;
        const lane = Math.floor(Math.random() * 3);
        const types = ['magnet', 'shield', 'overdrive', 'multiplier'];
        const type = types[Math.floor(Math.random() * types.length)];

        powerupObjects.push({
            lane: lane,
            x: window.GameRenderer.laneX(lane, 0.0),
            y: (window.GameRenderer.H * 0.38) - 50,
            radius: 18,
            type: type,
            collected: false,
            progress: 0.0
        });
    }

    /* ==========================================================
       UPDATES & PHYSICS
       ========================================================== */

    function updatePlayer(dt) {
        if (!window.GameRenderer) return;

        const targetX = window.GameRenderer.laneX(player.lane, 1.0);
        const prevX = player.x;

        // Smooth 3-lane lateral interpolation
        player.x += (targetX - player.x) * Math.min(1, (dt / 1000) * 16);
        player.vx = player.x - prevX;

        // Emit thruster flame particles
        if (window.Particles && window.GameState) {
            const skin = window.GameState.getCurrentSkin();
            window.Particles.emitThruster(
                player.x,
                player.y - player.jumpHeight + (player.sliding ? 8 : 18),
                skin.thrusterColor,
                2
            );
        }

        // Jump physics
        if (player.jumping) {
            player.jumpHeight += player.jumpVelocity * (dt / 16.67);
            player.jumpVelocity += 0.82 * (dt / 16.67);

            if (player.jumpHeight <= 0) {
                player.jumpHeight = 0;
                player.jumpVelocity = 0;
                player.jumping = false;
                triggerHaptic([10]);
            }
        }

        // Slide timer & friction sparks
        if (player.sliding) {
            player.slideTimer -= dt;
            if (window.Particles) {
                window.Particles.emitSlideSparks(player.x, player.y + 16, 2);
            }

            if (player.slideTimer <= 0) {
                player.slideTimer = 0;
                player.sliding = false;
            }
        }

        // Power-up timers
        if (player.hasShield) {
            player.shieldTimer -= dt;
            if (player.shieldTimer <= 0) {
                player.hasShield = false;
                if (window.Particles) window.Particles.addFloatingText('SHIELD EXPIRED', player.x, player.y - 60, '#999999');
            }
        }

        if (player.hasMagnet) {
            player.magnetTimer -= dt;
            if (player.magnetTimer <= 0) {
                player.hasMagnet = false;
            }
        }

        if (player.hasOverdrive) {
            player.overdriveTimer -= dt;
            if (player.overdriveTimer <= 0) {
                player.hasOverdrive = false;
                if (window.Particles) window.Particles.addFloatingText('OVERDRIVE ENDED', player.x, player.y - 60, '#999999');
            }
        }

        if (player.hasMultiplier) {
            player.multiplierTimer -= dt;
            if (player.multiplierTimer <= 0) {
                player.hasMultiplier = false;
            }
        }

        if (invulnerableTimer > 0) {
            invulnerableTimer -= dt;
        }

        // Combo decay timer
        if (comboResetTimer > 0) {
            comboResetTimer -= dt;
            if (comboResetTimer <= 0) {
                diamondCombo = 0;
            }
        }
    }

    function updateObjects(dt) {
        if (!window.GameRenderer) return;

        const currentSpeed = player.hasOverdrive ? speed * 1.6 : speed;
        const movement = currentSpeed * (dt / 16.67) * 2.2;
        const H = window.GameRenderer.H;
        const horizonY = H * 0.38;
        const trackLength = H - horizonY;

        // 1. Update 3D obstacles
        for (const ob of obstacles) {
            ob.y += movement;
            ob.progress = Math.max(0, (ob.y - horizonY) / trackLength);
            ob.x = window.GameRenderer.laneX(ob.lane, Math.min(1, ob.progress));
        }

        // 2. Update 3D diamonds & magnet attraction
        for (const diamond of diamondObjects) {
            if (player.hasMagnet && !diamond.collected && diamond.y > horizonY) {
                // Accelerate diamond toward player's position
                const dx = player.x - diamond.x;
                const dy = (player.y - player.jumpHeight) - diamond.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 340) {
                    diamond.x += (dx / dist) * 16;
                    diamond.y += (dy / dist) * 16;
                } else {
                    diamond.y += movement;
                }
            } else {
                diamond.y += movement;
            }

            diamond.progress = Math.max(0, (diamond.y - horizonY) / trackLength);
            if (!player.hasMagnet || diamond.y < horizonY) {
                diamond.x = window.GameRenderer.laneX(diamond.lane, Math.min(1, diamond.progress));
            }
        }

        // 3. Update 3D powerups
        for (const pu of powerupObjects) {
            pu.y += movement;
            pu.progress = Math.max(0, (pu.y - horizonY) / trackLength);
            pu.x = window.GameRenderer.laneX(pu.lane, Math.min(1, pu.progress));
        }

        // Prune offscreen entities
        obstacles = obstacles.filter(ob => ob.y < H + 120);
        diamondObjects = diamondObjects.filter(d => d.y < H + 100 && !d.collected);
        coinObjects = diamondObjects;
        powerupObjects = powerupObjects.filter(pu => pu.y < H + 100 && !pu.collected);
    }

    function updateSpawning(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnObstaclePattern();

            if (Math.random() > 0.35) {
                spawnCoinStreak();
            }

            const currentSpeed = player.hasOverdrive ? speed * 1.6 : speed;
            // Spawning accelerates smoothly as speed progresses
            spawnTimer = Math.max(480, 2100 - (currentSpeed - START_SPEED) * 135);
        }

        // Power-up capsule spawn
        powerupSpawnTimer -= dt;
        if (powerupSpawnTimer <= 0) {
            spawnPowerup();
            powerupSpawnTimer = 18000 + Math.random() * 12000;
        }
    }

    /* ==========================================================
       DYNAMIC SPEED PROGRESSION SYSTEM
       ========================================================== */
    function update_speed(dt) {
        // dt in seconds
        elapsed_time += dt;

        game_speed = Math.min(
            START_SPEED + (elapsed_time * ACCELERATION),
            MAX_SPEED
        );
        speed = game_speed;
        return game_speed;
    }

    function updateDifficulty(dt) {
        const dtSeconds = dt / 1000;
        update_speed(dtSeconds);

        const currentSpeed = player.hasOverdrive ? game_speed * 1.6 : game_speed;
        distance += currentSpeed * dtSeconds * 3.5;

        const pointMultiplier = player.hasMultiplier ? 4 : 2;
        score = Math.floor(distance * pointMultiplier) + (diamondsCollected * 10);
    }

    /* ==========================================================
       COLLISIONS
       ========================================================== */

    function checkCollisions() {
        const playerHeight = player.sliding ? player.height * 0.45 : player.height;
        const py = player.y - player.jumpHeight;

        // 1. Obstacle collision
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const ob = obstacles[i];
            if (ob.lane !== player.lane) continue;

            const pLeft = player.x - player.width * 0.4;
            const pRight = player.x + player.width * 0.4;
            const pTop = py - playerHeight * 0.5;
            const pBottom = py + playerHeight * 0.5;

            const obLeft = ob.x - ob.width * 0.45;
            const obRight = ob.x + ob.width * 0.45;
            const obTop = ob.y - ob.height * 0.5;
            const obBottom = ob.y + ob.height * 0.5;

            if (pRight > obLeft && pLeft < obRight && pBottom > obTop && pTop < obBottom) {
                // Check if jump cleared low barrier
                if (ob.type === 'low' && player.jumpHeight > 38) {
                    continue; // Jumped over!
                }

                // Check if slide cleared high barrier
                if (ob.type === 'high' && player.sliding) {
                    continue; // Slid under!
                }

                // Overdrive smashes through everything
                if (player.hasOverdrive) {
                    if (window.Particles) {
                        window.Particles.emitExplosion(ob.x, ob.y, '#ff00ff', 25);
                        window.Particles.addFloatingText('+50 SMASH!', ob.x, ob.y - 30, '#ff00ff');
                    }
                    safeAudio(a => a.playShieldHit && a.playShieldHit());
                    obstacles.splice(i, 1);
                    score += 50;
                    continue;
                }

                // Temporary invulnerability check
                if (invulnerableTimer > 0) {
                    continue;
                }

                // Shield absorbs collision
                if (player.hasShield) {
                    player.hasShield = false;
                    invulnerableTimer = 1200; // 1.2s invulnerability grace
                    if (window.GameRenderer) window.GameRenderer.triggerShake(12, 300);
                    if (window.Particles) {
                        window.Particles.emitExplosion(player.x, py, '#00f3ff', 30);
                        window.Particles.addFloatingText('SHIELD SHATTERED!', player.x, py - 40, '#00f3ff');
                    }
                    safeAudio(a => a.playShieldHit && a.playShieldHit());
                    triggerHaptic([40, 30, 60]);
                    obstacles.splice(i, 1);
                    continue;
                }

                // Fatal Collision!
                endGame();
                return;
            }
        }

        // 2. Diamond collection
        for (const diamond of diamondObjects) {
            if (diamond.collected) continue;

            const dx = player.x - diamond.x;
            const dy = py - diamond.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 46) {
                diamond.collected = true;
                diamondsCollected++;
                diamondCombo++;
                comboResetTimer = 1800; // 1.8s combo window

                const bonus = Math.min(diamondCombo, 10) * 5;
                score += (10 + bonus);

                safeAudio(a => a.playDiamond && a.playDiamond(diamondCombo));
                triggerHaptic([12]);

                if (window.Particles) {
                    window.Particles.emitDiamondBurst(diamond.x, diamond.y, '#00f3ff', 14);
                    if (diamondCombo > 2) {
                        window.Particles.addFloatingText(`💎 x${diamondCombo} COMBO!`, diamond.x, diamond.y - 20, '#00f3ff', 14);
                    } else {
                        window.Particles.addFloatingText(`💎 +${10 + bonus}`, diamond.x, diamond.y - 18, '#ffffff', 13);
                    }
                }
            }
        }

        // 3. Power-up collection
        for (const pu of powerupObjects) {
            if (pu.collected) continue;

            const dx = player.x - pu.x;
            const dy = py - pu.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 50) {
                pu.collected = true;
                activatePowerup(pu.type);
                if (window.Particles) {
                    window.Particles.emitCoinBurst(pu.x, pu.y, '#00f3ff', 16);
                }
            }
        }
    }

    /* ==========================================================
       HUD & UI UPDATES
       ========================================================== */

    function updateHUD() {
        const scoreElem = document.getElementById('score');
        const diamondsElem = document.getElementById('diamonds');
        const speedElem = document.getElementById('speedGauge');
        const powerupBar = document.getElementById('powerupBar');
        const powerupIcon = document.getElementById('powerupIcon');
        const powerupTimer = document.getElementById('powerupTimer');

        if (scoreElem) scoreElem.textContent = score;
        if (diamondsElem) diamondsElem.textContent = `💎 ${diamondsCollected}`;

        const kmh = Math.floor(speed * 18);
        if (speedElem) {
            speedElem.textContent = `CYBER HIGHWAY // ${speed.toFixed(1)}X (${kmh} KM/H)`;
        }

        // Power-up status indicator
        if (powerupBar && powerupIcon && powerupTimer) {
            let activeType = null;
            let remaining = 0;
            let total = 1;

            if (player.hasOverdrive) {
                activeType = '⚡ OVERDRIVE';
                remaining = player.overdriveTimer;
                total = window.GameState ? window.GameState.getPowerupDuration('overdrive') * 1000 : 6000;
            } else if (player.hasShield) {
                activeType = '🛡️ SHIELD';
                remaining = player.shieldTimer;
                total = window.GameState ? window.GameState.getPowerupDuration('shield') * 1000 : 12000;
            } else if (player.hasMagnet) {
                activeType = '🧲 MAGNET';
                remaining = player.magnetTimer;
                total = window.GameState ? window.GameState.getPowerupDuration('magnet') * 1000 : 8000;
            } else if (player.hasMultiplier) {
                activeType = '✖️2 MULTIPLIER';
                remaining = player.multiplierTimer;
                total = window.GameState ? window.GameState.getPowerupDuration('multiplier') * 1000 : 10000;
            }

            if (activeType && remaining > 0) {
                powerupBar.classList.remove('hidden');
                powerupIcon.textContent = activeType;
                const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
                powerupTimer.style.width = `${pct}%`;
            } else {
                powerupBar.classList.add('hidden');
            }
        }
    }

    /* ==========================================================
       MAIN GAME LOOP
       ========================================================== */

    function gameLoop(time) {
        if (currentState !== STATE.PLAYING) return;

        const dt = Math.min(time - lastTime || 16.67, 45);
        lastTime = time;

        updatePlayer(dt);
        updateObjects(dt);
        updateSpawning(dt);
        updateDifficulty(dt);
        checkCollisions();

        if (window.Particles && window.GameRenderer) {
            window.Particles.update(dt);
            window.Particles.updateSpeedLines(window.GameRenderer.W, window.GameRenderer.H, speed, player.hasOverdrive);
        }

        // Render 3D Frame
        if (window.GameRenderer) {
            const laneOffset = (player.x - (window.GameRenderer.W / 2)) / (window.GameRenderer.W / 2);
            window.GameRenderer.beginFrame(dt);
            window.GameRenderer.drawSky(time, laneOffset);
            window.GameRenderer.drawSideBuildings(dt, speed, laneOffset, time);
            window.GameRenderer.drawRoad(dt, speed);
            window.GameRenderer.drawDiamonds(diamondObjects, time);
            window.GameRenderer.drawPowerups(powerupObjects, time);
            window.GameRenderer.drawObstacles(obstacles, time);

            if (window.Particles) {
                window.Particles.draw(window.GameRenderer.ctx);
            }

            // Invulnerability blink
            if (!(invulnerableTimer > 0 && Math.floor(time / 60) % 2 === 0)) {
                window.GameRenderer.drawPlayer(player, time);
            }

            window.GameRenderer.endFrame();
        }

        updateHUD();

        if (currentState === STATE.PLAYING) {
            requestAnimFrame(gameLoop);
        }
    }

    // Ambient loop for menu / game over background
    function renderLoop(time) {
        if (currentState !== STATE.PLAYING && window.GameRenderer) {
            const dt = 16.67;
            window.GameRenderer.beginFrame(dt);
            window.GameRenderer.drawSky(time, 0);
            window.GameRenderer.drawSideBuildings(dt, 2.0, 0, time);
            window.GameRenderer.drawRoad(dt, 2.0);
            if (window.Particles) {
                window.Particles.update(dt);
                window.Particles.draw(window.GameRenderer.ctx);
            }
            window.GameRenderer.endFrame();
        }
        requestAnimFrame(renderLoop);
    }

    /* ==========================================================
       CONTROLS & GESTURE DETECTOR
       ========================================================== */

    function initControls() {
        // Touch Swipe Gestures
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        window.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = performance.now();
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            const threshold = 30;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (Math.abs(dx) > threshold) {
                    if (dx > 0) moveRight();
                    else moveLeft();
                }
            } else {
                if (Math.abs(dy) > threshold) {
                    if (dy < 0) jump();
                    else slide();
                }
            }
        }, { passive: true });

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'arrowleft' || key === 'a') {
                moveLeft();
            } else if (key === 'arrowright' || key === 'd') {
                moveRight();
            } else if (key === 'arrowup' || key === 'w' || key === ' ') {
                e.preventDefault();
                jump();
            } else if (key === 'arrowdown' || key === 's') {
                e.preventDefault();
                slide();
            } else if (key === 'p' || key === 'escape') {
                togglePause();
            }
        });

        // Tactile On-Screen Buttons
        const btnLeft = document.getElementById('touchLeft');
        const btnRight = document.getElementById('touchRight');
        const btnJump = document.getElementById('touchJump');
        const btnSlide = document.getElementById('touchSlide');

        if (btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); moveLeft(); });
            btnLeft.addEventListener('click', (e) => { e.stopPropagation(); moveLeft(); });
        }
        if (btnRight) {
            btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); moveRight(); });
            btnRight.addEventListener('click', (e) => { e.stopPropagation(); moveRight(); });
        }
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); jump(); });
            btnJump.addEventListener('click', (e) => { e.stopPropagation(); jump(); });
        }
        if (btnSlide) {
            btnSlide.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); slide(); });
            btnSlide.addEventListener('click', (e) => { e.stopPropagation(); slide(); });
        }
    }

    /* ==========================================================
       UI & MODALS INITIALIZATION
       ========================================================== */

    function initUI() {
        const btnStart = document.getElementById('btnStart');
        const btnRestart = document.getElementById('btnRestart');
        const btnResume = document.getElementById('btnResume');
        const btnPause = document.getElementById('btnPause');
        const btnMenuFromOver = document.getElementById('btnMenuFromOver');
        const btnMenuFromPause = document.getElementById('btnMenuFromPause');

        if (btnStart) btnStart.addEventListener('click', startGame);
        if (btnRestart) btnRestart.addEventListener('click', startGame);
        if (btnResume) btnResume.addEventListener('click', resumeGame);
        if (btnPause) btnPause.addEventListener('click', togglePause);
        if (btnMenuFromOver) btnMenuFromOver.addEventListener('click', showMenu);
        if (btnMenuFromPause) btnMenuFromPause.addEventListener('click', showMenu);

        // Sound Toggles
        function updateAudioButtons() {
            if (!window.GameState) return;
            const settings = window.GameState.get().settings;
            const isMusicMuted = !!settings.musicMuted;
            const isSfxMuted = !!settings.sfxMuted;

            const btnMenuMusic = document.getElementById('btnMenuMusic');
            const btnPauseMusic = document.getElementById('btnPauseMusic');
            const musicText = isMusicMuted ? '🎵 MUSIC: OFF' : '🎵 MUSIC: ON';

            if (btnMenuMusic) {
                btnMenuMusic.textContent = musicText;
                btnMenuMusic.classList.toggle('muted', isMusicMuted);
            }
            if (btnPauseMusic) {
                btnPauseMusic.textContent = musicText;
                btnPauseMusic.classList.toggle('muted', isMusicMuted);
            }

            const btnMenuSFX = document.getElementById('btnMenuSFX');
            const btnPauseSFX = document.getElementById('btnPauseSFX');
            const sfxText = isSfxMuted ? '🔊 SFX: OFF' : '🔊 SFX: ON';

            if (btnMenuSFX) {
                btnMenuSFX.textContent = sfxText;
                btnMenuSFX.classList.toggle('muted', isSfxMuted);
            }
            if (btnPauseSFX) {
                btnPauseSFX.textContent = sfxText;
                btnPauseSFX.classList.toggle('muted', isSfxMuted);
            }

            const btnSound = document.getElementById('btnSound');
            if (btnSound) {
                btnSound.textContent = (isMusicMuted && isSfxMuted) ? '🔇' : '🔊';
            }
        }

        function toggleMusic(e) {
            if (e) e.stopPropagation();
            if (!window.GameState) return;
            const settings = window.GameState.get().settings;
            settings.musicMuted = !settings.musicMuted;
            window.GameState.save();
            updateAudioButtons();

            safeAudio(a => {
                if (settings.musicMuted) {
                    if (a.stopMusic) a.stopMusic();
                } else {
                    if (currentState === STATE.PLAYING) {
                        if (a.playActionMusic) a.playActionMusic();
                    } else {
                        if (a.playMenuMusic) a.playMenuMusic();
                    }
                }
            });
        }

        function toggleSFX(e) {
            if (e) e.stopPropagation();
            if (!window.GameState) return;
            const settings = window.GameState.get().settings;
            settings.sfxMuted = !settings.sfxMuted;
            window.GameState.save();
            updateAudioButtons();

            if (!settings.sfxMuted) {
                safeAudio(a => a.playClick && a.playClick());
            }
        }

        function toggleMasterSound(e) {
            if (e) e.stopPropagation();
            if (!window.GameState) return;
            const settings = window.GameState.get().settings;
            const targetMuted = !(settings.musicMuted && settings.sfxMuted);
            settings.musicMuted = targetMuted;
            settings.sfxMuted = targetMuted;
            window.GameState.save();
            updateAudioButtons();

            safeAudio(a => {
                if (settings.musicMuted) {
                    if (a.stopMusic) a.stopMusic();
                } else {
                    if (currentState === STATE.PLAYING) {
                        if (a.playActionMusic) a.playActionMusic();
                    } else {
                        if (a.playMenuMusic) a.playMenuMusic();
                    }
                }
            });
        }

        const btnMenuMusic = document.getElementById('btnMenuMusic');
        if (btnMenuMusic) btnMenuMusic.addEventListener('click', toggleMusic);
        const btnPauseMusic = document.getElementById('btnPauseMusic');
        if (btnPauseMusic) btnPauseMusic.addEventListener('click', toggleMusic);

        const btnMenuSFX = document.getElementById('btnMenuSFX');
        if (btnMenuSFX) btnMenuSFX.addEventListener('click', toggleSFX);
        const btnPauseSFX = document.getElementById('btnPauseSFX');
        if (btnPauseSFX) btnPauseSFX.addEventListener('click', toggleSFX);

        const btnSound = document.getElementById('btnSound');
        if (btnSound) btnSound.addEventListener('click', toggleMasterSound);

        updateAudioButtons();

        // Fullscreen Toggle
        const btnFullscreen = document.getElementById('btnFullscreen');
        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });
        }

        // Shop / Garage Modal
        const btnShop = document.getElementById('btnShop');
        const btnCloseShop = document.getElementById('btnCloseShop');
        if (btnShop) btnShop.addEventListener('click', openShop);
        if (btnCloseShop) btnCloseShop.addEventListener('click', () => {
            const modal = document.getElementById('shopModal');
            if (modal) modal.classList.add('hidden');
        });

        // Tutorial / Help Modal
        const btnHelp = document.getElementById('btnHelp');
        const helpModal = document.getElementById('helpModal');
        const btnCloseHelp = document.getElementById('btnCloseHelp');
        if (btnHelp && helpModal) {
            btnHelp.addEventListener('click', () => helpModal.classList.remove('hidden'));
            if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => helpModal.classList.add('hidden'));
        }
    }

    function openShop() {
        const modal = document.getElementById('shopModal');
        if (modal) modal.classList.remove('hidden');
        renderShop();
    }

    function renderShop() {
        if (!window.GameState) return;
        const data = window.GameState.get();
        const currentDiamonds = data.diamonds !== undefined ? data.diamonds : data.coins;
        const shopDiamondsElem = document.getElementById('shopDiamonds');
        if (shopDiamondsElem) shopDiamondsElem.textContent = currentDiamonds || 0;

        // Render Skins
        const skinsList = document.getElementById('skinsList');
        if (skinsList && window.GameState.SKINS) {
            skinsList.innerHTML = '';
            Object.values(window.GameState.SKINS).forEach(skin => {
                const isUnlocked = data.unlockedSkins.includes(skin.id);
                const isEquipped = data.equippedSkin === skin.id;

                const card = document.createElement('div');
                card.className = `shop-card ${isEquipped ? 'equipped' : ''}`;
                card.innerHTML = `
                    <div class="skin-preview" style="background: radial-gradient(circle, ${skin.primaryColor}33, transparent); border-color: ${skin.primaryColor};">
                        <div class="skin-ship-icon" style="color: ${skin.primaryColor}; text-shadow: 0 0 12px ${skin.primaryColor}">▲</div>
                    </div>
                    <div class="shop-card-info">
                        <h4>${skin.name}</h4>
                        <p>${skin.tagline}</p>
                    </div>
                    <div class="shop-card-action">
                        ${isEquipped ? '<span class="badge-equipped">EQUIPPED</span>' : 
                          isUnlocked ? `<button class="btn-shop-equip" data-skin="${skin.id}">EQUIP</button>` : 
                          `<button class="btn-shop-buy" data-skin="${skin.id}">💎 ${skin.price}</button>`}
                    </div>
                `;
                skinsList.appendChild(card);
            });

            skinsList.querySelectorAll('.btn-shop-equip').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-skin');
                    window.GameState.equipSkin(id);
                    renderShop();
                });
            });

            skinsList.querySelectorAll('.btn-shop-buy').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-skin');
                    const res = window.GameState.unlockSkin(id);
                    if (res.success) {
                        renderShop();
                        updateMenuStats();
                    } else {
                        alert(res.reason || 'Insufficient Diamonds!');
                    }
                });
            });
        }

        // Render Upgrades
        const upgradesList = document.getElementById('upgradesList');
        if (upgradesList && window.GameState.UPGRADE_CONFIG) {
            upgradesList.innerHTML = '';
            Object.entries(window.GameState.UPGRADE_CONFIG).forEach(([key, cfg]) => {
                const currentLvl = data.upgrades[key] || 1;
                const isMax = currentLvl >= cfg.maxLvl;
                const nextCost = isMax ? 'MAX' : cfg.costs[currentLvl - 1];

                const card = document.createElement('div');
                card.className = 'shop-card';
                card.innerHTML = `
                    <div class="upgrade-icon">${cfg.icon}</div>
                    <div class="shop-card-info">
                        <h4>${cfg.name} (LVL ${currentLvl}/${cfg.maxLvl})</h4>
                        <p>${cfg.desc}</p>
                        <div class="lvl-bar-track">
                            <div class="lvl-bar-fill" style="width: ${(currentLvl / cfg.maxLvl) * 100}%"></div>
                        </div>
                    </div>
                    <div class="shop-card-action">
                        ${isMax ? '<span class="badge-max">MAXED</span>' : 
                          `<button class="btn-shop-upgrade" data-upgrade="${key}">💎 ${nextCost}</button>`}
                    </div>
                `;
                upgradesList.appendChild(card);
            });

            upgradesList.querySelectorAll('.btn-shop-upgrade').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const key = e.target.getAttribute('data-upgrade');
                    const res = window.GameState.upgradeItem(key);
                    if (res.success) {
                        renderShop();
                        updateMenuStats();
                    } else {
                        alert(res.reason || 'Insufficient Diamonds!');
                    }
                });
            });
        }
    }

    function openHelp() {
        const modal = document.getElementById('helpModal');
        if (modal) modal.classList.remove('hidden');
    }

    // Auto initialize when DOM is ready
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Global exports for accessibility and external callers
    window.startGame = startGame;
    window.showMenu = showMenu;
    window.resumeGame = resumeGame;
    window.togglePause = togglePause;
    window.openShop = openShop;
    window.openHelp = openHelp;
    window.moveLeft = moveLeft;
    window.moveRight = moveRight;
    window.jump = jump;
    window.slide = slide;
    window.START_SPEED = START_SPEED;
    window.MAX_SPEED = MAX_SPEED;
    window.ACCELERATION = ACCELERATION;
    window.update_speed = update_speed;
    window.getGameSpeed = () => game_speed;
    window.getElapsedTime = () => elapsed_time;
})();
