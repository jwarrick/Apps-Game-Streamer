import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8765;
const OUT_DIR = path.join(process.cwd(), 'recovered_videos');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // Enable CORS for all origins (including gamestreamer-live.web.app)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Clip-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url.startsWith('/status')) {
    const files = fs.readdirSync(OUT_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready', port: PORT, recoveredFiles: files }));
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/upload')) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const filename = urlObj.searchParams.get('name') || req.headers['x-filename'] || `clip_${Date.now()}.mp4`;
    const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, '_');
    const targetPath = path.join(OUT_DIR, cleanFilename);

    console.log(`[RecoveryServer] Receiving: ${cleanFilename}...`);
    const fileStream = fs.createWriteStream(targetPath);

    req.pipe(fileStream);

    req.on('end', () => {
      fileStream.close(() => {
        const stats = fs.statSync(targetPath);
        console.log(`[RecoveryServer] ✓ Saved: ${cleanFilename} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename: cleanFilename, sizeBytes: stats.size }));
      });
    });

    req.on('error', (err) => {
      console.error('[RecoveryServer] Receive error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Emergency Recovery Server RUNNING at:`);
  console.log(`   http://192.168.1.86:${PORT}/status`);
  console.log(`   Saving recovered clips to: ${OUT_DIR}`);
  console.log(`======================================================\n`);
});
