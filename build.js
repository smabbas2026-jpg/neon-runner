const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
if (fs.existsSync(dist)) {
    fs.rmSync(dist, { recursive: true, force: true });
}
fs.mkdirSync(dist, { recursive: true });

// Copy individual root files
const files = ['index.html', 'style.css', 'manifest.json'];
for (const file of files) {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(dist, file));
    }
}

// Copy folders recursively
const dirs = ['js', 'assets'];
for (const dir of dirs) {
    const src = path.join(__dirname, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(dist, dir), { recursive: true });
    }
}

console.log('Build completed successfully: static assets copied to dist/');
