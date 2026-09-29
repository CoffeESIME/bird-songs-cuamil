import {marked} from './vendor/marked.js';
import DOMPurify from './vendor/purify.js';

import {embedURL} from './embeds.js';
function frame(src,title) {
  const el=document.createElement('iframe');el.src=src;el.title=title || 'Reproductor multimedia';el.loading='lazy';
  el.allow='encrypted-media; fullscreen; picture-in-picture';el.referrerPolicy='strict-origin-when-cross-origin';
  el.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation allow-popups');
  el.className=src.includes('youtube')?'embed-video':'embed-music';return el;
}
export function renderMarkdown(target, markdown, base) {
  const fragment=DOMPurify.sanitize(marked.parse(markdown),{RETURN_DOM_FRAGMENT:true,ADD_TAGS:['iframe'],ADD_ATTR:['src'],FORBID_TAGS:['style','form','input','button'],FORBID_ATTR:['style']});
  for(const el of fragment.querySelectorAll('iframe')) {
    const src=embedURL(el.getAttribute('src'));
    if(src)el.replaceWith(frame(src,el.title));else el.remove();
  }
  for(const el of fragment.querySelectorAll('a,img')) {
    const attr=el.tagName==='IMG'?'src':'href', raw=el.getAttribute(attr);
    if(!raw){el.removeAttribute(attr);continue}
    let resolved;try{resolved=new URL(raw,new URL(base,location.href))}catch{el.removeAttribute(attr);continue}
    if(!['http:','https:'].includes(resolved.protocol)){el.removeAttribute(attr);continue}
    el.setAttribute(attr,resolved.href);
    if(el.tagName==='IMG'){el.loading='lazy';continue}
    el.rel='noopener noreferrer';el.target='_blank';
    const embed=embedURL(resolved.href);
    if(embed && el.parentElement.tagName==='P' && el.parentElement.children.length===1 && el.parentElement.textContent.trim()===el.textContent.trim()) {
      const wrapper=document.createElement('div');wrapper.className='embed-block';wrapper.append(frame(embed,el.textContent),el.cloneNode(true));el.parentElement.replaceWith(wrapper);
    }
  }
  target.replaceChildren(fragment);
}
export function renderAnnex(birds,select) {
  const section=document.getElementById('annex'), list=document.getElementById('annex-list');list.replaceChildren();
  const entries=birds.filter(b=>b.hasNotes);section.hidden=!entries.length;
  for(const bird of entries){
    const item=document.createElement('details');item.id=`anexo-${bird.id}`;
    const title=document.createElement('summary');title.textContent=bird.name;
    const subtitle=document.createElement('p');subtitle.className='scientific';subtitle.textContent=bird.scientific;
    const body=document.createElement('div');body.className='markdown';
    // Parse and mount players only when an entry is opened.
    item.addEventListener('toggle',()=>{if(item.open && !body.dataset.loaded){renderMarkdown(body,bird.notes,bird.contentPath);body.dataset.loaded='true'}if(!item.open){body.replaceChildren();delete body.dataset.loaded}});
    const button=document.createElement('button');button.className='text-button';button.textContent='Volver a la ficha ↑';button.onclick=()=>{select(birds.indexOf(bird));document.querySelector('.library').scrollIntoView({behavior:'smooth'})};
    item.append(title,subtitle,body,button);list.append(item);
  }
}
