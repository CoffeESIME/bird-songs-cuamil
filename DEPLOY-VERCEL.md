# Publicar AVIARIO en Vercel

La carpeta de proyecto es **aviario/**: contiene `vercel.json`, `package.json` y `dist/`. No selecciones la carpeta superior con los videos originales. Si usas `aviario-vercel.zip`, descomprímelo primero: sus archivos ya están en la raíz del proyecto.

## Opción 1: GitHub + panel de Vercel

1. Sube el contenido de `aviario/` a un repositorio de GitHub.
2. En Vercel, selecciona **Add New → Project** e importa ese repositorio.
3. Si el repositorio contiene `aviario/` como subcarpeta, selecciona **Root Directory: aviario**. Si subiste directamente su contenido, deja la raíz del repositorio.
4. La configuración incluida establece:

   | Ajuste | Valor |
   | --- | --- |
   | Framework Preset | Other |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | vacío; no hay dependencias |
   | Variables de entorno | ninguna |

5. Pulsa **Deploy**. Vercel mostrará la dirección del sitio.

## Opción 2: terminal

Desde la carpeta del proyecto (donde está `vercel.json`):

```powershell
npm run build
npx vercel
```

Inicia sesión y confirma el proyecto y su configuración. El primer comando de Vercel crea una publicación de vista previa. Cuando esté revisada:

```powershell
npx vercel --prod
```

No se ejecuta `npm start` en producción: ese comando es solo para la vista previa local. Vercel sirve directamente `dist/`. No se necesitan funciones, base de datos, Python ni ffmpeg durante el despliegue.

## Archivos y actualizaciones

- Mantén los videos optimizados, imágenes y JSON dentro de `dist/media/` y súbelos junto con la app.
- El build comprueba sintaxis, rutas, contenido no vacío y estructura de los análisis. Si falta un archivo, falla antes de publicar.
- Para reemplazar grabaciones, actualiza `dist/catalog.js` y regenera el análisis siguiendo `README.md`.
- La configuración anterior de Sites se conserva fuera de `dist/` y se excluye de los envíos por CLI mediante `.vercelignore`. No interviene en Vercel.
- Vercel administra por separado el acceso y la protección de sus despliegues; la configuración privada del alojamiento anterior no se transfiere.
- Después del primer despliegue, comprueba play/pausa, avance del audio, cambio de ave y carga de las cuatro visualizaciones.

Documentación oficial: [configuración de builds](https://vercel.com/docs/builds/configure-a-build) y [vercel.json](https://vercel.com/docs/project-configuration/vercel-json).
