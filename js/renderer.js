/**
 * Neon Runner - 2.5D Cyberpunk Highway Renderer
 */
(function() {
    'use strict';

    class Renderer {
        constructor() {
            this.canvas = null;
            this.ctx = null;
            this.W = 0;
            this.H = 0;
            this.dpr = 1;

            this.roadOffset = 0;
            this.shakeTimer = 0;
            this.shakeIntensity = 0;
            this.bgImage = null;

            this.stars = [];
            this.initStars();
        }

        init(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.resize();

            // Attempt to load synthwave background image
            this.bgImage = new Image();
            this.bgImage.src = 'assets/bg.jpg';
        }

        initStars() {
            this.stars = [];
            for (let i = 0; i < 70; i++) {
                this.stars.push({
                    x: Math.random(),
                    y: Math.random() * 0.5,
                    size: 1 + Math.random() * 2,
                    speed: 0.2 + Math.random() * 0.8,
                    blink: Math.random() * Math.PI * 2
                });
            }
        }

        resize() {
            if (!this.canvas) return;
            this.W = window.innerWidth;
            this.H = window.innerHeight;
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);

            this.canvas.width = this.W * this.dpr;
            this.canvas.height = this.H * this.dpr;
            this.canvas.style.width = this.W + 'px';
            this.canvas.style.height = this.H + 'px';

            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        }

        triggerShake(intensity = 10, duration = 250) {
            this.shakeIntensity = intensity;
            this.shakeTimer = duration;
        }

        getRoadMetrics() {
            const roadWidth = Math.min(this.W * 0.88, 540);
            const roadLeft = (this.W - roadWidth) / 2;
            const roadTopWidth = roadWidth * 0.30;
            const roadTopLeft = (this.W - roadTopWidth) / 2;
            const horizonY = this.H * 0.38;

            return { roadWidth, roadLeft, roadTopWidth, roadTopLeft, horizonY };
        }

        laneX(lane, progress = 1.0) {
            // progress: 0.0 at horizon, 1.0 at screen bottom
            const { roadWidth, roadLeft, roadTopWidth, roadTopLeft } = this.getRoadMetrics();

            const currentRoadWidth = roadTopWidth + (roadWidth - roadTopWidth) * progress;
            const currentRoadLeft = roadTopLeft + (roadLeft - roadTopLeft) * progress;

            return currentRoadLeft + currentRoadWidth * ((lane + 0.5) / 3);
        }

        // Draw parallax sky and synthwave sunset
        drawSky(time, playerLaneOffset = 0) {
            const ctx = this.ctx;
            const { horizonY } = this.getRoadMetrics();

            // Background gradient
            const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
            skyGradient.addColorStop(0, '#040212');
            skyGradient.addColorStop(0.4, '#0d0628');
            skyGradient.addColorStop(0.8, '#26093d');
            skyGradient.addColorStop(1, '#440f54');

            ctx.fillStyle = skyGradient;
            ctx.fillRect(0, 0, this.W, horizonY + 2);

            // Twinkling neon stars
            ctx.save();
            for (const s of this.stars) {
                const sx = (s.x * this.W + playerLaneOffset * 15 * s.speed) % this.W;
                const sy = s.y * horizonY;
                const alpha = 0.3 + 0.7 * Math.sin(time * 0.003 * s.speed + s.blink);
                ctx.fillStyle = `rgba(220, 240, 255, ${Math.max(0, alpha)})`;
                ctx.fillRect(sx, sy, s.size, s.size);
            }
            ctx.restore();

            // Draw synthwave wireframe sun on the horizon
            const sunRadius = Math.min(this.W * 0.22, 110);
            const sunX = this.W / 2 + playerLaneOffset * 25;
            const sunY = horizonY - 10;

            ctx.save();
            ctx.beginPath();
            ctx.arc(sunX, sunY, sunRadius, Math.PI, 0, false);
            const sunGrad = ctx.createLinearGradient(sunX, sunY - sunRadius, sunX, sunY);
            sunGrad.addColorStop(0, '#ffe600');
            sunGrad.addColorStop(0.5, '#ff0077');
            sunGrad.addColorStop(1, '#7700a8');
            ctx.fillStyle = sunGrad;
            ctx.shadowColor = '#ff0077';
            ctx.shadowBlur = 30;
            ctx.fill();

            // Horizontal sun blinds (retro synthwave slices)
            ctx.fillStyle = '#0d0628';
            const sliceCount = 7;
            for (let i = 1; i <= sliceCount; i++) {
                const sliceH = (i / sliceCount) * 4.5;
                const sy = sunY - (i / sliceCount) * (sunRadius * 0.75);
                ctx.fillRect(sunX - sunRadius - 10, sy, (sunRadius + 10) * 2, sliceH);
            }
            ctx.restore();

            // City skyline silhouette on horizon
            this.drawCitySkyline(horizonY, playerLaneOffset);
        }

        drawCitySkyline(horizonY, playerLaneOffset) {
            const ctx = this.ctx;
            ctx.save();
            ctx.fillStyle = '#08051a';

            const numBuildings = 22;
            const bWidth = this.W / (numBuildings - 4);

            for (let i = -2; i < numBuildings + 2; i++) {
                const bx = i * bWidth - (playerLaneOffset * 35);
                // Pseudo-random building height based on index
                const seed = Math.sin(i * 12.9898) * 43758.5453;
                const bHeight = 30 + Math.abs(seed % 65);

                ctx.fillRect(bx, horizonY - bHeight, bWidth * 0.92, bHeight);

                // Neon roof antenna light
                if (i % 2 === 0) {
                    ctx.fillStyle = i % 4 === 0 ? '#00f3ff' : '#ff0077';
                    ctx.fillRect(bx + bWidth * 0.45, horizonY - bHeight - 6, 2, 6);
                    ctx.beginPath();
                    ctx.arc(bx + bWidth * 0.45 + 1, horizonY - bHeight - 7, 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#08051a';
                }
            }
            ctx.restore();
        }

        // Draw highway surface, perspective lanes, and glowing rails
        drawRoad(dt, speed) {
            const ctx = this.ctx;
            const { roadWidth, roadLeft, roadTopWidth, roadTopLeft, horizonY } = this.getRoadMetrics();

            // Perspective road trapezoid
            ctx.save();
            const roadGrad = ctx.createLinearGradient(0, horizonY, 0, this.H);
            roadGrad.addColorStop(0, '#0c0721');
            roadGrad.addColorStop(0.3, '#100c2e');
            roadGrad.addColorStop(1, '#050314');

            ctx.fillStyle = roadGrad;
            ctx.beginPath();
            ctx.moveTo(roadTopLeft, horizonY);
            ctx.lineTo(roadTopLeft + roadTopWidth, horizonY);
            ctx.lineTo(roadLeft + roadWidth, this.H);
            ctx.lineTo(roadLeft, this.H);
            ctx.closePath();
            ctx.fill();

            // Road side cyber barriers / glowing outer neon rails
            ctx.shadowBlur = 18;

            // Left rail (cyan neon)
            ctx.strokeStyle = '#00f3ff';
            ctx.shadowColor = '#00f3ff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(roadTopLeft, horizonY);
            ctx.lineTo(roadLeft, this.H);
            ctx.stroke();

            // Right rail (magenta neon)
            ctx.strokeStyle = '#ff00a0';
            ctx.shadowColor = '#ff00a0';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(roadTopLeft + roadTopWidth, horizonY);
            ctx.lineTo(roadLeft + roadWidth, this.H);
            ctx.stroke();

            // Lane dividers (2 dashed perspective lines)
            ctx.shadowBlur = 8;
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
            ctx.shadowColor = 'rgba(0, 243, 255, 0.6)';
            ctx.lineWidth = 2;

            for (let lane = 1; lane < 3; lane++) {
                const topX = roadTopLeft + roadTopWidth * (lane / 3);
                const bottomX = roadLeft + roadWidth * (lane / 3);

                ctx.beginPath();
                ctx.moveTo(topX, horizonY);
                ctx.lineTo(bottomX, this.H);
                ctx.stroke();
            }

            // Moving horizontal grid bars (gives high-speed velocity illusion)
            this.roadOffset = (this.roadOffset + speed * (dt / 16.67) * 0.04) % 1.0;
            const barCount = 14;

            ctx.strokeStyle = 'rgba(255, 0, 160, 0.35)';
            ctx.lineWidth = 1.5;

            for (let i = 0; i < barCount; i++) {
                // Exponential depth perspective: progress = p^2.5
                let p = ((i / barCount) + this.roadOffset / barCount) % 1.0;
                let depth = Math.pow(p, 2.2);

                const y = horizonY + (this.H - horizonY) * depth;
                const curWidth = roadTopWidth + (roadWidth - roadTopWidth) * depth;
                const curLeft = roadTopLeft + (roadLeft - roadTopLeft) * depth;

                ctx.beginPath();
                ctx.moveTo(curLeft, y);
                ctx.lineTo(curLeft + curWidth, y);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Draw Player with lean, shadow, thruster glow, and equipped skin
        drawPlayer(player, time) {
            const ctx = this.ctx;
            const skin = window.GameState ? window.GameState.getCurrentSkin() : {
                primaryColor: '#00f3ff',
                secondaryColor: '#0066ff',
                visorColor: '#ffffff',
                thrusterColor: '#00ffff',
                glowColor: 'rgba(0, 243, 255, 0.8)'
            };

            const py = player.y - player.jumpHeight;
            const isSliding = player.sliding;
            const h = isSliding ? player.height * 0.5 : player.height;
            const w = isSliding ? player.width * 1.15 : player.width;

            // Calculate tilt angle based on horizontal movement
            const tilt = (player.vx || 0) * 0.035;

            ctx.save();
            ctx.translate(player.x, py);
            ctx.rotate(tilt);

            // Ground shadow (drawn relative to road position, shrinks as player jumps)
            const shadowScale = Math.max(0.35, 1 - (player.jumpHeight / 240));
            const shadowAlpha = Math.max(0.15, 0.6 * shadowScale);

            ctx.save();
            ctx.translate(0, player.jumpHeight + (isSliding ? 14 : 26));
            ctx.scale(shadowScale, shadowScale * 0.35);
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
            ctx.shadowColor = skin.primaryColor;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, w * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Thruster flame particles / exhaust glow
            const thrusterFlicker = 1.0 + 0.3 * Math.sin(time * 0.04);
            ctx.save();
            ctx.shadowColor = skin.thrusterColor;
            ctx.shadowBlur = 18;
            ctx.fillStyle = skin.thrusterColor;
            ctx.beginPath();
            ctx.moveTo(-w * 0.25, h * 0.4);
            ctx.lineTo(0, h * 0.4 + 20 * thrusterFlicker);
            ctx.lineTo(w * 0.25, h * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Player Cyber Runner Body
            ctx.save();
            ctx.shadowColor = skin.glowColor;
            ctx.shadowBlur = 16;

            if (!isSliding) {
                // Standing / Hovering Racer Model
                // Main chassis
                ctx.fillStyle = skin.primaryColor;
                ctx.beginPath();
                ctx.moveTo(0, -h * 0.5); // nose
                ctx.lineTo(w * 0.48, h * 0.2); // right wing
                ctx.lineTo(w * 0.3, h * 0.45); // right thruster
                ctx.lineTo(-w * 0.3, h * 0.45); // left thruster
                ctx.lineTo(-w * 0.48, h * 0.2); // left wing
                ctx.closePath();
                ctx.fill();

                // Inner armor plates
                ctx.fillStyle = skin.secondaryColor;
                ctx.beginPath();
                ctx.moveTo(0, -h * 0.35);
                ctx.lineTo(w * 0.25, h * 0.2);
                ctx.lineTo(-w * 0.25, h * 0.2);
                ctx.closePath();
                ctx.fill();

                // Visor / Cockpit glow
                ctx.fillStyle = skin.visorColor;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.ellipse(0, -h * 0.15, w * 0.22, h * 0.12, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Low-profile Slide / Skid Frame
                ctx.fillStyle = skin.primaryColor;
                ctx.beginPath();
                ctx.roundRect(-w * 0.55, -h * 0.5, w * 1.1, h, 8);
                ctx.fill();

                // Visor streak
                ctx.fillStyle = skin.visorColor;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 12;
                ctx.fillRect(-w * 0.35, -h * 0.2, w * 0.7, h * 0.35);
            }
            ctx.restore();

            // Active Power-Up Visual Effects
            this.drawPlayerPowerups(ctx, player, w, h, time);

            ctx.restore();
        }

        drawPlayerPowerups(ctx, player, w, h, time) {
            // Shield Aura (rotating cyan hexagonal forcefield)
            if (player.hasShield) {
                ctx.save();
                ctx.strokeStyle = '#00f3ff';
                ctx.shadowColor = '#00f3ff';
                ctx.shadowBlur = 22;
                ctx.lineWidth = 3;

                ctx.beginPath();
                const shieldRadius = Math.max(w, h) * 0.82;
                const sides = 6;
                const rot = time * 0.002;
                for (let i = 0; i < sides; i++) {
                    const angle = rot + (i / sides) * Math.PI * 2;
                    const sx = Math.cos(angle) * shieldRadius;
                    const sy = Math.sin(angle) * shieldRadius;
                    if (i === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.closePath();
                ctx.stroke();

                // Subtle transparent fill
                ctx.fillStyle = 'rgba(0, 243, 255, 0.12)';
                ctx.fill();
                ctx.restore();
            }

            // Magnet Field (pulsing electromagnetic flux rings)
            if (player.hasMagnet) {
                ctx.save();
                const pulse = (time * 0.004) % 1;
                ctx.strokeStyle = `rgba(0, 180, 255, ${1 - pulse})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, (w * 0.8) + pulse * 45, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Overdrive Aura (blazing magenta speed flames)
            if (player.hasOverdrive) {
                ctx.save();
                ctx.strokeStyle = '#ff00ff';
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = 25;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(w, h) * 0.9 + Math.sin(time * 0.02) * 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Draw Obstacles (Low Laser Grid, High Plasma Arc, Cyber Drone Barricade)
        drawObstacles(obstacles, time) {
            const ctx = this.ctx;

            for (const ob of obstacles) {
                ctx.save();
                ctx.translate(ob.x, ob.y);

                if (ob.type === 'low') {
                    // Low Laser Barrier (Must Jump Over)
                    ctx.shadowColor = '#ff0044';
                    ctx.shadowBlur = 20;

                    // Side pylons
                    ctx.fillStyle = '#ff2200';
                    ctx.fillRect(-ob.width * 0.48, -ob.height * 0.4, 12, ob.height * 0.8);
                    ctx.fillRect(ob.width * 0.48 - 12, -ob.height * 0.4, 12, ob.height * 0.8);

                    // Glowing bottom laser beam
                    const laserY = ob.height * 0.2;
                    ctx.strokeStyle = '#ff0055';
                    ctx.lineWidth = 6 + Math.sin(time * 0.05) * 2;
                    ctx.beginPath();
                    ctx.moveTo(-ob.width * 0.45, laserY);
                    ctx.lineTo(ob.width * 0.45, laserY);
                    ctx.stroke();

                    // White laser core
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // "JUMP" indicator badge
                    ctx.fillStyle = 'rgba(255, 0, 85, 0.85)';
                    ctx.font = '900 11px "Orbitron", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('▲ JUMP', 0, -ob.height * 0.2);

                } else if (ob.type === 'high') {
                    // High Plasma Arc (Must Slide Under)
                    ctx.shadowColor = '#ff8800';
                    ctx.shadowBlur = 18;

                    // Overhead beam
                    ctx.fillStyle = '#ff9900';
                    ctx.fillRect(-ob.width * 0.5, -ob.height * 0.5, ob.width, 14);

                    // Plasma zaps hanging at head level
                    ctx.strokeStyle = '#ffdd00';
                    ctx.lineWidth = 4 + Math.sin(time * 0.06) * 2;
                    ctx.beginPath();
                    ctx.moveTo(-ob.width * 0.45, -ob.height * 0.35);
                    ctx.lineTo(ob.width * 0.45, -ob.height * 0.35);
                    ctx.stroke();

                    // "SLIDE" indicator badge
                    ctx.fillStyle = 'rgba(255, 150, 0, 0.9)';
                    ctx.font = '900 11px "Orbitron", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('▼ SLIDE', 0, ob.height * 0.35);

                } else {
                    // Cyber Barricade / Drone (Must Dodge)
                    ctx.shadowColor = '#ff0033';
                    ctx.shadowBlur = 22;

                    ctx.fillStyle = '#ff0040';
                    ctx.beginPath();
                    ctx.roundRect(-ob.width * 0.48, -ob.height * 0.48, ob.width * 0.96, ob.height * 0.96, 8);
                    ctx.fill();

                    // Hazard diagonal stripes
                    ctx.fillStyle = '#110515';
                    ctx.fillRect(-ob.width * 0.3, -ob.height * 0.3, ob.width * 0.6, ob.height * 0.6);

                    // Warning Skull / Exclamation icon
                    ctx.fillStyle = '#ff0055';
                    ctx.font = '900 16px "Orbitron", sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚠', 0, 0);
                }

                ctx.restore();
            }
        }

        // Draw Collectible Coins (Spinning 3D Octahedron Diamonds)
        drawCoins(coins, time) {
            const ctx = this.ctx;

            for (const coin of coins) {
                if (coin.collected) continue;

                ctx.save();
                ctx.translate(coin.x, coin.y);

                // Rotating 3D diamond projection
                const spin = time * 0.005 + (coin.seed || 0);
                const scaleX = Math.cos(spin);

                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 18;

                // Gold Diamond
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.moveTo(0, -coin.radius);
                ctx.lineTo(coin.radius * scaleX, 0);
                ctx.lineTo(0, coin.radius);
                ctx.lineTo(-coin.radius * scaleX, 0);
                ctx.closePath();
                ctx.fill();

                // Bright crystalline core
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(0, -coin.radius * 0.5);
                ctx.lineTo(coin.radius * 0.5 * scaleX, 0);
                ctx.lineTo(0, coin.radius * 0.5);
                ctx.lineTo(-coin.radius * 0.5 * scaleX, 0);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }

        // Draw Power-Up items (Shield, Magnet, Overdrive, Multiplier)
        drawPowerups(items, time) {
            const ctx = this.ctx;

            const configs = {
                magnet: { color: '#00bfff', icon: '🧲' },
                shield: { color: '#00f3ff', icon: '🛡️' },
                overdrive: { color: '#ff00ff', icon: '⚡' },
                multiplier: { color: '#ffb700', icon: '✖️2' }
            };

            for (const item of items) {
                if (item.collected) continue;

                const cfg = configs[item.type] || configs.magnet;
                const bob = Math.sin(time * 0.006 + item.x) * 6;

                ctx.save();
                ctx.translate(item.x, item.y + bob);

                // Outer glowing aura
                ctx.shadowColor = cfg.color;
                ctx.shadowBlur = 24;
                ctx.fillStyle = 'rgba(10, 5, 25, 0.85)';
                ctx.strokeStyle = cfg.color;
                ctx.lineWidth = 3;

                ctx.beginPath();
                ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Icon
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cfg.icon, 0, 1);

                ctx.restore();
            }
        }

        // Pre-render frame with camera screen shake
        beginFrame(dt) {
            const ctx = this.ctx;
            ctx.save();

            // Handle screen shake
            if (this.shakeTimer > 0) {
                this.shakeTimer -= dt;
                const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
                const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
                ctx.translate(shakeX, shakeY);
            }

            ctx.clearRect(0, 0, this.W, this.H);
        }

        endFrame() {
            this.ctx.restore();
        }
    }

    window.GameRenderer = new Renderer();
})();
