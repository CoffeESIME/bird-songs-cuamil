import {readFile,writeFile,mkdir,open,unlink,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {getSpecies,readBird} from './bird-audio.mjs';
import {cachedJson,searchPhotos,searchCommons,eligible,selectMedia,identity,downloadMedia,appendMedia} from './bird-media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export function options(args) {
  const {values:v}=parseArgs({args,options:{all:{type:'boolean'},missing:{type:'boolean'},bird:{type:'string',multiple:true},'dry-run':{type:'boolean'},'allow-nc':{type:'boolean'},'max-pages':{type:'string',default:'1'},refresh:{type:'boolean'},report:{type:'string'},plan:{type:'string'},help:{type:'boolean'}}});
  if(!v.help&&Number(!!v.all)+Number(!!v.missing)+Number(!!v.bird?.length)!==1)throw Error('Choose --all, --missing, or --bird ID (repeatable)');
  if(!/^[1-3]$/.test(v['max-pages']))throw Error('--max-pages must be 1–3');
  return {...v,allowNc:!!v['allow-nc'],maxPages:Number(v['max-pages'])};
}
async function checkExisting(bird,dir) {
  const seen=new Set();
  for(const key of ['photos','videos']) {
    if(bird[key]!==undefined&&!Array.isArray(bird[key]))throw Error(`${key} must be an array`);
    for(const c of bird[key]||[]) {
      if(!c.file)throw Error('Existing media lacks path');
      const f=path.resolve(dir,c.file);if(!f.startsWith(path.resolve(dir)+path.sep)||!(await stat(f)).isFile())throw Error('Invalid existing media path');
      if(c.source&&c.sourceId){if(seen.has(identity(c)))throw Error('Duplicate existing source identity');seen.add(identity(c))}
    }
  }
}
export async function main(args=process.argv.slice(2)) {
  const opts=options(args);if(opts.help){console.log('birds:media --bird ID [--bird ID] | --all | --missing [--dry-run] [--allow-nc] [--report FILE] [--plan DRY_RUN_REPORT] [--refresh] [--max-pages 1..3]');return}
  const plan=opts.plan?JSON.parse(await readFile(path.resolve(opts.plan),'utf8')):null;
  if(plan&&!plan.dryRun)throw Error('--plan requires a dry-run report');
  const report={version:1,dryRun:!!opts['dry-run'],createdAt:new Date().toISOString(),species:[]};
  const json=cachedJson(path.join(root,'.media-cache'),opts),lock=path.join(root,'.media-import.lock');
  let handle;
  if(!opts['dry-run'])handle=await open(lock,'wx');
  try {
    for(const entry of await getSpecies(path.join(root,'dist/content'),opts.bird||[])) {
      const item={id:entry.id,candidates:[],selected:[],downloaded:[],warnings:[],errors:[]};report.species.push(item);
      try {
        let {bird,raw,file}=await readBird(entry);item.scientific=bird.scientific;await checkExisting(bird,entry.dir);
        if(bird.rank!=='species'){item.warnings.push('Skipped: not a species');continue}
        if(opts.missing&&(bird.photos||[]).length&&(bird.videos||[]).length){item.skipped=true;continue}
        if((bird.photos||[]).filter(c=>c.local).length>=2&&(bird.photos||[]).filter(c=>!c.local).length>=2&&(bird.videos||[]).length>=3){item.skipped=true;continue}
        if(plan){
          const planned=plan.species.find(s=>s.id===bird.id&&s.scientific===bird.scientific);if(!planned)throw Error('Species not present in reviewed plan');
          item.candidates=planned.selected.map(c=>eligible(c,opts));
        }else{
          const candidates=[];
          for(const [source,search] of [['inaturalist',searchPhotos],['wikimedia-commons',searchCommons]])try{candidates.push(...await search(bird,json,item.warnings,opts))}catch(e){item.errors.push(`${source}: ${e.message}`)}
          item.candidates=[...new Map(candidates.map(c=>[identity(c),c])).values()].map(c=>eligible(c,opts));
        }
        if(opts.missing)item.candidates=item.candidates.filter(c=>c.kind==='photo'?!(bird.photos||[]).length:!(bird.videos||[]).length);
        item.selected=selectMedia(item.candidates,bird);
        console.log(`\n${bird.scientific}: ${item.candidates.filter(c=>c.kind==='photo').length} photos; ${item.candidates.filter(c=>c.kind==='video').length} videos; ${item.selected.length} selected`);
        for(const c of item.selected)console.log(` SELECT ${c.kind} ${identity(c)} | ${c.local?'LOCAL':'reference'} | ${c.distanceFromUamKm??'unknown'} km | ${c.author} | ${c.license} | ${c.width}x${c.height} | ${c.sourceUrl}`);
        if(!opts['dry-run'])for(const c of item.selected){
          let downloaded;
          try{downloaded=await downloadMedia(c,entry.dir);raw=await appendMedia(file,raw,downloaded);item.downloaded.push(downloaded)}
          catch(e){if(downloaded)await unlink(path.join(entry.dir,downloaded.file)).catch(()=>{});item.errors.push(`${identity(c)}: ${e.message}`)}
        }
      }catch(e){item.errors.push(e.message)}
      for(const error of item.errors)console.error(entry.id+': '+error);
    }
    report.summary={species:report.species.length,selected:report.species.reduce((n,s)=>n+s.selected.length,0),downloaded:report.species.reduce((n,s)=>n+s.downloaded.length,0),errors:report.species.reduce((n,s)=>n+s.errors.length,0)};
    const target=path.resolve(opts.report||path.join(root,'reports',opts['dry-run']?'media-dry-run.json':'media-import.json'));
    await mkdir(path.dirname(target),{recursive:true});await writeFile(target,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report.summary));console.log('Full candidates, rejections and selections: '+target);
    if(report.summary.errors)process.exitCode=1;return report;
  }finally{if(handle){await handle.close();await unlink(lock)}}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1});
