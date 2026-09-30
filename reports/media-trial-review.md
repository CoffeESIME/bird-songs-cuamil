# Prueba de fotografías y videos

Resultado: **10 fotografías (4 locales) y 3 videos**, únicamente en las tres especies autorizadas. Segunda ejecución: **0 seleccionados, 0 descargados, 0 errores**. JSON, atribuciones y hashes verificados; los 13 archivos superaron la decodificación completa con ffmpeg. `npm run check`: 33 pruebas aprobadas.

## Revisión visual

Se inspeccionaron las diez fotografías finales y fotogramas de los tres videos. La apariencia es compatible con la especie indicada y se conserva la evidencia taxonómica de cada fuente. La foto local del gavilán es distante y a contraluz: sirve como registro local, con menor detalle diagnóstico. La identificación del video del mirlo en silueta se apoya además en la categoría taxonómica de Commons. No se presenta esta revisión como una identificación ornitológica independiente.

Se rechazaron las fotos iNaturalist 96867388 (desenfoque) y 496141015 (plumas/restos). Permanecen fuera del catálogo en `rejected/`, con procedencia y licencia en el informe inicial; sus identidades están excluidas de futuras selecciones en `mediaReview.rejected`. Las sustitutas 531585132 y 533929037 muestran un mirlo completo y reconocible. Los campos automáticos `visualReview: pending` no sustituyen esta revisión registrada.

No se encontró video elegible de Accipiter striatus en la búsqueda limitada. Un resultado incidental de otra especie fue rechazado.

## Archivos finales

| Especie / archivo | Fuente e ID | Autor | Licencia | Resolución | Local / distancia |
|---|---|---|---|---|---|
| accipiter-striatus / fotos/local-01.jpg | [inaturalist:116662129](https://www.inaturalist.org/photos/116662129) | Nathan Zárate | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 1650 × 1275 | Sí / 3.631 km |
| accipiter-striatus / fotos/reference-01.jpg | [inaturalist:628165537](https://www.inaturalist.org/photos/628165537) | Alberto Sánchez | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 1920 × 1280 | No / 20.676 km |
| accipiter-striatus / fotos/reference-02.jpg | [inaturalist:186394699](https://www.inaturalist.org/photos/186394699) | Mario Castañeda | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 2048 × 1536 | No / 17.678 km |
| turdus-migratorius / fotos/local-02.jpg | [inaturalist:663756928](https://www.inaturalist.org/photos/663756928) | Álvaro San José Elizundia | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 2048 × 1365 | Sí / 1.087 km |
| turdus-migratorius / fotos/reference-01.jpg | [inaturalist:4031080](https://www.inaturalist.org/photos/4031080) | Gonzalo Zepeda Martínez | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 927 × 800 | No / 5.162 km |
| turdus-migratorius / fotos/local-01.jpg | [inaturalist:531585132](https://www.inaturalist.org/photos/531585132) | Nathan Zárate | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 2048 × 2048 | Sí / 3.605 km |
| turdus-migratorius / fotos/reference-02.jpg | [inaturalist:533929037](https://www.inaturalist.org/photos/533929037) | Efraín Octavio Aguilar Pérez | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 2048 × 1365 | No / 5.157 km |
| turdus-migratorius / videos/vocalization-01.webm | [wikimedia-commons:41546479](https://commons.wikimedia.org/wiki/File:American_robin_(Turdus_migratorius)_singing.webm) | Michael Carian | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | 640 × 360 | No / desconocida |
| turdus-migratorius / videos/behavior-01.webm | [wikimedia-commons:114426414](https://commons.wikimedia.org/wiki/File:American_Robin_in_bird_bath.webm) | Captain-tucker | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 1920 × 1080 | No / desconocida |
| zenaida-macroura / fotos/local-01.jpg | [inaturalist:446122454](https://www.inaturalist.org/photos/446122454) | Rodolfo DQ | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | 1536 × 2048 | Sí / 4.02 km |
| zenaida-macroura / fotos/reference-01.jpg | [inaturalist:274292066](https://www.inaturalist.org/photos/274292066) | Alberto Sánchez | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 1920 × 1920 | No / 20.638 km |
| zenaida-macroura / fotos/reference-02.jpg | [inaturalist:3942034](https://www.inaturalist.org/photos/3942034) | Gonzalo Zepeda Martínez | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 874 × 800 | No / 19.364 km |
| zenaida-macroura / videos/behavior-01.webm | [wikimedia-commons:47294890](https://commons.wikimedia.org/wiki/File:Mourning_dove_(Zenaida_macroura).webm) | Katja Schulz | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | 1920 × 1280 | No / desconocida |

Los campos previos de las tres fichas, incluidos todos los audios y análisis, se compararon con HEAD y permanecen intactos. Ninguna otra ficha fue enriquecida.

## Evidencia

- `media-trial-dry-run.json`: candidatos y selección inicial.
- `media-trial-import.json`: descarga inicial.
- `media-trial-replacements-dry-run.json` y `media-trial-replacements-import.json`: sustituciones revisadas.
- `media-trial-idempotence.json`: segunda ejecución real sin descargas.
- `media-trial-validation.json`: comprobación final de metadatos, archivos y hashes.

La búsqueda es acotada y no demuestra ausencia absoluta de multimedia en una plataforma. La prueba incluye licencias NC, habilitadas mediante `--allow-nc`.
