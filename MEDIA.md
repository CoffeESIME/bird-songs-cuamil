# Fotografías y videos por especie

La fuente editable sigue siendo `dist/content/<id>/ave.json`, con `fotos/`, `videos/`, `audio/` y `notas.md`. No se modifican audios ni notas. El catálogo conserva las atribuciones individuales y las muestra junto a las atribuciones de audio.

## Comandos

Requiere Node 22 y `ffmpeg`/`ffprobe` disponibles en PATH. Desde `aviario/`:

```sh
npm run birds:media -- --bird accipiter-striatus --dry-run --allow-nc
npm run birds:media -- --bird accipiter-striatus --allow-nc --plan reports/media-dry-run.json
npm run birds:media -- --missing --dry-run
npm run birds:media -- --all --dry-run
npm run content:build
```

`--bird` puede repetirse. Es obligatorio elegir exactamente uno entre `--bird`, `--all` y `--missing`; no hay una ejecución masiva implícita. `--missing` busca únicamente tipos de medio ausentes: fotos si no hay fotos, videos si no hay videos. `--all` puede completar los cupos pendientes. La prueba inicial se limita a Accipiter striatus, Turdus migratorius y Zenaida macroura.

El dry-run no descarga multimedia ni modifica `ave.json`; escribe caché y un informe con **todos los candidatos encontrados, motivos de rechazo y selección**, no solo el resumen de consola. `--report ruta.json` cambia la salida. `--plan informe-dry-run.json` descarga únicamente su selección y vuelve a aplicar las reglas de licencia y los cupos existentes. Sin `--plan` se hace una nueva selección. Para revisar licencias actualizadas, repite el dry-run con `--refresh`.

## Selección y límites

Consulta las APIs oficiales de [iNaturalist](https://api.inaturalist.org/v1/docs/) y [Commons Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo), siempre desde `scientific` de `ave.json`. Exige taxón activo exacto y observaciones de grado de investigación, no cautivas. En Commons exige el nombre científico en el título o categoría de especie: una mención incidental en la descripción no basta.

Prioridad geográfica: radio de 5 km desde 19.3525, -99.2824; Cuajimalpa (place 59040); CDMX (59014, nombre administrativo en la API: Distrito Federal, MX); México (6793); Commons; iNaturalist mundial. Las coordenadas privadas u oscurecidas se omiten y nunca se reconstruyen. `local` exige coordenadas públicas con distancia Haversine ≤5 km. La ubicación regional no implica localidad dentro de 5 km.

Máximo dos fotos locales y dos de referencia (no locales), con diversidad de observaciones. Dentro del mismo nivel geográfico se prefieren imágenes de al menos 1000 píxeles por lado, licencias comerciales, favoritos de la observación y resolución. Resolución mínima: 640 × 480. Estos indicadores no garantizan enfoque o encuadre: `visualReview: pending` indica que falta inspección humana. La revisión visual de la prueba queda registrada aparte en `reports/media-trial-review.md`. `mediaReview.rejected` en cada ficha permite excluir identidades rechazadas por revisión visual. No se afirma que una búsqueda limitada encuentre la mejor foto de toda la plataforma.

Hasta tres videos de distintos tipos por ave. Los tipos se infieren de palabras explícitas del título/descripción; `behavior` es la categoría general. Se usan originales WebM, MP4 u OGV de Commons, nunca se descargan archivos de YouTube, Vimeo o redes sociales. Ausencia de video no es un error.

Se acepta CC0, CC BY y CC BY-SA. `--allow-nc` habilita CC BY-NC y CC BY-NC-SA; **la prueba lo usa y sus fotos NC no pueden destinarse a usos comerciales**. Se rechazan ND, licencias desconocidas y atribuciones incompletas. Se guarda la licencia de cada foto, no la licencia de la observación. El crédito de Commons procede de Artist, no del usuario que subió el archivo. Los metadatos originales de Commons se conservan.

Una petición a la vez, pausa mínima 1,1 s, tres intentos con backoff exponencial y consideración de Retry-After. User-Agent identificable. Caché local `.media-cache/` con vigencia de 24 h. Hasta 30 observaciones por ámbito por defecto; `--max-pages 1..3` amplía la búsqueda y el informe indica truncamientos. Commons inspecciona los primeros diez resultados por tipo. Límite de 20 MiB por foto y 80 MiB por video.

## Archivos y seguridad de escritura

Nombres `fotos/local-01.jpg`, `reference-01.jpg`, etc. Las fotos no JPEG se convierten a JPEG sin recortar y registran la modificación. Videos: `videos/flight-01.webm`, `feeding-01.webm`, `vocalization-01.webm`, `behavior-01.webm`, etc., según el formato original y tipo. Se verifica la decodificación completa antes de incorporar el archivo.

Identidad por `source + sourceId`; hashes SHA-256 detectan contenido repetido. Archivos existentes nunca se sobrescriben, ni siquiera si no están registrados. Un bloqueo evita importadores multimedia concurrentes. Actualizaciones atómicas de JSON detectan ediciones simultáneas y preservan los demás campos. Si falla la actualización se retira únicamente el archivo recién creado; una interrupción abrupta puede dejar un archivo huérfano que debe revisarse, nunca se sobrescribe automáticamente.

La descarga no autentica por sí sola una identificación biológica: conserva la evidencia de la fuente y requiere inspección visual. Los informes y la validación inicial están en `reports/media-trial-*`.
