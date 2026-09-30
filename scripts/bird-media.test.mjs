import test from 'node:test';
import assert from 'node:assert/strict';
import {photoFromInat,fromCommons,eligible,selectMedia,allowedUrl,appendMedia,identity} from './bird-media.mjs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const bird={scientific:'Accipiter striatus',taxonId:5097};
const obs={id:1,quality_grade:'research',taxon:{id:5097,name:bird.scientific},geojson:{coordinates:[-99.2824,19.3525]},place_ids:[6793]};
const photo={id:1,license_code:'cc-by',attribution:'(c) Author, some rights reserved (CC BY)',url:'https://static.inaturalist.org/photos/1/square.jpg',original_dimensions:{width:2048,height:1365}};
test('Exact research identity, per-file licenses and obscured coordinates',()=>{
 const p=photoFromInat(obs,photo,bird);assert.equal(p.local,true);assert.equal(p.distanceFromUamKm,0);assert.equal(eligible(p).license,'CC BY 4.0');
 assert.equal(photoFromInat({...obs,taxon:{id:4,name:'Other bird'}},photo,bird),null);
 const hidden=photoFromInat({...obs,obscured:true},photo,bird);assert.equal(hidden.local,false);assert.equal(hidden.latitude,null);assert.equal(hidden.distanceFromUamKm,null);
 for(const rawLicense of [null,'all-rights-reserved','cc-by-nd','cc-by-nc-nd','cc-by-nc'])assert.ok(eligible({...p,rawLicense}).rejection);
 assert.equal(eligible({...p,rawLicense:'cc-by-nc'},{allowNc:true}).rejection,null);
});
test('Commons incidental species mentions are rejected; per-file API license accepted',()=>{
 const p={pageid:1,title:'File:Other bird.webm',imageinfo:[{url:'https://upload.wikimedia.org/example.webm',mime:'video/webm',extmetadata:{ImageDescription:{value:'Accipiter striatus seen far away'},Artist:{value:'Author'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]};
 assert.equal(fromCommons(p,bird,'video'),null);
 const c=fromCommons({...p,title:'File:Accipiter striatus flying.webm'},bird,'video');assert.equal(c.type,'flight');assert.equal(eligible(c).license,'CC BY-SA 4.0');
 assert.equal(allowedUrl('https://youtube.com/movie.mp4','wikimedia-commons'),false);
 assert.equal(allowedUrl('https://upload.wikimedia.org.evil.test/x','wikimedia-commons'),false);
});
test('Selection honors geographic tiers, slot limits, observation diversity and repeat runs',()=>{
 const base=eligible(photoFromInat(obs,photo,bird));
 const candidates=Array.from({length:12},(_,n)=>({...base,sourceId:String(n),observationId:n,local:n<5,geoTier:n<5?0:n<8?1:4}));
 const selected=selectMedia(candidates,{});assert.equal(selected.length,4);assert.equal(selected.filter(c=>c.local).length,2);assert.ok(selected.filter(c=>!c.local).every(c=>c.geoTier===1));
 assert.equal(selectMedia(candidates,{photos:selected}).length,0);
 assert.equal(new Set(selected.map(identity)).size,4);
 assert.ok(!selectMedia(candidates,{mediaReview:{rejected:[candidates[0]]}}).some(c=>identity(c)===identity(candidates[0])));
 assert.equal(selectMedia(candidates.map(c=>({...c,observationId:1})),{}).length,2);
});
test('Atomic append preserves audio and refuses stale writes and duplicate identities',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bird-media-')),file=path.join(dir,'ave.json');
 try{const raw=JSON.stringify({audio:[{file:'audio/keep.mp3'}]});await writeFile(file,raw);const c={kind:'photo',source:'inaturalist',sourceId:'1'};
 const next=await appendMedia(file,raw,c);assert.equal(JSON.parse(next).audio[0].file,'audio/keep.mp3');
 await assert.rejects(appendMedia(file,raw,{...c,sourceId:'2'}),/changed/);await assert.rejects(appendMedia(file,next,c),/Duplicate/);assert.equal(await readFile(file,'utf8'),next);
 }finally{await rm(dir,{recursive:true,force:true})}
});
