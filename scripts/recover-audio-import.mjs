// Retry incomplete species using the already-reviewed candidates in the report.
// Original failures remain in the report as history; no new taxonomic assumptions.
import {readFile,writeFile,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {identity,licenseInfo,hasDownloadUrl,selectCandidates,downloadAudio,updateBird,existingAudio} from './bird-audio.mjs';
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const file=path.join(dist,'audio-import-report.json'),lock=path.join(dist,'.audio-import.lock');
const handle=await open(lock,'wx');
try {
 const report=JSON.parse(await readFile(file,'utf8'));
 report.recovery ||= [];
 for(const item of report.species.filter(s=>s.errors.length)) {
  const dir=path.join(dist,'content',item.id),metadataFile=path.join(dir,'ave.json');
  let raw=await readFile(metadataFile,'utf8'),bird=JSON.parse(raw),existing=await existingAudio(bird,dir);
  if(existing.length>=3) continue;
  const attempt={id:item.id,downloaded:[],errors:[],unavailable:[],startedAt:new Date().toISOString()};
  report.recovery.push(attempt);
  const candidates=item.candidates.filter(c=>!c.rejection&&hasDownloadUrl(c)&&licenseInfo(c.license,c.source));
  const bad=new Set(item.errors.filter(e=>/Invalid URL|Audio exceeds|decode validation/.test(e.message)).map(e=>e.sourceId));
  const tried=new Set(candidates.filter(c=>bad.has(c.sourceId)).map(identity));
  for(let n=0;n<6&&existing.length<3;n++) {
   const c=selectCandidates(candidates.filter(c=>!tried.has(identity(c))),existing,3)[0];
   if(!c) break;
   tried.add(identity(c));let recording;
   try {
    const {rejection,...candidate}=c;
    recording=await downloadAudio(candidate,dir,{decode:true});
    raw=await updateBird(metadataFile,raw,recording);existing.push(recording);
    item.downloaded.push(recording);attempt.downloaded.push(recording);
    console.log(`Recovered ${item.id}: ${identity(c)} -> ${recording.file}`);
   } catch(e) {
    if(recording) await unlink(path.join(dir,recording.file)).catch(()=>{});
    attempt.errors.push({source:c.source,sourceId:c.sourceId,message:e.message});console.warn(`Recovery: ${item.id}: ${e.message}`);
   }
  }
  attempt.finalAudioCount=existing.length;
  attempt.finishedAt=new Date().toISOString();
  console.log(`${item.id}: ${existing.length} recordings after recovery`);
 }
 const all=report.species.flatMap(s=>s.downloaded);
 report.summary.audioDownloaded=all.length;
 report.summary.speciesWithAudio=report.species.filter(s=>s.existing+s.downloaded.length>0).length;
 report.summary.speciesWithoutAudio=report.species.length-report.summary.speciesWithAudio;
 report.summary.recoveryDownloaded=report.recovery.reduce((n,r)=>n+r.downloaded.length,0);
 report.summary.recoveryErrors=report.recovery.reduce((n,r)=>n+r.errors.length,0);
 report.summary.local=all.filter(c=>c.local).length;
 report.summary.cdmx=all.filter(c=>c.local||/cuajimalpa|ciudad de mexico|mexico city|distrito federal|cdmx/i.test((c.location||'').normalize('NFD').replace(/\p{Diacritic}/gu,''))).length;
 report.summary.mexico=all.filter(c=>c.country==='Mexico').length;
 report.summary.otherCountries=all.filter(c=>c.country&&c.country!=='Mexico').length;
 report.summary.unknownCountry=all.filter(c=>!c.country).length;
 report.speciesWithoutAudio=report.species.filter(s=>s.existing+s.downloaded.length===0).map(s=>s.id);
 report.localRecordings=all.filter(c=>c.local);
 report.recoveredAt=new Date().toISOString();
 await writeFile(file,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.summary,null,2));
} finally {await handle.close();await unlink(lock)}
