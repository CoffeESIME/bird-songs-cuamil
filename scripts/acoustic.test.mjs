import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareAcoustic,acousticFrame} from '../dist/acoustic.js';
import {birds} from '../dist/catalog-demo.js';

for(const bird of birds){
  const data=JSON.parse(await readFile(new URL(`../dist/${bird.analysis}`,import.meta.url),'utf8'));
  const model=prepareAcoustic(data);
  test(`${bird.id}: reveal only elapsed fragments; rewind and replay reset`,()=>{
    assert.equal(acousticFrame(model,0).count,0);
    data.nodes.forEach((node,i)=>{
      assert.equal(acousticFrame(model,node.t-.0001).count,i);
      assert.equal(acousticFrame(model,node.t).count,i+1);
    });
    assert.equal(acousticFrame(model,data.duration).count,data.nodes.length);
    assert.equal(acousticFrame(model,data.nodes[4].t).count,5);
    assert.equal(acousticFrame(model,0).count,0);
  });
  test(`${bird.id}: frozen media time freezes the entire scene`,()=>{
    const t=data.nodes[12].t+.12,paused=acousticFrame(model,t);
    acousticFrame(model,t+3);
    assert.deepEqual(acousticFrame(model,t),paused);
    assert.ok(paused.energy>=0&&paused.energy<=1);
    assert.ok(paused.birth>0&&paused.birth<1);
  });
  test(`${bird.id}: reduced motion keeps progress without animated effects`,()=>{
    const t=data.nodes[8].t+.05,normal=acousticFrame(model,t),reduced=acousticFrame(model,t,true);
    assert.equal(reduced.count,normal.count);
    for(const key of ['turn','energy','link'])assert.equal(reduced[key],0);
    assert.equal(reduced.birth,1);
  });
}

test('identical/silent fragments normalize to finite coordinates',()=>{
  const model=prepareAcoustic({nodes:[{t:1,centroid:0,spread:0,rms:0}],envelope:[0],duration:2});
  assert.ok(['x','y','z'].every(key=>Number.isFinite(model.nodes[0][key])));
  assert.equal(acousticFrame(model,1).energy,0);
  assert.equal(acousticFrame(model,2).count,1);
});
