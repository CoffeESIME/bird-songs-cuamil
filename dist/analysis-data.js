export function analysisRow(data,time) {
  const step=data.rowSeconds||data.hop/data.sampleRate;
  return data.spectrogram[Math.max(0,Math.min(data.spectrogram.length-1,Math.floor(time/step)))];
}
export function recordingAnalysis(bird,src) {
  return bird.recordingAnalyses?.[src] || (src===bird.audio?bird.analysis:null) || null;
}
export function validateAnalysis(data) {
  if(!(data.duration>0)||!(data.sampleRate>0)||!(data.hop>0)||!data.spectrogram?.length||!data.envelope?.length||!data.nodes?.length) throw Error('Incomplete analysis');
  if(data.rowSeconds!==undefined&&(!(data.rowSeconds>0)||Math.abs(data.rowSeconds*data.spectrogram.length-data.duration)>.001)) throw Error('Invalid analysis timing');
  if(data.spectrogram.some(row=>row.length!==data.bands||row.some(v=>!Number.isFinite(v)||v<0||v>255))||data.envelope.some(v=>!Number.isFinite(v)||v<0)||data.nodes.some((n,i)=>['t','centroid','spread','rms'].some(k=>!Number.isFinite(n[k])||n[k]<0)||n.t>data.duration||(i&&n.t<data.nodes[i-1].t))) throw Error('Invalid analysis values');
  return data;
}
