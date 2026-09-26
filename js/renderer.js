/**
 * Street Runner - 2.5D Cyberpunk Highway Renderer
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

            this.buildings = [];
            this.initBuildings();
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

        initBuildings() {
            this.buildings = [];
            const countPerSide = 8;
            const signs = ['STREET', 'RUNNER', 'CYBER', 'NEON', 'SYNTH', 'TOKYO', 'HOTEL', '2099', 'NEXUS', 'RAM', 'MATRIX', 'VOX'];
            const neonColors = ['#00f3ff', '#ff007f', '#ffe600', '#00ff66', '#b700ff'];
            const windowTints = ['#00f3ff', '#ffe600', '#ff00a0', '#e0ffff', '#00ffaa'];

            for (let i = 0; i < countPerSide; i++) {
                const z = i / countPerSide;
                // Left side scenery
                this.buildings.push(this.createBuilding('left', z, i, signs, neonColors, windowTints));
                // Right side scenery (staggered slightly for natural parallax)
                this.buildings.push(this.createBuilding('right', (z + 0.5 / countPerSide) % 1.0, i + 50, signs, neonColors, windowTints));
            }

            // Streetlights along sidewalks
            this.streetlights = [];
            const lightCount = 7;
            for (let i = 0; i < lightCount; i++) {
                const z = i / lightCount;
                this.streetlights.push({ side: 'left', z, seed: i });
                this.streetlights.push({ side: 'right', z: (z + 0.5 / lightCount) % 1.0, seed: i + 30 });
            }

            // Pedestrians walking on sidewalks
            this.pedestrians = [];
            const pedCount = 5;
            const pedShirts = ['#00d9ff', '#ff007f', '#713cff', '#00ff66', '#ffaa00', '#ffffff'];
            for (let i = 0; i < pedCount; i++) {
                this.pedestrians.push({
                    side: 'left',
                    z: (i / pedCount + 0.08) % 1.0,
                    shirt: pedShirts[i % pedShirts.length],
                    strideSpeed: 0.9 + (i % 3) * 0.25,
                    walkSpeed: 0.02 + (i % 3) * 0.015,
                    phase: (i * 1.7)
                });
                this.pedestrians.push({
                    side: 'right',
                    z: ((i + 0.45) / pedCount + 0.08) % 1.0,
                    shirt: pedShirts[(i + 3) % pedShirts.length],
                    strideSpeed: 0.9 + ((i + 1) % 3) * 0.25,
                    walkSpeed: 0.02 + ((i + 1) % 3) * 0.015,
                    phase: (i * 2.3)
                });
            }

            // Scenery cars along outer curbs/shoulder
            this.sceneryCars = [];
            const carCount = 4;
            const carColors = ['#ff245f', '#00d9ff', '#713cff', '#ffe600', '#ff007f'];
            for (let i = 0; i < carCount; i++) {
                this.sceneryCars.push({
                    side: 'left',
                    z: (i / carCount + 0.15) % 1.0,
                    color: carColors[i % carColors.length],
                    speedOffset: 0.015 * (i % 2 === 0 ? 1 : -0.5),
                    seed: i
                });
                this.sceneryCars.push({
                    side: 'right',
                    z: ((i + 0.5) / carCount + 0.15) % 1.0,
                    color: carColors[(i + 2) % carColors.length],
                    speedOffset: 0.015 * (i % 2 === 1 ? 1 : -0.5),
                    seed: i + 10
                });
            }

            // Freestanding neon signs
            this.neonSigns = [];
            const signWords = ['NEON', 'CITY', 'RUN', 'CYBER', 'HIGHWAY', '2099', 'VOX', 'MATRIX'];
            const signCount = 4;
            for (let i = 0; i < signCount; i++) {
                this.neonSigns.push({
                    side: 'left',
                    z: (i / signCount + 0.05) % 1.0,
                    text: signWords[(i * 2) % signWords.length],
                    color: '#ff36d4',
                    seed: i
                });
                this.neonSigns.push({
                    side: 'right',
                    z: ((i + 0.5) / signCount + 0.05) % 1.0,
                    text: signWords[(i * 2 + 1) % signWords.length],
                    color: '#00eaff',
                    seed: i + 30
                });
            }
        }

        createBuilding(side, z, seed, signs, neonColors, windowTints) {
            const length = 0.11;
            const neon = neonColors[seed % neonColors.length];
            const winColor = windowTints[(seed * 3) % windowTints.length];
            const sign = signs[seed % signs.length];
            const hasSign = (seed % 2 === 0);

            // Determine scenery type: 'house', 'shop', or 'building'
            let type = 'building';
            const mod = Math.abs(seed) % 6;
            if (mod === 1 || mod === 4) {
                type = 'house';
            } else if (mod === 2) {
                type = 'shop';
            } else {
                type = 'building';
            }

            let h = 200 + Math.abs(Math.sin(seed * 4.31)) * 260;
            if (type === 'house') {
                h = 110 + (seed % 3) * 20;
            } else if (type === 'shop') {
                h = 140 + (seed % 3) * 25;
            }

            // Pre-generate window illumination pattern (4 cols x 6 rows)
            const winCols = 4;
            const winRows = 6;
            const litMatrix = [];
            for (let r = 0; r < winRows; r++) {
                litMatrix[r] = [];
                for (let c = 0; c < winCols; c++) {
                    litMatrix[r][c] = (Math.sin(seed * 7.1 + r * 3.3 + c * 5.7) > -0.2);
                }
            }

            return {
                side,
                z,
                length,
                height: h,
                type,
                neonColor: neon,
                windowColor: winColor,
                signText: sign,
                hasSign,
                litMatrix,
                hasAntenna: (seed % 3 === 0),
                seed
            };
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

        // Draw parallax sky, cyber moon, and synthwave sunset
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

            // CYBER MOON (Top-Right, majestic cyan & royal blue neon glows)
            const moonX = this.W * 0.82 + playerLaneOffset * 12;
            const moonY = Math.max(48, horizonY * 0.28);
            const moonRadius = Math.min(46, Math.max(28, this.W * 0.052));

            ctx.save();
            // Outer atmospheric blue / cyan glow halos
            const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.4, moonX, moonY, moonRadius * 2.8);
            moonGlow.addColorStop(0, 'rgba(0, 217, 255, 0.55)');
            moonGlow.addColorStop(0.35, 'rgba(20, 123, 255, 0.3)');
            moonGlow.addColorStop(0.7, 'rgba(20, 123, 255, 0.08)');
            moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = moonGlow;
            ctx.beginPath();
            ctx.arc(moonX, moonY, moonRadius * 2.8, 0, Math.PI * 2);
            ctx.fill();

            // Moon body
            const moonCore = ctx.createRadialGradient(moonX - moonRadius * 0.25, moonY - moonRadius * 0.25, moonRadius * 0.1, moonX, moonY, moonRadius);
            moonCore.addColorStop(0, '#ffffff');
            moonCore.addColorStop(0.6, '#e9f8ff');
            moonCore.addColorStop(0.88, '#cceeff');
            moonCore.addColorStop(1, '#8ae4ff');

            ctx.shadowColor = '#00d9ff';
            ctx.shadowBlur = 28;
            ctx.fillStyle = moonCore;
            ctx.beginPath();
            ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
            ctx.fill();

            // Soft craters
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(20, 100, 160, 0.15)';
            ctx.beginPath();
            ctx.arc(moonX - moonRadius * 0.35, moonY - moonRadius * 0.1, moonRadius * 0.22, 0, Math.PI * 2);
            ctx.arc(moonX + moonRadius * 0.22, moonY + moonRadius * 0.28, moonRadius * 0.26, 0, Math.PI * 2);
            ctx.arc(moonX - moonRadius * 0.12, moonY + moonRadius * 0.38, moonRadius * 0.16, 0, Math.PI * 2);
            ctx.fill();
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

            const numBuildings = 22;
            const bWidth = this.W / (numBuildings - 4);

            for (let i = -2; i < numBuildings + 2; i++) {
                const bx = i * bWidth - (playerLaneOffset * 35);
                const seed = Math.sin(i * 12.9898) * 43758.5453;
                const bHeight = 32 + Math.abs(seed % 75);

                // Far building silhouette
                ctx.fillStyle = '#090c1f';
                ctx.fillRect(bx, horizonY - bHeight, bWidth * 0.92, bHeight);

                // Far building border
                ctx.strokeStyle = '#1b264a';
                ctx.lineWidth = 1;
                ctx.strokeRect(bx, horizonY - bHeight, bWidth * 0.92, bHeight);

                // Far window lights (repeating grid of cyan & yellow dots)
                const winRows = Math.floor(bHeight / 9);
                const winCols = Math.max(2, Math.floor(bWidth * 0.92 / 7));
                for (let wr = 1; wr < winRows; wr++) {
                    for (let wc = 1; wc < winCols; wc++) {
                        if ((wr + wc + Math.floor(Math.abs(seed))) % 3 === 0) {
                            ctx.fillStyle = (wr % 2 === 0) ? 'rgba(0, 217, 255, 0.45)' : 'rgba(255, 216, 77, 0.45)';
                            ctx.fillRect(bx + wc * 6, horizonY - bHeight + wr * 8, 3, 3);
                        }
                    }
                }

                // Neon roof antenna light
                if (i % 2 === 0) {
                    ctx.fillStyle = i % 4 === 0 ? '#00f3ff' : '#ff315f';
                    ctx.fillRect(bx + bWidth * 0.45, horizonY - bHeight - 8, 2, 8);
                    ctx.beginPath();
                    ctx.arc(bx + bWidth * 0.45 + 1, horizonY - bHeight - 9, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        // Draw 3D Perspective Cyberpunk Scenery (Buildings, Houses, Shops, Streetlights, Pedestrians, Cars)
        drawSideBuildings(dt, speed, playerLaneOffset = 0, time = 0) {
            const ctx = this.ctx;
            const { roadWidth, roadLeft, roadTopWidth, roadTopLeft, horizonY } = this.getRoadMetrics();

            // Advance scenery depths
            const moveDelta = speed * (dt / 16.67) * 0.04;
            const signs = ['STREET', 'RUNNER', 'CYBER', 'NEON', 'SYNTH', 'TOKYO', 'HOTEL', '2099', 'NEXUS', 'RAM', 'MATRIX', 'VOX'];
            const neonColors = ['#00f3ff', '#ff007f', '#ffe600', '#00ff66', '#b700ff'];
            const windowTints = ['#00f3ff', '#ffe600', '#ff00a0', '#e0ffff', '#00ffaa'];

            for (const b of this.buildings) {
                b.z += moveDelta;
                if (b.z - b.length > 1.05) {
                    b.z -= 1.05;
                    const newSeed = Math.floor(Math.random() * 1000);
                    Object.assign(b, this.createBuilding(b.side, b.z, newSeed, signs, neonColors, windowTints));
                }
            }

            if (this.streetlights) {
                for (const sl of this.streetlights) {
                    sl.z += moveDelta;
                    if (sl.z > 1.05) sl.z -= 1.05;
                }
            }

            if (this.pedestrians) {
                for (const ped of this.pedestrians) {
                    ped.z += moveDelta + ped.walkSpeed * (dt / 16.67) * 0.02;
                    if (ped.z > 1.05) ped.z -= 1.05;
                }
            }

            if (this.sceneryCars) {
                for (const car of this.sceneryCars) {
                    car.z += moveDelta + car.speedOffset * (dt / 16.67) * 0.02;
                    if (car.z > 1.05) car.z -= 1.05;
                }
            }

            if (this.neonSigns) {
                for (const ns of this.neonSigns) {
                    ns.z += moveDelta;
                    if (ns.z > 1.05) ns.z -= 1.05;
                }
            }

            // Draw sidewalks / kerb strip along road edges
            ctx.save();
            // Left sidewalk
            ctx.fillStyle = '#070414';
            ctx.beginPath();
            ctx.moveTo(roadTopLeft, horizonY);
            ctx.lineTo(roadTopLeft - 22, horizonY);
            ctx.lineTo(roadLeft - 55, this.H);
            ctx.lineTo(roadLeft, this.H);
            ctx.closePath();
            ctx.fill();

            // Left sidewalk outer neon kerb (cyan)
            ctx.strokeStyle = 'rgba(0, 234, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(roadTopLeft - 22, horizonY);
            ctx.lineTo(roadLeft - 55, this.H);
            ctx.stroke();

            // Right sidewalk
            ctx.fillStyle = '#070414';
            ctx.beginPath();
            ctx.moveTo(roadTopLeft + roadTopWidth, horizonY);
            ctx.lineTo(roadTopLeft + roadTopWidth + 22, horizonY);
            ctx.lineTo(roadLeft + roadWidth + 55, this.H);
            ctx.lineTo(roadLeft + roadWidth, this.H);
            ctx.closePath();
            ctx.fill();

            // Right sidewalk outer neon kerb (magenta)
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(roadTopLeft + roadTopWidth + 22, horizonY);
            ctx.lineTo(roadLeft + roadWidth + 55, this.H);
            ctx.stroke();
            ctx.restore();

            // 1. Render Buildings, Houses, and Shops back-to-front
            const sortedBuildings = this.buildings.slice().sort((a, b) => a.z - b.z);

            for (const b of sortedBuildings) {
                const pNear = b.z;
                const pFar = Math.max(0, b.z - b.length);
                if (pNear <= 0.02) continue;

                const dNear = Math.pow(Math.min(1.25, pNear), 2.15);
                const dFar = Math.pow(Math.max(0, pFar), 2.15);

                const yNear = horizonY + (this.H - horizonY) * dNear;
                const yFar = horizonY + (this.H - horizonY) * dFar;
                if (yNear <= horizonY) continue;

                const hNear = b.height * (0.35 + 0.95 * dNear);
                const hFar = b.height * (0.35 + 0.95 * dFar);

                let wallNearX, wallFarX, outerNearX, outerFarX;

                if (b.side === 'left') {
                    const curbNear = roadTopLeft + (roadLeft - roadTopLeft) * dNear;
                    const curbFar = roadTopLeft + (roadLeft - roadTopLeft) * dFar;
                    const swNear = 12 + 28 * dNear;
                    const swFar = 12 + 28 * dFar;

                    wallNearX = curbNear - swNear;
                    wallFarX = curbFar - swFar;
                    outerNearX = Math.max(-60, wallNearX - (this.W * 0.45 * (0.35 + 0.65 * dNear)));
                    outerFarX = Math.max(-60, wallFarX - (this.W * 0.45 * (0.35 + 0.65 * dFar)));
                } else {
                    const curbNear = (roadTopLeft + roadTopWidth) + ((roadLeft + roadWidth) - (roadTopLeft + roadTopWidth)) * dNear;
                    const curbFar = (roadTopLeft + roadTopWidth) + ((roadLeft + roadWidth) - (roadTopLeft + roadTopWidth)) * dFar;
                    const swNear = 12 + 28 * dNear;
                    const swFar = 12 + 28 * dFar;

                    wallNearX = curbNear + swNear;
                    wallFarX = curbFar + swFar;
                    outerNearX = Math.min(this.W + 60, wallNearX + (this.W * 0.45 * (0.35 + 0.65 * dNear)));
                    outerFarX = Math.min(this.W + 60, wallFarX + (this.W * 0.45 * (0.35 + 0.65 * dFar)));
                }

                ctx.save();

                // Check scenery type
                if (b.type === 'house') {
                    // CYBER HOUSE (Pitched roof, warm glowing windows, cyber door)
                    // 1. Side wall
                    ctx.fillStyle = b.side === 'left' ? '#1c1b33' : '#141428';
                    ctx.beginPath();
                    ctx.moveTo(wallFarX, yFar - hFar);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.lineTo(wallFarX, yFar);
                    ctx.closePath();
                    ctx.fill();

                    // 2. Front facade (gradient #242641 to #39385b)
                    const houseGrad = ctx.createLinearGradient(outerNearX, 0, wallNearX, 0);
                    houseGrad.addColorStop(0, '#242641');
                    houseGrad.addColorStop(1, '#39385b');
                    ctx.fillStyle = houseGrad;
                    ctx.beginPath();
                    ctx.moveTo(outerNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.lineTo(outerNearX, yNear);
                    ctx.closePath();
                    ctx.fill();

                    // 3. Triangular pitched roof (#493258 with neon trim)
                    const peakX = (wallNearX + outerNearX) / 2;
                    const roofH = (45 + (b.seed % 2) * 15) * (0.4 + 0.8 * dNear);
                    const peakY = (yNear - hNear) - roofH;

                    ctx.fillStyle = '#493258';
                    ctx.beginPath();
                    ctx.moveTo(outerNearX, yNear - hNear);
                    ctx.lineTo(peakX, peakY);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.closePath();
                    ctx.fill();

                    // Roof neon trim
                    ctx.strokeStyle = '#ff007f';
                    ctx.shadowColor = '#ff007f';
                    ctx.shadowBlur = 10 * dNear;
                    ctx.lineWidth = 1.5 + dNear;
                    ctx.beginPath();
                    ctx.moveTo(outerNearX, yNear - hNear);
                    ctx.lineTo(peakX, peakY);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.stroke();

                    // 4. House Windows (#ffd75c warm yellow amber glow)
                    if (dNear > 0.08) {
                        const winW = Math.max(4, 18 * dNear);
                        const winH = Math.max(4, 18 * dNear);
                        const winY = (yNear - hNear) + (hNear * 0.35);

                        ctx.shadowBlur = 14 * dNear;
                        ctx.shadowColor = '#ffd75c';
                        ctx.fillStyle = '#ffd75c';

                        const leftWinX = peakX - Math.abs(peakX - outerNearX) * 0.45 - winW / 2;
                        const rightWinX = peakX + Math.abs(wallNearX - peakX) * 0.45 - winW / 2;
                        ctx.fillRect(leftWinX, winY, winW, winH);
                        ctx.fillRect(rightWinX, winY, winW, winH);

                        // Window crossbar
                        ctx.fillStyle = '#242641';
                        ctx.fillRect(leftWinX + winW / 2 - 0.5, winY, 1, winH);
                        ctx.fillRect(leftWinX, winY + winH / 2 - 0.5, winW, 1);
                        ctx.fillRect(rightWinX + winW / 2 - 0.5, winY, 1, winH);
                        ctx.fillRect(rightWinX, winY + winH / 2 - 0.5, winW, 1);
                    }

                    // 5. Cyber Door (#111426 with cyan border #00eaff)
                    if (dNear > 0.08) {
                        const doorW = Math.max(6, 22 * dNear);
                        const doorH = Math.max(12, 42 * dNear);
                        const doorX = peakX - doorW / 2;
                        const doorY = yNear - doorH;

                        ctx.fillStyle = '#111426';
                        ctx.fillRect(doorX, doorY, doorW, doorH);

                        ctx.strokeStyle = '#00eaff';
                        ctx.shadowColor = '#00eaff';
                        ctx.shadowBlur = 8 * dNear;
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(doorX, doorY, doorW, doorH);
                    }

                } else if (b.type === 'shop') {
                    // CYBER STOREFRONT (Neon canopy/awning, glowing display window, sign)
                    // Side & front walls
                    ctx.fillStyle = b.side === 'left' ? '#0d1124' : '#0a0d1e';
                    ctx.beginPath();
                    ctx.moveTo(wallFarX, yFar - hFar);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.lineTo(wallFarX, yFar);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#12162b';
                    ctx.beginPath();
                    ctx.moveTo(outerNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.lineTo(outerNearX, yNear);
                    ctx.closePath();
                    ctx.fill();

                    // Striped neon awning
                    const awningH = Math.max(6, 18 * dNear);
                    const awningY = yNear - hNear * 0.55;
                    const awningW = Math.abs(wallNearX - outerNearX);
                    const awningLeft = Math.min(wallNearX, outerNearX);

                    ctx.fillStyle = b.neonColor;
                    ctx.fillRect(awningLeft, awningY, awningW, awningH);

                    // Illuminated storefront display glass
                    if (dNear > 0.08) {
                        const dispW = awningW * 0.75;
                        const dispH = hNear * 0.45;
                        const dispX = awningLeft + (awningW - dispW) / 2;
                        const dispY = yNear - dispH - 4;

                        ctx.fillStyle = 'rgba(0, 234, 255, 0.2)';
                        ctx.fillRect(dispX, dispY, dispW, dispH);

                        ctx.strokeStyle = '#00eaff';
                        ctx.shadowColor = '#00eaff';
                        ctx.shadowBlur = 10 * dNear;
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(dispX, dispY, dispW, dispH);
                    }

                    // Shop neon sign overhead
                    if (dNear > 0.1) {
                        const signText = ['CYBER CAFE', 'NEON STORE', 'RAM SHOP', 'SYNTH BAR', 'DATA MART', 'PIXEL RETRO'][b.seed % 6];
                        ctx.font = `bold ${Math.max(7, Math.floor(10 * dNear))}px 'Orbitron', sans-serif`;
                        ctx.fillStyle = b.neonColor;
                        ctx.shadowColor = b.neonColor;
                        ctx.shadowBlur = 12 * dNear;
                        ctx.textAlign = 'center';
                        ctx.fillText(signText, (outerNearX + wallNearX) / 2, yNear - hNear + 14 * dNear);
                    }

                } else {
                    // CYBER SKYSCRAPER / TOWER
                    // 1. Street-facing wall
                    ctx.fillStyle = b.side === 'left' ? '#0a061c' : '#070417';
                    ctx.beginPath();
                    ctx.moveTo(wallFarX, yFar - hFar);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.lineTo(wallFarX, yFar);
                    ctx.closePath();
                    ctx.fill();

                    // 2. Front facade
                    ctx.fillStyle = b.side === 'left' ? '#0e0926' : '#0c0722';
                    ctx.beginPath();
                    ctx.moveTo(outerNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.lineTo(outerNearX, yNear);
                    ctx.closePath();
                    ctx.fill();

                    // 3. Rooftop
                    ctx.fillStyle = '#170f36';
                    ctx.beginPath();
                    ctx.moveTo(outerFarX, yFar - hFar);
                    ctx.lineTo(wallFarX, yFar - hFar);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(outerNearX, yNear - hNear);
                    ctx.closePath();
                    ctx.fill();

                    // Rooftop neon rim line
                    ctx.strokeStyle = b.neonColor;
                    ctx.shadowColor = b.neonColor;
                    ctx.shadowBlur = 10 * dNear;
                    ctx.lineWidth = 1.2 + 2 * dNear;
                    ctx.beginPath();
                    ctx.moveTo(outerNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallFarX, yFar - hFar);
                    ctx.stroke();

                    // Vertical street-edge neon beacon strip
                    ctx.beginPath();
                    ctx.moveTo(wallNearX, yNear - hNear);
                    ctx.lineTo(wallNearX, yNear);
                    ctx.stroke();

                    // 4. Windows on Front Facade
                    if (dNear > 0.08) {
                        const winCols = 4;
                        const winRows = 6;
                        const facadeW = Math.abs(wallNearX - outerNearX);
                        const colW = facadeW / (winCols + 1);
                        const rowH = hNear / (winRows + 2);
                        const winW = Math.max(2, colW * 0.55);
                        const winH = Math.max(3, rowH * 0.45);

                        ctx.shadowBlur = 8 * dNear;
                        ctx.shadowColor = b.windowColor;

                        for (let r = 0; r < winRows; r++) {
                            const winY = yNear - hNear + (r + 1.2) * rowH;
                            if (winY > yNear - 8) continue;

                            for (let c = 0; c < winCols; c++) {
                                if (b.litMatrix[r] && b.litMatrix[r][c]) {
                                    const winX = (b.side === 'left') 
                                        ? outerNearX + (c + 0.8) * colW 
                                        : wallNearX + (c + 0.8) * colW;

                                    ctx.fillStyle = b.windowColor;
                                    ctx.fillRect(winX, winY, winW, winH);
                                }
                            }
                        }
                    }

                    // 5. Rooftop Billboard Sign
                    if (b.hasSign && dNear > 0.12 && dNear < 0.95) {
                        const signW = Math.min(140, Math.max(35, 100 * dNear));
                        const signH = Math.min(42, Math.max(16, 26 * dNear));
                        const signX = (b.side === 'left') 
                            ? wallNearX - signW - 8 * dNear 
                            : wallNearX + 8 * dNear;
                        const signY = yNear - hNear - signH - 6 * dNear;

                        ctx.fillStyle = 'rgba(6, 3, 18, 0.9)';
                        ctx.fillRect(signX, signY, signW, signH);

                        ctx.strokeStyle = b.neonColor;
                        ctx.shadowColor = b.neonColor;
                        ctx.shadowBlur = 12 * dNear;
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(signX, signY, signW, signH);

                        const fontSize = Math.max(8, Math.floor(12 * dNear));
                        ctx.font = `900 ${fontSize}px 'Orbitron', monospace`;
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(b.signText, signX + signW / 2, signY + signH / 2);
                    }

                    // 6. Rooftop Antenna with Blinking Red Beacon (#ff315f)
                    if (b.hasAntenna && dNear > 0.08) {
                        const antX = (b.side === 'left') ? wallNearX - 16 * dNear : wallNearX + 16 * dNear;
                        const antY = yNear - hNear;
                        const antH = 28 * dNear;

                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                        ctx.lineWidth = 1.2;
                        ctx.beginPath();
                        ctx.moveTo(antX, antY);
                        ctx.lineTo(antX, antY - antH);
                        ctx.stroke();

                        const blink = Math.sin(time * 0.007 + b.seed * 4);
                        if (blink > 0.2) {
                            ctx.fillStyle = '#ff315f';
                            ctx.shadowColor = '#ff315f';
                            ctx.shadowBlur = 12;
                            ctx.beginPath();
                            ctx.arc(antX, antY - antH, 2.5 * dNear, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                ctx.restore();
            }

            // 2. Render Freestanding Neon Signs on Sidewalks
            if (this.neonSigns) {
                for (const ns of this.neonSigns) {
                    if (ns.z <= 0.04 || ns.z > 0.98) continue;
                    const d = Math.pow(Math.min(1.25, ns.z), 2.15);
                    const y = horizonY + (this.H - horizonY) * d;

                    let curb, sw, signX;
                    if (ns.side === 'left') {
                        curb = roadTopLeft + (roadLeft - roadTopLeft) * d;
                        sw = 12 + 28 * d;
                        signX = curb - sw * 0.85;
                    } else {
                        curb = (roadTopLeft + roadTopWidth) + ((roadLeft + roadWidth) - (roadTopLeft + roadTopWidth)) * d;
                        sw = 12 + 28 * d;
                        signX = curb + sw * 0.85;
                    }

                    const signW = Math.max(22, 65 * d);
                    const signH = Math.max(12, 28 * d);
                    const poleH = (45 + 75 * d);
                    const signY = y - poleH - signH;

                    ctx.save();
                    // Pole
                    ctx.strokeStyle = '#596179';
                    ctx.lineWidth = Math.max(1.5, 3 * d);
                    ctx.beginPath();
                    ctx.moveTo(signX, y);
                    ctx.lineTo(signX, signY + signH);
                    ctx.stroke();

                    // Sign box
                    ctx.fillStyle = '#190a23';
                    ctx.fillRect(signX - signW / 2, signY, signW, signH);

                    ctx.strokeStyle = ns.color;
                    ctx.shadowColor = ns.color;
                    ctx.shadowBlur = 12 * d;
                    ctx.lineWidth = Math.max(1.5, 2.5 * d);
                    ctx.strokeRect(signX - signW / 2, signY, signW, signH);

                    // Text
                    ctx.font = `bold ${Math.max(7, Math.floor(11 * d))}px 'Orbitron', sans-serif`;
                    ctx.fillStyle = ns.color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(ns.text, signX, signY + signH / 2);
                    ctx.restore();
                }
            }

            // 3. Render Streetlights along Sidewalks (with warm glowing light cones)
            if (this.streetlights) {
                for (const sl of this.streetlights) {
                    if (sl.z <= 0.03 || sl.z > 1.0) continue;
                    const d = Math.pow(Math.min(1.25, sl.z), 2.15);
                    const y = horizonY + (this.H - horizonY) * d;

                    let curb, sw, poleX, armTipX;
                    if (sl.side === 'left') {
                        curb = roadTopLeft + (roadLeft - roadTopLeft) * d;
                        sw = 12 + 28 * d;
                        poleX = curb - sw * 0.35;
                        armTipX = curb - sw * 0.05;
                    } else {
                        curb = (roadTopLeft + roadTopWidth) + ((roadLeft + roadWidth) - (roadTopLeft + roadTopWidth)) * d;
                        sw = 12 + 28 * d;
                        poleX = curb + sw * 0.35;
                        armTipX = curb + sw * 0.05;
                    }

                    const poleH = (50 + 95 * d);
                    const topY = y - poleH;

                    ctx.save();
                    // Warm glowing light cone onto sidewalk
                    if (d > 0.1) {
                        const coneGrad = ctx.createRadialGradient(armTipX, topY + 4, 2, armTipX, y, sw * 0.9);
                        coneGrad.addColorStop(0, 'rgba(255, 241, 160, 0.25)');
                        coneGrad.addColorStop(0.6, 'rgba(255, 217, 90, 0.08)');
                        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        ctx.fillStyle = coneGrad;
                        ctx.beginPath();
                        ctx.moveTo(armTipX, topY + 4);
                        ctx.lineTo(armTipX - sw * 0.7, y);
                        ctx.lineTo(armTipX + sw * 0.7, y);
                        ctx.closePath();
                        ctx.fill();
                    }

                    // Pole (#383d51)
                    ctx.strokeStyle = '#383d51';
                    ctx.lineWidth = Math.max(1.5, 3.5 * d);
                    ctx.beginPath();
                    ctx.moveTo(poleX, y);
                    ctx.lineTo(poleX, topY);
                    // Arm bracket (#41475c)
                    ctx.lineTo(armTipX, topY + 3);
                    ctx.stroke();

                    // Lantern fixture (#fff1a0 and #ffd95a)
                    ctx.fillStyle = '#fff1a0';
                    ctx.shadowColor = '#ffd95a';
                    ctx.shadowBlur = 18 * d;
                    ctx.beginPath();
                    ctx.arc(armTipX, topY + 3, Math.max(2, 4.5 * d), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            // 4. Render Scenery Cars along Outer Curbs
            if (this.sceneryCars) {
                for (const car of this.sceneryCars) {
                    if (car.z <= 0.05 || car.z > 0.98) continue;
                    const d = Math.pow(Math.min(1.25, car.z), 2.15);
                    const y = horizonY + (this.H - horizonY) * d;

                    let curb, sw, cx;
                    if (car.side === 'left') {
                        curb = roadTopLeft + (roadLeft - roadTopLeft) * d;
                        sw = 12 + 28 * d;
                        cx = curb - sw * 0.55;
                    } else {
                        curb = (roadTopLeft + roadTopWidth) + ((roadLeft + roadWidth) - (roadTopLeft + roadTopWidth)) * d;
                        sw = 12 + 28 * d;
                        cx = curb + sw * 0.55;
                    }

                    const cW = Math.max(16, 42 * d);
                    const cH = Math.max(8, 18 * d);

                    ctx.save();
                    // Wheels
                    ctx.fillStyle = '#030308';
                    ctx.strokeStyle = '#555c70';
                    ctx.lineWidth = 1;
                    const wRadius = cH * 0.28;
                    ctx.beginPath();
                    ctx.arc(cx - cW * 0.3, y, wRadius, 0, Math.PI * 2);
                    ctx.arc(cx + cW * 0.3, y, wRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Car body
                    ctx.fillStyle = car.color;
                    ctx.shadowColor = car.color;
                    ctx.shadowBlur = 8 * d;
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(cx - cW / 2, y - cH, cW, cH * 0.75, 4 * d) : ctx.rect(cx - cW / 2, y - cH, cW, cH * 0.75);
                    ctx.fill();

                    // Roof cabin
                    ctx.fillStyle = '#1c2137';
                    ctx.fillRect(cx - cW * 0.25, y - cH * 1.35, cW * 0.5, cH * 0.5);

                    // Lights
                    ctx.fillStyle = car.side === 'left' ? '#ff245f' : '#00eaff';
                    ctx.shadowColor = ctx.fillStyle;
                    ctx.shadowBlur = 10;
                    ctx.fillRect(car.side === 'left' ? cx - cW / 2 : cx + cW / 2 - 2, y - cH * 0.7, 3, 3);
                    ctx.restore();
                }
            }

            // 5. Render Pedestrians on Sidewalks (animated striding, jackets, visors)
            if (this.pedestrians) {
                for (const ped of this.pedestrians) {
                    if (ped.z <= 0.04 || ped.z > 0.98) continue;
                    const d = Math.pow(Math.min(1.25, ped.z), 2.15);
                    const y = horizonY + (this.H - horizonY) * d;

                    let curb, sw, px;
                    if (ped.side === 'left') {
                        curb = roadTopLeft + (roadLeft - roadTopLeft) * d;
                        sw = 12 + 28 * d;
                        px = curb - sw * 0.65;
                    } else {
                        curb = (roadTopLeft + roadTopWidth) + ((roadLeft + roadWidth) - (roadTopLeft + roadTopWidth)) * d;
                        sw = 12 + 28 * d;
                        px = curb + sw * 0.65;
                    }

                    const pH = Math.max(14, 38 * d);
                    const pW = pH * 0.35;
                    const stride = Math.sin(time * 0.009 * ped.strideSpeed + ped.phase);

                    ctx.save();
                    // Legs (#191c2e with animated stride)
                    ctx.strokeStyle = '#191c2e';
                    ctx.lineWidth = Math.max(1.2, 2.5 * d);
                    ctx.beginPath();
                    // Left leg
                    ctx.moveTo(px - pW * 0.2, y - pH * 0.35);
                    ctx.lineTo(px - pW * 0.2 + stride * 5 * d, y);
                    // Right leg
                    ctx.moveTo(px + pW * 0.2, y - pH * 0.35);
                    ctx.lineTo(px + pW * 0.2 - stride * 5 * d, y);
                    ctx.stroke();

                    // Shoes (cyan neon dots)
                    ctx.fillStyle = '#00d9ff';
                    ctx.fillRect(px - pW * 0.2 + stride * 5 * d - 1, y - 2, 3, 2);
                    ctx.fillRect(px + pW * 0.2 - stride * 5 * d - 1, y - 2, 3, 2);

                    // Torso (colored cyber jacket)
                    ctx.fillStyle = ped.shirt;
                    ctx.shadowColor = ped.shirt;
                    ctx.shadowBlur = 6 * d;
                    ctx.fillRect(px - pW / 2, y - pH * 0.72, pW, pH * 0.38);

                    // Head (#e9b18f)
                    const headRadius = Math.max(1.8, pH * 0.12);
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#e9b18f';
                    ctx.beginPath();
                    ctx.arc(px, y - pH * 0.85, headRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Cyber visor (#00eaff neon)
                    ctx.fillStyle = '#00eaff';
                    ctx.shadowColor = '#00eaff';
                    ctx.shadowBlur = 6;
                    ctx.fillRect(px - headRadius * 0.8, y - pH * 0.87, headRadius * 1.6, Math.max(1, 2 * d));
                    ctx.restore();
                }
            }
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

        // Draw Collectible Diamonds (Multi-faceted 3D Glowing Cyber Gemstones)
        drawDiamonds(diamonds, time) {
            const ctx = this.ctx;

            for (const d of diamonds) {
                if (d.collected) continue;

                ctx.save();
                ctx.translate(d.x, d.y);

                // Rotating 3D gemstone projection
                const spin = time * 0.005 + (d.seed || 0);
                const cosSpin = Math.cos(spin);
                const absCos = Math.abs(cosSpin);
                const scaleX = cosSpin;
                const r = d.radius * 1.15;

                // Diamond electric cyan bloom
                ctx.shadowColor = '#00f3ff';
                ctx.shadowBlur = 22;

                // 1. Lower Pavilion (Bottom V-taper to culet)
                // Left lower facet
                ctx.fillStyle = cosSpin > 0 ? '#00b8e6' : '#0077aa';
                ctx.beginPath();
                ctx.moveTo(-r * scaleX, -r * 0.2);
                ctx.lineTo(0, -r * 0.2);
                ctx.lineTo(0, r * 1.15);
                ctx.closePath();
                ctx.fill();

                // Right lower facet
                ctx.fillStyle = cosSpin > 0 ? '#00e5ff' : '#0099cc';
                ctx.beginPath();
                ctx.moveTo(0, -r * 0.2);
                ctx.lineTo(r * scaleX, -r * 0.2);
                ctx.lineTo(0, r * 1.15);
                ctx.closePath();
                ctx.fill();

                // 2. Upper Crown (Top bevels)
                // Left crown bezel
                ctx.fillStyle = cosSpin > 0 ? '#66ffff' : '#00d0f5';
                ctx.beginPath();
                ctx.moveTo(-r * scaleX, -r * 0.2);
                ctx.lineTo(-r * 0.55 * scaleX, -r * 0.85);
                ctx.lineTo(0, -r * 0.2);
                ctx.closePath();
                ctx.fill();

                // Right crown bezel
                ctx.fillStyle = cosSpin > 0 ? '#b3ffff' : '#4deeea';
                ctx.beginPath();
                ctx.moveTo(0, -r * 0.2);
                ctx.lineTo(r * 0.55 * scaleX, -r * 0.85);
                ctx.lineTo(r * scaleX, -r * 0.2);
                ctx.closePath();
                ctx.fill();

                // Top Table facet (flat table top)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
                ctx.beginPath();
                ctx.moveTo(-r * 0.55 * scaleX, -r * 0.85);
                ctx.lineTo(r * 0.55 * scaleX, -r * 0.85);
                ctx.lineTo(0, -r * 0.2);
                ctx.closePath();
                ctx.fill();

                // Inner crystalline prism core
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(0, -r * 0.7);
                ctx.lineTo(r * 0.3 * scaleX, -r * 0.2);
                ctx.lineTo(0, r * 0.5);
                ctx.lineTo(-r * 0.3 * scaleX, -r * 0.2);
                ctx.closePath();
                ctx.fill();

                // Outer Diamond Cut crisp wireframe edges
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                // Outer perimeter
                ctx.moveTo(-r * 0.55 * scaleX, -r * 0.85);
                ctx.lineTo(r * 0.55 * scaleX, -r * 0.85);
                ctx.lineTo(r * scaleX, -r * 0.2);
                ctx.lineTo(0, r * 1.15);
                ctx.lineTo(-r * scaleX, -r * 0.2);
                ctx.closePath();
                // Girdle line
                ctx.moveTo(-r * scaleX, -r * 0.2);
                ctx.lineTo(r * scaleX, -r * 0.2);
                ctx.stroke();

                // Twinkling Star Glint / Gemstone Specular Flare
                const glintCycle = (time * 0.007 + (d.seed || 0) * 5) % (Math.PI * 2);
                const glintIntensity = Math.sin(glintCycle);
                if (glintIntensity > 0.75) {
                    const sparkScale = (glintIntensity - 0.75) / 0.25;
                    const sparkLen = r * 1.4 * sparkScale;

                    ctx.shadowColor = '#ffffff';
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.8 * sparkScale;

                    // 4-point cross star flare at upper right edge
                    const fx = r * 0.4 * scaleX;
                    const fy = -r * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(fx - sparkLen, fy); ctx.lineTo(fx + sparkLen, fy);
                    ctx.moveTo(fx, fy - sparkLen); ctx.lineTo(fx, fy + sparkLen);
                    ctx.stroke();

                    // Central flare core
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(fx, fy, 2.5 * sparkScale, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        }

        // Backward compatibility alias
        drawCoins(coins, time) {
            this.drawDiamonds(coins, time);
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
