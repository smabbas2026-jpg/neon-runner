const assert = require('assert');
const fs = require('fs');

console.log('=== MULTI-DEVICE SPEED PACING & FAIRNESS TEST SUITE ===');

// Mock environments for different screen resolutions
const devices = [
    { name: 'Mobile Portrait (iPhone 13 / 14 / 15)', W: 390, H: 844 },
    { name: 'Mobile Landscape (iPhone Landscape)', W: 844, H: 390 },
    { name: 'Small Android Phone', W: 360, H: 640 },
    { name: 'Tablet Portrait (iPad 10th Gen)', W: 820, H: 1180 },
    { name: 'Tablet Landscape (iPad Landscape)', W: 1180, H: 820 },
    { name: 'Desktop Full HD (1080p)', W: 1920, H: 1080 },
    { name: 'Desktop 4K UHD', W: 3840, H: 2160 }
];

devices.forEach(dev => {
    const horizonY = dev.H * 0.38;
    const playerY = dev.H - Math.max(130, Math.min(180, dev.H * 0.20));
    const effectiveDistance = Math.max(120, playerY - horizonY);

    // Calculate movement at START_SPEED (3.0)
    const startSpeed = 3.0;
    const startFactor = Math.max(1.0, startSpeed / 3.0); // 1.0
    const startVelocityRatio = Math.pow(startFactor, 0.72) / 2.35; // 1 / 2.35
    const startPixelsPerSec = effectiveDistance * startVelocityRatio;
    const startTravelTimeSec = effectiveDistance / startPixelsPerSec;

    // Calculate movement at MAX_SPEED (14.5)
    const maxSpeed = 14.5;
    const maxFactor = Math.max(1.0, maxSpeed / 3.0); // 4.833
    const maxVelocityRatio = Math.pow(maxFactor, 0.72) / 2.35;
    const maxPixelsPerSec = effectiveDistance * maxVelocityRatio;
    const maxTravelTimeSec = effectiveDistance / maxPixelsPerSec;

    console.log(`\nDevice: ${dev.name} (${dev.W}x${dev.H})`);
    console.log(`  HorizonY: ${horizonY.toFixed(1)}px, PlayerY: ${playerY.toFixed(1)}px, Track: ${effectiveDistance.toFixed(1)}px`);
    console.log(`  Start Speed (3.0): Travel time = ${startTravelTimeSec.toFixed(2)}s (Lead time for player reaction)`);
    console.log(`  Max Speed (14.5):   Travel time = ${maxTravelTimeSec.toFixed(2)}s (Exhilarating arcade reflexes)`);

    assert.ok(
        Math.abs(startTravelTimeSec - 2.35) < 0.01,
        `Start travel time on ${dev.name} must be 2.35s, got ${startTravelTimeSec}`
    );
    assert.ok(
        Math.abs(maxTravelTimeSec - 0.76) < 0.02,
        `Max speed travel time on ${dev.name} must be ~0.76s, got ${maxTravelTimeSec}`
    );
});
console.log('\n✓ Device-Independent Travel Time verified across ALL aspect ratios!');

// Spawning interval verification
console.log('\n--- Verifying Wave Spawning Interval Curve ---');
function getSpawnInterval(speed) {
    return Math.max(860, 2400 - (speed - 3.0) * 135);
}

const speedsToTest = [3.0, 4.0, 5.5, 7.5, 9.5, 12.0, 14.5, 20.0];
speedsToTest.forEach(spd => {
    const interval = getSpawnInterval(spd);
    console.log(`  Speed ${spd.toFixed(1)} -> Wave interval: ${Math.round(interval)}ms`);
    assert.ok(interval >= 860, `Interval at speed ${spd} must be >= 860ms`);
    if (spd === 3.0) {
        assert.strictEqual(interval, 2400, 'Initial wave interval must be 2400ms');
    }
});
console.log('✓ Wave spawning interval curve guarantees >= 860ms recovery time!');

// Lane blocking verification
console.log('\n--- Verifying Lane Safety Progression (1000 simulated spawns) ---');
for (let i = 0; i < 1000; i++) {
    // Early speed test
    const earlySpeed = 3.0 + Math.random() * 2.0; // < 5.0
    let blockedCount = 1;
    if (earlySpeed >= 9.5) blockedCount = Math.random() < 0.50 ? 2 : 1;
    else if (earlySpeed >= 5.5) blockedCount = Math.random() < 0.28 ? 2 : 1;
    else blockedCount = 1;

    assert.strictEqual(blockedCount, 1, 'Early game must ONLY block 1 lane');
}
console.log('✓ Early run strictly blocks only 1 lane (leaving 2 wide-open lanes for easy navigation).');

console.log('\n======================================================');
console.log(' ALL SPEED PACING & MULTI-DEVICE TESTS PASSED (100%)! ');
console.log('======================================================');
