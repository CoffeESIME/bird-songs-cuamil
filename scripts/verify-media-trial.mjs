import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {identity} from './bird-media.mjs';
import {distanceFromUam,licenseInfo} from './bird-audio.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const report={createdAt:new Date().toISOString(),species:[],errors:[]};
for(const id of ['accipiter-striatus','turdus-migratorius','zenaida-macroura']) {
 const dir=path.join(root,'dist/content',id),bird=JSON.parse(await readFile(path.join(dir,'ave.json'),'utf8'));
 const media=[...(bird.photos||[]),...(bird.videos||[])],ids=new Set(),hashes=new Set();
 for(const c of media) {
  assert.ok(!ids.has(identity(c)));ids.add(identity(c));
  for(const field of ['file','author','source','sourceId','sourceUrl','originalUrl','license','licenseUrl','downloadedAt'])assert.ok(c[field],`${id}: missing ${field}`);
  assert.ok(licenseInfo(c.licenseUrl,'wikimedia-commons'));
  const full=path.resolve(dir,c.file);assert.ok(full.startsWith(dir+path.sep));
  const hash=createHash('sha256').update(await readFile(full)).digest('hex');assert.equal(hash,c.sha256);assert.ok(!hashes.has(hash));hashes.add(hash);
  assert.equal(c.validation,'ffmpeg full decode');
  assert.equal(c.local,distanceFromUam(c.latitude,c.longitude)!==null&&distanceFromUam(c.latitude,c.longitude)<=5);
  if(c.coordinatesObscured){assert.equal(c.latitude,null);assert.equal(c.longitude,null)}
 }
 assert.ok((bird.photos||[]).filter(c=>c.local).length<=2);assert.ok((bird.photos||[]).filter(c=>!c.local).length<=2);assert.ok((bird.videos||[]).length<=3);
 for(const folder of ['fotos','videos'])for(const name of await readdir(path.join(dir,folder)))assert.ok(media.some(c=>c.file===folder+'/'+name),`Unregistered trial file: ${id}/${folder}/${name}`);
 report.species.push({id,photos:bird.photos?.length||0,videos:bird.videos?.length||0,local:bird.photos?.filter(c=>c.local).length||0,attributionsComplete:true,jsonValid:true,noDuplicates:true,hashesVerified:true,files:media.map(c=>({file:c.file,source:c.source,sourceId:c.sourceId,sha256:c.sha256,decode:c.validation}))});
}
await writeFile(path.join(root,'reports/media-trial-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.species.map(({files,...s})=>s),null,2));
