# Visualizaciones por grabación

Los audios originales no se modifican. Cada entrada de `audio` en `ave.json` añade `analysis`, `analysisSha256` y `analysisVersion`. Su JSON está en `analysis/<nombre-del-audio-con-extensión>.json`, por ejemplo `analysis/call-01.mp3.json`. El catálogo relaciona cada ruta de audio con su análisis mediante `recordingAnalyses`; la propiedad principal `analysis` se conserva por compatibilidad.

## Generación y reanudación

Requiere Python con NumPy y ffmpeg en PATH. No se consulta ninguna API:

```powershell
npm run birds:analyze -- --bird accipiter-striatus --bird haemorhous-mexicanus --bird turdus-migratorius
npm run birds:analyze -- --all
npm run content:build
```

La segunda ejecución omite los archivos cuyo SHA-256 de origen, versión del algoritmo y hash del JSON siguen coincidiendo. Un JSON ausente, alterado o inválido se regenera. `--force` permite recalcular. El proceso continúa tras un error y produce `dist/audio-analysis-report.json` con contadores y fallos; devuelve código distinto de cero si hubo errores. El bloqueo local `.audio-analysis.lock` impide dos ejecuciones simultáneas. Después de una interrupción forzada, comprueba que no siga activo el analizador antes de retirar ese bloqueo.

Cada análisis y actualización de metadatos se guarda de forma atómica, con comprobación de ediciones concurrentes. Las grabaciones marcadas `derivativesAllowed: false` se omiten. Las etiquetas, autores, licencias y demás campos previos se conservan.

## Datos y tamaño

- Decodificación temporal mono a 24 kHz; ventana Hann de 1024 muestras y salto de 256. FFT por lotes, con audio temporal mapeado en memoria para evitar una matriz FFT del archivo completo.
- Espectro de potencia dividido en 128 bandas hasta 12 kHz. Se conserva el máximo de potencia de cada banda por intervalo temporal uniforme, hasta **512 columnas**. Cuantización a 8 bits sobre un rango de 65 dB relativo al pico de la grabación; silencio representado con ceros.
- `rowSeconds` indica la duración de cada columna. El espectro mostrado al buscar usa este valor, no el salto de la STFT original. Es un resumen temporal de potencia, no un espectro instantáneo sin reducción.
- Forma de onda: hasta 700 máximos de amplitud en intervalos uniformes.
- Espacio acústico: hasta 36 fragmentos; se elige el de mayor RMS por tramo y se conservan su instante real, centroide, dispersión y RMS. No es clasificación taxonómica ni UMAP.
- Límite de **350 kB por JSON**, independiente de la duración del audio. Incluye `sourceSha256`, `sourceFile` y versión del algoritmo. Los JSON son archivos estáticos publicables; el catálogo sólo contiene sus rutas, no todos los espectrogramas.

## Reproductor

El selector «Grabación» utiliza el reproductor principal para todos los audios de la ficha. Al cambiar se pausa, se reinicia el tiempo y se carga únicamente el análisis asociado. Las respuestas tardías de otra selección se descartan. La caché conserva como máximo seis análisis.

Las cuatro vistas siguen el tiempo del reproductor: reproducir, pausar, adelantar y retroceder mantienen sincronizados el cursor, el espectro y los fragmentos. Si falta un JSON, la ficha muestra un estado vacío sin reutilizar análisis de otra grabación. Las atribuciones siguen disponibles debajo del álbum. La asociación antigua `recording` + `analysis` continúa funcionando para contenido manual y videos.

## Verificación

```powershell
python -m unittest discover -s scripts -p test_audio_analysis.py
npm run check
```

Las pruebas numéricas cubren silencio, audio muy corto, señal conocida de 1500 Hz, impulso al final, tamaño máximo y valores no finitos. Las pruebas de JavaScript cubren la correspondencia audio/análisis, tiempo de espectros compactados y rechazo de datos inválidos. La verificación estática valida todos los JSON vinculados, sus hashes, correspondencia con el audio original y presupuesto de tamaño.

El script antiguo `scripts/analyze_audio.py` queda disponible sólo para regenerar los videos de demostración. Para las fichas se usa `scripts/analyze_bird_audio.py`.
