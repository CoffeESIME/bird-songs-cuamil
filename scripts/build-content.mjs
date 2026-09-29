import {readdir, readFile, writeFile, mkdir, copyFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const root = path.join(dist,'content');
const image = /\.(jpe?g|png|webp|gif|avif)$/i, video = /\.(mp4|webm|mov|m4v)$/i, audio = /\.(mp3|wav|ogg|m4a|flac)$/i;
async function files(dir, pattern) {
  const output=[];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) output.push(...await files(full,pattern));
    else if(entry.isFile() && pattern.test(entry.name)) output.push(full);
  }
  return output.sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
}
const url = file => path.relative(dist,file).split(path.sep).map(encodeURIComponent).join('/');
export async function buildContent() {
  const birds=[], fingerprints=[];
  for (const entry of await readdir(root,{withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    const dir=path.join(root,entry.name), metadata=JSON.parse(await readFile(path.join(dir,'ave.json'),'utf8'));
    if (!metadata.name || !metadata.scientific || metadata.id !== entry.name || !/^[a-z0-9-]+$/.test(metadata.id)) throw Error(`Revisa ave.json: ${entry.name}`);
    const allImages=await files(dir,image), allVideos=await files(dir,video), allAudio=await files(dir,audio);
    for(const file of [...allImages,...allVideos,...allAudio]){
      const info=await stat(file);fingerprints.push([url(file),info.size,info.mtimeMs]);
    }
    const cover=allImages.find(f=>/^portada\./i.test(path.basename(f))) || allImages[0];
    const notes=await readFile(path.join(dir,'notas.md'),'utf8');
    let analysis=null;
    // Analysis is opt-in and only associated with an explicitly named local recording.
    if(metadata.recording) {
      const recording=path.resolve(dir,metadata.recording);
      if(![...allVideos,...allAudio].includes(recording)) throw Error(`Grabación inexistente: ${entry.name}/${metadata.recording}`);
      const list=audio.test(recording)?allAudio:allVideos;
      list.splice(list.indexOf(recording),1); list.unshift(recording);
      if(metadata.analysis) {
        const full=path.resolve(dir,metadata.analysis);
        if(!full.startsWith(dir+path.sep)) throw Error(`Análisis fuera de la carpeta: ${entry.name}`);
        await stat(full); analysis=url(full);
      }
    }
    birds.push({...metadata, habitat:metadata.habitat || (metadata.rank==='genus'?'Identificación a nivel de género':`${metadata.observations ?? '—'} observaciones en la zona`),
      demo:false, cutout:cover?url(cover):null, photos:allImages.map(url),
      media:allVideos.map(f=>({type:'video',src:url(f)})), audio:allAudio[0]&&(!metadata.recording||audio.test(metadata.recording))?url(allAudio[0]):null,
      recordings:allAudio.map(url),audioCredits:Array.isArray(metadata.audio)?metadata.audio:[],analysis,notes,contentPath:url(dir)+'/',
      hasNotes:!!notes.replace(/<!--[\s\S]*?-->/g,'').trim()});
  }
  birds.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  if(!birds.length) throw Error('No hay fichas en dist/content');
  await mkdir(path.join(dist,'vendor'),{recursive:true});
  await copyFile(path.join(dist,'../node_modules/marked/lib/marked.esm.js'),path.join(dist,'vendor/marked.js'));
  await copyFile(path.join(dist,'../node_modules/dompurify/dist/purify.es.mjs'),path.join(dist,'vendor/purify.js'));
  const source=JSON.parse(await readFile(path.join(root,'source.json'),'utf8'));
  const revision=createHash('sha256').update(JSON.stringify({source,birds,fingerprints})).digest('hex');
  const catalog=JSON.stringify({source,birds,revision},null,2)+'\n';
  let before='';try{before=await readFile(path.join(dist,'content-index.json'),'utf8')}catch{}
  if(before!==catalog) await writeFile(path.join(dist,'content-index.json'),catalog);
  return birds.length;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) console.log(`${await buildContent()} fichas compiladas.`);
