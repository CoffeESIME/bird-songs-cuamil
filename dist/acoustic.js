const clamp=value=>Math.max(0,Math.min(1,value));

// Normalize once per recording so earlier points never move as new ones arrive.
export function prepareAcoustic(data){
  const ranges=['centroid','spread','rms'].map(key=>{
    const values=data.nodes.map(node=>node[key]);
    return [Math.min(...values),Math.max(...values)];
  });
  const scaled=(value,i)=>(value-ranges[i][0])/Math.max(ranges[i][1]-ranges[i][0],.00001)*2-1;
  return {
    nodes:data.nodes.map(node=>({...node,x:scaled(node.centroid,0),y:scaled(node.rms,2),z:scaled(node.spread,1)})),
    envelope:data.envelope,peak:Math.max(...data.envelope,.001),duration:data.duration
  };
}

// Everything follows media time, including the camera and pulse. Pausing,
// buffering, seeking and replaying therefore need no separate animation clock.
export function acousticFrame(model,currentTime,reduced=false){
  const t=Math.max(0,currentTime);
  const count=model.nodes.filter(node=>node.t<=t).length;
  const active=count-1,previous=model.nodes[active],next=model.nodes[count];
  const link=previous&&next?clamp((t-previous.t)/Math.max(.001,next.t-previous.t)):0;
  const position=clamp(t/model.duration)*(model.envelope.length-1),i=Math.floor(position);
  const amplitude=(model.envelope[i]||0)*(1-(position-i))+(model.envelope[i+1]??model.envelope[i]??0)*(position-i);
  return {t,count,active,link:reduced?0:link,turn:reduced?0:t*.045,
    energy:reduced?0:Math.sqrt(amplitude/model.peak),
    birth:previous?(reduced?1:1-(1-clamp((t-previous.t)/.45))**4):0};
}
