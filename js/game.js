/**
 * Street Runner - Core Game Engine & Mobile Control System
 */
(function() {
    'use strict';

    const STATE = {
        MENU: 'menu',
        PLAYING: 'playing',
        PAUSED: 'paused',
        GAMEOVER: 'gameover'
    };

    let currentState = STATE.MENU;

    // Speed settings
    const START_SPEED = 4;
    const MAX_SPEED = 14;
    const ACCELERATION = 0.1;

    // Game variables
    let game_speed = START_SPEED;
    let speed = game_speed; // alias for existing renderer references
    let elapsed_time = 0;
    let score = 0;
    let diamondsCollected = 0;
    let distance = 0;
    let spawnTimer = 0;
    let powerupSpawnTimer = 15000;
    let diamondCombo = 0;
    let comboResetTimer = 0;

    let obstacles = [];
    let diamondObjects = [];
    let coinObjects = diamondObjects; // alias for compatibility
    let powerupObjects = [];

    let lastTime = 0;
    let invulnerableTimer = 0;

    // Player object
    const player = {
        lane: 1,
        x: 0,
        y: 0,
        vx: 0,
        width: 44,
        height: 68,
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

    function init() {
        const canvas = document.getElementById('canvas');
        window.GameRenderer.init(canvas);

        window.addEventListener('resize', () => {
            window.GameRenderer.resize();
            player.x = window.GameRenderer.laneX(player.lane, 1.0);
            player.y = window.GameRenderer.H - 140;
        });

        initControls();
        initUI();
        updateMenuStats();

        // Initial setup
        player.x = window.GameRenderer.laneX(1, 1.0);
        player.y = window.GameRenderer.H - 140;

        // Render initial background loop
        requestAnimationFrame(renderLoop);
    }

    function updateMenuStats() {
        const data = window.GameState.get();
        const currentDiamonds = data.diamonds !== undefined ? data.diamonds : data.coins;
        const menuBest = document.getElementById('menuBest');
        const menuDiamonds = document.getElementById('menuDiamonds') || document.getElementById('menuCoins');
        const shopDiamonds = document.getElementById('shopDiamonds') || document.getElementById('shopCoins');

        if (menuBest) menuBest.textContent = data.highScore;
        if (menuDiamonds) menuDiamonds.textContent = `💎 ${currentDiamonds}`;
        if (shopDiamonds) shopDiamonds.textContent = currentDiamonds;
    }

    function triggerHaptic(pattern) {
        const settings = window.GameState.get().settings;
        if (settings.vibration && navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }

    /* ==========================================================
       GAME LIFECYCLE
       ========================================================== */

    function startGame() {
        currentState = STATE.PLAYING;

        score = 0;
        diamondsCollected = 0;
        distance = 0;
        elapsed_time = 0;
        game_speed = START_SPEED;
        speed = game_speed;
        spawnTimer = 0;
        powerupSpawnTimer = 12000;
        diamondCombo = 0;
        comboResetTimer = 0;
        invulnerableTimer = 0;

        obstacles = [];
        diamondObjects = [];
        coinObjects = diamondObjects;
        powerupObjects = [];
        window.Particles.clear();

        player.lane = 1;
        player.x = window.GameRenderer.laneX(1, 1.0);
        player.y = window.GameRenderer.H - 140;
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

        // Update UI panels
        document.getElementById('menu').classList.add('hidden');
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('pauseScreen').classList.add('hidden');
        document.getElementById('shopModal').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');

        // Check if on-screen touch buttons should be shown
        const settings = window.GameState.get().settings;
        const touchControlsElem = document.getElementById('touchControls');
        if (touchControlsElem) {
            if (settings.touchControls) touchControlsElem.classList.remove('hidden');
            else touchControlsElem.classList.add('hidden');
        }

        updateHUD();
        triggerHaptic([30]);

        if (window.AudioEngine) {
            window.AudioEngine.init();
            window.AudioEngine.playActionMusic();
        }

        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function togglePause() {
        if (currentState === STATE.PLAYING) {
            currentState = STATE.PAUSED;
            document.getElementById('pauseScreen').classList.remove('hidden');
            if (typeof updateAudioButtons === 'function') updateAudioButtons();
            if (window.AudioEngine) window.AudioEngine.pauseMusic();
        } else if (currentState === STATE.PAUSED) {
            resumeGame();
        }
    }

    function resumeGame() {
        if (currentState !== STATE.PAUSED) return;
        currentState = STATE.PLAYING;
        document.getElementById('pauseScreen').classList.add('hidden');
        if (window.AudioEngine) window.AudioEngine.resumeMusic();
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function showMenu() {
        currentState = STATE.MENU;
        document.getElementById('menu').classList.remove('hidden');
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('pauseScreen').classList.add('hidden');
        document.getElementById('shopModal').classList.add('hidden');
        document.getElementById('hud').classList.add('hidden');
        const touchControlsElem = document.getElementById('touchControls');
        if (touchControlsElem) touchControlsElem.classList.add('hidden');

        if (typeof updateAudioButtons === 'function') updateAudioButtons();

        if (window.AudioEngine) {
            window.AudioEngine.playMenuMusic();
        }

        updateMenuStats();
    }

    function endGame() {
        currentState = STATE.GAMEOVER;

        if (window.AudioEngine) {
            window.AudioEngine.playCrash();
            setTimeout(() => {
                if (currentState === STATE.GAMEOVER && window.AudioEngine) {
                    window.AudioEngine.playMenuMusic();
                }
            }, 700);
        }
        triggerHaptic([50, 40, 100]);
        window.GameRenderer.triggerShake(18, 450);
        window.Particles.emitExplosion(player.x, player.y - player.jumpHeight, '#ff0055', 40);

        // Save high score and diamond earnings
        const isNewBest = window.GameState.updateHighScore(score, Math.floor(distance));
        window.GameState.addDiamonds(diamondsCollected);

        // Show Game Over UI
        document.getElementById('finalScore').textContent = score;
        const finalDiamondsElem = document.getElementById('finalDiamonds') || document.getElementById('finalCoins');
        if (finalDiamondsElem) finalDiamondsElem.textContent = `💎 ${diamondsCollected}`;
        document.getElementById('finalDistance').textContent = Math.floor(distance) + 'm';
        document.getElementById('finalBest').textContent = window.GameState.get().highScore;

        const newBestBadge = document.getElementById('newBestBadge');
        if (newBestBadge) {
            if (isNewBest) newBestBadge.classList.remove('hidden');
            else newBestBadge.classList.add('hidden');
        }

        document.getElementById('gameOver').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        const touchControlsElem = document.getElementById('touchControls');
        if (touchControlsElem) touchControlsElem.classList.add('hidden');

        updateMenuStats();
    }

    /* ==========================================================
       PLAYER ACTIONS
       ========================================================== */

    function moveLeft() {
        if (currentState !== STATE.PLAYING) return;
        if (player.lane > 0) {
            player.lane--;
            if (window.AudioEngine) window.AudioEngine.playSwipe();
            triggerHaptic([15]);
        }
    }

    function moveRight() {
        if (currentState !== STATE.PLAYING) return;
        if (player.lane < 2) {
            player.lane++;
            if (window.AudioEngine) window.AudioEngine.playSwipe();
            triggerHaptic([15]);
        }
    }

    function jump() {
        if (currentState !== STATE.PLAYING) return;
        if (!player.jumping && !player.sliding) {
            player.jumping = true;
            player.jumpVelocity = -15.5;
            if (window.AudioEngine) window.AudioEngine.playJump();
            triggerHaptic([20]);
        }
    }

    function slide() {
        if (currentState !== STATE.PLAYING) return;
        if (!player.jumping) {
            player.sliding = true;
            player.slideTimer = 480;
            if (window.AudioEngine) window.AudioEngine.playSlide();
            triggerHaptic([25]);
        }
    }

    /* ==========================================================
       POWER-UPS
       ========================================================== */

    function activatePowerup(type) {
        const durationSec = window.GameState.getPowerupDuration(type);
        const durationMs = durationSec * 1000;

        if (window.AudioEngine) window.AudioEngine.playPowerup();
        triggerHaptic([30, 20, 50]);

        if (type === 'shield') {
            player.hasShield = true;
            player.shieldTimer = durationMs;
            window.Particles.addFloatingText('SHIELD ONLINE!', player.x, player.y - 60, '#00f3ff');
        } else if (type === 'magnet') {
            player.hasMagnet = true;
            player.magnetTimer = durationMs;
            window.Particles.addFloatingText('MAGNET ACTIVE!', player.x, player.y - 60, '#00bfff');
        } else if (type === 'overdrive') {
            player.hasOverdrive = true;
            player.overdriveTimer = durationMs;
            window.GameRenderer.triggerShake(8, 300);
            window.Particles.addFloatingText('⚡ OVERDRIVE!', player.x, player.y - 60, '#ff00ff');
        } else if (type === 'multiplier') {
            player.hasMultiplier = true;
            player.multiplierTimer = durationMs;
            window.Particles.addFloatingText('2X MULTIPLIER!', player.x, player.y - 60, '#ffb700');
        }
    }

    /* ==========================================================
       SPAWNING
       ========================================================== */

    function spawnObstaclePattern() {
        const types = ['low', 'high', 'barricade'];
        // Pick an obstacle pattern ensuring at least 1 lane is safe
        const blockedLanesCount = (speed > 9 && Math.random() > 0.45) ? 2 : 1;
        const safeLane = Math.floor(Math.random() * 3);

        for (let lane = 0; lane < 3; lane++) {
            if (lane === safeLane && blockedLanesCount === 2) continue;
            if (blockedLanesCount === 1 && lane !== ((safeLane + 1) % 3)) continue;

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
        const targetX = window.GameRenderer.laneX(player.lane, 1.0);
        const prevX = player.x;

        // Smooth lane switching interpolation
        player.x += (targetX - player.x) * Math.min(1, (dt / 1000) * 14);
        player.vx = player.x - prevX;

        // Emit thruster particles
        const skin = window.GameState.getCurrentSkin();
        window.Particles.emitThruster(player.x, player.y - player.jumpHeight + (player.sliding ? 8 : 18), skin.thrusterColor, 2);

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

        // Slide timer & sparks
        if (player.sliding) {
            player.slideTimer -= dt;
            window.Particles.emitSlideSparks(player.x, player.y + 16, 2);

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
                window.Particles.addFloatingText('SHIELD EXPIRED', player.x, player.y - 60, '#999999');
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
                window.Particles.addFloatingText('OVERDRIVE ENDED', player.x, player.y - 60, '#999999');
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

        // Diamond combo decay timer
        if (comboResetTimer > 0) {
            comboResetTimer -= dt;
            if (comboResetTimer <= 0) {
                diamondCombo = 0;
            }
        }
    }

    function updateObjects(dt) {
        const currentSpeed = player.hasOverdrive ? speed * 1.6 : speed;
        const movement = currentSpeed * (dt / 16.67) * 2.2;
        const H = window.GameRenderer.H;
        const horizonY = H * 0.38;
        const trackLength = H - horizonY;

        // Update obstacles
        for (const ob of obstacles) {
            ob.y += movement;
            ob.progress = Math.max(0, (ob.y - horizonY) / trackLength);
            ob.x = window.GameRenderer.laneX(ob.lane, Math.min(1, ob.progress));
        }

        // Update diamonds & magnet pulling
        for (const diamond of diamondObjects) {
            if (player.hasMagnet && !diamond.collected && diamond.y > horizonY) {
                // Accelerate diamond straight toward player
                const dx = player.x - diamond.x;
                const dy = (player.y - player.jumpHeight) - diamond.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 320) {
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

        // Update powerups
        for (const pu of powerupObjects) {
            pu.y += movement;
            pu.progress = Math.max(0, (pu.y - horizonY) / trackLength);
            pu.x = window.GameRenderer.laneX(pu.lane, Math.min(1, pu.progress));
        }

        // Prune offscreen items
        obstacles = obstacles.filter(ob => ob.y < H + 120);
        diamondObjects = diamondObjects.filter(d => d.y < H + 100 && !d.collected);
        coinObjects = diamondObjects;
        powerupObjects = powerupObjects.filter(pu => pu.y < H + 100 && !pu.collected);
    }

    function updateSpawning(dt) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnObstaclePattern();

            if (Math.random() > 0.3) {
                spawnCoinStreak();
            }

            const currentSpeed = player.hasOverdrive ? speed * 1.6 : speed;
            spawnTimer = Math.max(420, 1100 - currentSpeed * 45);
        }

        // Power-up capsule spawn
        powerupSpawnTimer -= dt;
        if (powerupSpawnTimer <= 0) {
            spawnPowerup();
            powerupSpawnTimer = 18000 + Math.random() * 12000;
        }
    }

    function update_speed(dt) {
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
        distance += currentSpeed * dtSeconds;

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

            // Check bounding box overlap
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
                if (ob.type === 'low' && player.jumpHeight > 42) {
                    continue; // Successfully jumped over!
                }

                // Check if slide cleared high barrier
                if (ob.type === 'high' && player.sliding) {
                    continue; // Successfully slid under!
                }

                // Overdrive smashes through everything!
                if (player.hasOverdrive) {
                    window.Particles.emitExplosion(ob.x, ob.y, '#ff00ff', 25);
                    window.Particles.addFloatingText('+50 SMASH!', ob.x, ob.y - 30, '#ff00ff');
                    if (window.AudioEngine) window.AudioEngine.playShieldHit();
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
                    window.GameRenderer.triggerShake(12, 300);
                    window.Particles.emitExplosion(player.x, py, '#00f3ff', 30);
                    window.Particles.addFloatingText('SHIELD SHATTERED!', player.x, py - 40, '#00f3ff');
                    if (window.AudioEngine) window.AudioEngine.playShieldHit();
                    triggerHaptic([40, 30, 60]);
                    obstacles.splice(i, 1);
                    continue;
                }

                // Lethal Crash!
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

                if (window.AudioEngine) {
                    window.AudioEngine.playDiamond(diamondCombo);
                }
                triggerHaptic([12]);

                window.Particles.emitDiamondBurst(diamond.x, diamond.y, '#00f3ff', 14);
                if (diamondCombo > 2) {
                    window.Particles.addFloatingText(`💎 x${diamondCombo} COMBO!`, diamond.x, diamond.y - 20, '#00f3ff', 14);
                } else {
                    window.Particles.addFloatingText(`💎 +${10 + bonus}`, diamond.x, diamond.y - 18, '#ffffff', 13);
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
                window.Particles.emitCoinBurst(pu.x, pu.y, '#00f3ff', 16);
            }
        }
    }

    /* ==========================================================
       HUD & UI
       ========================================================== */

    function updateHUD() {
        const scoreElem = document.getElementById('score');
        const diamondsElem = document.getElementById('diamonds') || document.getElementById('coins');
        const speedElem = document.getElementById('speedGauge');
        const powerupBar = document.getElementById('powerupBar');
        const powerupIcon = document.getElementById('powerupIcon');
        const powerupTimer = document.getElementById('powerupTimer');

        if (scoreElem) scoreElem.textContent = score;
        if (diamondsElem) diamondsElem.textContent = `💎 ${diamondsCollected}`;

        const kmh = Math.floor(speed * 18);
        if (speedElem) speedElem.textContent = `${kmh} KM/H`;

        // Active Power-up indicator
        if (powerupBar && powerupIcon && powerupTimer) {
            let activeType = null;
            let remaining = 0;
            let total = 1;

            if (player.hasOverdrive) {
                activeType = '⚡ OVERDRIVE';
                remaining = player.overdriveTimer;
                total = window.GameState.getPowerupDuration('overdrive') * 1000;
            } else if (player.hasShield) {
                activeType = '🛡️ SHIELD';
                remaining = player.shieldTimer;
                total = window.GameState.getPowerupDuration('shield') * 1000;
            } else if (player.hasMagnet) {
                activeType = '🧲 MAGNET';
                remaining = player.magnetTimer;
                total = window.GameState.getPowerupDuration('magnet') * 1000;
            } else if (player.hasMultiplier) {
                activeType = '✖️2 MULTIPLIER';
                remaining = player.multiplierTimer;
                total = window.GameState.getPowerupDuration('multiplier') * 1000;
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

        window.Particles.update(dt);
        window.Particles.updateSpeedLines(window.GameRenderer.W, window.GameRenderer.H, speed, player.hasOverdrive);

        // Render Frame
        const laneOffset = (player.x - (window.GameRenderer.W / 2)) / (window.GameRenderer.W / 2);
        window.GameRenderer.beginFrame(dt);
        window.GameRenderer.drawSky(time, laneOffset);
        window.GameRenderer.drawSideBuildings(dt, speed, laneOffset, time);
        window.GameRenderer.drawRoad(dt, speed);
        window.GameRenderer.drawDiamonds(diamondObjects, time);
        window.GameRenderer.drawPowerups(powerupObjects, time);
        window.GameRenderer.drawObstacles(obstacles, time);
        window.Particles.draw(window.GameRenderer.ctx);

        // Blink player if temporarily invulnerable
        if (!(invulnerableTimer > 0 && Math.floor(time / 60) % 2 === 0)) {
            window.GameRenderer.drawPlayer(player, time);
        }

        window.GameRenderer.endFrame();

        updateHUD();

        if (currentState === STATE.PLAYING) {
            requestAnimationFrame(gameLoop);
        }
    }

    // Ambient loop for menu / game over background
    function renderLoop(time) {
        if (currentState !== STATE.PLAYING) {
            const dt = 16.67;
            window.GameRenderer.beginFrame(dt);
            window.GameRenderer.drawSky(time, 0);
            window.GameRenderer.drawSideBuildings(dt, 2.5, 0, time);
            window.GameRenderer.drawRoad(dt, 2.5);
            window.Particles.update(dt);
            window.Particles.draw(window.GameRenderer.ctx);
            window.GameRenderer.endFrame();
        }
        requestAnimationFrame(renderLoop);
    }

    /* ==========================================================
       CONTROLS & GESTURE DETECTOR
       ========================================================== */

    function initControls() {
        // Touch Swipe Handling
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
            const dt = performance.now() - touchStartTime;

            const threshold = 32;

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
            } else if (key === 'escape' || key === 'p') {
                togglePause();
            }
        });

        // On-Screen Tactile Touch Buttons
        const btnLeft = document.getElementById('touchLeft');
        const btnRight = document.getElementById('touchRight');
        const btnJump = document.getElementById('touchJump');
        const btnSlide = document.getElementById('touchSlide');

        if (btnLeft) btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); moveLeft(); });
        if (btnRight) btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); moveRight(); });
        if (btnJump) btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
        if (btnSlide) btnSlide.addEventListener('touchstart', (e) => { e.preventDefault(); slide(); });
    }

    /* ==========================================================
       UI EVENT LISTENERS & GARAGE SHOP
       ========================================================== */

    // Sound & Music Controls (Synchronized across Main Menu, Pause Screen & HUD)
    function updateAudioButtons() {
        const settings = window.GameState.get().settings;

        // Music Buttons (Menu & Pause)
        const btnMenuMusic = document.getElementById('btnMenuMusic');
        const btnPauseMusic = document.getElementById('btnPauseMusic');
        [btnMenuMusic, btnPauseMusic].forEach(btn => {
            if (btn) {
                btn.textContent = settings.musicMuted ? '🔇 MUSIC: OFF' : '🎵 MUSIC: ON';
                btn.classList.toggle('muted', !!settings.musicMuted);
            }
        });

        // SFX Buttons (Menu & Pause)
        const btnMenuSFX = document.getElementById('btnMenuSFX');
        const btnPauseSFX = document.getElementById('btnPauseSFX');
        [btnMenuSFX, btnPauseSFX].forEach(btn => {
            if (btn) {
                btn.textContent = settings.sfxMuted ? '🔇 SFX: OFF' : '🔊 SFX: ON';
                btn.classList.toggle('muted', !!settings.sfxMuted);
            }
        });

        // HUD Master Sound Button
        const btnSound = document.getElementById('btnSound');
        if (btnSound) {
            const allMuted = settings.musicMuted && settings.sfxMuted;
            btnSound.textContent = allMuted ? '🔇' : (settings.musicMuted ? '🔈' : '🔊');
        }
    }

    function initUI() {
        // Buttons
        document.getElementById('btnStart').addEventListener('click', startGame);
        document.getElementById('btnRestart').addEventListener('click', startGame);
        document.getElementById('btnMenuFromOver').addEventListener('click', showMenu);
        document.getElementById('btnResume').addEventListener('click', resumeGame);
        document.getElementById('btnMenuFromPause').addEventListener('click', showMenu);
        document.getElementById('btnPause').addEventListener('click', togglePause);

        function toggleMusic(e) {
            if (e) e.stopPropagation();
            if (window.AudioEngine) window.AudioEngine.init();
            const settings = window.GameState.get().settings;
            settings.musicMuted = !settings.musicMuted;
            window.GameState.save();
            updateAudioButtons();

            if (window.AudioEngine) {
                if (settings.musicMuted) {
                    window.AudioEngine.stopMusic();
                } else {
                    if (currentState === STATE.PLAYING) {
                        window.AudioEngine.playActionMusic();
                    } else {
                        window.AudioEngine.playMenuMusic();
                    }
                }
            }
        }

        function toggleSFX(e) {
            if (e) e.stopPropagation();
            if (window.AudioEngine) window.AudioEngine.init();
            const settings = window.GameState.get().settings;
            settings.sfxMuted = !settings.sfxMuted;
            window.GameState.save();
            updateAudioButtons();

            if (!settings.sfxMuted && window.AudioEngine) {
                window.AudioEngine.playClick();
            }
        }

        function toggleMasterSound(e) {
            if (e) e.stopPropagation();
            if (window.AudioEngine) window.AudioEngine.init();
            const settings = window.GameState.get().settings;
            const targetMuted = !(settings.musicMuted && settings.sfxMuted);
            settings.musicMuted = targetMuted;
            settings.sfxMuted = targetMuted;
            window.GameState.save();
            updateAudioButtons();

            if (window.AudioEngine) {
                if (settings.musicMuted) {
                    window.AudioEngine.stopMusic();
                } else {
                    if (currentState === STATE.PLAYING) {
                        window.AudioEngine.playActionMusic();
                    } else {
                        window.AudioEngine.playMenuMusic();
                    }
                }
            }
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

        // Garage / Shop Modal
        const btnShop = document.getElementById('btnShop');
        const btnCloseShop = document.getElementById('btnCloseShop');
        if (btnShop) btnShop.addEventListener('click', openShop);
        if (btnCloseShop) btnCloseShop.addEventListener('click', () => {
            document.getElementById('shopModal').classList.add('hidden');
        });

        // Instructions Modal
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
        modal.classList.remove('hidden');
        renderShop();
    }

    function renderShop() {
        const data = window.GameState.get();
        const currentDiamonds = data.diamonds !== undefined ? data.diamonds : data.coins;
        const shopDiamondsElem = document.getElementById('shopDiamonds') || document.getElementById('shopCoins');
        if (shopDiamondsElem) shopDiamondsElem.textContent = currentDiamonds;

        // Render Skins
        const skinsList = document.getElementById('skinsList');
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

        // Add event listeners for skin buttons
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

        // Render Upgrades
        const upgradesList = document.getElementById('upgradesList');
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

    // Initialize when DOM is ready
    window.addEventListener('DOMContentLoaded', init);

    // Global exports for inline HTML handlers if called
    window.startGame = startGame;
    window.showMenu = showMenu;
    window.resumeGame = resumeGame;
    window.togglePause = togglePause;
    window.START_SPEED = START_SPEED;
    window.MAX_SPEED = MAX_SPEED;
    window.ACCELERATION = ACCELERATION;
    window.update_speed = update_speed;
    window.getGameSpeed = () => game_speed;
    window.getElapsedTime = () => elapsed_time;
})();
