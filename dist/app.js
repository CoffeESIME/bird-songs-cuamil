import {renderAnnex} from './content-view.js';
import {birds,uiSounds,source,revision as contentRevision} from './catalog.js';
import {prepareAcoustic,acousticFrame} from './acoustic.js';
import {analysisRow,recordingAnalysis,validateAnalysis} from './analysis-data.js';
const $=id=>document.getElementById(id), video=$('video'), audio=new Audio();
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
const icon='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 9h5v5h8V7h5V3h5v7h5v4h-6v9H11v-4H6v-5H2zM12 23h3v6h-3zm8 0h3v6h-3z"/></svg>';
let index=Math.max(0,birds.findIndex(b=>b.id===location.hash.slice(1).replace(/^anexo-/,''))),photoIndex=0,playing=false,changing=false,fx=true,ctx,master,analyser,frequency;
let acousticModel=null;
let selectedAnalysisUrl=null;
let analysis=null,analysisToken=0,frame=0,lastFrame=0,yaw=-.45,pitch=.22,drag=null;
const sources=new Map(),analysisCache=new Map(),specImage=document.createElement('canvas');
const plots=Object.fromEntries(['spectrogram','acoustic','waveform','power'].map(id=>{const c=$(id);return [id,{canvas:c,g:c.getContext('2d'),w:0,h:0}]}));
const current=()=>birds[index], player=()=>current().audio?audio:video;
const time=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'--:--';
$('transition').innerHTML=icon.repeat(3)+'<p>CAMBIANDO DE VUELO</p>';
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function renderList(){const query=normalize($('search').value);$('bird-list').replaceChildren();birds.forEach((bird,i)=>{if(!normalize(bird.name+' '+bird.scientific+' '+(bird.aliases||[]).join(' ')).includes(query))return;const b=document.createElement('button');b.className='bird-item';b.setAttribute('aria-current',String(i===index));b.innerHTML=icon;const label=document.createElement('span');label.textContent=bird.name;b.append(label);b.onclick=()=>changeBird(i);$('bird-list').append(b)});$('empty').hidden=$('bird-list').children.length>0}
async function initAudio(){if(!ctx){ctx=new AudioContext();analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.7;master=ctx.createGain();master.gain.value=+$('volume').value;analyser.connect(master);master.connect(ctx.destination);for(const el of [video,audio]){el.volume=1;sources.set(el,ctx.createMediaElementSource(el))}frequency=new Uint8Array(analyser.frequencyBinCount);routeAudio()}if(ctx.state==='suspended')await ctx.resume()}
function routeAudio(){if(!ctx)return;for(const source of sources.values())source.disconnect();sources.get(player()).connect(analyser)}
async function sound(kind='click'){if(!fx)return;try{await initAudio();if(uiSounds[kind]){const effect=new Audio(uiSounds[kind]);effect.volume=.15;await effect.play();return}const t=ctx.currentTime,o=ctx.createOscillator(),gain=ctx.createGain();o.frequency.setValueAtTime(kind==='change'?1750:750,t);o.frequency.exponentialRampToValueAtTime(kind==='change'?3100:1100,t+.045);o.frequency.exponentialRampToValueAtTime(650,t+.13);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.025,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.14);o.connect(gain);gain.connect(ctx.destination);o.start();o.stop(t+.15)}catch{}}
function updatePlay(){playing=!player().paused&&!player().ended;$('play').setAttribute('aria-label',playing?'Pausar grabación':'Reproducir grabación');$('play').innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8z"/></svg>';$('track-title').textContent=playing?'Escuchando grabación':(current().audio||current().media.length?'Escuchar grabación':'Sin grabación todavía');$('video-play').textContent=playing?'Ⅱ':'▶';$('video-play').setAttribute('aria-label',playing?'Pausar video':'Reproducir video');$('live-state').textContent=playing?'● ESCUCHANDO':'EN PAUSA';if(playing)animate();else drawAll()}
async function play(){if(!current().audio&&!current().media.length)return;try{await initAudio();await player().play();if(current().audio&&current().media.length){video.muted=true;video.currentTime=player().currentTime%Math.max(1,video.duration||1);video.play().catch(()=>{})}$('status').textContent=current().demo?'Colección demo · las grabaciones todavía no están asociadas a estas especies.':'Grabación del ave seleccionada.'}catch{$('status').textContent='No se pudo reproducir. Pulsa play para volver a intentarlo.';updatePlay()}}
function pause(){video.pause();audio.pause();updatePlay()}
function toggle(){return playing?pause():play()}
function photo(n,scroll=true){const photos=current().photos;if(!photos.length){$('photo-count').textContent='Sin fotos todavía';return}photoIndex=(n+photos.length)%photos.length;$('photo-count').textContent=`0${photoIndex+1} / 0${photos.length}`;[...$('photo-strip').children].forEach((c,i)=>c.dataset.current=String(i===photoIndex));[...$('photo-dots').children].forEach((c,i)=>c.setAttribute('aria-pressed',String(i===photoIndex)));if(scroll){const target=$('photo-strip').children[photoIndex],strip=$('photo-strip');strip.scrollTo({left:target.offsetLeft-strip.offsetLeft-(strip.clientWidth-target.clientWidth)/2,behavior:reduced?'instant':'smooth'})}}
function renderPhotos(){
  $('photo-strip').replaceChildren();$('photo-dots').replaceChildren();
  const photos=current().photos;
  $('prev-photo').disabled=$('next-photo').disabled=photos.length<2;
  if(!photos.length){const p=document.createElement('p');p.className='content-empty';p.textContent='El álbum de esta ave aún está por comenzar.';$('photo-strip').append(p)}
  photos.forEach((src,i)=>{const card=document.createElement('div');card.className='polaroid photo-card';
    const img=document.createElement('img');img.src=src;img.alt=current().name+' · fotografía '+(i+1);img.loading='lazy';
    img.onerror=()=>{img.alt='No se pudo cargar esta fotografía'};
    const caption=document.createElement('div');caption.className='polaroid-caption';caption.textContent='Apunte de campo / '+String(i+1).padStart(2,'0');
    card.append(img,caption);$('photo-strip').append(card);
    const dot=document.createElement('button');dot.setAttribute('aria-label','Ver foto '+(i+1));dot.onclick=()=>photo(i);$('photo-dots').append(dot);
  });photo(0,false);$('photo-strip').scrollLeft=0;
}
async function loadAnalysis(){
 const token=++analysisToken,url=selectedAnalysisUrl;analysis=null;acousticModel=null;
 $('analysis-status').hidden=false;$('analysis-status').textContent='Preparando la huella del sonido…';drawAll();$('wave-duration').textContent='—';
 if(!url){$('analysis-status').textContent='Sin análisis para esta grabación.';return}
 try{
  let data=analysisCache.get(url);
  if(!data){const r=await fetch(url);if(!r.ok)throw Error();data=validateAnalysis(await r.json());if(token!==analysisToken)return;analysisCache.set(url,data);if(analysisCache.size>6)analysisCache.delete(analysisCache.keys().next().value)}
  if(token!==analysisToken)return;analysis=data;acousticModel=prepareAcoustic(data);buildSpectrogram();$('analysis-status').hidden=true;$('wave-duration').textContent=time(data.duration);drawAll();
 }catch{if(token===analysisToken){selectedAnalysisUrl=null;$('analysis-status').textContent='No se pudo cargar el análisis de esta grabación.';$('wave-duration').textContent='—';drawAll()}}
}
function chooseRecording(src){
 pause();selectedAnalysisUrl=recordingAnalysis(current(),src);audio.src=src;audio.load();
 $('elapsed').textContent='0:00';$('duration').textContent='--:--';$('spectrogram-time').textContent='0:00';$('seek').value=0;$('seek').disabled=true;
 $('status').textContent='Grabación seleccionada: '+decodeURIComponent(src.split('/').pop());
 loadAnalysis();updatePlay();
}

function loadBird(){
 const b=current();selectedAnalysisUrl=b.audio?recordingAnalysis(b,b.audio):b.analysis;history.replaceState(null,'','#'+b.id);
 $('bird-name').textContent=b.name;$('scientific').textContent=b.scientific;
 $('bird-counter').textContent='PÁGINA '+String(index+1).padStart(2,'0')+' / '+birds.length;
 $('portrait-number').textContent=String(index+1).padStart(2,'0');$('habitat').textContent=b.habitat;
 $('bird-art').hidden=!b.cutout;$('art-error').hidden=!!b.cutout;
 if(b.cutout){$('bird-art').src=b.cutout;$('bird-art').alt=b.name}else $('bird-art').removeAttribute('src');
 video.pause();audio.pause();video.removeAttribute('src');audio.removeAttribute('src');
 if(b.media.length)video.src=b.media[0].src;
 video.poster=b.photos[0]||'';video.muted=!!b.audio;
 if(b.audio)audio.src=b.audio;
 video.load();audio.load();routeAudio();
 $('video').hidden=!b.media.length;$('video-play').disabled=!b.media.length;
 $('play').disabled=!b.audio&&!b.media.length;
 $('video-caption').textContent=b.media.length?'Grabación de campo':'Aún no hay videos';
 document.querySelector('.sample-caption').textContent=b.media.length?'Archivo de esta ave':'Una nueva observación empieza aquí.';
 $('status').textContent=b.audio||b.media.length?'Archivo audiovisual de '+b.name+'.':'Esta ficha todavía no tiene una grabación.';
 $('elapsed').textContent='0:00';$('duration').textContent='--:--';$('spectrogram-time').textContent='0:00';$('seek').value=0;$('seek').disabled=true;
 const link=$('taxon-link');link.href=b.source;link.textContent='Ver especie en iNaturalist ↗';
 const annex=$('annex-link');annex.hidden=!b.hasNotes;annex.href='#anexo-'+b.id;
 annex.onclick=()=>{const entry=$('anexo-'+b.id);if(entry)entry.open=true};
 const select=$('video-select');select.replaceChildren();select.hidden=b.media.length<2;
 b.media.forEach((m,i)=>{const option=document.createElement('option');option.value=m.src;option.textContent=decodeURIComponent(m.src.split('/').pop());select.append(option)});
 select.onchange=()=>{pause();video.src=select.value;video.load();if(!b.audio){selectedAnalysisUrl=select.value===b.media[0]?.src?b.analysis:null;loadAnalysis()}};
 const credits=[...(b.audioCredits||[]),...(b.photoCredits||[]),...(b.videoCredits||[])];
 const recordings=$('audio-recordings');recordings.replaceChildren();recordings.hidden=b.recordings.length<2&&!credits.length;
 for(const credit of credits){
  const p=document.createElement('p');p.textContent=`${credit.file.split('/').pop()} · ${credit.author||credit.recordist||'Autor no indicado'} · `;
  for(const [text,href] of [[credit.source+' '+credit.sourceId,credit.sourceUrl],[credit.licenseLabel||credit.license,credit.licenseUrl]]){
   try{const u=new URL(href);if(!['https:','http:'].includes(u.protocol))continue;const a=document.createElement('a');a.textContent=text;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';p.append(a,' · ')}catch{}
  }
  p.append(`${credit.location||'Ubicación no indicada'}${credit.originalType?' · '+credit.originalType:''}${credit.derivativesAllowed===false?' · Sin modificaciones permitidas':''}${credit.changes?' · '+credit.changes:''}`);recordings.append(p);
 }
 const picker=$('audio-select');picker.replaceChildren();$('audio-choice').hidden=!b.recordings.length;
 b.recordings.forEach((src,i)=>{const option=document.createElement('option');option.value=src;const credit=(b.audioCredits||[]).find(c=>src.endsWith('/'+c.file.split('/').map(encodeURIComponent).join('/')));option.textContent=`${i+1}. ${credit?.originalType||decodeURIComponent(src.split('/').pop())}${credit?.recordist?' · '+credit.recordist:''}`;picker.append(option)});
 picker.value=b.audio||b.recordings[0]||'';picker.onchange=()=>chooseRecording(picker.value);

 renderList();renderPhotos();loadAnalysis();updatePlay();
}
async function changeBird(n,resume=playing){if(changing)return;if(n===index){if(!resume)pause();history.replaceState(null,'','#'+current().id);return}changing=true;pause();sound('change');$('transition').classList.remove('running');void $('transition').offsetWidth;$('transition').classList.add('running');await new Promise(r=>setTimeout(r,reduced?0:170));index=n;loadBird();if(resume)await play();await new Promise(r=>setTimeout(r,reduced?0:380));$('transition').classList.remove('running');changing=false}
const randomIndex=()=>(index+1+Math.floor(Math.random()*(birds.length-1)))%birds.length;
const next=(resume=playing)=>{
 const candidates=birds.map((b,i)=>i).filter(i=>!resume||birds[i].audio||birds[i].media.length);
 if(!candidates.length)return;
 const n=$('order').value==='shuffle'?candidates.filter(i=>i!==index):candidates.filter(i=>i>index);
 const options=n.length?n:candidates;
 return changeBird(options[$('order').value==='shuffle'?Math.floor(Math.random()*options.length):0],resume);
};
for(const el of [video,audio]){el.addEventListener('play',updatePlay);el.addEventListener('pause',updatePlay);el.addEventListener('loadedmetadata',()=>{if(el===player()){$('duration').textContent=time(el.duration);$('seek').disabled=!Number.isFinite(el.duration)}});el.addEventListener('timeupdate',()=>{if(el!==player())return;$('elapsed').textContent=time(el.currentTime);$('spectrogram-time').textContent=time(el.currentTime);$('seek').value=Number.isFinite(el.duration)&&el.duration?100*el.currentTime/el.duration:0;if(!playing)drawAll()});el.addEventListener('seeked',drawAll);el.addEventListener('ended',()=>{if(el!==player())return;updatePlay();if($('autoplay').checked)next(true)});el.addEventListener('error',()=>{if(el===player()){$('status').textContent='No se encontró esta grabación. Prueba otra ave.';updatePlay()}})}
$('play').onclick=toggle;$('video-play').onclick=toggle;$('next').onclick=()=>next();$('random').onclick=()=>changeBird(randomIndex());$('search').oninput=renderList;$('prev-photo').onclick=()=>photo(photoIndex-1);$('next-photo').onclick=()=>photo(photoIndex+1);$('photo-strip').onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();photo(photoIndex+(e.key==='ArrowRight'?1:-1));sound()}};
let scrollTimer;$('photo-strip').onscroll=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{const strip=$('photo-strip'),center=strip.scrollLeft+strip.clientWidth/2;let closest=0,distance=Infinity;[...strip.children].forEach((c,i)=>{const d=Math.abs(c.offsetLeft-strip.offsetLeft+c.clientWidth/2-center);if(d<distance){distance=d;closest=i}});if(strip.scrollWidth>strip.clientWidth+5){if(strip.scrollLeft<2)closest=0;else if(strip.scrollLeft>=strip.scrollWidth-strip.clientWidth-2)closest=strip.children.length-1;photo(closest,false)}},180)};
$('seek').oninput=()=>{const el=player();if(Number.isFinite(el.duration)){el.currentTime=+$('seek').value/100*el.duration;if(current().audio&&Number.isFinite(video.duration))video.currentTime=el.currentTime%video.duration;drawAll()}};$('volume').oninput=()=>{if(master)master.gain.value=+$('volume').value;else player().volume=+$('volume').value};$('fx').onclick=()=>{fx=!fx;$('fx').setAttribute('aria-pressed',String(fx));$('fx-state').textContent=fx?'ON':'OFF';if(fx)sound()};$('order').onchange=()=>sound();$('autoplay').onchange=()=>sound();document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.bird-item,#random,#next,#fx'))sound()});document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY/.test(document.activeElement.tagName)){e.preventDefault();toggle()}});$('bird-art').onerror=()=>{$('bird-art').hidden=true;$('art-error').hidden=false};
function resize(){for(const p of Object.values(plots)){const r=p.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);p.w=Math.round(r.width);p.h=Math.round(r.height);p.canvas.width=Math.round(p.w*dpr);p.canvas.height=Math.round(p.h*dpr);p.g.setTransform(dpr,0,0,dpr,0,0)}drawAll()}
new ResizeObserver(resize).observe(document.querySelector('.sheet-grid'));
function buildSpectrogram(){const rows=analysis.spectrogram,bands=analysis.bands;specImage.width=rows.length;specImage.height=bands;const g=specImage.getContext('2d'),pixels=g.createImageData(rows.length,bands);for(let x=0;x<rows.length;x++)for(let y=0;y<bands;y++){const value=rows[x][bands-1-y]/255;const strength=Math.max(0,(value-.3)/.7)**1.65;const k=(y*rows.length+x)*4;pixels.data[k]=Math.round(247-191*strength);pixels.data[k+1]=Math.round(242-201*strength);pixels.data[k+2]=Math.round(230-202*strength);pixels.data[k+3]=255}g.putImageData(pixels,0,0)}
function clear(p){p.g.clearRect(0,0,p.w,p.h)}
function cursor(g,x,top,bottom){g.strokeStyle='#a77550';g.lineWidth=1;g.beginPath();g.moveTo(x,top);g.lineTo(x,bottom);g.stroke();g.fillStyle='#a77550';g.beginPath();g.arc(x,top,2.5,0,Math.PI*2);g.fill()}
function drawSpectrogram(){const p=plots.spectrogram,{g,w,h}=p;clear(p);if(!analysis||w<1||h<1)return;g.imageSmoothingEnabled=true;g.drawImage(specImage,30,9,w-38,h-26);const progress=Math.min(1,player().currentTime/analysis.duration);if(player().currentTime>0)cursor(g,30+progress*(w-38),8,h-17)}
function drawWave(){const p=plots.waveform,{g,w,h}=p;clear(p);if(!analysis)return;const arr=analysis.envelope,max=Math.max(...arr,.001),progress=player().currentTime/analysis.duration;g.lineWidth=1;for(let i=0;i<w-48;i++){const j=Math.floor(i/(w-48)*arr.length),amp=(arr[j]/max)**.8*(h*.37);g.strokeStyle=i/(w-48)<progress?'#8b5c3c':'#c7b591';g.beginPath();g.moveTo(24+i,h/2-amp);g.lineTo(24+i,h/2+amp);g.stroke()}if(player().currentTime>0)cursor(g,24+Math.min(1,progress)*(w-48),14,h-14)}
function drawPower(){const p=plots.power,{g,w,h}=p;clear(p);if(!analysis)return;const row=analysisRow(analysis,player().currentTime);const gradient=g.createLinearGradient(24,0,w-24,0);gradient.addColorStop(0,'#3d3026');gradient.addColorStop(.5,'#a5865a');gradient.addColorStop(1,'#e6d8b5');g.fillStyle=gradient;g.beginPath();g.moveTo(24,h-18);for(let i=0;i<row.length;i++){const value=Math.max(0,(row[i]/255-.2)/.8);g.lineTo(24+i/(row.length-1)*(w-48),h-18-value*(h-35))}g.lineTo(w-24,h-18);g.closePath();g.fill()}
function drawAcoustic(){
  const p=plots.acoustic,{g,w,h}=p;clear(p);
  const status=$('acoustic-progress');
  if(!acousticModel||w<1){status.textContent=selectedAnalysisUrl?'PREPARANDO…':'SIN ANÁLISIS';return}
  const {nodes}=acousticModel;
  const state=acousticFrame(acousticModel,player().currentTime,reduced);
  const {t,count,active,link,energy,birth}=state;
  const label=`${String(count).padStart(2,'0')} / ${nodes.length} FRAGMENTOS`;
  if(status.textContent!==label)status.textContent=label;
  const description=`Espacio acústico: ${count} de ${nodes.length} fragmentos revelados. Se dibuja al reproducir. Arrastra o usa las flechas para girar. Inicio restablece la vista.`;
  if(p.canvas.getAttribute('aria-label')!==description)p.canvas.setAttribute('aria-label',description);
  const turn=yaw+state.turn,cy=Math.cos(turn),sy=Math.sin(turn),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const scale=Math.min(w*.27,h*.48);
  const project=node=>{
    const rx=node.x*cy-node.z*sy,rz=node.x*sy+node.z*cy;
    const ry=node.y*cp-rz*sp,depth=node.y*sp+rz*cp,perspective=3.8/(3.8+depth);
    return {x:w/2+rx*scale*perspective,y:h*.51-ry*scale*.6*perspective,z:depth,r:(4+(node.y+1)*7)*perspective};
  };
  // A quiet orbit gives the first notes somewhere to appear.
  g.strokeStyle='#c9b99a55';g.lineWidth=1;g.setLineDash([3,7]);
  g.beginPath();g.ellipse(w/2,h*.53,Math.min(w*.34,h*.55),h*.22,0,0,Math.PI*2);g.stroke();g.setLineDash([]);
  if(!count){
    g.fillStyle='#827360';g.font='12px "DM Sans",sans-serif';g.textAlign='center';
    g.fillText(t>0||playing?'Escucha cómo toma forma…':'Dale play para dibujar el sonido',w/2,h*.51);
    return;
  }
  const points=nodes.slice(0,count).map((node,i)=>({...project(node),i,node}));
  g.lineWidth=1.5;g.strokeStyle='#927a5875';
  for(let i=1;i<points.length;i++){
    g.beginPath();g.moveTo(points[i-1].x,points[i-1].y);g.lineTo(points[i].x,points[i].y);g.stroke();
  }
  // The leading ink point traces the next chronological connection.
  if(link>0){
    const a=points[active],b=project(nodes[count]);
    const x=a.x+(b.x-a.x)*link,y=a.y+(b.y-a.y)*link;
    g.strokeStyle='#a77550';g.lineWidth=2;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(x,y);g.stroke();
    g.fillStyle='#9d6747';g.beginPath();g.arc(x,y,2.5+energy*2,0,Math.PI*2);g.fill();
  }
  points.sort((a,b)=>b.z-a.z);
  for(const point of points){
    const isActive=point.i===active;
    const reveal=isActive?birth:1;
    const r=point.r*(.3+.7*reveal);
    const light=Math.round(74-point.i/Math.max(1,nodes.length-1)*49);
    g.globalAlpha=.25+.75*reveal;
    const gradient=g.createRadialGradient(point.x-r*.35,point.y-r*.4,r*.08,point.x,point.y,r);
    gradient.addColorStop(0,`hsl(37 33% ${Math.min(91,light+23)}%)`);
    gradient.addColorStop(.6,`hsl(33 27% ${light}%)`);
    gradient.addColorStop(1,`hsl(29 25% ${Math.max(12,light-19)}%)`);
    g.fillStyle=gradient;g.beginPath();g.arc(point.x,point.y,r,0,Math.PI*2);g.fill();
    g.strokeStyle='#5f4b3435';g.lineWidth=.7;g.stroke();
    if(isActive){
      g.strokeStyle='#b78b5a';g.lineWidth=1.4;g.beginPath();g.arc(point.x,point.y,r+4+energy*7,0,Math.PI*2);g.stroke();
      const age=t-point.node.t;
      if(!reduced&&age<.8){
        g.globalAlpha=(1-age/.8)*.45;g.beginPath();g.arc(point.x,point.y,r+6+age*26,0,Math.PI*2);g.stroke();
      }
    }
    g.globalAlpha=1;
    if(isActive){
      g.fillStyle='#574330';g.font='10px "DM Sans",sans-serif';g.textAlign='center';
      g.fillText(point.node.rms.toFixed(3),point.x,point.y-r-8);
    }
  }
}
function drawAll(){drawSpectrogram();drawWave();drawPower();drawAcoustic()}
function animate(){if(!frame)frame=requestAnimationFrame(tick)}
function tick(now){frame=0;if(!playing||document.hidden)return;if(now-lastFrame>(reduced?160:40)){lastFrame=now;drawAll()}else if(!reduced)drawAcoustic();animate()}
$('acoustic').onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};$('acoustic').setPointerCapture(e.pointerId)};$('acoustic').onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.009;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-drag.y)*.009));drag={x:e.clientX,y:e.clientY};drawAcoustic()};$('acoustic').onpointerup=$('acoustic').onpointercancel=()=>drag=null;$('acoustic').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){yaw=-.45;pitch=.22}else{yaw+=e.key==='ArrowRight'?.15:e.key==='ArrowLeft'?-.15:0;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.key==='ArrowDown'?.15:e.key==='ArrowUp'?-.15:0)))}drawAcoustic()};$('reset-view').onclick=()=>{yaw=-.45;pitch=.22;drawAcoustic()};document.addEventListener('visibilitychange',()=>{if(!document.hidden&&playing)animate()});
motionPreference.addEventListener('change',event=>{reduced=event.matches;drawAll()});
document.querySelector('.library-heading h2 span').textContent='/ '+birds.length;
$('catalog-source').href=source.url;$('catalog-source').textContent=birds.length+' fichas · radio de 5 km · iNaturalist';
renderAnnex(birds,n=>changeBird(n,false));
loadBird();resize();
// The local server rebuilds the index when files are pasted. Refresh an idle page.
if(location.hostname==='127.0.0.1'||location.hostname==='localhost'){
 let revision=contentRevision;
 setInterval(async()=>{try{const r=await fetch('/__content-version',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.error){$('status').textContent='No se pudo actualizar el contenido: '+data.error;return}if(revision&&revision!==data.version&&!playing)location.reload();revision??=data.version}catch{}},2500);
}
if(document.modelContext?.registerTool){for(const tool of [{name:'list_birds',description:'Listar aves y consultar la selección actual.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({birds:birds.map(({id,name})=>({id,name})),selected:current().id})},{name:'select_bird',description:'Seleccionar un ave de la biblioteca y dejar la reproducción pausada.',inputSchema:{type:'object',properties:{id:{type:'string',enum:birds.map(b=>b.id)}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{const n=birds.findIndex(b=>b.id===input?.id);if(n<0)throw Error('Ave desconocida');if(changing)throw Error('Espera a que termine la transición');await changeBird(n,false);return {selected:current().id}}}]){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}}
