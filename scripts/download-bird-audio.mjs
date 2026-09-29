import {writeFile,open,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {getSpecies,readBird,existingAudio,searchXc,searchInat,licenseInfo,selectCandidates,compareCandidates,identity,region,downloadAudio,updateBird,hasDownloadUrl} from './bird-audio.mjs';

const dist=fileURLToPath(new URL('../dist/',import.meta.url));
export function options(args) {
  const {values:v}=parseArgs({args,options:{source:{type:'string',default:'both'},all:{type:'boolean'},bird:{type:'string',multiple:true},missing:{type:'boolean'},'dry-run':{type:'boolean'},limit:{type:'string',default:'3'},'max-pages':{type:'string',default:'5'},'allow-nd':{type:'boolean'},commercial:{type:'boolean'},'verify-decode':{type:'boolean'},help:{type:'boolean'}}});
  if(!v.help && Number(Boolean(v.all))+Number(Boolean(v.bird?.length))+Number(Boolean(v.missing))!==1) throw Error('Choose exactly one: --all, --missing, or --bird ID (repeatable).');
  if(!['both','xeno-canto','inaturalist'].includes(v.source)) throw Error('--source must be both, xeno-canto or inaturalist');
  if(!/^[1-3]$/.test(v.limit)) throw Error('--limit must be 1, 2 or 3 (total per species)');
  if(!/^\d+$/.test(v['max-pages'])||Number(v['max-pages'])<1||Number(v['max-pages'])>100) throw Error('--max-pages must be 1–100');
  return {...v,limit:Number(v.limit),maxPages:Number(v['max-pages']),allowNd:!!v['allow-nd']};
}
async function processBird(entry,opts,report) {
  const item={id:entry.id,candidates:[],selected:[],downloaded:[],warnings:[],errors:[],existing:0};report.species.push(item);
  try {
    let {bird,raw,file}=await readBird(entry);item.scientific=bird.scientific;
    const existing=await existingAudio(bird,entry.dir);item.existing=existing.length;
    if(opts.missing&&existing.length || existing.length>=opts.limit) {report.skippedExisting+=existing.length;item.skipped=true;return}
    if(bird.rank!=='species') {item.warnings.push('Not a species; no taxonomic match assumed.');return}
    const candidates=[];
    const sources=[...(process.env.XENO_CANTO_API_KEY&&opts.source!=='inaturalist'?[['xeno-canto',searchXc]]:[]),...(opts.source!=='xeno-canto'?[['inaturalist',searchInat]]:[])];
    for(const [source,search] of sources) {
      try {candidates.push(...await search(bird,{...opts,key:process.env.XENO_CANTO_API_KEY},item.warnings))} catch(e) {item.errors.push({source,message:e.message})}
    }
    const unique=[...new Map(candidates.map(c=>[identity(c),c])).values()];
    const accepted=[];
    for(const c of unique) {
      const lic=licenseInfo(c.license,c.source,opts);
      const rejection=!lic?'License not accepted':!hasDownloadUrl(c)?'Source does not provide an HTTPS download URL':!c.recordist||!c.sourceId||!c.sourceUrl?'Incomplete attribution':['D','E'].includes(c.quality)?'Low source quality':null;
      item.candidates.push({...c,...lic,rejection});
      if(!lic) report.licenseRejected++;
      if(!rejection) accepted.push({...c,...lic});
    }
    report.skippedExisting+=accepted.filter(c=>existing.some(e=>identity(e)===identity(c))).length;
    const selected=selectCandidates(accepted,existing,opts.limit);
    item.selected=selected.map(c=>({...c,reason:`geographic tier ${region(c)}; quality ${c.quality||'not rated'}; type ${c.originalType||'not supplied'}; reusable license; diversity within tier`}));
    console.log(`\n${bird.scientific}: ${unique.length} candidates, ${accepted.length} reusable/eligible, ${selected.length} selected`);
    const preview=[...item.selected,...item.candidates.filter(c=>!selected.some(s=>identity(s)===identity(c))).sort(compareCandidates).slice(0,8)];
    for(const c of preview) console.log(`  ${selected.some(s=>identity(s)===identity(c))?'SELECT':'candidate'} ${identity(c)} | ${c.recordist} | ${c.originalType||'type unknown'} | ${c.licenseLabel||c.license||'no license'} | ${c.location||'location unknown'} | ${c.distanceFromUamKm??'?'} km${c.rejection?' | REJECT '+c.rejection:''}${c.reason?' | '+c.reason+' | '+c.sourceUrl:''}`);
    if(unique.length>preview.length) console.log(`  ... ${unique.length-preview.length} further candidates (full list in the import report after downloading).`);
    if(!unique.length) item.warnings.push(`No audio found for ${bird.scientific}`);
    else if(!unique.some(c=>licenseInfo(c.license,c.source,opts))) item.warnings.push(`No reusable audio found for ${bird.scientific}`);
    else if(!accepted.length) item.warnings.push(`No eligible audio found for ${bird.scientific}`);
    if(!opts['dry-run']) for(const candidate of selected) {
      let recording;
      try {
        recording=await downloadAudio(candidate,entry.dir,{decode:opts['verify-decode']});
        raw=await updateBird(file,raw,recording);item.downloaded.push(recording);
      } catch(e) {
        if(recording) await unlink(path.join(entry.dir,recording.file)).catch(()=>{});
        item.errors.push({sourceId:candidate.sourceId,message:e.message});
      }
    }
  } catch(e) {item.errors.push({message:e.message})}
  finally {
    for(const w of item.warnings) console.warn(`WARNING: ${w}`);
    for(const e of item.errors) console.error(`ERROR: ${item.id}: ${e.message}`);
  }
}
export async function main(args=process.argv.slice(2)) {
  const opts=options(args);
  try {process.loadEnvFile(path.join(dist,'../.env'))} catch(e) {if(e.code!=='ENOENT') throw Error('Could not load aviario/.env (requires Node 20.12+).')}
  if(opts.help) {console.log('npm run birds:audio -- (--all | --missing | --bird ID [--bird ID]) [--source both|xeno-canto|inaturalist] [--dry-run] [--limit 1..3] [--max-pages 1..100] [--verify-decode] [--allow-nd] [--commercial]\nXENO_CANTO_API_KEY enables primary source API v3. ND excluded unless explicitly enabled; originals are never converted.');return}
  if(opts.source==='xeno-canto'&&!process.env.XENO_CANTO_API_KEY) throw Error('XENO_CANTO_API_KEY is required for --source xeno-canto');
  const report={sourceFilter:opts.source,startedAt:new Date().toISOString(),dryRun:!!opts['dry-run'],sources:{xenoCanto:process.env.XENO_CANTO_API_KEY?'enabled':'unavailable: XENO_CANTO_API_KEY not configured',inaturalist:opts.source==='xeno-canto'?'disabled':'enabled'},species:[],skippedExisting:0,licenseRejected:0};
  if(!process.env.XENO_CANTO_API_KEY) console.warn('WARNING: Xeno-canto API v3 requires XENO_CANTO_API_KEY; using iNaturalist.');
  const lock=path.join(dist,'.audio-import.lock');let handle;
  if(!opts['dry-run']) {try {handle=await open(lock,'wx')} catch(e) {if(e.code==='EEXIST') throw Error('Another audio import is running (dist/.audio-import.lock).');throw e}}
  try {
    for(const entry of await getSpecies(path.join(dist,'content'),opts.bird)) await processBird(entry,opts,report);
    const recordings=report.species.flatMap(s=>s.downloaded), selected=report.species.flatMap(s=>s.selected);
    report.summary={speciesProcessed:report.species.length,speciesWithAudio:report.species.filter(s=>s.existing+s.downloaded.length>0).length,speciesWithoutAudio:report.species.filter(s=>s.existing+s.downloaded.length===0).length,audioDownloaded:recordings.length,wouldDownload:opts['dry-run']?selected.length:0,local:recordings.filter(c=>c.local).length,cdmx:recordings.filter(c=>region(c)<=2).length,mexico:recordings.filter(c=>c.country==='Mexico').length,otherCountries:recordings.filter(c=>c.country&&c.country!=='Mexico').length,unknownCountry:recordings.filter(c=>!c.country).length,skippedExisting:report.skippedExisting,licenseRejected:report.licenseRejected,errors:report.species.reduce((n,s)=>n+s.errors.length,0)};
    report.speciesWithoutAudio=report.species.filter(s=>s.existing+s.downloaded.length===0).map(s=>s.id);
    report.licensesFound=[...new Set(report.species.flatMap(s=>s.candidates.map(c=>c.license)))];
    report.localRecordings=recordings.filter(c=>c.local);report.finishedAt=new Date().toISOString();
    console.log('\n========================================\nBird audio import\n'+JSON.stringify(report.summary,null,2)+'\n========================================');
    // Dry-run never writes a report or creates directories/locks.
    if(!opts['dry-run']) await writeFile(path.join(dist,'audio-import-report.json'),JSON.stringify(report,null,2)+'\n');
    if(report.summary.errors) process.exitCode=1;
    return report;
  } finally {if(handle) {await handle.close();await unlink(lock)}}
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1});
