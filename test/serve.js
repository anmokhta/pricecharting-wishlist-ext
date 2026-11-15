// Minimal static server for the repo root, so test/mockup.html can load
// ../extension/content.js. No dependencies. Usage: npm run mockup
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const GREY = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#ccc"/></svg>';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Card images in the fixtures (/img/<id>/60.jpg or 240.jpg): a grey square.
    if (urlPath.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end(GREY); return; }
    const file = path.resolve(root, '.' + (urlPath === '/' ? '/test/mockup.html' : urlPath));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(port, '127.0.0.1', () => console.log(`Mockup: http://localhost:${port}/test/mockup.html`));
