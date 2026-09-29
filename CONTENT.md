# Agregar contenido por ave

La app tiene una carpeta por especie en **dist/content/**. El catálogo inicial contiene las 214 entradas (212 especies y dos géneros) de la consulta de iNaturalist (19.3525, −99.2824; radio de 5 km; aves), importadas el 29 de septiembre de 2026 UTC. Es una instantánea, no un listado que depende de internet al abrir la app. La fecha, la consulta y el total están en `dist/content/source.json`.

## Uso diario: copiar, pegar y guardar

1. Abre la carpeta del ave por su nombre científico. Por ejemplo, `dist/content/turdus-migratorius/` es el mirlo primavera; `dist/content/piranga-flava/` es Piranga flava.
2. Copia tus imágenes a **fotos/** y tus videos a **videos/**. No edites ningún índice ni código. Se detectan también subcarpetas y archivos en la raíz de la especie.
3. Escribe datos, poemas o enlaces en **notas.md** y guarda el archivo.
4. Con `npm start` abierto, el servidor regenera el catálogo y el navegador local se actualiza cuando no está reproduciendo la grabación principal. Para publicar, ejecuta `npm run build` y publica nuevamente `dist/`. Copiar archivos en tu computadora no cambia una web ya publicada hasta desplegarla otra vez.

```text
dist/content/turdus-migratorius/
  ave.json             ← nombre, sinónimos y referencia; normalmente no hace falta editarlo
  notas.md             ← texto del anexo; vacío o solo comentarios = no aparece
  portada.jpg          ← opcional: imagen principal
  fotos/
    01-jardin.jpg
    02-en-el-arbol.webp
  videos/
    01-canto.mp4
    02-vuelo.mp4
  audio/
    01-canto.mp3
```

Las fotos aparecen todas en el carrusel. Si hay un archivo llamado `portada.jpg` (o PNG/WebP/etc.), se usa para la imagen principal; de lo contrario se usa la primera foto. Los nombres se ordenan alfabéticamente con números naturales: utiliza `01-`, `02-`, etc. Los videos se eligen desde el selector debajo del reproductor. El primer audio independiente tiene prioridad sobre el sonido del video; los demás audios aparecen con controles propios después del álbum. Evita guardar el mismo material tanto en una nota como en fotos si no quieres mostrarlo dos veces.

Formatos detectados: JPG, JPEG, PNG, WebP, GIF y AVIF; MP4, WebM, MOV y M4V; MP3, WAV, OGG, M4A y FLAC. La reproducción depende del códec compatible con el navegador. MP4 H.264/AAC y MP3 suelen ser las opciones más portables.

## Ejemplo de notas.md

```markdown
## Una observación del jardín

Vi esta ave entre los árboles. Puedo escribir **negritas**, *cursivas*,
listas, tablas, enlaces y citas.

- Fecha de la observación: …
- Lugar: …

### Un poema

> Pega aquí el texto que quieras compartir.  
> Dos espacios al final de cada línea conservan el salto del verso.

Autor: … · [Fuente](https://ejemplo.org/poema)

### Una canción

Pega aquí un enlace de YouTube, Spotify o Apple Music en su propia línea.

### Una imagen dentro del texto

![El ave entre las ramas](fotos/01-jardin.jpg)
```

Markdown admite títulos, párrafos, listas, citas, negritas, cursivas, enlaces, imágenes, tablas y bloques de código. Las rutas de imágenes son relativas a la carpeta del ave. Puedes utilizar enlaces HTTPS de imágenes externas; su disponibilidad depende del sitio de origen. El HTML se sanitiza antes de mostrarlo.

## Canciones y videos incrustados

Pega un enlace real de `https://www.youtube.com/watch?v=…`, `https://youtu.be/…`, `https://open.spotify.com/track/…` o `https://music.apple.com/mx/album/…` en un párrafo separado; también sirve `[Título de la canción](URL)` en su propio párrafo. El anexo lo convierte en un reproductor y conserva un enlace para abrir el original. YouTube Shorts, álbumes/playlists/episodios de Spotify y álbumes/playlists/canciones de Apple Music también son compatibles.

Puedes pegar el iframe que ofrece uno de estos proveedores: se conserva solo su URL compatible y se reconstruye el reproductor. Otros iframes se descartan. Para otros servicios, agrega un enlace normal. Los reproductores externos se cargan al abrir la entrada del anexo y se descargan al cerrarla; no se reproducen automáticamente. Pueden requerir internet, inicio de sesión o que el autor permita incrustaciones.

## Nombres comunes, calandrias y poemas

`ave.json` permite cambiar `name` y añadir nombres de búsqueda en `aliases`, por ejemplo `"aliases": ["American Robin", "robin americano"]`. Conserva `id`, `scientific` y `taxonId` para mantener la identidad de la especie.

La consulta incluye varias especies llamadas calandria: abre la carpeta del nombre científico que quieras documentar. Un poema o canción que menciona «calandria» o «fueguero» no identifica necesariamente una especie concreta. Añade en la nota el contexto que tengas y su fuente. No se han inventado poemas, autores ni canciones: el mirlo incluye una breve nota de nombres como ejemplo y las demás notas están listas para escribir.

## Audio y análisis

Agregar un audio o video permite reproducirlo de inmediato. Las gráficas requieren un JSON de análisis de esa misma grabación; nunca se reutilizan datos demo. Si tienes el análisis, configura en `ave.json`:

```json
"recording": "audio/01-canto.mp3",
"analysis": "analisis.json"
```

Estas son propiedades adicionales dentro del objeto existente, separadas por comas. Sin `recording` y `analysis`, se muestra «Sin análisis de audio». Al elegir otro video se retira el análisis del video anterior. El script de análisis anterior sigue disponible para las muestras originales; no genera automáticamente análisis para los archivos nuevos.

## Actualizar la lista de especies

Desde `aviario/`, ejecuta `npm run content:sync` con conexión a internet. Consulta todas las páginas de iNaturalist, crea carpetas para especies nuevas y conserva los archivos existentes. No borra especies ni sobrescribe tus nombres o notas. `npm run content:build` reconstruye el índice sin consultar internet. `npm run check` comprueba el catálogo, los archivos y el comportamiento básico.

Para agregar una especie manualmente, copia una carpeta vacía, usa un nombre científico separado por guiones, cambia `id` para que coincida con la carpeta y ajusta sus metadatos. Mantén `notas.md`, aunque esté vacío.

## Arquitectura

- **Fuente editable:** `dist/content/<nombre-cientifico>/ave.json`, `notas.md` y archivos multimedia.
- **Importación:** `scripts/sync-species.mjs`; la respuesta de referencia queda en `inaturalist-species.json`.
- **Compilación:** `scripts/build-content.mjs` genera `dist/content-index.json` y copia las bibliotecas locales de Markdown/sanitización a `dist/vendor/`.
- **Lectura:** `dist/catalog.js` carga el índice; `dist/app.js` conecta las fichas; `dist/content-view.js` construye el anexo.
- **Desarrollo:** `server.mjs` observa cambios en las carpetas. Un JSON inválido muestra un error y conserva el último índice válido.
- **Publicación:** archivos estáticos en `dist/`; Vercel instala dependencias con `npm ci` y regenera contenido con `npm run build`.

Las grabaciones demo originales permanecen en `dist/media/` y su catálogo histórico en `dist/catalog-demo.js`; no se asignan a las nuevas fichas. Se conserva el diseño y el motor de visualización acústica.
