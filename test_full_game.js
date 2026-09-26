const assert = require('assert');
const fs = require('fs');

console.log('--- 1. Testing HTML structure ---');
const html = fs.readFileSync('index.html', 'utf8');

assert.ok(html.includes('<canvas id="canvas"></canvas>'), 'index.html must have canvas#canvas for 3D rendering');
assert.ok(html.includes('id="lanesIndicator"'), 'index.html must have 3-lane indicator');
assert.ok(html.includes('id="dotLane0"') && html.includes('id="dotLane1"') && html.includes('id="dotLane2"'), 'index.html must have dots for 3 lanes (L, C, R)');
assert.ok(html.includes('id="speedGauge"'), 'index.html must have speed gauge');
assert.ok(html.includes('id="touchLeft"') && html.includes('id="touchRight"'), 'index.html must have touch left and right buttons');
assert.ok(html.includes('id="touchJump"') && html.includes('id="touchSlide"'), 'index.html must have touch jump and slide buttons');
assert.ok(html.includes('id="btnStart"'), 'index.html must have btnStart');
assert.ok(html.includes('triggerRunNow(event)'), 'index.html must have triggerRunNow handler');
console.log('✓ HTML 3D & 3-lane elements verified.');

console.log('--- 2. Testing Game Logic & 3-Lane Mechanics ---');
// Mock browser environment for game.js testing
const elements = {};
function createMockElement(id) {
    return {
        id,
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, val) { if (val) this.classes.add(c); else this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        },
        style: {},
        addEventListener(event, fn) { this['on' + event] = fn; },
        click() { if (this.onclick) this.onclick(); },
        textContent: '',
        innerHTML: ''
    };
}

const mockDoc = {
    readyState: 'complete',
    getElementById(id) {
        if (!elements[id]) elements[id] = createMockElement(id);
        return elements[id];
    },
    addEventListener(event, fn) {}
};

const mockWindow = {
    addEventListener(event, fn) {},
    removeEventListener(event, fn) {},
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    document: mockDoc,
    GameState: {
        get() {
            return {
                highScore: 120,
                diamonds: 50,
                settings: { musicMuted: false, sfxMuted: false, vibration: true }
            };
        },
        save() {},
        updateHighScore(score, dist) { return score > 120; },
        addDiamonds(d) {},
        getCurrentSkin() {
            return { primaryColor: '#00f3ff', thrusterColor: '#00ffff' };
        },
        getPowerupDuration(type) { return 8; }
    },
    GameRenderer: {
        W: 800,
        H: 600,
        init(canvas) {},
        resize() {},
        triggerShake(i, d) {},
        laneX(lane, progress) {
            // 3 lanes calculation: roadWidth 500, lane 0, 1, 2
            const roadLeft = 150;
            const roadWidth = 500;
            return roadLeft + roadWidth * ((lane + 0.5) / 3);
        },
        beginFrame(dt) {},
        drawSky(t, o) {},
        drawSideBuildings(dt, s, o, t) {},
        drawRoad(dt, s) {},
        drawDiamonds(d, t) {},
        drawPowerups(p, t) {},
        drawObstacles(o, t) {},
        drawPlayer(p, t) {},
        endFrame() {}
    },
    Particles: {
        clear() {},
        emitThruster() {},
        emitSlideSparks() {},
        emitExplosion() {},
        emitDiamondBurst() {},
        emitCoinBurst() {},
        addFloatingText() {},
        update(dt) {},
        updateSpeedLines() {},
        draw(ctx) {}
    },
    AudioEngine: {
        init() {},
        initAudio() { return true; },
        playMenuMusic() {},
        playActionMusic() {},
        pauseMusic() {},
        resumeMusic() {},
        stopMusic() {},
        playJump() {},
        playSlide() {},
        playSwipe() {},
        playCrash() {},
        playDiamond() {},
        playPowerup() {},
        playShieldHit() {},
        playClick() {}
    }
};

// Execute game.js inside mock window
const gameCode = fs.readFileSync('js/game.js', 'utf8');
const runGame = new Function('window', 'document', gameCode);
runGame(mockWindow, mockDoc);

assert.strictEqual(mockWindow.START_SPEED, 3.0, 'START_SPEED must be 3.0');
assert.strictEqual(mockWindow.MAX_SPEED, 14.5, 'MAX_SPEED must be 14.5');
assert.strictEqual(mockWindow.ACCELERATION, 0.075, 'ACCELERATION must be 0.075');
console.log('✓ Speed constants verified: START_SPEED = 3.0, MAX_SPEED = 14.5, ACCELERATION = 0.075');

// Test start game
mockWindow.startGame();
assert.strictEqual(mockWindow.getGameSpeed(), 3.0, 'Speed at game start should be 3.0');
console.log('✓ startGame initialized speed to 3.0');

// Test 3 lanes switching
assert.strictEqual(elements.dotLane1.classList.contains('active'), true, 'Initial lane should be Center (Lane 1)');
mockWindow.moveLeft();
assert.strictEqual(elements.dotLane0.classList.contains('active'), true, 'Lane after moveLeft should be Left (Lane 0)');
mockWindow.moveLeft();
assert.strictEqual(elements.dotLane0.classList.contains('active'), true, 'Lane 0 should not go below 0');

mockWindow.moveRight();
assert.strictEqual(elements.dotLane1.classList.contains('active'), true, 'Lane after moveRight should be Center (Lane 1)');
mockWindow.moveRight();
assert.strictEqual(elements.dotLane2.classList.contains('active'), true, 'Lane after second moveRight should be Right (Lane 2)');
mockWindow.moveRight();
assert.strictEqual(elements.dotLane2.classList.contains('active'), true, 'Lane 2 should not go above 2');
console.log('✓ 3-lane switching (Left: 0, Center: 1, Right: 2) and lane indicator clamping verified.');

// Test Jump & Slide actions
mockWindow.jump();
mockWindow.slide();
console.log('✓ Jump and Slide actions verified without runtime errors.');

// Test speed progression over time
mockWindow.update_speed(20);
assert.strictEqual(mockWindow.getGameSpeed(), 3.0 + 20 * 0.075, 'Speed after 20s should be 4.5');
mockWindow.update_speed(40);
assert.strictEqual(mockWindow.getGameSpeed(), 3.0 + 60 * 0.075, 'Speed after 60s should be 7.5');
mockWindow.update_speed(120);
assert.strictEqual(mockWindow.getGameSpeed(), 14.5, 'Speed after 180s should be capped at MAX_SPEED 14.5');
console.log('✓ Progressive acceleration over time verified from 3.0 up to 14.5.');

console.log('\n========================================');
console.log(' ALL 3D & 3-LANE AUTOMATED TESTS PASSED! ');
console.log('========================================');
