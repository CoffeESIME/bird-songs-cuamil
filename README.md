# AVIARIO — Cuaderno de cantos

Sitio web en español, con dependencias de Markdown empaquetadas localmente. `npm start` inicia http://127.0.0.1:4173. `npm run check` revisa la sintaxis.

## Contenido por especie

El catálogo contiene las 214 entradas (212 especies y dos géneros) importadas de la consulta de iNaturalist. Cada ave tiene una carpeta en **dist/content/**: copia imágenes en **fotos/**, videos en **videos/** y escribe sus notas en **notas.md**. Las notas con contenido aparecen al final en el anexo, con soporte para Markdown y reproductores de YouTube, Spotify y Apple Music.

Consulta **[CONTENT.md](CONTENT.md)** para ejemplos, formatos, actualización automática y publicación. Con el servidor local abierto, guardar archivos actualiza la app; la versión publicada requiere un nuevo despliegue.

Instala dependencias con `npm ci` y ejecuta `npm start`. Para publicar en Vercel, sigue [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md). `npm run build` regenera el catálogo y valida los archivos antes de publicar.

Las grabaciones originales de demostración se conservan en media/, pero no se atribuyen a las especies del nuevo catálogo. Las fichas sin fotos, videos o análisis muestran estados vacíos.

## Visualizaciones y regeneración

`python scripts/analyze_audio.py` procesa los videos `dist/media/sample-*.mp4` con ffmpeg y numpy. No requiere servidor de análisis durante el uso.

- **Spectrogram:** STFT con ventana Hann de 1024 muestras, salto de 256, audio mono a 24 kHz y 128 bandas entre 0 y 12 kHz. Intensidad en dB relativa al pico de la grabación. Cursor sincronizado.
- **Acoustic Space:** 36 ventanas temporales, representadas por su centroide espectral, ancho de banda y RMS. Las esferas aparecen progresivamente al alcanzar su marca temporal y los enlaces se trazan durante la escucha. El contorno del punto activo pulsa con la envolvente del audio; el tamaño de cada esfera indica su energía. La cámara y los efectos siguen el tiempo de reproducción: se congelan al pausar o cargar, se reconstruyen al buscar y empiezan de nuevo al repetir o cambiar de ave. Con movimiento reducido se revelan los fragmentos sin giro, pulsos ni crecimiento animado. Los ejes se normalizan dentro de cada grabación. No es UMAP ni un clasificador de especies; no comparar las posiciones normalizadas entre grabaciones como distancias científicas.
- **Soundwave:** envolvente de amplitud completa (700 puntos), con progreso sincronizado.
- **Power Spectrum:** espectro logarítmico de la ventana correspondiente a la posición de reproducción, tomado de los mismos datos precalculados.

Las vistas no usan puntos aleatorios ni datos decorativos. Al pausar se conserva el instante analizado. Cambiar el volumen no modifica los datos del análisis. El análisis de cada grabación se carga de forma asíncrona y se guarda en memoria; las solicitudes antiguas no sobreescriben la selección actual.

Las fuentes Lilita One y DM Sans se cargan de Google Fonts con alternativas locales. WebMCP opcional expone `list_birds` y `select_bird` (selección pausada). No se recopilan datos ni se solicitan micrófono o cámara.
