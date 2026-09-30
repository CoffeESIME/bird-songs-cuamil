import {readFile, writeFile, mkdir, rename, unlink, stat, copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {UAM, distanceFromUam, coordinate, licenseInfo, identity} from './bird-audio.mjs';

export {identity};
export const UA='Aviario-Media-Importer/1.0 (educational bird catalogue; sequential bounded requests)';
const fold=s=>String(s??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export const plain=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function allowedUrl(raw,source) {
  try {const u=new URL(raw);return u.protocol==='https:' && (source==='wikimedia-commons'?u.hostname==='upload.wikimedia.org':['inaturalist-open-data.s3.amazonaws.com','static.inaturalist.org'].includes(u.hostname))}catch{return false}
}
let last=0;
export async function request(url,{bytes=false,max=20*1024*1024}={}) {
  for(let n=0;n<3;n++) {
    await delay(Math.max(0,1100-(Date.now()-last)));last=Date.now();
    try {
      const r=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(bytes?120000:45000),redirect:'error'});
      if(!r.ok){const e=Error(`HTTP ${r.status}`);e.retry=r.status===429||r.status>=500;e.wait=Math.min(30000,Number(r.headers.get('retry-after'))*1000||0);await r.body?.cancel();throw e}
      if(!bytes){const d=await r.json();if(d.error)throw Error(d.error.info||d.error.code);return d}
      if(Number(r.headers.get('content-length'))>max){await r.body.cancel();throw Object.assign(Error('File exceeds size limit'),{retry:false})}
      const chunks=[];let size=0;
      for await(const b of r.body){size+=b.length;if(size>max)throw Object.assign(Error('File exceeds size limit'),{retry:false});chunks.push(b)}
      return Buffer.concat(chunks);
    }catch(e){if(n===2||e.retry===false)throw e;await delay(Math.max(e.wait||0,2000*2**n))}
  }
}
export function cachedJson(folder,{refresh=false}={}) {
  return async url=>{
    const file=path.join(folder,createHash('sha256').update(String(url)).digest('hex')+'.json');
    if(!refresh)try{const c=JSON.parse(await readFile(file,'utf8'));if(Date.now()-c.time<86400000)return c.data}catch{}
    const data=await request(url);await mkdir(folder,{recursive:true});await writeFile(file,JSON.stringify({time:Date.now(),data}));return data;
  };
}
const endpoint=(base,args)=>{const u=new URL(base);u.search=new URLSearchParams(args);return u};
export function photoFromInat(o,p,bird) {
  if(o.quality_grade!=='research'||o.captive||o.taxon?.is_active===false||o.taxon?.id!==bird.taxonId||fold(o.taxon?.name)!==fold(bird.scientific)||p.hidden||p.flags?.length||!p.id||!p.url)return null;
  const obscured=!!o.obscured||[o.geoprivacy,o.taxon_geoprivacy].some(v=>['private','obscured'].includes(v));
  const coords=obscured?[]:o.geojson?.coordinates||[];
  const latitude=coordinate(coords[1],90),longitude=coordinate(coords[0],180),distance=distanceFromUam(latitude,longitude);
  const ids=o.place_ids||[];
  const author=p.attribution_name||p.attribution?.match(/^\(c\) (.+?), some rights reserved/i)?.[1]||p.attribution?.match(/uploaded by (.+)$/i)?.[1];
  return {kind:'photo',source:'inaturalist',sourceId:String(p.id),sourceUrl:`https://www.inaturalist.org/photos/${p.id}`,observationUrl:`https://www.inaturalist.org/observations/${o.id}`,observationId:o.id,
    scientificName:bird.scientific,author:author||null,attribution:p.attribution||null,rawLicense:p.license_code,
    originalUrl:p.url.replace(/\/square\./,'/original.'),latitude,longitude,distanceFromUamKm:distance===null?null:Math.round(distance*1000)/1000,local:distance!==null&&distance<=5,coordinatesObscured:obscured,
    location:o.place_guess||null,geoTier:distance!==null&&distance<=5?0:ids.includes(59040)?1:ids.includes(59014)?2:ids.includes(6793)?3:5,
    width:p.original_dimensions?.width||null,height:p.original_dimensions?.height||null,favorites:o.faves_count||0,taxonomicEvidence:'Research grade; exact active species ID and scientific name',visualReview:'pending'};
}
export async function searchPhotos(bird,json,warnings,{maxPages=1}={}) {
  const taxa=await json(endpoint('https://api.inaturalist.org/v1/taxa',{q:bird.scientific,rank:'species',per_page:'30'}));
  const exact=taxa.results?.filter(t=>fold(t.name)===fold(bird.scientific)&&t.is_active!==false&&t.rank==='species')||[];
  const t=exact.find(t=>t.id===bird.taxonId)||(exact.length===1?exact[0]:null);
  if(!t){warnings.push('No exact active scientific name in iNaturalist');return []}
  const out=[];
  for(const scope of [{lat:UAM.latitude,lng:UAM.longitude,radius:5},{place_id:59040},{place_id:59014},{place_id:6793},{}]) {
    for(let page=1;page<=maxPages;page++) {
      const d=await json(endpoint('https://api.inaturalist.org/v1/observations',{taxon_id:t.id,photos:'true',quality_grade:'research',captive:'false',per_page:30,page,order_by:'votes',order:'desc',...scope}));
      if(!Array.isArray(d.results))throw Error('Invalid observation response');
      for(const o of d.results)for(const p of o.photos||[]){const c=photoFromInat(o,p,{...bird,taxonId:t.id});if(c)out.push(c)}
      if(page*30>=d.total_results)break;
      if(page===maxPages)warnings.push(`Bounded iNaturalist search: ${JSON.stringify(scope)}; inspected ${page*30}/${d.total_results} observations`);
    }
  }
  return out;
}
export function videoType(text) {
  const t=fold(text);
  for(const [type,re] of [['feeding',/\b(feeding|eating|foraging)\b/],['flight',/\b(flying|flight|takeoff)\b/],['vocalization',/\b(singing|song|calling|vocalization)\b/],['courtship',/\b(courtship|mating)\b/],['interaction',/\b(fighting|interaction)\b/]])if(re.test(t))return type;
  return 'behavior';
}
export function fromCommons(p,bird,kind) {
  const i=p.imageinfo?.[0];if(!i)return null;
  const m=i.extmetadata||{},get=k=>plain(m[k]?.value);
  const scientific=fold(bird.scientific);
  // An incidental mention in a description/search result is insufficient.
  const categories=get('Categories').split('|').map(fold);
  const title=fold(p.title?.replace(/_/g,' '));
  const taxonMatch=title.includes(scientific)||categories.some(c=>c===scientific||c.startsWith(scientific+' '));
  if(!taxonMatch)return null;
  if(kind==='photo'&&i.mime!=='image/jpeg'||kind==='video'&&!['video/webm','video/ogg','video/mp4'].includes(i.mime))return null;
  const text=`${p.title} ${get('ImageDescription')}`;
  return {kind,source:'wikimedia-commons',sourceId:String(p.pageid),sourceUrl:i.descriptionurl,originalUrl:i.url,scientificName:bird.scientific,author:get('Artist')||null,attribution:get('Attribution')||get('Credit')||null,
    rawLicense:get('LicenseUrl'),sourceLicense:get('LicenseShortName'),mime:i.mime,width:i.width||null,height:i.height||null,size:i.size,duration:i.duration||null,
    latitude:null,longitude:null,distanceFromUamKm:null,local:false,geoTier:4,title:p.title,description:get('ImageDescription'),type:kind==='video'?videoType(text):undefined,
    commonsMetadata:m,taxonomicEvidence:'Scientific name in Commons file title or species category',visualReview:'pending'};
}
export async function searchCommons(bird,json,warnings) {
  const out=[];
  for(const kind of ['photo','video']) {
    const d=await json(endpoint('https://commons.wikimedia.org/w/api.php',{action:'query',format:'json',generator:'search',gsrsearch:`"${bird.scientific}" filetype:${kind==='photo'?'bitmap':'video'}`,gsrnamespace:6,gsrlimit:10,prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiextmetadatalanguage:'en'}));
    if(d.continue)warnings.push(`Bounded Commons ${kind} search: first 10 results`);
    for(const p of Object.values(d.query?.pages||{})){const c=fromCommons(p,bird,kind);if(c)out.push(c);else warnings.push(`Commons rejected (identity or MIME): ${p.title}`)}
  }
  return out;
}
export function eligible(c,{allowNc=false}={}) {
  const lic=licenseInfo(c.rawLicense,c.source,{commercial:!allowNc});
  let rejection=!lic?'License unknown, ND, or NC without --allow-nc':!c.author||!c.sourceId||!c.sourceUrl?'Incomplete attribution':!allowedUrl(c.originalUrl,c.source)?'Unsupported media host':null;
  if(c.kind==='photo'&&(!(c.width>=640)||!(c.height>=480)))rejection||='Insufficient/unknown resolution';
  if(c.kind==='video'&&c.size>80*1024*1024)rejection||='Video exceeds 80 MiB';
  return {...c,...(lic?{license:lic.licenseLabel,licenseUrl:lic.licenseUrl,nonCommercial:lic.nonCommercial}:{}),rejection};
}
export function selectMedia(candidates,bird) {
  const existing=[...(bird.photos||[]),...(bird.videos||[])],seen=new Set([...existing,...(bird.mediaReview?.rejected||[])].map(identity));
  const pool=[...new Map(candidates.map(c=>[identity(c),c])).values()].filter(c=>!c.rejection&&!seen.has(identity(c)));
  const chosen=[];
  for(const local of [true,false]) {
    const photos=pool.filter(c=>c.kind==='photo'&&c.local===local).sort((a,b)=>a.geoTier-b.geoTier||Number(Math.min(b.width,b.height)>=1000)-Number(Math.min(a.width,a.height)>=1000)||Number(a.nonCommercial)-Number(b.nonCommercial)||(b.favorites||0)-(a.favorites||0)||b.width*b.height-a.width*a.height||identity(a).localeCompare(identity(b)));
    const usedObs=new Set((bird.photos||[]).map(c=>c.observationId).filter(Boolean));
    const count=(bird.photos||[]).filter(c=>Boolean(c.local)===local).length;
    for(const c of photos){if(chosen.filter(c=>c.kind==='photo'&&c.local===local).length>=2-count)break;if(c.observationId&&usedObs.has(c.observationId))continue;chosen.push(c);if(c.observationId)usedObs.add(c.observationId)}
  }
  const usedTypes=new Set((bird.videos||[]).map(c=>c.type));
  for(const c of pool.filter(c=>c.kind==='video').sort((a,b)=>(a.size||Infinity)-(b.size||Infinity))){if(chosen.filter(c=>c.kind==='video').length>=3-(bird.videos||[]).length)break;if(usedTypes.has(c.type))continue;chosen.push(c);usedTypes.add(c.type)}
  return chosen;
}
export function decode(file) {
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-of','json',file],{encoding:'utf8',windowsHide:true,timeout:30000});
  if(probe.error||probe.status!==0)throw Error('ffprobe failed: '+(probe.error?.message||probe.stderr));
  const stream=JSON.parse(probe.stdout).streams.find(s=>s.codec_type==='video');if(!stream)throw Error('No image/video stream');
  const check=spawnSync('ffmpeg',['-v','error','-xerror','-i',file,'-map','0:v:0','-f','null','-'],{encoding:'utf8',windowsHide:true,timeout:120000});
  if(check.error||check.status!==0)throw Error('Decode failed: '+(check.error?.message||check.stderr));
  return {width:stream.width,height:stream.height,codec:stream.codec_name};
}
export async function downloadMedia(c,dir) {
  if(!allowedUrl(c.originalUrl,c.source)||!licenseInfo(c.licenseUrl,'wikimedia-commons'))throw Error('Untrusted URL or license');
  const bytes=await request(c.originalUrl,{bytes:true,max:(c.kind==='video'?80:20)*1024*1024});
  const folder=path.join(dir,c.kind==='photo'?'fotos':'videos');await mkdir(folder,{recursive:true});
  const ext=c.kind==='photo'?'.jpg':({'video/webm':'.webm','video/ogg':'.ogv','video/mp4':'.mp4'}[c.mime]);
  if(!ext)throw Error('Unsupported video format');
  const temp=path.join(folder,`.media-${randomUUID()}`),converted=temp+'.jpg';
  try {
    await writeFile(temp,bytes,{flag:'wx'});const info=decode(temp);let input=temp,changes=null;
    if(c.kind==='photo'&&info.codec!=='mjpeg'){
      const r=spawnSync('ffmpeg',['-v','error','-i',temp,'-frames:v','1','-q:v','2',converted],{encoding:'utf8',windowsHide:true,timeout:60000});if(r.error||r.status!==0)throw Error('JPEG conversion failed');decode(converted);input=converted;changes='Converted to JPEG; no crop';
    }
    const digest=createHash('sha256').update(await readFile(input)).digest('hex');
    const current=JSON.parse(await readFile(path.join(dir,'ave.json'),'utf8'));
    if([...(current.photos||[]),...(current.videos||[])].some(e=>e.sha256===digest))throw Error('Duplicate file content');
    const stem=c.kind==='photo'?(c.local?'local':'reference'):c.type;
    let file;
    for(let n=1;n<=2;n++){
      const name=`${stem}-${String(n).padStart(2,'0')}${ext}`;
      try{await copyFile(input,path.join(folder,name),constants.COPYFILE_EXCL);file=`${path.basename(folder)}/${name}`;break}catch(e){if(e.code!=='EEXIST')throw e}
    }
    if(!file)throw Error('All filename slots occupied; existing files preserved');
    const {rejection,...metadata}=c;
    return {...metadata,file,...info,changes,sha256:digest,bytes:(await stat(path.join(dir,file))).size,downloadedAt:new Date().toISOString(),validation:'ffmpeg full decode'};
  } finally{await unlink(temp).catch(()=>{});await unlink(converted).catch(()=>{})}
}
export async function appendMedia(file,raw,c) {
  if(await readFile(file,'utf8')!==raw)throw Error('ave.json changed during download');
  const bird=JSON.parse(raw),key=c.kind==='photo'?'photos':'videos';
  if((bird[key]||[]).some(e=>identity(e)===identity(c)))throw Error('Duplicate source identity');
  bird[key]=[...(bird[key]||[]),c];const next=JSON.stringify(bird,null,2)+'\n',temp=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,next,{flag:'wx'});if(await readFile(file,'utf8')!==raw)throw Error('ave.json changed');await rename(temp,file)}finally{await unlink(temp).catch(()=>{})}
  return next;
}
