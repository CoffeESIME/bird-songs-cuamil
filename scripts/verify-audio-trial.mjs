// Local, repeatable audit of the three initial imports; makes no API requests.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {main} from './download-bird-audio.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const ids=['accipiter-striatus','haemorhous-mexicanus','turdus-migratorius'];
const hash=b=>createHash('sha256').update(b).digest('hex');
async function snapshot() {
 const files={};
 for(const id of ids) {
  const dir=path.join(root,'dist/content',id);
  for(const f of ['ave.json',...(await readdir(path.join(dir,'audio'))).map(f=>'audio/'+f)]) files[`${id}/${f}`]=hash(await readFile(path.join(dir,f)));
 }
 return files;
}
const validation={validatedAt:new Date().toISOString(),recordings:[]};
let limit=0,totalRecordings=0;
for(const id of ids) {
 const dir=path.join(root,'dist/content',id),bird=JSON.parse(await readFile(path.join(dir,'ave.json'),'utf8'));
 const original=spawnSync('git',['show',`HEAD:dist/content/${id}/ave.json`],{cwd:root,encoding:'utf8',windowsHide:true});
 assert.equal(original.status,0);
 const {audio,...other}=bird;assert.deepEqual(other,JSON.parse(original.stdout));assert.ok(audio.length>=1&&audio.length<=3);
 limit=Math.max(limit,audio.length);totalRecordings+=audio.length;
 assert.equal(new Set(audio.map(c=>`${c.source}:${c.sourceId}`)).size,audio.length);
 assert.equal((await readdir(path.join(dir,'audio'))).length,audio.length);
 for(const c of audio) {
  for(const k of ['source','sourceId','sourceUrl','recordist','license','licenseUrl','file']) assert.ok(c[k],`${id}: ${k}`);
  const full=path.join(dir,c.file),bytes=await readFile(full);assert.equal(hash(bytes),c.sha256);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name','-of','json',full],{encoding:'utf8',windowsHide:true});
  assert.equal(probe.status,0);const info=JSON.parse(probe.stdout);assert.ok(Number(info.format.duration)>0);
  const expected={'.mp3':['mp3'],'.wav':['pcm_s16le','pcm_s24le','pcm_f32le'],'.m4a':['aac','alac']};
  assert.ok(expected[path.extname(c.file)]?.includes(info.streams[0].codec_name));
  validation.recordings.push({id,file:c.file,sourceId:c.sourceId,sha256:c.sha256,durationSeconds:Number(info.format.duration),codec:info.streams[0].codec_name,attributionComplete:true,originalFieldsPreserved:true});
 }
}
const before=await snapshot(),reportPath=path.join(root,'dist/audio-import-report.json'),originalReport=await readFile(reportPath);
assert.equal(totalRecordings,limit*ids.length,'Trial species must have equal recording counts to audit without API requests');
const args=ids.flatMap(id=>['--bird',id]).concat(['--limit',String(limit)]);
const dry=await main([...args,'--dry-run']);assert.equal(dry.summary.audioDownloaded,0);
assert.deepEqual(await snapshot(),before);assert.deepEqual(await readFile(reportPath),originalReport);
try {
 const second=await main(args);assert.equal(second.summary.audioDownloaded,0);assert.equal(second.summary.skippedExisting,totalRecordings);assert.deepEqual(await snapshot(),before);
 validation.idempotency={downloadedOnSecondRun:0,skippedExisting:totalRecordings,filesAndMetadataUnchanged:true,dryRunUnchanged:true};
} finally {await writeFile(reportPath,originalReport)}
await writeFile(path.join(root,'dist/audio-trial-validation.json'),JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify(validation,null,2));
