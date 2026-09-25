const fs = require('fs');
const path = require('path');

const files = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/style.css': 'style.css',
  '/manifest.json': 'manifest.json',
  '/js/state.js': 'js/state.js',
  '/js/audio.js': 'js/audio.js',
  '/js/particles.js': 'js/particles.js',
  '/js/renderer.js': 'js/renderer.js',
  '/js/game.js': 'js/game.js'
};

const inlines = {};
for (const [route, relPath] of Object.entries(files)) {
  inlines[route] = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
}

const template = `const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3050', 10);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

// Static anchors for @vercel/nft bundling
const STATIC_MAP = {
    '/': path.join(__dirname, 'index.html'),
    '/index.html': path.join(__dirname, 'index.html'),
    '/style.css': path.join(__dirname, 'style.css'),
    '/manifest.json': path.join(__dirname, 'manifest.json'),
    '/js/state.js': path.join(__dirname, 'js', 'state.js'),
    '/js/audio.js': path.join(__dirname, 'js', 'audio.js'),
    '/js/particles.js': path.join(__dirname, 'js', 'particles.js'),
    '/js/renderer.js': path.join(__dirname, 'js', 'renderer.js'),
    '/js/game.js': path.join(__dirname, 'js', 'game.js'),
    '/assets/logo.jpg': path.join(__dirname, 'assets', 'logo.jpg'),
    '/assets/bg.jpg': path.join(__dirname, 'assets', 'bg.jpg')
};

const CWD_MAP = {
    '/': path.join(process.cwd(), 'index.html'),
    '/index.html': path.join(process.cwd(), 'index.html'),
    '/style.css': path.join(process.cwd(), 'style.css'),
    '/manifest.json': path.join(process.cwd(), 'manifest.json'),
    '/js/state.js': path.join(process.cwd(), 'js', 'state.js'),
    '/js/audio.js': path.join(process.cwd(), 'js', 'audio.js'),
    '/js/particles.js': path.join(process.cwd(), 'js', 'particles.js'),
    '/js/renderer.js': path.join(process.cwd(), 'js', 'renderer.js'),
    '/js/game.js': path.join(process.cwd(), 'js', 'game.js'),
    '/assets/logo.jpg': path.join(process.cwd(), 'assets', 'logo.jpg'),
    '/assets/bg.jpg': path.join(process.cwd(), 'assets', 'bg.jpg')
};

// Fallback embedded text content for all static text assets
const INLINE_ASSETS = ${JSON.stringify(inlines)};

function resolveFilePath(reqUrl) {
    if (STATIC_MAP[reqUrl] && fs.existsSync(STATIC_MAP[reqUrl])) {
        return STATIC_MAP[reqUrl];
    }
    if (CWD_MAP[reqUrl] && fs.existsSync(CWD_MAP[reqUrl])) {
        return CWD_MAP[reqUrl];
    }
    const cleanRel = reqUrl.replace(/^\\/+|\\?.*$/g, '');
    const candidateDirect = path.join(__dirname, cleanRel);
    if (fs.existsSync(candidateDirect) && fs.statSync(candidateDirect).isFile()) {
        return candidateDirect;
    }
    const candidateCwd = path.join(process.cwd(), cleanRel);
    if (fs.existsSync(candidateCwd) && fs.statSync(candidateCwd).isFile()) {
        return candidateCwd;
    }
    return null;
}

function handleRequest(req, res) {
    const parsedUrl = new URL(req.url, 'http://localhost');
    let reqUrl = parsedUrl.pathname;

    if (reqUrl === '') reqUrl = '/';

    const targetFile = resolveFilePath(reqUrl);

    if (targetFile) {
        const ext = path.extname(targetFile).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const isStatic = ext !== '.html';
        const cacheControl = isStatic ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';

        fs.readFile(targetFile, (err, content) => {
            if (!err) {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': cacheControl,
                    'X-Content-Type-Options': 'nosniff'
                });
                res.end(content);
                return;
            }

            if (INLINE_ASSETS[reqUrl]) {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': cacheControl,
                    'X-Content-Type-Options': 'nosniff'
                });
                res.end(INLINE_ASSETS[reqUrl]);
                return;
            }

            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Server Error: ' + err.code);
        });
        return;
    }

    if (INLINE_ASSETS[reqUrl]) {
        const ext = path.extname(reqUrl).toLowerCase() || '.html';
        const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';
        const isStatic = ext !== '.html';
        const cacheControl = isStatic ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': cacheControl,
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(INLINE_ASSETS[reqUrl]);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + reqUrl);
}

module.exports = (req, res) => handleRequest(req, res);

if (require.main === module) {
    const server = http.createServer(handleRequest);
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(\`Port \${PORT} in use, trying \${PORT + 1}...\`);
            server.listen(PORT + 1);
        } else {
            console.error('Server error:', err);
        }
    });
    server.listen(PORT, () => {
        console.log(\`Street Runner server running at http://localhost:\${PORT}/\`);
    });
}
`;

fs.writeFileSync(path.join(__dirname, 'server.js'), template);
console.log('Successfully updated server.js with refreshed inline assets!');
