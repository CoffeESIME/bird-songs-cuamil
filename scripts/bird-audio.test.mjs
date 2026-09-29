import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {distanceFromUam,enrich,licenseInfo,normalizeType,normalizeXc,normalizeInat,selectCandidates,audioExtension,downloadAudio,updateBird,searchXc,hasDownloadUrl} from './bird-audio.mjs';
import {options} from './download-bird-audio.mjs';

test('coordinates: missing, zero, invalid and exact radius are not confused',()=>{
 assert.equal(distanceFromUam(null,null),null);assert.equal(distanceFromUam('',''),null);
 assert.equal(distanceFromUam(100,0),null);assert.equal(distanceFromUam(19.3525,-99.2824),0);
 assert.ok(distanceFromUam(0,0)>1000);
 assert.equal(enrich({latitude:null,longitude:null}).local,false);
 assert.equal(enrich({latitude:19.3525+5.0001/6371*180/Math.PI,longitude:-99.2824}).local,false);
});
test('per-recording licenses, exact raw values, ND opt-in and commercial filter',()=>{
 for(const raw of [null,'all rights reserved','unknown','cc-by-evil']) assert.equal(licenseInfo(raw,'inaturalist'),null);
 assert.equal(licenseInfo('cc-by-nc','inaturalist',{commercial:true}),null);
 assert.equal(licenseInfo('cc-by-nd','inaturalist'),null);
 assert.equal(licenseInfo('cc-by-nd','inaturalist',{allowNd:true}).derivativesAllowed,false);
 const raw='https://creativecommons.org/licenses/by-nc-sa/3.0/';
 assert.equal(licenseInfo(raw,'xeno-canto').license,raw);
 assert.equal(licenseInfo('https://creativecommons.org/licenses/by-sa/2.5/','xeno-canto').licenseLabel,'CC BY-SA 2.5');
 assert.equal(licenseInfo(raw.replace('creativecommons.org','evil.test'),'xeno-canto'),null);
 assert.equal(licenseInfo('cc0','inaturalist').licenseUrl,'https://creativecommons.org/publicdomain/zero/1.0/');
});
test('no guessed labels, scientific matches, or precise obscured coordinates',()=>{
 assert.equal(normalizeType('alarm call'),'alarm');assert.equal(normalizeType('flight call'),'flight_call');
 assert.equal(normalizeType('possibly song?'),'other');
 const xc={gen:'Accipiter',sp:'striatus',status:'questioned'};
 assert.equal(normalizeXc(xc,'Accipiter striatus'),null);
 assert.equal(normalizeXc({...xc,status:'identified'},'Accipiter cooperii'),null);
 const bird={taxonId:5097,scientific:'Accipiter striatus'},sound={id:1,file_url:'https://example.org/a.mp3',license_code:'cc-by',attribution:'(c) Actual Author, some rights reserved (CC BY)'};
 const obs={id:1,quality_grade:'research',taxon:{id:5097,name:bird.scientific},user:{login:'uploader'},obscured:true,geojson:{coordinates:[-99.2824,19.3525]}};
 const c=normalizeInat(obs,sound,bird);assert.equal(c.recordist,'Actual Author');assert.equal(c.type,'other');assert.equal(c.local,false);assert.equal(c.latitude,null);
 assert.equal(normalizeInat({...obs,taxon:{id:5097,name:'Different bird'}},sound,bird),null);
 assert.equal(normalizeInat({...obs,quality_grade:'needs_id'},sound,bird),null);
});
test('ranking prefers nearby eligible audio, quality, diversity and deduplicates stable IDs',()=>{
 const base={source:'xeno-canto',type:'call',country:'Mexico',quality:'A'};
 const distant={...base,sourceId:'1',local:false},local={...base,sourceId:'2',local:true,quality:'B'},song={...local,sourceId:'3',type:'song'};
 assert.deepEqual(selectCandidates([distant,local,local,song],[],2).map(c=>c.sourceId),['2','3']);
 assert.deepEqual(selectCandidates([local,song],[local],1),[]);
 assert.deepEqual(selectCandidates([local,song],[local],2).map(c=>c.sourceId),['3']);
});
test('XC v3 pagination uses quoted scientific name and records truncation',async()=>{
 const calls=[],warnings=[];
 await searchXc({scientific:'Accipiter striatus'},{key:'private-test',maxPages:2,json:async u=>{calls.push(u);return {numPages:3,recordings:[]}}},warnings);
 assert.equal(calls.length,6);assert.equal(warnings.length,3);
 assert.ok(calls.every(u=>u.pathname==='/api/3/recordings'&&u.searchParams.get('query').startsWith('sp:"Accipiter striatus"')));
});
test('download rejects HTML and stores original bytes without collisions; updates preserve unrelated fields',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bird-audio-'));
 try {
  const candidate={source:'xeno-canto',sourceId:'XC1',type:'call',audioUrl:'https://example.org/audio'};
  await assert.rejects(downloadAudio(candidate,dir,{fetcher:async()=>new Response('<html>bad</html>')}),/supported audio/);
  const bytes=Buffer.from('ID3original-test-bytes');
  await mkdir(path.join(dir,'audio'));await writeFile(path.join(dir,'audio/call-01.mp3'),'existing');
  const recording=await downloadAudio(candidate,dir,{fetcher:async()=>new Response(bytes)});
  assert.equal(recording.file,'audio/call-02.mp3');assert.deepEqual(await readFile(path.join(dir,recording.file)),bytes);
  const file=path.join(dir,'ave.json'), raw=JSON.stringify({id:'test',scientific:'Test bird',custom:{keep:true}});await writeFile(file,raw);
  await updateBird(file,raw,recording);const updated=JSON.parse(await readFile(file));assert.deepEqual(updated.custom,{keep:true});assert.equal(updated.audio.length,1);
  await assert.rejects(updateBird(file,raw,recording),/changed during import/);
  assert.ok(!(await readdir(path.join(dir,'audio'))).some(f=>f.startsWith('.import')));
 } finally {await rm(dir,{recursive:true,force:true})}
 assert.throws(()=>audioExtension(Buffer.from('not audio')));
});
test('CLI defaults are safe and selection is explicit',()=>{
 assert.throws(()=>options([]));assert.throws(()=>options(['--all','--bird','x']));assert.throws(()=>options(['--all','--limit','0']));
 assert.equal(options(['--bird','a','--bird','b','--dry-run']).bird.length,2);
 assert.equal(options(['--all','--source','xeno-canto']).source,'xeno-canto');
 assert.throws(()=>options(['--all','--source','unknown']));
});
test('unavailable recordings are excluded before selection even if licensed',()=>{
 for(const audioUrl of [null,undefined,'','//example.org/audio','http://example.org/audio','not a URL']) assert.equal(hasDownloadUrl({audioUrl}),false);
 assert.equal(hasDownloadUrl({audioUrl:'https://xeno-canto.org/123/download'}),true);
});
