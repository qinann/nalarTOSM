/**
 * TOSM Local Dev Server
 * Jalankan: node server.cjs
 * Lalu buka: http://localhost:8080
 */
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html' : 'text/html; charset=utf-8',
  '.js'   : 'application/javascript',
  '.mjs'  : 'application/javascript',
  '.cjs'  : 'application/javascript',
  '.css'  : 'text/css',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.ico'  : 'image/x-icon',
  '.svg'  : 'image/svg+xml',
  '.glb'  : 'model/gltf-binary',
  '.gltf' : 'model/gltf+json',
  '.wasm' : 'application/wasm',
  '.data' : 'application/octet-stream',
  '.br'   : 'application/octet-stream',
  '.gz'   : 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // Security: don't serve outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    // Unity WebGL needs these headers for SharedArrayBuffer / WASM streaming
    res.writeHead(200, {
      'Content-Type'               : mime,
      'Cross-Origin-Opener-Policy' : 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control'              : 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ✅  TOSM Server berjalan di:');
  console.log(`     http://localhost:${PORT}`);
  console.log('');
  console.log('  Halaman yang tersedia:');
  console.log(`     http://localhost:${PORT}/animasi-modul1.html`);
  console.log(`     http://localhost:${PORT}/index.html`);
  console.log('');
  console.log('  Tekan Ctrl+C untuk berhenti.');
  console.log('');
});
