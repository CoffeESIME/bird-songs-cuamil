import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
const root = new URL('../dist/content/', import.meta.url);
const endpoint = 'https://api.inaturalist.org/v1/observations/species_counts?lat=19.3525&lng=-99.2824&radius=5&taxon_id=3&per_page=500&locale=es-MX';
const selected = new Set(JSON.parse(await readFile(new URL('../selected-species.json', import.meta.url), 'utf8')));
let snapshot;
if (process.argv.includes('--snapshot')) snapshot = JSON.parse(await readFile(new URL('../inaturalist-species.json', import.meta.url)));
else {
  const results = []; let total = Infinity;
  for (let page = 1; results.length < total; page++) {
    const response = await fetch(`${endpoint}&page=${page}`);
    if (!response.ok) throw Error(`iNaturalist: ${response.status}`);
    const data = await response.json(); total = data.total_results;
    if (!data.results.length && results.length < total) throw Error('Respuesta incompleta de iNaturalist');
    results.push(...data.results);
  }
  snapshot = {total_results: total, results};
}
if (snapshot.results.length !== snapshot.total_results) throw Error('Catálogo incompleto');
snapshot.results = snapshot.results.filter(({taxon}) => selected.has(taxon.name));
const missing = [...selected].filter(name => !snapshot.results.some(({taxon}) => taxon.name === name));
if (missing.length) throw Error(`Faltan especies seleccionadas: ${missing.join(', ')}`);
snapshot.total_results = snapshot.results.length;
await writeFile(new URL('../inaturalist-species.json', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n');
await mkdir(root, {recursive:true});
for (const {taxon, count} of snapshot.results) {
  const id = taxon.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const dir = new URL(`${id}/`, root);
  await mkdir(dir, {recursive:true});
  for (const folder of ['fotos', 'videos', 'audio']) await mkdir(new URL(`${folder}/`,dir), {recursive:true});
  const metadata = {id, name:taxon.preferred_common_name || taxon.name, scientific:taxon.name,
    aliases: [taxon.english_common_name].filter(Boolean), taxonId:taxon.id, rank:taxon.rank,
    source:`https://www.inaturalist.org/taxa/${taxon.id}`, observations:count};
  // Existing authored files are never overwritten, including notes and names.
  for (const [file, content] of [['ave.json', JSON.stringify(metadata,null,2)+'\n'], ['notas.md', '<!-- Escribe aquí notas, poemas o enlaces. Solo aparecerá el anexo si hay contenido. -->\n']]) {
    try {await access(new URL(file,dir));} catch {await writeFile(new URL(file,dir),content);}
  }
}
await writeFile(new URL('source.json',root),JSON.stringify({url:'https://www.inaturalist.org/observations?lat=19.3525&lng=-99.2824&radius=5&taxon_id=3&view=species',api:endpoint,importedAt:new Date().toISOString(),count:snapshot.total_results},null,2));
console.log(`${snapshot.results.length} especies sincronizadas; contenido existente conservado.`);
