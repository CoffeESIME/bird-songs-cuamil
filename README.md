# AVIARIO — Cuaderno de cantos

Sitio web en español, sin dependencias de ejecución. `npm start` inicia http://127.0.0.1:4173. `npm run check` revisa la sintaxis.

## Diseño e interacción

Menú horizontal de cinco aves y controles debajo. Tarjetas crema con ilustración recortada, video independiente, cuatro visualizaciones simultáneas y carrusel inferior de cuatro fotos. Selección alfabética o aleatoria sin repetición inmediata, reproducción continua, volumen y efectos de interfaz desactivables. Espacio 3D giratorio con arrastre, flechas de teclado y botón de restablecer. Carrusel por botones, puntos, teclado y desplazamiento táctil. Respeta movimiento reducido.

## Contenido demo

Los videos originales en la carpeta superior permanecen intactos. Se utilizan copias comprimidas de hasta 30 segundos y cuatro fotogramas de cada uno. No hay identificación de especies para esas grabaciones: el sitio lo indica. Las cinco aves recortadas son ilustraciones generadas, no fotografías documentales; prompts y procedencia en `image-prompts.md`.

## Cambiar el contenido

Edita `dist/catalog.js`. Cada entrada tiene `cutout` (PNG transparente), `media` (video), `photos` (carrusel de imágenes), `analysis` (JSON de características), `audio` (opcional) y `demo`. Con `audio: null` se oye el video. Con una ruta MP3/WAV se oye la grabación independiente y el video queda silenciado. Mantén el análisis vinculado al mismo audio: si cambias una grabación, regenera su JSON. Las etiquetas de demo deben actualizarse solo después de verificar la especie.

`uiSounds.click` y `uiSounds.change` aceptan rutas a efectos propios; `null` utiliza chirridos sintetizados por Web Audio.

## Visualizaciones y regeneración

`python scripts/analyze_audio.py` procesa los videos `dist/media/sample-*.mp4` con ffmpeg y numpy. No requiere servidor de análisis durante el uso.

- **Spectrogram:** STFT con ventana Hann de 1024 muestras, salto de 256, audio mono a 24 kHz y 128 bandas entre 0 y 12 kHz. Intensidad en dB relativa al pico de la grabación. Cursor sincronizado.
- **Acoustic Space:** 36 ventanas temporales, representadas por su centroide espectral, ancho de banda y RMS. Esferas con tamaño según energía y enlaces cronológicos. Los ejes se normalizan dentro de cada grabación. No es UMAP ni un clasificador de especies; no comparar las posiciones normalizadas entre grabaciones como distancias científicas.
- **Soundwave:** envolvente de amplitud completa (700 puntos), con progreso sincronizado.
- **Power Spectrum:** espectro logarítmico de la ventana correspondiente a la posición de reproducción, tomado de los mismos datos precalculados.

Las vistas no usan puntos aleatorios ni datos decorativos. Al pausar se conserva el instante analizado. Cambiar el volumen no modifica los datos del análisis. El análisis de cada grabación se carga de forma asíncrona y se guarda en memoria; las solicitudes antiguas no sobreescriben la selección actual.

Las fuentes Lilita One y DM Sans se cargan de Google Fonts con alternativas locales. WebMCP opcional expone `list_birds` y `select_bird` (selección pausada). No se recopilan datos ni se solicitan micrófono o cámara.
