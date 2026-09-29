# Importar cantos y vocalizaciones

Desde `aviario/`, con Node 20.12 o posterior, sin instalar dependencias nuevas:

```powershell
npm run birds:audio -- --bird accipiter-striatus --dry-run --limit 1
npm run birds:audio -- --bird accipiter-striatus --bird haemorhous-mexicanus --bird turdus-migratorius --limit 1 --verify-decode
npm run birds:audio -- --missing
npm run birds:audio -- --all
```

`--all` y `--missing` son opciones preparadas para una importación posterior. Las pruebas iniciales sólo descargan una grabación de cada una de las tres especies indicadas. Sin selector, el comando se detiene y muestra cómo elegirlo; nunca comienza una importación masiva por defecto.

## Fuentes y credenciales

La [API oficial de Xeno-canto v3](https://xeno-canto.org/explore/api), consultada el 28 de septiembre de 2026, requiere una clave y consultas etiquetadas: `sp:"Accipiter striatus"`. No se utiliza la API v2 ni scraping de grabaciones. El adaptador comprueba `gen + sp` y `status: identified`, para excluir identificaciones cuestionadas/no confirmadas. No se aceptan coincidencias sólo por nombre común ni se resuelven sinónimos de forma implícita.

Configura la clave en `aviario/.env` como `XENO_CANTO_API_KEY=tu-clave` (archivo ignorado por Git), o en la terminal antes de ejecutar. El importador carga `.env` automáticamente; una variable ya configurada en el entorno tiene prioridad:

```powershell
$env:XENO_CANTO_API_KEY = 'tu-clave-de-la-cuenta-Xeno-canto'
npm run birds:audio -- --bird accipiter-striatus --dry-run
```

La clave nunca se escribe en metadatos, reportes o errores. Sin clave se informa que Xeno-canto no está disponible y se consulta iNaturalist. Las pruebas unitarias verifican su consulta v3, normalización y paginación con respuestas simuladas; la prueba en vivo con la clave configurada se describe al final.

`--source both` (predeterminado) compara ambas fuentes. `--source xeno-canto` permite seleccionar sólo esta colección para añadir referencias sin reemplazar los audios locales existentes; requiere clave. `--source inaturalist` consulta sólo iNaturalist. `--limit` sigue contando todos los audios existentes, independientemente de su fuente.

La [API oficial de iNaturalist](https://api.inaturalist.org/v1/docs/) resuelve primero el nombre científico; después exige que la observación coincida con el identificador y nombre científico de especie y tenga grado `research`. Se omiten subespecies y géneros si no hay coincidencia exacta, en lugar de atribuirles sonidos de otra identificación. Los dos géneros del catálogo se registran como omitidos. Cada sonido tiene licencia independiente: nunca se usa la licencia de la observación o de una foto.

## Selección y límites

1. Coincidencia taxonómica verificable; sonidos ocultos/marcados excluidos.
2. Licencia aceptada, autor e identificador presentes; calidad D/E de XC excluida.
3. Orden geográfico: ≤5 km, Cuajimalpa, CDMX, Estado/Valle de México, México, resto.
4. Dentro de cada ámbito: calidad A/B/C/sin calificar, tipo conocido, preferencia por XC, integridad de metadatos, distancia, identificador estable.
5. Diversidad de tipos dentro del mejor ámbito geográfico; máximo 1–3 archivos **totales** por especie, incluidos los existentes. Los tipos desconocidos no se convierten en `song` o `call` por suposición.

La calidad de XC sirve como aproximación de claridad/ruido; no hay análisis automático ni escucha humana garantizada. iNaturalist no califica la calidad acústica: `research` es evidencia taxonómica. Los campos de una observación no se atribuyen automáticamente a todos sus sonidos. Por eso `originalType` y `quality` pueden ser `null`.

Se consulta por separado el ámbito local, México y el mundo, paginando cada consulta. `--max-pages N` limita cada ámbito (5 por defecto, 100 resultados/página, máximo 100 páginas); el reporte avisa si quedan resultados sin examinar. No se afirma haber encontrado el mejor audio de toda la colección cuando la búsqueda está truncada. La consulta local independiente evita que el límite global oculte los resultados cercanos. Los candidatos repetidos entre ámbitos se deduplican por `source + sourceId`.

La distancia usa Haversine y coordenadas suministradas, nunca geocodificación. Las coordenadas ocultas/privadas de iNaturalist se omiten porque su punto público puede estar desplazado. `local` se calcula antes de redondear la distancia. El país México se confirma con el lugar oficial 6793; países extranjeros no suministrados explícitamente quedan en `null`, no se deducen del texto libre. Los nombres de localidad sólo orientan las categorías regionales.

## Licencias y archivos

Se admiten CC0, CC BY, BY-SA, BY-NC y BY-NC-SA. `--commercial` excluye NC. ND se excluye por defecto: `--allow-nd` habilita únicamente almacenamiento del original sin editar y registra `derivativesAllowed: false`. Antes de habilitarlo confirma que el uso previsto es compatible. El importador no convierte, recorta, normaliza ni analiza para generar obras derivadas.

`license` guarda el valor exacto original (código en iNaturalist, URL en XC); `licenseLabel` es la etiqueta legible y `licenseUrl` el enlace. Las versiones 4.0 y CC0 1.0 para códigos de iNaturalist siguen su [módulo oficial de licencias](https://github.com/inaturalist/inaturalist/blob/main/app/models/shared/license_module.rb). Se conserva además la atribución literal cuando existe.

Los archivos se guardan con extensión comprobada por firma (`other-01.mp3`, `call-01.wav`, etc.); no se cambia una extensión para aparentar MP3. Descargas limitadas a 40 MiB, con timeout y rechazo de HTML. `--verify-decode` requiere ffmpeg en PATH y decodifica a un destino nulo, sin alterar los originales; si falla, no se importa el archivo. Sin esa opción sólo se valida la firma del contenedor. `sha256`, tamaño y método de validación quedan registrados.

`ave.json` conserva todas las propiedades previas y añade `audio`. Se escribe por reemplazo atómico y se comprueba que no hubo una edición concurrente. Los nombres existentes nunca se sobrescriben. Un bloqueo de importación impide descargas simultáneas; tras un cierre forzado, revisa que no quede un proceso activo antes de retirar `dist/.audio-import.lock`. Un archivo ya registrado pero ausente genera un error explícito para revisar, no una copia silenciosa.

El catálogo conserva la ruta `audio` que espera el reproductor y expone los metadatos como `audioCredits`, visibles en la ficha con enlaces de autoría/fuente/licencia. El importador no regenera el sitio; el servidor ya detecta cambios, y `npm run content:build` actualiza el catálogo para publicación.

## Reporte y comprobaciones

Una ejecución real escribe `dist/audio-import-report.json`: candidatos y motivos de rechazo, selección y razones, archivos, licencias, avisos de paginación y errores por especie/fuente. Cada ejecución reemplaza ese reporte, no los audios anteriores. `--dry-run` muestra la selección y alternativas sin escribir archivos, carpetas ni reporte. `speciesWithAudio` representa archivos existentes/importados, mientras `wouldDownload` representa la propuesta del dry-run.

Los contadores local, CDMX y México se solapan (un sonido local puede pertenecer a los tres); países desconocidos se cuentan aparte. Los errores por especie no detienen las demás, pero devuelven código de salida 1. Un resultado vacío o la ausencia de clave XC son avisos y no fabrican grabaciones.

```powershell
node --test scripts/bird-audio.test.mjs
npm run check
```

Las pruebas cubren licencias por archivo, ND, filtrado comercial, identidad, coordenadas ocultas y límite de 5 km, selección, paginación XC, colisiones de archivos, respuestas HTML y preservación de metadatos.

## Resultado de la prueba inicial

Se ejecutó primero dry-run y luego descarga con `--limit 1 --max-pages 2 --verify-decode`, sólo para estas tres especies. Se revisaron 822 candidatos únicos; 284 quedaron fuera por licencia (incluye ND no habilitado). La búsqueda mundial quedó truncada para mirlo y pinzón, además de la búsqueda mexicana del pinzón; las consultas locales se completaron. No se ejecutó `--all` ni `--missing`.

| Especie | Candidatos / elegibles | Selección iNaturalist | Autor | Licencia | Ubicación / distancia UAM | Archivo / duración |
|---|---:|---|---|---|---|---|
| Accipiter striatus | 96 / 66 | [812271](https://www.inaturalist.org/observations/183222570) | Efraín Octavio Aguilar Pérez | CC BY-NC 4.0 | Colinas de San Javier, Guadalajara / 454.911 km | `other-01.mp3` / 8.678 s |
| Haemorhous mexicanus | 382 / 250 | [191588](https://www.inaturalist.org/observations/74627948) | Arturo Crespo Moctezuma | CC BY 4.0 | Bosques de Tarango, CDMX / 3.199 km | `other-01.wav` / 11.459 s |
| Turdus migratorius | 344 / 222 | [1067112](https://www.inaturalist.org/observations/219084794) | prm66 | CC BY-NC 4.0 | Calle Julián Adame, Cuajimalpa / 1.863 km | `other-01.m4a` / 21.455 s |

El gavilán seleccionado fue el candidato mexicano elegible más cercano; pinzón y mirlo fueron locales. El pinzón a 2.676 km se rechazó porque no tenía licencia reutilizable declarada. Todos los seleccionados tienen identificación de investigación y coincidencia científica exacta. Ninguno proporciona una clasificación acústica por sonido: `type: other`, `originalType: null`, `quality: null`. Las licencias NC requieren mantener un uso no comercial.

Los tres originales pasaron decodificación completa en ffmpeg; ffprobe confirmó MP3, PCM en WAV y AAC en M4A respectivamente. `npm run check` pasó las 25 pruebas y la verificación de archivos. `node scripts/verify-audio-trial.mjs` comprobó hashes, rutas, atribuciones, preservación de los campos originales de `ave.json`, dry-run sin escrituras y segunda ejecución con **0 descargas / 3 omitidos**, sin duplicados. Este auditor compara con las fichas del commit inicial y está destinado a esta prueba de una grabación por especie.

Evidencia: [reporte completo](dist/audio-import-report.json) y [validación](dist/audio-trial-validation.json). La fecha de `downloadedAt` usa UTC, por lo que esta prueba realizada el 28 de septiembre en México figura como 29 de septiembre UTC.

## Prueba en vivo de Xeno-canto con clave configurada

Se validó la clave desde `.env`, primero en dry-run y después con descarga. El filtro `--source xeno-canto --limit 2 --max-pages 2 --verify-decode` añadió una referencia por especie a los originales de iNaturalist. No se ejecutó una descarga masiva. El límite de dos páginas truncó las búsquedas mundiales de pinzón y mirlo; no las consultas mexicanas ni locales de XC.

| Especie | Candidatos / elegibles XC | Grabación | Autor | Tipo original | Calidad | Ubicación / distancia | Duración |
|---|---:|---|---|---|---|---|---:|
| Accipiter striatus | 51 / 45 | [XC676528](https://xeno-canto.org/676528) | Richard E. Webster | call | C | Mesa El Campanero, Yécora, Sonora / 1408.906 km | 328.026 s |
| Haemorhous mexicanus | 282 / 247 | [XC314416](https://xeno-canto.org/314416) | Manuel Grosselet | call | A | Lomas de Bezares, Miguel Hidalgo, CDMX / 5.885 km | 59.240 s |
| Turdus migratorius | 245 / 227 | [XC398608](https://xeno-canto.org/398608) | Manuel Grosselet | call, song | A | Lomas de Bezares, Miguel Hidalgo, CDMX / 5.885 km | 49.999 s |

Las tres licencias son CC BY-NC-SA 4.0 y los archivos son MP3 originales. Se eligieron por región, calidad y desempates documentados; ninguno de los nuevos audios está dentro de 5 km. Los originales locales de iNaturalist siguen disponibles. La decodificación completa pasó y `npm run check` volvió a pasar las 25 pruebas. El auditor ahora admite entre una y tres grabaciones por especie (mismo número en las tres especies de prueba); verificó los seis archivos, atribuciones, campos originales y segunda ejecución con **0 descargas y 6 omitidos**.

El [reporte inicial de iNaturalist](dist/audio-inaturalist-trial-report.json) se conserva por separado. El [reporte actual](dist/audio-import-report.json) contiene la prueba de Xeno-canto y sus candidatos; [la validación](dist/audio-trial-validation.json) abarca las seis grabaciones.
