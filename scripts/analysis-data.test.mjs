import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisRow,recordingAnalysis,validateAnalysis} from '../dist/analysis-data.js';
test('compacted spectra follow recording time including seek and end',()=>{
 const data={rowSeconds:2,spectrogram:[[0],[1],[2]],hop:256,sampleRate:24000};
 assert.deepEqual(analysisRow(data,0),[0]);assert.deepEqual(analysisRow(data,3),[1]);assert.deepEqual(analysisRow(data,6),[2]);assert.deepEqual(analysisRow(data,-1),[0]);
 delete data.rowSeconds;assert.deepEqual(analysisRow(data,256/24000),[1]);
});
test('a different recording never borrows the primary analysis',()=>{
 const bird={audio:'a.mp3',analysis:'a.json',recordingAnalyses:{'b.wav':'b.json'}};
 assert.equal(recordingAnalysis(bird,'a.mp3'),'a.json');assert.equal(recordingAnalysis(bird,'b.wav'),'b.json');assert.equal(recordingAnalysis(bird,'c.mp3'),null);
});
test('malformed analysis is rejected before plotting',()=>{
 const data={duration:1,sampleRate:24000,hop:256,bands:1,rowSeconds:1,spectrogram:[[1]],envelope:[.1],nodes:[{t:0,centroid:100,spread:1,rms:.1}]};
 assert.equal(validateAnalysis(data),data);
 assert.throws(()=>validateAnalysis({...data,rowSeconds:2}));assert.throws(()=>validateAnalysis({...data,spectrogram:[[NaN]]}));
});
