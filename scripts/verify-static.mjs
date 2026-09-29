// No compilation is needed. Fail deployment if a referenced local asset is missing.
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateAnalysis} from '../dist/analysis-data.js';
const {birds} = JSON.parse(await readFile(new URL('../dist/content-index.json',import.meta.url),'utf8'));
const uiSounds={};

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const assets = new Set(['index.html', 'app.js', 'style.css', 'catalog.js', 'acoustic.js','analysis-data.js','content-view.js','embeds.js','content-index.json','vendor/marked.js','vendor/purify.js']);
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\.\/$)/i.test(ref)) assets.add(ref);
}
for (const bird of birds) {
  for (const ref of [bird.cutout, bird.analysis, ...Object.values(bird.recordingAnalyses||{}), bird.audio, ...bird.recordings, ...bird.photos, ...bird.media.map(m => m.src)]) {
    if (ref) assets.add(ref);
  }
}
for (const ref of Object.values(uiSounds)) if (ref) assets.add(ref);
let bytes = 0;
for (const ref of assets) {
  if (/^https?:\/\//i.test(ref)) throw new Error(`Use a local asset for reliable audio analysis: ${ref}`);
  const resolved = path.resolve(root, decodeURIComponent(ref.split(/[?#]/)[0]));
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Asset outside dist: ${ref}`);
  const info = await stat(resolved);
  if (!info.isFile() || info.size === 0) throw new Error(`Missing or empty asset: ${ref}`);
  bytes += info.size;
}
for (const bird of birds) {
  for(const [sound,analysisFile] of Object.entries(bird.recordingAnalyses||{})) {
    const raw=await readFile(path.join(root,decodeURIComponent(analysisFile)));
    const data=validateAnalysis(JSON.parse(raw));
    const credit=bird.audioCredits.find(c=>sound===bird.contentPath+c.file.split('/').map(encodeURIComponent).join('/'));
    const sourceBytes=await readFile(path.join(root,decodeURIComponent(sound)));
    if(!credit||data.version!==2||raw.length>350000||data.sourceFile!==credit.file||data.sourceSha256!==createHash('sha256').update(sourceBytes).digest('hex')||credit.analysisSha256!==createHash('sha256').update(raw).digest('hex')) throw Error(`Stale or mismatched analysis: ${analysisFile}`);
  }
  if(!bird.analysis)continue;
  const data = JSON.parse(await readFile(path.join(root, decodeURIComponent(bird.analysis)), 'utf8'));
  if (!(data.duration > 0) || !(data.sampleRate > 0) || !(data.hop > 0)
      || !data.spectrogram?.length || !data.nodes?.length || !data.envelope?.length
      || data.spectrogram.some(row => row.length !== data.bands || row.some(n => !Number.isFinite(n)))
      || data.nodes.some(node => ['t', 'centroid', 'spread', 'rms'].some(key => !Number.isFinite(node[key])))) {
    throw new Error(`Invalid audio analysis: ${bird.analysis}`);
  }
}
console.log(`Ready for Vercel: ${birds.length} birds, ${assets.size} assets, ${(bytes / 1024 / 1024).toFixed(1)} MB referenced. Output: dist/`);
