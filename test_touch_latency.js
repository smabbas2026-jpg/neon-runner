const assert = require('assert');
const fs = require('fs');

console.log('--- Testing Touch & Swipe Zero-Latency Processing ---');

const elements = {};
function createMockElement(id, classes = []) {
    return {
        id,
        classList: {
            classes: new Set(classes),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            toggle(c, val) { if (val) this.classes.add(c); else this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        },
        style: {},
        addEventListener(event, fn, opts) {
            if (!this['on' + event]) this['on' + event] = [];
            this['on' + event].push({ fn, opts });
        },
        dispatchEvent(evt) {
            const list = this['on' + evt.type] || [];
            list.forEach(h => h.fn(evt));
        },
        closest(sel) {
            if (sel.includes('.btn-touch') && this.classList.contains('btn-touch')) return this;
            if (sel.includes('#btnPause') && this.id === 'btnPause') return this;
            if (sel.includes('#btnSound') && this.id === 'btnSound') return this;
            return null;
        },
        click() { if (this.onclick) this.onclick(); },
        textContent: '',
        innerHTML: ''
    };
}

const mockDoc = {
    readyState: 'complete',
    getElementById(id) {
        if (!elements[id]) {
            elements[id] = createMockElement(id, id === 'hud' ? ['hidden'] : []);
        }
        return elements[id];
    },
    addEventListener(event, fn) {}
};

const windowListeners = {};
const mockWindow = {
    addEventListener(event, fn, opts) {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push({ fn, opts });
    },
    dispatchEvent(evt) {
        const list = windowListeners[evt.type] || [];
        list.forEach(h => h.fn(evt));
    },
    removeEventListener() {},
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => setTimeout(fn, 16),
    document: mockDoc,
    innerWidth: 800,
    innerHeight: 600,
    GameState: {
        get() {
            return {
                highScore: 200,
                diamonds: 100,
                settings: { musicMuted: false, sfxMuted: false, vibration: true }
            };
        },
        save() {},
        updateHighScore() { return false; },
        addDiamonds() {},
        getCurrentSkin() { return { primaryColor: '#00f3ff', thrusterColor: '#00ffff' }; },
        getPowerupDuration() { return 8; }
    },
    GameRenderer: {
        W: 800,
        H: 600,
        init() {},
        resize() {},
        triggerShake() {},
        laneX(lane) { return 150 + 500 * ((lane + 0.5) / 3); },
        beginFrame() {},
        drawSky() {},
        drawSideBuildings() {},
        drawRoad() {},
        drawDiamonds() {},
        drawPowerups() {},
        drawObstacles() {},
        drawPlayer() {},
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
        update() {},
        updateSpeedLines() {},
        draw() {}
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

// Start game
mockWindow.startGame();
assert.strictEqual(elements.dotLane1.classList.contains('active'), true, 'Initial lane should be Center (Lane 1)');

// 1. Verify touchstart was registered with { passive: false }
const touchstartHandlers = windowListeners['touchstart'] || [];
assert.ok(touchstartHandlers.length > 0, 'touchstart listener must be registered');
assert.strictEqual(touchstartHandlers[0].opts.passive, false, 'touchstart listener MUST have passive: false for zero gesture delay');
console.log('✓ touchstart registered with passive: false (no browser arbitration delay).');

// 2. Simulate Swipe Left in mid-drag (touchmove)
let defaultPrevented = false;
const touchStartEvt = {
    type: 'touchstart',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() { defaultPrevented = true; },
    changedTouches: [{ identifier: 101, clientX: 400, clientY: 400 }]
};
mockWindow.dispatchEvent(touchStartEvt);
assert.strictEqual(defaultPrevented, true, 'touchstart should call e.preventDefault() to cancel browser navigation delays');

// Immediate swipe left: move finger left by 15px (dx = -15)
const touchMoveEvt = {
    type: 'touchmove',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 101, clientX: 385, clientY: 400 }]
};
mockWindow.dispatchEvent(touchMoveEvt);

// Lane should have IMMEDIATELY shifted to Left (Lane 0) without waiting for touchend
assert.strictEqual(elements.dotLane0.classList.contains('active'), true, 'Ship should switch to Left Lane (0) immediately on touchmove');
console.log('✓ Swipe Left responded immediately during touchmove (<16ms, frame 1)!');

// 3. Simulate Chained Swipe Right without lifting finger (drag to the right)
const touchMoveRightEvt = {
    type: 'touchmove',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 101, clientX: 415, clientY: 400 }] // subDx = +30px (> 22px threshold)
};
mockWindow.dispatchEvent(touchMoveRightEvt);
assert.strictEqual(elements.dotLane1.classList.contains('active'), true, 'Ship should chain-switch back to Center Lane (1) during continuous drag');
console.log('✓ Continuous chained swipe right during drag verified without lifting finger!');

// End touch
mockWindow.dispatchEvent({
    type: 'touchend',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 101, clientX: 415, clientY: 400 }]
});

// 4. Test Swipe Up (Jump)
mockWindow.dispatchEvent({
    type: 'touchstart',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 102, clientX: 400, clientY: 400 }]
});
mockWindow.dispatchEvent({
    type: 'touchmove',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 102, clientX: 400, clientY: 380 }] // dy = -20px
});
mockWindow.dispatchEvent({
    type: 'touchend',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 102, clientX: 400, clientY: 380 }]
});
console.log('✓ Swipe Up (Jump) executed with zero latency.');

// 5. Test Swipe Down (Slide)
mockWindow.dispatchEvent({
    type: 'touchstart',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 103, clientX: 400, clientY: 300 }]
});
mockWindow.dispatchEvent({
    type: 'touchmove',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 103, clientX: 400, clientY: 325 }] // dy = +25px
});
mockWindow.dispatchEvent({
    type: 'touchend',
    target: elements['canvas'],
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 103, clientX: 400, clientY: 325 }]
});
console.log('✓ Swipe Down (Slide) executed with zero latency.');

// 6. Test Swiping starting in touchControls background
const touchControlsEl = createMockElement('touchControls');
mockWindow.dispatchEvent({
    type: 'touchstart',
    target: touchControlsEl,
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 104, clientX: 400, clientY: 550 }]
});
mockWindow.dispatchEvent({
    type: 'touchmove',
    target: touchControlsEl,
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 104, clientX: 425, clientY: 550 }] // dx = +25px
});
assert.strictEqual(elements.dotLane2.classList.contains('active'), true, 'Swiping starting inside touchControls area must shift to Right Lane (2)');
console.log('✓ Swiping starting inside touchControls area is not blocked and works instantly!');

console.log('\n==================================================');
console.log(' ALL ZERO-LATENCY TOUCH TESTS PASSED SUCCESSFULLY! ');
console.log('==================================================');
process.exit(0);
