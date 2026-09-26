const assert = require('assert');

// Verify speed progression logic
const START_SPEED = 4.0;
const MAX_SPEED = 14.0;
const ACCELERATION = 0.08;

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
assert.strictEqual(update_speed(0), 4.0, 'Initial speed should be 4.0');
console.log('  t=0s: speed =', game_speed);

update_speed(10);
assert.strictEqual(game_speed, 4.0 + 10 * 0.08, 'Speed after 10s should be 4.8');
console.log('  t=10s: speed =', game_speed);

update_speed(50);
assert.strictEqual(game_speed, 4.0 + 60 * 0.08, 'Speed after 60s should be 8.8');
console.log('  t=60s: speed =', game_speed);

update_speed(100);
assert.strictEqual(game_speed, 14.0, 'Speed should be capped at MAX_SPEED 14.0');
console.log('  t=160s: speed =', game_speed, '(capped at MAX_SPEED)');

console.log('All speed progression tests PASSED!');
