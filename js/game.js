/**
 * Street Runner // Cyber Highway - Core Interactive Game Engine
 * Features:
 * - Direct Cyber Highway DOM integration
 * - Smooth physics Jump & Slide system
 * - Dynamic obstacles (obstacle_x -= game_speed)
 * - Speed progression (START_SPEED = 4.0, MAX_SPEED = 14.0, ACCELERATION = 0.08)
 * - Parallax animation speed synchronization
 * - Diamonds, power-ups (Shield, Magnet, Overdrive, Multiplier)
 * - Pure Web Audio API synthesizers (Music & SFX)
 * - Touch swipes & on-screen mobile controls
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
    const START_SPEED = 4.0;
    const MAX_SPEED = 14.0;
    const ACCELERATION = 0.08;

    let game_speed = START_SPEED;
    let elapsed_time = 0;
    let score = 0;
    let distance = 0;
    let diamondsCollected = 0;

    let obstacles = [];
    let diamonds = [];
    let powerups = [];

    let spawnTimer = 0;
    let diamondSpawnTimer = 0;
    let powerupSpawnTimer = 18000;

    let lastTime = 0;

    // Player Physics State
    const player = {
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

    // DOM Elements
    let playerEl, entitiesLayerEl, scoreDisplayEl, diamondsBadgeEl, speedDisplayEl;
    let farCityEl, mainCityEl, sidewalkEl, roadEl, peopleLayerEl, carsLayerEl;
    let startMenuEl, gameOverModalEl, pauseModalEl;
    let menuHighScoreEl, menuDiamondsEl, finalScoreEl, finalDistanceEl, finalDiamondsEl, finalBestEl;

    function init() {
        // Cache DOM elements
        playerEl = document.getElementById('player');
        entitiesLayerEl = document.getElementById('gameEntitiesLayer');
        scoreDisplayEl = document.getElementById('scoreDisplay');
        diamondsBadgeEl = document.getElementById('diamondsBadge');
        speedDisplayEl = document.getElementById('speedDisplay');

        farCityEl = document.getElementById('farCity');
        mainCityEl = document.getElementById('mainCity');
        sidewalkEl = document.getElementById('sidewalk');
        roadEl = document.getElementById('road');
        peopleLayerEl = document.getElementById('peopleLayer');
        carsLayerEl = document.getElementById('carsLayer');

        startMenuEl = document.getElementById('startMenu');
        gameOverModalEl = document.getElementById('gameOverModal');
        pauseModalEl = document.getElementById('pauseModal');

        menuHighScoreEl = document.getElementById('menuHighScore');
        menuDiamondsEl = document.getElementById('menuDiamonds');
        finalScoreEl = document.getElementById('finalScore');
        finalDistanceEl = document.getElementById('finalDistance');
        finalDiamondsEl = document.getElementById('finalDiamonds');
        finalBestEl = document.getElementById('finalBest');

        initControls();
        updateMenuStats();

        // Start render loop
        requestAnimationFrame(gameLoop);
    }

    function updateMenuStats() {
        const data = window.GameState ? window.GameState.get() : { highScore: 0, diamonds: 0 };
        if (menuHighScoreEl) menuHighScoreEl.textContent = data.highScore || 0;
        if (menuDiamondsEl) menuDiamondsEl.textContent = `💎 ${data.diamonds || 0}`;
    }

    /* ==========================================================
       GAME LIFECYCLE
       ========================================================== */

    function startGame() {
        currentState = STATE.PLAYING;

        // Reset variables
        game_speed = START_SPEED;
        elapsed_time = 0;
        score = 0;
        distance = 0;
        diamondsCollected = 0;
        spawnTimer = 600;
        diamondSpawnTimer = 1200;
        powerupSpawnTimer = 15000;

        player.jumpHeight = 0;
        player.jumpVelocity = 0;
        player.jumping = false;
        player.sliding = false;
        player.slideTimer = 0;
        player.hasShield = false;
        player.hasMagnet = false;
        player.hasOverdrive = false;
        player.hasMultiplier = false;

        // Clear active entities
        if (entitiesLayerEl) entitiesLayerEl.innerHTML = '';
        obstacles = [];
        diamonds = [];
        powerups = [];

        // Hide menus
        if (startMenuEl) startMenuEl.classList.add('hidden');
        if (gameOverModalEl) gameOverModalEl.classList.add('hidden');
        if (pauseModalEl) pauseModalEl.classList.add('hidden');

        // Start audio
        if (window.AudioEngine) {
            window.AudioEngine.initAudio();
            window.AudioEngine.startMusic('game');
        }

        lastTime = performance.now();
    }

    function pauseGame() {
        if (currentState === STATE.PLAYING) {
            currentState = STATE.PAUSED;
            if (pauseModalEl) pauseModalEl.classList.remove('hidden');
            if (window.AudioEngine) window.AudioEngine.stopMusic();
        } else if (currentState === STATE.PAUSED) {
            resumeGame();
        }
    }

    function resumeGame() {
        if (currentState === STATE.PAUSED) {
            currentState = STATE.PLAYING;
            if (pauseModalEl) pauseModalEl.classList.add('hidden');
            if (window.AudioEngine) window.AudioEngine.startMusic('game');
            lastTime = performance.now();
        }
    }

    function gameOver() {
        currentState = STATE.GAMEOVER;

        if (window.AudioEngine) {
            window.AudioEngine.playCrash();
            window.AudioEngine.stopMusic();
        }

        // Save progress in GameState
        if (window.GameState) {
            const data = window.GameState.get();
            const isNewBest = score > data.highScore;
            window.GameState.setHighScore(score);
            window.GameState.addDiamonds(diamondsCollected);

            if (finalScoreEl) finalScoreEl.textContent = score;
            if (finalDistanceEl) finalDistanceEl.textContent = `${Math.floor(distance)}m`;
            if (finalDiamondsEl) finalDiamondsEl.textContent = `💎 ${diamondsCollected}`;
            if (finalBestEl) finalBestEl.textContent = Math.max(score, data.highScore);
        }

        if (gameOverModalEl) gameOverModalEl.classList.remove('hidden');
    }

    /* ==========================================================
       SPEED UPDATE (User Formula)
       ========================================================== */

    function update_speed(dt) {
        elapsed_time += dt;

        game_speed = Math.min(
            START_SPEED + (elapsed_time * ACCELERATION),
            MAX_SPEED
        );
        return game_speed;
    }

    /* ==========================================================
       PLAYER ACTIONS
       ========================================================== */

    function jump() {
        if (currentState !== STATE.PLAYING) return;
        if (!player.jumping && !player.sliding) {
            player.jumping = true;
            player.jumpVelocity = 18.5;
            if (window.AudioEngine) window.AudioEngine.playJump();
        }
    }

    function slide() {
        if (currentState !== STATE.PLAYING) return;
        if (!player.jumping && !player.sliding) {
            player.sliding = true;
            player.slideTimer = 550;
            if (window.AudioEngine) window.AudioEngine.playSlide();
        }
    }

    /* ==========================================================
       SPAWNING
       ========================================================== */

    function spawnObstacle() {
        const types = ['low', 'high', 'car'];
        const weights = [0.45, 0.35, 0.20];
        const r = Math.random();
        let type = 'low';

        if (r < weights[0]) {
            type = 'low';
        } else if (r < weights[0] + weights[1]) {
            type = 'high';
        } else {
            type = 'car';
        }

        const el = document.createElement('div');
        el.className = `obstacle ${type}`;
        const startX = window.innerWidth + 80;
        el.style.left = startX + 'px';

        if (entitiesLayerEl) entitiesLayerEl.appendChild(el);

        obstacles.push({
            el,
            type,
            x: startX
        });
    }

    function spawnDiamondStreak() {
        const count = 3 + Math.floor(Math.random() * 3);
        const isHigh = Math.random() > 0.5;
        const baseY = isHigh ? '38%' : '23%';

        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'diamond-item';
            el.textContent = '💎';
            el.style.bottom = baseY;

            const startX = window.innerWidth + 100 + i * 55;
            el.style.left = startX + 'px';

            if (entitiesLayerEl) entitiesLayerEl.appendChild(el);

            diamonds.push({
                el,
                x: startX,
                collected: false
            });
        }
    }

    function spawnPowerup() {
        const types = ['shield', 'magnet', 'overdrive', 'multiplier'];
        const icons = { shield: '🛡️', magnet: '🧲', overdrive: '⚡', multiplier: '✖️2' };
        const type = types[Math.floor(Math.random() * types.length)];

        const el = document.createElement('div');
        el.className = 'powerup-item';
        el.textContent = icons[type];
        el.style.bottom = '24%';

        const startX = window.innerWidth + 120;
        el.style.left = startX + 'px';

        if (entitiesLayerEl) entitiesLayerEl.appendChild(el);

        powerups.push({
            el,
            type,
            x: startX,
            collected: false
        });
    }

    function activatePowerup(type) {
        if (window.AudioEngine) window.AudioEngine.playPowerup();

        if (type === 'shield') {
            player.hasShield = true;
            player.shieldTimer = 15000;
        } else if (type === 'magnet') {
            player.hasMagnet = true;
            player.magnetTimer = 12000;
        } else if (type === 'overdrive') {
            player.hasOverdrive = true;
            player.overdriveTimer = 8000;
        } else if (type === 'multiplier') {
            player.hasMultiplier = true;
            player.multiplierTimer = 15000;
        }
    }

    /* ==========================================================
       MAIN LOOP
       ========================================================== */

    function gameLoop(now) {
        requestAnimationFrame(gameLoop);

        const dt = Math.min(now - lastTime, 100);
        lastTime = now;

        if (currentState !== STATE.PLAYING) return;

        const dtSeconds = dt / 1000;

        // 1. Update Speed via User's Formula
        update_speed(dtSeconds);

        const currentEffectiveSpeed = player.hasOverdrive ? game_speed * 1.5 : game_speed;
        distance += currentEffectiveSpeed * dtSeconds * 12;
        score = Math.floor(distance) + (diamondsCollected * 10);

        // 2. Synchronize Parallax Speed with game_speed
        const speedRatio = START_SPEED / currentEffectiveSpeed;
        if (farCityEl) farCityEl.style.animationDuration = (24 * speedRatio) + 's';
        if (mainCityEl) mainCityEl.style.animationDuration = (10 * speedRatio) + 's';
        if (sidewalkEl) sidewalkEl.style.animationDuration = (4 * speedRatio) + 's';
        if (roadEl) roadEl.style.animationDuration = (3.5 * speedRatio) + 's';
        if (peopleLayerEl) peopleLayerEl.style.animationDuration = (8 * speedRatio) + 's';
        if (carsLayerEl) carsLayerEl.style.animationDuration = (6 * speedRatio) + 's';

        // 3. Update Player Physics
        if (player.jumping) {
            player.jumpHeight += player.jumpVelocity * (dt / 16.67);
            player.jumpVelocity -= 1.15 * (dt / 16.67);

            if (player.jumpHeight <= 0) {
                player.jumpHeight = 0;
                player.jumping = false;
                player.jumpVelocity = 0;
            }
        }

        if (player.sliding) {
            player.slideTimer -= dt;
            if (player.slideTimer <= 0) {
                player.sliding = false;
            }
        }

        // Powerup Timers
        if (player.hasShield) {
            player.shieldTimer -= dt;
            if (player.shieldTimer <= 0) player.hasShield = false;
        }
        if (player.hasMagnet) {
            player.magnetTimer -= dt;
            if (player.magnetTimer <= 0) player.hasMagnet = false;
        }
        if (player.hasOverdrive) {
            player.overdriveTimer -= dt;
            if (player.overdriveTimer <= 0) player.hasOverdrive = false;
        }
        if (player.hasMultiplier) {
            player.multiplierTimer -= dt;
            if (player.multiplierTimer <= 0) player.hasMultiplier = false;
        }

        // Update Player CSS Classes & Position
        if (playerEl) {
            playerEl.style.transform = `translateY(${-player.jumpHeight}px)`;

            playerEl.classList.toggle('player-jumping', player.jumping);
            playerEl.classList.toggle('player-sliding', player.sliding);
            playerEl.classList.toggle('player-running', !player.jumping);
            playerEl.classList.toggle('has-shield', player.hasShield);
        }

        // 4. Update Spawning
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnObstacle();
            spawnTimer = Math.max(550, 1400 - (currentEffectiveSpeed * 55));
        }

        diamondSpawnTimer -= dt;
        if (diamondSpawnTimer <= 0) {
            spawnDiamondStreak();
            diamondSpawnTimer = 3000 + Math.random() * 2500;
        }

        powerupSpawnTimer -= dt;
        if (powerupSpawnTimer <= 0) {
            spawnPowerup();
            powerupSpawnTimer = 16000 + Math.random() * 10000;
        }

        // 5. Update Obstacles: obstacle_x -= game_speed
        const movement = currentEffectiveSpeed * (dt / 16.67) * 4.6;

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const ob = obstacles[i];
            ob.x -= movement;
            ob.el.style.left = ob.x + 'px';

            if (ob.x < -140) {
                ob.el.remove();
                obstacles.splice(i, 1);
            }
        }

        // 6. Update Diamonds & Magnet Pulling
        const playerRect = playerEl ? playerEl.getBoundingClientRect() : null;

        for (let i = diamonds.length - 1; i >= 0; i--) {
            const d = diamonds[i];

            if (player.hasMagnet && playerRect && !d.collected) {
                const dRect = d.el.getBoundingClientRect();
                const dx = (playerRect.left + playerRect.width / 2) - (dRect.left + dRect.width / 2);
                const dy = (playerRect.top + playerRect.height / 2) - (dRect.top + dRect.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 320) {
                    d.x += (dx / dist) * 16;
                    d.el.style.left = d.x + 'px';
                } else {
                    d.x -= movement;
                    d.el.style.left = d.x + 'px';
                }
            } else {
                d.x -= movement;
                d.el.style.left = d.x + 'px';
            }

            if (d.x < -100) {
                d.el.remove();
                diamonds.splice(i, 1);
            }
        }

        // 7. Update Power-up items
        for (let i = powerups.length - 1; i >= 0; i--) {
            const pu = powerups[i];
            pu.x -= movement;
            pu.el.style.left = pu.x + 'px';

            if (pu.x < -100) {
                pu.el.remove();
                powerups.splice(i, 1);
            }
        }

        // 8. Collision Detection
        if (playerRect) {
            // Check Obstacle Collisions
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const ob = obstacles[i];
                const obRect = ob.el.getBoundingClientRect();

                // Hitbox overlap check with slight margin for fairness
                const pL = playerRect.left + 8;
                const pR = playerRect.right - 8;
                const pT = playerRect.top + 6;
                const pB = playerRect.bottom - 4;

                const oL = obRect.left + 6;
                const oR = obRect.right - 6;
                const oT = obRect.top + 6;
                const oB = obRect.bottom - 4;

                if (pR > oL && pL < oR && pB > oT && pT < oB) {
                    // Overdrive smashes obstacle
                    if (player.hasOverdrive) {
                        ob.el.remove();
                        obstacles.splice(i, 1);
                        score += 100;
                        if (window.AudioEngine) window.AudioEngine.playPowerup();
                        continue;
                    }

                    // Shield absorbs collision
                    if (player.hasShield) {
                        player.hasShield = false;
                        ob.el.remove();
                        obstacles.splice(i, 1);
                        if (window.AudioEngine) window.AudioEngine.playPowerup();
                        continue;
                    }

                    // Crash -> Game Over
                    gameOver();
                    break;
                }
            }

            // Check Diamond Collections
            for (let i = diamonds.length - 1; i >= 0; i--) {
                const d = diamonds[i];
                if (d.collected) continue;

                const dRect = d.el.getBoundingClientRect();
                if (
                    playerRect.right > dRect.left &&
                    playerRect.left < dRect.right &&
                    playerRect.bottom > dRect.top &&
                    playerRect.top < dRect.bottom
                ) {
                    d.collected = true;
                    diamondsCollected++;
                    score += 10 * (player.hasMultiplier ? 2 : 1);
                    d.el.remove();
                    diamonds.splice(i, 1);

                    if (window.AudioEngine) window.AudioEngine.playCoin();
                }
            }

            // Check Power-up Collections
            for (let i = powerups.length - 1; i >= 0; i--) {
                const pu = powerups[i];
                if (pu.collected) continue;

                const puRect = pu.el.getBoundingClientRect();
                if (
                    playerRect.right > puRect.left &&
                    playerRect.left < puRect.right &&
                    playerRect.bottom > puRect.top &&
                    playerRect.top < puRect.bottom
                ) {
                    pu.collected = true;
                    activatePowerup(pu.type);
                    pu.el.remove();
                    powerups.splice(i, 1);
                }
            }
        }

        // 9. Update HUD
        if (scoreDisplayEl) {
            const formatted = score.toString().padStart(6, '0');
            scoreDisplayEl.textContent = `SCORE: ${formatted}`;
        }
        if (diamondsBadgeEl) {
            diamondsBadgeEl.textContent = `💎 ${diamondsCollected}`;
        }
        if (speedDisplayEl) {
            const kmh = Math.floor(currentEffectiveSpeed * 18);
            speedDisplayEl.textContent = `CYBER HIGHWAY // ${kmh} KM/H`;
        }
    }

    /* ==========================================================
       CONTROLS
       ========================================================== */

    function initControls() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            if (key === ' ' || key === 'arrowup' || key === 'w') {
                e.preventDefault();
                jump();
            } else if (key === 'arrowdown' || key === 's') {
                e.preventDefault();
                slide();
            } else if (key === 'p' || key === 'escape') {
                pauseGame();
            } else if (key === 'm') {
                if (window.AudioEngine) window.AudioEngine.toggleMusicMute();
            }
        });

        // Touch Swipes
        let touchStartY = 0;
        let touchStartX = 0;

        window.addEventListener('touchstart', (e) => {
            const t = e.changedTouches[0];
            touchStartX = t.clientX;
            touchStartY = t.clientY;
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dy = t.clientY - touchStartY;
            const dx = t.clientX - touchStartX;

            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
                if (dy < 0) jump();
                else slide();
            }
        }, { passive: true });

        // Mobile On-Screen Buttons
        const btnMobileJump = document.getElementById('btnMobileJump');
        const btnMobileSlide = document.getElementById('btnMobileSlide');

        if (btnMobileJump) {
            btnMobileJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
            btnMobileJump.addEventListener('click', jump);
        }

        if (btnMobileSlide) {
            btnMobileSlide.addEventListener('touchstart', (e) => { e.preventDefault(); slide(); });
            btnMobileSlide.addEventListener('click', slide);
        }

        // HUD Buttons
        const btnSound = document.getElementById('btnSound');
        const btnMusic = document.getElementById('btnMusic');
        const btnPause = document.getElementById('btnPause');

        if (btnSound) {
            btnSound.addEventListener('click', () => {
                if (window.AudioEngine) {
                    const muted = window.AudioEngine.toggleSFXMute();
                    btnSound.textContent = muted ? '🔇' : '🔊';
                }
            });
        }

        if (btnMusic) {
            btnMusic.addEventListener('click', () => {
                if (window.AudioEngine) {
                    const muted = window.AudioEngine.toggleMusicMute();
                    btnMusic.textContent = muted ? '🎵❌' : '🎵';
                }
            });
        }

        if (btnPause) {
            btnPause.addEventListener('click', pauseGame);
        }

        // Modal Action Buttons
        const btnStartGame = document.getElementById('btnStartGame');
        const btnRestartGame = document.getElementById('btnRestartGame');
        const btnResumeGame = document.getElementById('btnResumeGame');
        const btnMenuFromPause = document.getElementById('btnMenuFromPause');

        if (btnStartGame) btnStartGame.addEventListener('click', startGame);
        if (btnRestartGame) btnRestartGame.addEventListener('click', startGame);
        if (btnResumeGame) btnResumeGame.addEventListener('click', resumeGame);
        if (btnMenuFromPause) {
            btnMenuFromPause.addEventListener('click', () => {
                currentState = STATE.MENU;
                if (pauseModalEl) pauseModalEl.classList.add('hidden');
                if (startMenuEl) startMenuEl.classList.remove('hidden');
                updateMenuStats();
            });
        }
    }

    window.addEventListener('DOMContentLoaded', init);

})();
