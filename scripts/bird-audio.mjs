import {readdir, readFile, writeFile, mkdir, rename, unlink, stat} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

export const UAM = {latitude:19.3525, longitude:-99.2824};
const clean = value => String(value ?? '').trim();
const fold = value => clean(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export const identity = c => `${c.source}:${c.sourceId}`;
export function hasDownloadUrl(candidate) {
  try {return new URL(candidate.audioUrl).protocol==='https:'} catch {return false}
}
export function coordinate(value, maximum) {
  if(value === null || value === undefined || clean(value)==='') return null;
  const n=Number(value); return Number.isFinite(n) && Math.abs(n)<=maximum ? n : null;
}
export function distanceFromUam(latitude, longitude) {
  const lat=coordinate(latitude,90), lon=coordinate(longitude,180);
  if(lat===null || lon===null) return null;
  const rad=n=>n*Math.PI/180, a=Math.sin(rad(lat-UAM.latitude)/2)**2+Math.cos(rad(UAM.latitude))*Math.cos(rad(lat))*Math.sin(rad(lon-UAM.longitude)/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,a)));
}
export function normalizeType(raw) {
  const types=fold(raw).split(/[,;]/).map(t=>t.trim());
  for(const [type, labels] of [['song',['song','canto']],['alarm',['alarm','alarm call','alarma']],['flight_call',['flight call','flight_call','llamada en vuelo']],['drumming',['drumming','tamborileo']],['call',['call','llamada']]]) {
    if(types.some(t=>labels.includes(t))) return type;
  }
  return 'other';
}
export function licenseInfo(raw, source, {allowNd=false, commercial=false}={}) {
  let code, version, licenseUrl;
  if(source==='inaturalist') {
    code=clean(raw).toLowerCase().replace(/^cc-/, '');
    version=code==='cc0'?'1.0':'4.0';
  } else {
    try {
      const u=new URL(raw);
      if(!['http:','https:'].includes(u.protocol) || !['creativecommons.org','www.creativecommons.org'].includes(u.hostname)) return null;
      const m=u.pathname.match(/^\/(?:licenses\/(by(?:-nc)?(?:-sa|-nd)?)\/([1-4]\.0|2\.5)|publicdomain\/(zero)\/(1\.0))\/?$/);
      if(!m) return null;
      code=m[3]?'cc0':m[1]; version=m[4]||m[2]; licenseUrl=raw;
    } catch {return null}
  }
  if(!['cc0','by','by-sa','by-nc','by-nc-sa','by-nd','by-nc-nd'].includes(code)) return null;
  const derivativesAllowed=!code.includes('-nd'), nonCommercial=code.includes('-nc');
  if((!derivativesAllowed&&!allowNd) || (nonCommercial&&commercial)) return null;
  licenseUrl ||= code==='cc0'?'https://creativecommons.org/publicdomain/zero/1.0/':`https://creativecommons.org/licenses/${code}/${version}/`;
  return {license:raw,licenseLabel:code==='cc0'?'CC0 1.0':`CC ${code.toUpperCase()} ${version}`,licenseUrl,derivativesAllowed,nonCommercial};
}
export function region(c) {
  if(c.local) return 0;
  const loc=fold(c.location), country=fold(c.country);
  if(/cuajimalpa/.test(loc)) return 1;
  if(/ciudad de mexico|mexico city|distrito federal|\bcdmx\b/.test(loc)) return 2;
  if(/estado de mexico|state of mexico|valle de mexico/.test(loc)) return 3;
  if(country==='mexico') return 4;
  return 5;
}
export function enrich(c) {
  const distance=distanceFromUam(c.latitude,c.longitude);
  return {...c,distanceFromUamKm:distance===null?null:Math.round(distance*1000)/1000,local:distance!==null&&distance<=5};
}
// Quality is a gate first (D/E rejected), then geography, A/B/C/unknown,
// known vocalization, primary source, completeness, distance, stable source ID.
export function compareCandidates(a,b) {
  const q=c=>({A:0,B:1,C:2}[c.quality]??3);
  const complete=c=>['date','location','latitude','longitude'].filter(k=>c[k]!==null&&c[k]!==undefined).length;
  return region(a)-region(b) || q(a)-q(b) || Number(a.type==='other')-Number(b.type==='other') || Number(a.source!=='xeno-canto')-Number(b.source!=='xeno-canto') || complete(b)-complete(a) || (a.distanceFromUamKm??Infinity)-(b.distanceFromUamKm??Infinity) || identity(a).localeCompare(identity(b),'en',{numeric:true});
}
export function selectCandidates(candidates, existing=[], limit=3) {
  const seen=new Set(existing.map(identity)), pool=[...new Map(candidates.map(c=>[identity(c),c])).values()].filter(c=>!seen.has(identity(c))).sort(compareCandidates);
  const chosen=[], used=new Set(existing.map(c=>c.type));
  while(pool.length && existing.length+chosen.length<limit) {
    // Diversity only within the best geographic tier; never invent a type.
    const bestRegion=region(pool[0]);
    const diverse=pool.findIndex(c=>region(c)===bestRegion&&!used.has(c.type));
    const [c]=pool.splice(diverse<0?0:diverse,1); chosen.push(c); used.add(c.type);
  }
  return chosen;
}
let lastRequest=0;
export async function requestJson(url) {
  for(let attempt=0;attempt<3;attempt++) {
    await delay(Math.max(0,1100-(Date.now()-lastRequest))); lastRequest=Date.now();
    let r;
    try {r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'Aviario-Audio-Importer/1.0'}})} catch {
      if(attempt===2) throw Error('Network request failed (timeout or connection)');
      await delay(1000*2**attempt);continue;
    }
    if(r.ok) return r.json();
    if((r.status===429||r.status>=500)&&attempt<2) {
      const retry=Number(r.headers.get('retry-after'));
      await delay(Math.min(30000,Math.max(2000*2**attempt,Number.isFinite(retry)?retry*1000:0)));continue;
    }
    // Never put request URLs in errors: XC URLs include a private API key.
    throw Error(`API HTTP ${r.status}`);
  }
}
export function normalizeXc(r, scientific) {
  if(fold(`${r.gen} ${r.sp}`)!==fold(scientific) || r.status!=='identified') return null;
  return enrich({source:'xeno-canto',sourceId:`XC${r.id}`,scientificName:`${r.gen} ${r.sp}`,type:normalizeType(r.type),originalType:r.type||null,
    audioUrl:r.file,originalFileName:r['file-name']||null,sourceUrl:r.url,recordist:r.rec||null,attribution:null,
    license:r.lic,latitude:coordinate(r.lat,90),longitude:coordinate(r.lon,180),country:r.cnt||null,location:r.loc||null,date:r.date||null,quality:r.q||null,taxonomicEvidence:'identified'});
}
export async function searchXc(bird, {key, maxPages=5, json=requestJson}, warnings) {
  const all=[];
  // Local and Mexican pools precede the bounded global query, so a global cap
  // cannot hide local recordings. Each query is paginated independently.
  for(const suffix of [' box:19.30,-99.34,19.41,-99.22',' cnt:Mexico','']) {
    for(let page=1;page<=maxPages;page++) {
      const u=new URL('https://xeno-canto.org/api/3/recordings');
      u.search=new URLSearchParams({query:`sp:"${bird.scientific}"${suffix}`,key,per_page:'100',page:String(page)});
      const d=await json(u);
      if(!Array.isArray(d.recordings)) throw Error('Invalid Xeno-canto response');
      all.push(...d.recordings.map(r=>normalizeXc(r,bird.scientific)).filter(Boolean));
      if(page>=Number(d.numPages)) break;
      if(page===maxPages) warnings.push(`Xeno-canto search truncated at ${maxPages} pages (${suffix||'world'}).`);
    }
  }
  return all;
}
export function normalizeInat(o,s,bird) {
  if(o.quality_grade!=='research' || o.taxon?.is_active===false || o.taxon?.id!==bird.taxonId || fold(o.taxon?.name)!==fold(bird.scientific) || s.hidden || s.flags?.length || !s.file_url) return null;
  const obscured=o.obscured || o.geoprivacy==='obscured' || o.geoprivacy==='private' || o.taxon_geoprivacy==='obscured' || o.taxon_geoprivacy==='private';
  const coordinates=obscured?[]:o.geojson?.coordinates||[];
  // The API has no per-sound vocalization label or acoustic quality rating.
  // Observation descriptions/annotations can refer to another sound: not guessed.
  const author=s.attribution?.match(/^\(c\) (.+), some rights reserved/ig)?.[0]?.replace(/^\(c\) /i,'').replace(/, some rights reserved$/i,'');
  return enrich({source:'inaturalist',sourceId:String(s.id),scientificName:o.taxon.name,type:'other',originalType:null,
    audioUrl:s.file_url,originalFileName:null,sourceUrl:`https://www.inaturalist.org/observations/${o.id}`,recordist:author||s.attribution_name||o.user?.name||o.user?.login||null,
    attribution:s.attribution||null,license:s.license_code,latitude:coordinate(coordinates[1],90),longitude:coordinate(coordinates[0],180),country:o.place_ids?.includes(6793)?'Mexico':null,
    location:o.place_guess||null,date:o.observed_on||null,quality:null,taxonomicEvidence:'research; exact species taxon and scientific name',observationId:o.id,coordinatesObscured:Boolean(obscured)});
}
export async function searchInat(bird, {maxPages=5,json=requestJson}, warnings) {
  const u=new URL('https://api.inaturalist.org/v1/taxa');u.search=new URLSearchParams({q:bird.scientific,rank:'species',per_page:'30'});
  const taxa=await json(u), exact=taxa.results?.filter(t=>fold(t.name)===fold(bird.scientific)&&t.is_active!==false&&t.rank==='species')||[];
  const taxon=exact.find(t=>t.id===bird.taxonId) || (exact.length===1?exact[0]:null);
  if(!taxon) {warnings.push(`No exact iNaturalist taxon for ${bird.scientific}`);return []}
  const resolved={...bird,taxonId:taxon.id}, all=[];
  for(const scope of [{lat:UAM.latitude,lng:UAM.longitude,radius:5},{place_id:6793},{}]) {
    for(let page=1;page<=maxPages;page++) {
      const endpoint=new URL('https://api.inaturalist.org/v1/observations');
      endpoint.search=new URLSearchParams({taxon_id:String(taxon.id),sounds:'true',quality_grade:'research',per_page:'100',page:String(page),order_by:'id',order:'asc',locale:'en',...scope});
      const d=await json(endpoint);
      if(!Array.isArray(d.results)) throw Error('Invalid iNaturalist response');
      all.push(...d.results.flatMap(o=>(o.sounds||[]).map(s=>normalizeInat(o,s,resolved)).filter(Boolean)));
      if(page*100>=d.total_results || !d.results.length) break;
      if(page===maxPages) warnings.push(`iNaturalist search truncated at ${maxPages} pages (${JSON.stringify(scope)}).`);
    }
  }
  return all;
}
export async function getSpecies(root, ids=[]) {
  const entries=(await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()&&(!ids.length||ids.includes(e.name))).sort((a,b)=>a.name.localeCompare(b.name));
  for(const id of ids) if(!entries.some(e=>e.name===id)) throw Error(`Bird not found: ${id}`);
  return entries.map(e=>({id:e.name,dir:path.join(root,e.name)}));
}
export async function readBird(entry) {
  const file=path.join(entry.dir,'ave.json'), raw=await readFile(file,'utf8'), bird=JSON.parse(raw);
  if(bird.id!==entry.id || !/^[a-z0-9-]+$/.test(bird.id) || !bird.scientific) throw Error('Invalid bird identity');
  if(bird.audio!==undefined&&!Array.isArray(bird.audio)) throw Error('Existing audio is not an array; preserved');
  return {bird,raw,file};
}
export function audioExtension(buffer) {
  if(buffer.subarray(0,3).toString()==='ID3' || (buffer[0]===255&&(buffer[1]&224)===224)) return '.mp3';
  if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WAVE') return '.wav';
  if(buffer.subarray(0,4).toString()==='OggS') return '.ogg';
  if(buffer.subarray(0,4).toString()==='fLaC') return '.flac';
  if(buffer.subarray(4,8).toString()==='ftyp') return '.m4a';
  throw Error('Response is not a supported audio file');
}
export async function downloadAudio(candidate,dir,{fetcher=fetch,decode=false}={}) {
  const u=new URL(candidate.audioUrl);if(u.protocol!=='https:') throw Error('Audio URL must use HTTPS');
  const r=await fetcher(u,{signal:AbortSignal.timeout(90000)});
  if(!r.ok) throw Error(`Audio HTTP ${r.status}`);
  const max=40*1024*1024;
  if(Number(r.headers.get('content-length'))>max) {await r.body.cancel();throw Error('Audio exceeds 40 MiB')}
  const chunks=[];let size=0;
  for await(const chunk of r.body) {size+=chunk.length;if(size>max) throw Error('Audio exceeds 40 MiB');chunks.push(chunk)}
  const bytes=Buffer.concat(chunks), extension=audioExtension(bytes);
  const folder=path.join(dir,'audio');await mkdir(folder,{recursive:true});
  const tmp=path.join(folder,`.import-${randomUUID()}${extension}`);
  await writeFile(tmp,bytes,{flag:'wx'});
  try {
    if(decode) {
      const result=spawnSync('ffmpeg',['-v','error','-xerror','-i',tmp,'-map','0:a:0','-f','null','-'],{encoding:'utf8',windowsHide:true,timeout:90000});
      if(result.error || result.status!==0) throw Error(`Audio decode validation failed: ${result.error?.message||result.stderr.trim()}`);
    }
    let file;
    for(let n=1;;n++) {
      file=`audio/${candidate.type}-${String(n).padStart(2,'0')}${extension}`;
      try {await writeFile(path.join(dir,file),bytes,{flag:'wx'});break} catch(e) {if(e.code!=='EEXIST') throw e}
    }
    const {audioUrl,originalFileName,...metadata}=candidate;
    return {...metadata,file,originalAudioUrl:audioUrl,originalFileName,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:size,downloadedAt:new Date().toISOString().slice(0,10),validation:decode?'ffmpeg decode':'audio signature'};
  } finally {await unlink(tmp).catch(()=>{})}
}
export async function updateBird(file,raw,recording) {
  // Optimistic concurrency check protects manual edits made while downloading.
  const current=await readFile(file,'utf8');if(current!==raw) throw Error('ave.json changed during import; refusing to overwrite');
  const bird=JSON.parse(current);bird.audio=[...(bird.audio||[]),recording];
  const tmp=`${file}.${randomUUID()}.tmp`, next=JSON.stringify(bird,null,2)+'\n';
  try {await writeFile(tmp,next,{flag:'wx'});await rename(tmp,file)} finally {await unlink(tmp).catch(()=>{})}
  return next;
}
export async function existingAudio(bird,dir) {
  for(const item of bird.audio||[]) {
    if(typeof item.file!=='string') throw Error('Existing audio has no file path');
    const resolved=path.resolve(dir,item.file);
    if(!resolved.startsWith(path.resolve(dir)+path.sep)) throw Error('Audio path escapes species directory');
    if(!(await stat(resolved)).isFile()) throw Error(`Missing audio file: ${item.file}`);
  }
  return bird.audio||[];
}
