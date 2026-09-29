export function embedURL(value) {
  let url;try{url=new URL(value)}catch{return null}
  if(url.protocol!=='https:')return null;
  const host=url.hostname;
  if(['www.youtube.com','youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host)) {
    const id=host==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
    return /^[\w-]{11}$/.test(id||'')?`https://www.youtube-nocookie.com/embed/${id}`:null;
  }
  if(host==='open.spotify.com' && /^\/(?:embed\/)?(?:track|album|playlist|episode)\/[a-zA-Z0-9]+$/.test(url.pathname)) return `https://open.spotify.com/embed/${url.pathname.replace(/^\/(?:embed\/)?/,'')}`;
  if(['music.apple.com','embed.music.apple.com'].includes(host) && /^\/[a-z]{2}\/(album|playlist|song)\//.test(url.pathname)) return `https://embed.music.apple.com${url.pathname}${url.search}`;
  return null;
}
