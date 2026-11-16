# Audio por capítulo

Cada versión de **audio** tiene su propia carpeta (`audio/nvi/`, `audio/rvr1909/`, etc.). Esa carpeta la elige `AUDIO_CONFIG.version` (por defecto `nvi`) o el selector «Versión de audio» del reproductor; **no** depende del selector de texto ni de `STATE.currentVersion`. Así el texto puede seguir siendo RVR 1909 mientras suena NVI.

## Estructura

```text
audio/
  <version>/
    <libro-2dígitos>/
      <capítulo-3dígitos>.mp3
      <capítulo-3dígitos>.json   # opcional, tiempos por versículo
```

Los números son los de `data/rvr1909.json` (`books[].number` y `chapters[].number`):

| Archivo | Contenido |
|---------|-----------|
| `audio/nvi/63/001.mp3` | 2 Juan 1, NVI (muestra de prueba) |
| `audio/nvi/64/001.mp3` | 3 Juan 1, NVI |
| `audio/nvi/65/001.mp3` | Judas 1, NVI |
| `audio/rvr1909/43/003.mp3` | Juan 3, RVR 1909 (cuando exista el archivo) |

Si el MP3 no existe, el reproductor se oculta y la lectura sigue igual. El botón «Voz del sistema» (Web Speech API) no depende de estos archivos.

## Sincronía de versículos (opcional)

Junto al MP3 puedes dejar un JSON con el mismo nombre:

```json
{
  "verses": [
    { "number": 1, "start": 0.0, "end": 4.2 },
    { "number": 2, "start": 4.2, "end": 9.8 }
  ]
}
```

`start` y `end` van en segundos. Si está presente, la app resalta el versículo mientras suena.

## Dónde alojar los archivos

Una Biblia narrada completa ronda **1.180 capítulos**. A 64 kbps, cada capítulo pesa ~2–4 MB y **una versión entera puede superar los 2–4 GB**.

- GitHub bloquea archivos de más de **100 MB**. Un MP3 por capítulo suele quedar por debajo, pero el repo no debería crecer tanto.
- **Pocos capítulos de muestra:** súbelos como archivos normales de Git (están muy por debajo del límite). No uses Git LFS aquí, para que el sitio los sirva sin punteros.
- **Biblia completa:** alójala fuera y cambia `AUDIO_CONFIG.baseUrl` en `js/app.js` a una URL absoluta, por ejemplo:
  - una [GitHub Release](https://docs.github.com/es/repositories/releasing-projects-on-github) (hasta 2 GB por archivo);
  - [Internet Archive](https://archive.org);
  - un bucket (Cloudflare R2, etc.).

  Si `baseUrl` es `https://ejemplo.org/biblia` y el audio es NVI, 2 Juan 1 será `https://ejemplo.org/biblia/nvi/63/001.mp3`.

Asegúrate de tener derecho a distribuir la narración (la RVR 1909 es dominio público; la voz o una grabación comercial pueden no serlo).

Los MP3 de prueba NVI en `audio/nvi/` provienen de Faith Comes By Hearing / Bible.is (narración dramatizada SPNNVIN2DA). El texto y las marcas NVI son © 1999, 2015 Biblica, Inc. Estas tres muestras sirven solo para probar el reproductor; **no añadas el resto de la Biblia sin permiso de distribución.**


## Uso offline (PWA)

`sw.js` cachea un capítulo la **primera vez que se reproduce**. No descarga la Biblia entera. Sin `manifest.json` ni icono la app aún no es instalable; el caché de audio sí funciona si el service worker llegó a registrarse (hace falta haber entrado al menos una vez con red).
