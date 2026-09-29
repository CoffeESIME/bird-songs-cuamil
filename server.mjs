import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildContent} from './scripts/build-content.mjs';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
await buildContent();
let contentError=null, timer, building=false, pending=false;
async function rebuild(){
  if(building){pending=true;return}building=true;
  try{await buildContent();contentError=null}catch(error){contentError=error.message;console.error('Contenido:',error.message)}
  finally{building=false;if(pending){pending=false;rebuild()}}
}
fs.watch(path.join(root,'content'),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(rebuild,400)});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.webm':'video/webm','.mov':'video/quicktime','.m4v':'video/mp4','.m4a':'audio/mp4','.ogg':'audio/ogg','.flac':'audio/flac','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.jpeg':'image/jpeg'};
http.createServer((req,res)=>{if(req.url==='/__content-version'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({version:JSON.parse(fs.readFileSync(path.join(root,'content-index.json'),'utf8')).revision,error:contentError}));return}let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===path.resolve(root))file=path.join(root,'index.html');if(!file.startsWith(root)){res.writeHead(403).end();return}const stat=fs.statSync(file);if(!stat.isFile())throw new Error();const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};if(req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416).end();return}const start=+match[1],end=match[2]?Math.min(+match[2],stat.size-1):stat.size-1;if(start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(res)}else{res.writeHead(200,{...headers,'Content-Length':stat.size});fs.createReadStream(file).pipe(res)}}catch{res.writeHead(404).end('No encontrado')}}).listen(4173,'127.0.0.1',()=>console.log('AVIARIO: http://127.0.0.1:4173'));
