const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const port = Number(process.env.PORT || 8765);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain; charset=utf-8', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' };
http.createServer((request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/') { response.writeHead(302, { Location: '/app/index.html' + url.search }).end(); return; }
        const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        const relative = path.relative(root, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
        if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404).end(); return; }
        response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        fs.createReadStream(target).pipe(response);
    } catch { response.writeHead(400).end(); }
}).listen(port, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + port));
