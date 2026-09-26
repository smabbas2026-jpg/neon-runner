const assert = require('assert');

// Verify speed progression logic: starts slow, accelerates progressively
const START_SPEED = 3.0;
const MAX_SPEED = 14.5;
const ACCELERATION = 0.075;

let game_speed = START_SPEED;
let elapsed_time = 0;

function update_speed(dt) {
    elapsed_time += dt;
    game_speed = Math.min(
        START_SPEED + (elapsed_time * ACCELERATION),
        MAX_SPEED
    );
    return game_speed;
}

console.log('Testing speed progression:');
assert.strictEqual(update_speed(0), 3.0, 'Initial speed should be 3.0 (gentle start)');
console.log('  t=0s: speed =', game_speed);

update_speed(20);
assert.strictEqual(game_speed, 3.0 + 20 * 0.075, 'Speed after 20s should be 4.5');
console.log('  t=20s: speed =', game_speed);

update_speed(40);
assert.strictEqual(game_speed, 3.0 + 60 * 0.075, 'Speed after 60s should be 7.5');
console.log('  t=60s: speed =', game_speed);

update_speed(60);
assert.strictEqual(game_speed, 3.0 + 120 * 0.075, 'Speed after 120s should be 12.0');
console.log('  t=120s: speed =', game_speed);

update_speed(100);
assert.strictEqual(game_speed, 14.5, 'Speed should be capped at MAX_SPEED 14.5');
console.log('  t=220s: speed =', game_speed, '(capped at MAX_SPEED)');

console.log('All 3-lane speed progression tests PASSED!');
