import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { analyze } from './analyze.js';

const PORT = Number(process.env.PORT ?? 3000);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? 2);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.static(publicDir));

let running = 0;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, running });
});

app.post('/api/analyze', async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== 'string' || !url.trim() || url.length > 2048) {
    res.status(400).json({ error: 'Send a JSON body like { "url": "https://example.com" }.' });
    return;
  }
  if (running >= MAX_CONCURRENT) {
    res.status(429).json({ error: 'Analyzer is busy. Try again in a moment.' });
    return;
  }
  running++;
  try {
    res.json(await analyze(url));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    running--;
  }
});

app.listen(PORT, () => {
  console.log(`Site Recon running at http://localhost:${PORT}`);
});
