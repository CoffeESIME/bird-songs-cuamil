import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {embedURL} from '../dist/embeds.js';
test('Only recognized HTTPS media providers can become embeds',()=>{
 assert.equal(embedURL('https://youtu.be/dQw4w9WgXcQ'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 assert.equal(embedURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 assert.equal(embedURL('https://open.spotify.com/track/abc123?si=foo'),'https://open.spotify.com/embed/track/abc123');
 assert.equal(embedURL('https://music.apple.com/mx/album/test/123?i=456'),'https://embed.music.apple.com/mx/album/test/123?i=456');
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/embed/dQw4w9WgXcQ','http://youtube.com/watch?v=dQw4w9WgXcQ','https://evil.test','https://open.spotify.com/evil/123','https://youtube.com/embed/nope'])assert.equal(embedURL(url),null);
});
test('Every imported taxon has a unique editable folder and no demo media',async()=>{
 const {birds}=JSON.parse(await readFile(new URL('../dist/content-index.json',import.meta.url),'utf8'));
 const snapshot=JSON.parse(await readFile(new URL('../inaturalist-species.json',import.meta.url),'utf8'));
 const selected=JSON.parse(await readFile(new URL('../selected-species.json',import.meta.url),'utf8'));
 assert.deepEqual(birds.map(b=>b.scientific).sort(),[...selected].sort());
 assert.deepEqual(snapshot.results.map(({taxon})=>taxon.name).sort(),[...selected].sort());
 assert.equal(new Set(birds.map(b=>b.id)).size,birds.length);
 for(const {taxon} of snapshot.results)assert.ok(birds.some(b=>b.taxonId===taxon.id),taxon.name);
 for(const bird of birds){assert.equal(bird.demo,false);assert.ok(!JSON.stringify(bird.media).includes('sample-'));await readFile(new URL('../dist/'+bird.contentPath+'notas.md',import.meta.url));}
});
