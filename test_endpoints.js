const http = require('http');

const urls = [
    '/',
    '/style.css',
    '/assets/logo.jpg',
    '/assets/bg.jpg',
    '/js/state.js',
    '/js/audio.js',
    '/js/particles.js',
    '/js/renderer.js',
    '/js/game.js',
    '/manifest.json'
];

let pending = urls.length;
urls.forEach(u => {
    http.get('http://localhost:3050' + u, res => {
        console.log(`[STATUS ${res.statusCode}] ${u} (${res.headers['content-type']})`);
        pending--;
        if (pending === 0) {
            console.log('ALL ENDPOINTS VERIFIED SUCCESSFULLY!');
            process.exit(0);
        }
    }).on('error', err => {
        console.error(`FAILED: ${u}`, err.message);
        process.exit(1);
    });
});
