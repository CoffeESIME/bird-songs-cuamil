import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {licenseInfo,identity,distanceFromUam,audioExtension} from './bird-audio.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const report={validatedAt:new Date().toISOString(),speciesProcessed:0,speciesWithAudio:0,speciesWithoutAudio:[],audioFiles:0,bytes:0,local:0,bySource:{},errors:[]};
for(const entry of await readdir(path.join(root,'dist/content'),{withFileTypes:true})) {
 if(!entry.isDirectory()) continue;
 report.speciesProcessed++;
 try {
  const dir=path.join(root,'dist/content',entry.name),bird=JSON.parse(await readFile(path.join(dir,'ave.json'),'utf8'));
  const previous=spawnSync('git',['show',`HEAD:dist/content/${entry.name}/ave.json`],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.equal(previous.status,0,`Cannot compare original metadata: ${entry.name}`);
  const {audio=[],...other}=bird,{audio:originalAudio,...originalFields}=JSON.parse(previous.stdout);
  assert.deepEqual(other,originalFields,'Non-audio metadata changed');assert.ok(audio.length<=3);
  assert.equal(new Set(audio.map(identity)).size,audio.length,'Duplicate source recording');
  if(audio.length) report.speciesWithAudio++;else report.speciesWithoutAudio.push({id:bird.id,scientific:bird.scientific,rank:bird.rank});
  const audioNames=await readdir(path.join(dir,'audio'));
  assert.equal(audioNames.length,audio.length,'Unregistered or missing file in audio directory');
  for(const c of audio) {
   for(const key of ['source','sourceId','sourceUrl','recordist','license','licenseUrl','file','downloadedAt','sha256']) assert.ok(c[key],`Missing ${key}`);
   assert.ok(licenseInfo(c.license,c.source),'Unaccepted license');assert.equal(c.derivativesAllowed,true);
   const full=path.resolve(dir,c.file);assert.ok(full.startsWith(path.resolve(dir)+path.sep));
   const bytes=await readFile(full);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256,'SHA256 mismatch');
   assert.equal(bytes.length,c.bytes);assert.equal(audioExtension(bytes),path.extname(c.file));
   assert.equal(c.validation,'ffmpeg decode','File was not validated by ffmpeg');
   const distance=distanceFromUam(c.latitude,c.longitude);
   assert.equal(c.local,distance!==null&&distance<=5);
   if(distance===null) assert.equal(c.distanceFromUamKm,null);else assert.ok(Math.abs(c.distanceFromUamKm-distance)<0.001);
   report.audioFiles++;report.bytes+=bytes.length;report.local+=Number(c.local);
   report.bySource[c.source]=(report.bySource[c.source]||0)+1;
  }
 } catch(e) {report.errors.push({id:entry.name,message:e.message})}
}
report.completedAt=new Date().toISOString();
await writeFile(path.join(root,'dist/audio-import-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.errors.length) process.exitCode=1;
