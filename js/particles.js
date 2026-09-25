/**
 * Street Runner - High Performance Particle & FX System
 */
(function() {
    'use strict';

    class ParticleSystem {
        constructor() {
            this.particles = [];
            this.floatingTexts = [];
            this.speedLines = [];
            this.shockwaves = [];
            this.maxParticles = 300;
        }

        clear() {
            this.particles.length = 0;
            this.floatingTexts.length = 0;
            this.speedLines.length = 0;
            this.shockwaves.length = 0;
        }

        // Emit thruster flame particles behind player
        emitThruster(x, y, color, count = 2) {
            for (let i = 0; i < count; i++) {
                if (this.particles.length >= this.maxParticles) break;
                this.particles.push({
                    x: x + (Math.random() - 0.5) * 14,
                    y: y + 20,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: 3 + Math.random() * 4,
                    size: 3 + Math.random() * 4,
                    color: color,
                    alpha: 0.9,
                    decay: 0.04 + Math.random() * 0.03,
                    glow: true
                });
            }
        }

        // Emit road friction sparks when sliding
        emitSlideSparks(x, y, count = 4) {
            for (let i = 0; i < count; i++) {
                if (this.particles.length >= this.maxParticles) break;
                this.particles.push({
                    x: x + (Math.random() - 0.5) * 30,
                    y: y + 10,
                    vx: (Math.random() - 0.5) * 8,
                    vy: -(1 + Math.random() * 4),
                    size: 2 + Math.random() * 3,
                    color: Math.random() > 0.5 ? '#ffff88' : '#ff9900',
                    alpha: 1,
                    decay: 0.05 + Math.random() * 0.04,
                    gravity: 0.2,
                    glow: true
                });
            }
        }

        // Emit diamond collection burst (crystalline sparks & glints)
        emitDiamondBurst(x, y, color = '#00f3ff', count = 16) {
            const diamondPalette = ['#00f3ff', '#ffffff', '#e0ffff', '#4deeea'];
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2.5 + Math.random() * 6;
                const pColor = diamondPalette[Math.floor(Math.random() * diamondPalette.length)];
                this.particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 2.5 + Math.random() * 3.5,
                    color: pColor,
                    alpha: 1,
                    decay: 0.025 + Math.random() * 0.02,
                    glow: true
                });
            }
        }

        // Backward compatibility alias for coin burst
        emitCoinBurst(x, y, color = '#00f3ff', count = 16) {
            this.emitDiamondBurst(x, y, color, count);
        }

        // Emit explosion on player crash or obstacle break
        emitExplosion(x, y, color = '#ff0055', count = 35) {
            // Add expanding shockwave ring
            this.shockwaves.push({
                x: x,
                y: y,
                radius: 10,
                maxRadius: 120,
                color: color,
                alpha: 1,
                growth: 6
            });

            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 8;
                this.particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1.5,
                    size: 3 + Math.random() * 5,
                    color: Math.random() > 0.3 ? color : '#ffffff',
                    alpha: 1,
                    decay: 0.02 + Math.random() * 0.02,
                    gravity: 0.15,
                    glow: true
                });
            }
        }

        // Add floating text (e.g. "+10", "COMBO x2!", "SHIELD")
        addFloatingText(text, x, y, color = '#00ffff', size = 18) {
            this.floatingTexts.push({
                text: text,
                x: x,
                y: y,
                vy: -1.8,
                alpha: 1,
                decay: 0.022,
                color: color,
                size: size
            });
        }

        // Speed warp lines during high velocity or overdrive
        updateSpeedLines(W, H, speed, isOverdrive) {
            const desiredCount = isOverdrive ? 28 : (speed > 8 ? 14 : 0);
            while (this.speedLines.length < desiredCount) {
                this.speedLines.push({
                    x: Math.random() * W,
                    y: Math.random() * (H * 0.7),
                    length: 30 + Math.random() * 80,
                    speed: 15 + Math.random() * 25,
                    alpha: 0.2 + Math.random() * 0.5,
                    color: isOverdrive ? '#ff00ff' : '#00ffff'
                });
            }

            for (let i = this.speedLines.length - 1; i >= 0; i--) {
                const line = this.speedLines[i];
                line.y += line.speed * (speed / 5);
                if (line.y > H) {
                    if (this.speedLines.length > desiredCount) {
                        this.speedLines.splice(i, 1);
                    } else {
                        line.y = -line.length;
                        line.x = Math.random() * W;
                        line.color = isOverdrive ? '#ff00ff' : '#00ffff';
                    }
                }
            }
        }

        update(dt = 16.67) {
            const factor = dt / 16.67;

            // Update generic particles
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx * factor;
                p.y += p.vy * factor;
                if (p.gravity) p.vy += p.gravity * factor;
                p.alpha -= p.decay * factor;

                if (p.alpha <= 0) {
                    this.particles.splice(i, 1);
                }
            }

            // Update floating texts
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const t = this.floatingTexts[i];
                t.y += t.vy * factor;
                t.alpha -= t.decay * factor;
                if (t.alpha <= 0) {
                    this.floatingTexts.splice(i, 1);
                }
            }

            // Update shockwaves
            for (let i = this.shockwaves.length - 1; i >= 0; i--) {
                const sw = this.shockwaves[i];
                sw.radius += sw.growth * factor;
                sw.alpha -= 0.04 * factor;
                if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
                    this.shockwaves.splice(i, 1);
                }
            }
        }

        draw(ctx) {
            // Draw speed lines
            if (this.speedLines.length > 0) {
                ctx.save();
                for (const line of this.speedLines) {
                    ctx.strokeStyle = line.color;
                    ctx.globalAlpha = line.alpha;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(line.x, line.y);
                    ctx.lineTo(line.x, line.y + line.length);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Draw shockwaves
            if (this.shockwaves.length > 0) {
                ctx.save();
                for (const sw of this.shockwaves) {
                    ctx.beginPath();
                    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = sw.color;
                    ctx.globalAlpha = Math.max(0, sw.alpha);
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Draw particles
            if (this.particles.length > 0) {
                ctx.save();
                for (const p of this.particles) {
                    ctx.globalAlpha = Math.max(0, p.alpha);
                    ctx.fillStyle = p.color;
                    if (p.glow) {
                        ctx.shadowColor = p.color;
                        ctx.shadowBlur = 8;
                    }
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            // Draw floating texts
            if (this.floatingTexts.length > 0) {
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = '900 16px "Orbitron", sans-serif';
                for (const t of this.floatingTexts) {
                    ctx.globalAlpha = Math.max(0, t.alpha);
                    ctx.fillStyle = t.color;
                    ctx.shadowColor = t.color;
                    ctx.shadowBlur = 10;
                    ctx.fillText(t.text, t.x, t.y);
                }
                ctx.restore();
            }
        }
    }

    window.Particles = new ParticleSystem();
})();
