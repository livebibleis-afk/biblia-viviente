# Biblia Viviente

**Lector bíblico moderno, limpio y optimizado para móviles.**  
Versión: **Reina-Valera 1909** (dominio público)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2ea44f?style=for-the-badge&logo=github)](https://livebibleis-afk.github.io/biblia-viviente/)
[![License](https://img.shields.io/badge/Licencia-Uso%20libre-blue?style=for-the-badge)](#licencia)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/es/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)

---

### 🔗 Demo en vivo

**→ [Abrir Biblia Viviente](https://livebibleis-afk.github.io/biblia-viviente/)**

---

## Características

| Función | Descripción |
|---------|-------------|
| **Lectura limpia** | Libro → Capítulo → Versículos con tipografía pensada para leer |
| **Responsive** | Se adapta perfectamente a iPhone, Android, tablet y escritorio |
| **Modo oscuro** | Respeta la preferencia del sistema + botón para cambiar manualmente |
| **Optimizado iOS** | Safe-area, notch y barra de estado en Safari |
| **Navegación rápida** | Anterior / Siguiente capítulo + botón de volver |
| **Buscador** | Filtra libros por nombre al instante |
| **Filtros** | Todos · Antiguo Testamento · Nuevo Testamento |
| **Audio del capítulo** | Reproduce `audio/<versión>/<libro>/<capítulo>.mp3` si el archivo existe |
| **Podcast** | Enseñanzas del Dr. Armando Alducin F., agrupadas por serie, con reproductor y RSS |
| **Sin dependencias en el visor** | La página sigue siendo HTML, CSS y JavaScript. El etiquetado de MP3 es un script aparte |

---

## Estructura del proyecto

```text
biblia-viviente/
├── index.html          # Aplicación principal
├── css/
│   └── styles.css      # Estilos (tema claro/oscuro + responsive)
├── js/
│   ├── app.js          # Lógica de navegación y renderizado
│   └── podcast.js      # Lista, búsqueda y reproductor del podcast
├── data/
│   ├── rvr1909.json    # Biblia completa (Reina-Valera 1909)
│   └── podcast/        # Manifiesto, catálogo y carátula (sin MP3)
├── feed.xml            # RSS del podcast (iTunes / Spotify / Apple)
├── tools/podcast/      # Descarga, ID3 y publicación al GitHub Release
├── audio/
│   ├── nvi/            # Muestras NVI (2 Juan, 3 Juan, Judas)
│   └── rvr1909/        # MP3 por libro/capítulo (ver audio/README.md)
├── sw.js               # Caché offline del audio reproducido
├── .nojekyll           # Necesario para GitHub Pages
└── README.md
```

---

## Tecnología

- **HTML5** semántico
- **CSS moderno**: variables, `color-mix()`, `dvh`, safe-area insets
- **JavaScript** ES Modules (sin frameworks)
- **Datos**: JSON optimizado a partir del XML de [Beblia](https://github.com/Beblia/Holy-Bible-XML-Format)
- **Tipografías**: Inter + Source Serif 4 (Google Fonts)

---

## Cómo usar localmente

```bash
# Clonar
git clone https://github.com/livebibleis-afk/biblia-viviente.git
cd biblia-viviente

# Servir (recomendado)
python3 -m http.server 8080
# o
npx serve .
```

Abre: [http://localhost:8080](http://localhost:8080)

---


## Audio por capítulo

La app busca un MP3 según la **versión de audio** (`AUDIO_CONFIG.version`, por defecto `nvi`), el libro y el capítulo abiertos. El texto puede seguir siendo RVR 1909:

`audio/nvi/63/001.mp3` → 2 Juan 1 (audio NVI)

Si el archivo no está, el reproductor se oculta y no se rompe la lectura. La guía de nombres y alojamiento externo está en [`audio/README.md`](audio/README.md).

## Podcast — Dr. Armando Alducin F.

Las enseñanzas se etiquetan (ID3) y se publican como podcast. **Los MP3 no entran en git.** Viven como archivos del GitHub Release `podcast`. En el repositorio solo hay metadatos: el CSV, `data/podcast/episodes.json`, `data/podcast/state.json`, la carátula y `feed.xml`.

La página principal tiene una entrada **Podcast**. Abre la lista por serie, el buscador y el reproductor. El RSS está en [`feed.xml`](feed.xml). Un episodio entra al feed cuando su MP3 ya está en el release. Mientras no haya audio, la ficha dice «Próximamente» y, si hay enlace, se puede abrir el video de origen.

Hay dos episodios de partida, los de la plantilla:

| Archivo | Título | Año | Origen |
| --- | --- | --- | --- |
| `DAAF_Armando_Alducin_F_RESA_01.mp3` | Reportaje Especial Sobre Afganistan (Parte 01) | 2021 | Aún sin URL |
| `DAAF_Armando_Alducin_F_DYEM_01.mp3` | Introducción \| Dios y la Existencia del Mal 01 | 2015 | https://youtu.be/3McxO3SnKHI |

El nombre es el prefijo del expositor + código de serie + pista: `DAAF_Armando_Alducin_F_RESA_01.mp3`. `DYEM` no venía escrito en la hoja; es la abreviatura de «Dios y la Existencia del Mal» para poder nombrar el archivo. Cámbiala en `codigo_serie` si usas otra. El álbum de la plantilla decía «@BibliaViviente Dr. AAF (corregirlo)»: aquí el álbum es `@BibliaViviente Dr. AAF` más el nombre de la serie. El disco `20151407` se conserva tal como está en la hoja, aunque la plantilla pide 6 dígitos.

### Agregar un episodio

Edita [`data/podcast/episodes.csv`](data/podcast/episodes.csv). Una fila por episodio. No inventes filas de más: cada fila es un programa real.

| Columna | Qué va |
| --- | --- |
| `archivo` | `DAAF_Armando_Alducin_F_CODIGO_01.mp3`. Si lo dejas vacío, se arma con `codigo_serie` y `pista`. |
| `titulo` | Título del episodio |
| `artista` | `Dr. Armando Alducin F.` |
| `album` | `@BibliaViviente Dr. AAF` + serie |
| `anio` | Año |
| `pista` | Número de pista dentro de la serie |
| `genero` | `@BibliaViviente` |
| `comentarios` | Texto libre de ID3 (comentario) |
| `disco` | Número de disco, idealmente 6 dígitos |
| `compositor` | `@BibliaViviente` |
| `artista_album` | `@BibliaViviente` |
| `caratula` | Texto `@BibliaViviente Dr. AAF`, o una ruta `.jpg`/`.png` si esa entrega lleva otra imagen |
| `serie` | Nombre con el que se agrupa en la página |
| `codigo_serie` | Código corto del archivo (`RESA`, `DYEM`, …) |
| `source_url` | YouTube o TikTok. Sin esto no hay descarga. Se quita el `?si=` de seguimiento. |
| `resumen`, `temas`, `referencias`, `titulo_sugerido` | Opcionales. La transcripción solo rellena los que estén vacíos. |

Puedes seguir la hoja en Google Sheets en lugar de editar el CSV a mano:

1. Crea una hoja con **esa misma fila de encabezados** (la plantilla vieja, con celdas sueltas y guiones, no sirve: la herramienta la rechaza).
2. **Archivo → Compartir → Publicar en la web**. Elige la hoja y el formato **Valores separados por comas (.csv)**. Publica y copia la URL.
3. En el repositorio: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
   - Nombre: `PODCAST_SHEET_CSV_URL`
   - Valor: la URL publicada.
4. Cada corrida del workflow descarga esa URL y sustituye el CSV. Si la descarga falla o no trae columna `titulo`, se conserva el CSV del repo. Las columnas `resumen`, `temas`, `referencias` y `titulo_sugerido` no se borran si la hoja las trae vacías.

Variables opcionales (también en Actions → Variables):

| Variable | Para qué | Si no existe |
| --- | --- | --- |
| `PODCAST_SHEET_CSV_URL` | CSV publicado de Google Sheets | Se usa `data/podcast/episodes.csv` |
| `PODCAST_SITE_URL` | URL del sitio, sin barra final | `https://livebibleis-afk.github.io/biblia-viviente` |
| `PODCAST_AUDIO_BASE_URL` | Prefijo de los MP3 del release | `https://github.com/livebibleis-afk/biblia-viviente/releases/download/podcast` |
| `PODCAST_OWNER_EMAIL` | Correo `itunes:email` del feed | El feed no incluye correo |
| `PODCAST_RELEASE_TAG` | Tag del release de audio | `podcast` |

### Correr el workflow

El archivo es [`.github/workflows/podcast.yml`](.github/workflows/podcast.yml).

- **A mano:** Actions → Podcast → Run workflow. Puedes marcar transcripción, forzar el reproceso, limitar a un archivo o pegar una URL de hoja solo para esa corrida.
- **Solo:** cada lunes a las 08:00 UTC.

El workflow instala ffmpeg y las dependencias, corre las pruebas, etiqueta lo que aún no está publicado y sube los MP3 al release `podcast` (`--latest=false`, para no tapar el release de código). Después hace commit **solo** de `episodes.csv`, `episodes.json`, `state.json` y `feed.xml`.

YouTube suele bloquear las descargas desde los servidores de GitHub (error 403 o «sign in to confirm you're not a bot»). Eso **no tumba** el workflow: el episodio queda en `state.json` como `error_descarga`, el catálogo se publica igual y el informe queda como artifact `podcast-report`. El audio hay que generarlo en una computadora normal.

### Respaldo local

En tu máquina, desde la raíz del repositorio (hace falta Python 3, ffmpeg y `gh auth login` o la variable `GH_TOKEN`):

```bash
python3 -m venv .venv
source .venv/bin/activate          # En Windows: .venv\Scripts\activate
pip install -r tools/podcast/requirements.txt

# Descargar, escribir ID3 (título, artista, álbum, año, pista, género,
# comentario, disco, compositor, artista del álbum, carátula y URL) y
# subir el MP3 al release. No lo commitees.
python3 tools/podcast/tag_podcast.py --upload

# Si YouTube pide comprobación, exporta cookies del navegador a un archivo
# que NO debes subir (está en .gitignore):
python3 tools/podcast/tag_podcast.py --upload --cookies "$HOME/cookies-youtube.txt"

# Solo regenerar catálogo y RSS, sin descargar:
python3 tools/podcast/tag_podcast.py --metadata-only

# Probar el etiquetado con un audio corto si YouTube no deja bajar.
# No se puede combinar con --upload: ese archivo no es el episodio.
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=2" -c:a libmp3lame /tmp/prueba.mp3
python3 tools/podcast/tag_podcast.py --substitute-audio /tmp/prueba.mp3 \
  --only DAAF_Armando_Alducin_F_DYEM_01.mp3
```

Cuando el MP3 ya está en el release, sube los metadatos:

```bash
git add data/podcast/episodes.csv data/podcast/episodes.json data/podcast/state.json feed.xml
git commit -m "podcast: actualiza catálogo y feed"
git push
```

Si corriges un título de un episodio ya publicado, vuelve a correr con `--force` (en Actions, la casilla «Volver a procesar») para reescribir el MP3.

Opciones útiles: `--dry-run` (no escribe nada), `--only ARCHIVO.mp3`, `--make-cover` (regenera `data/podcast/cover.jpg`; hace falta Pillow).

### Transcripción (opcional)

`--transcribe` usa [faster-whisper](https://github.com/SYSTRAN/faster-whisper) en CPU. Es lento y la primera vez baja un modelo, por eso el workflow no lo instala salvo que marques la casilla.

```bash
pip install faster-whisper
python3 tools/podcast/tag_podcast.py --transcribe --whisper-model base --only DAAF_Armando_Alducin_F_DYEM_01.mp3
```

Si el CSV tiene vacíos `resumen`, `temas`, `referencias` o `titulo_sugerido`, los rellena. No pisa lo que ya escribiste. El texto completo queda en `dist/podcast/transcripts/` (no se commitea). Los capítulos de unos cinco minutos pasan al JSON. Revisa las sugerencias antes de darlas por buenas: son una ayuda, no una cita editada.

La carátula compartida es `data/podcast/cover.jpg` («@BibliaViviente Dr. AAF»). Va embebida en cada MP3 y en el RSS.

## Datos bíblicos

| Campo | Valor |
|-------|-------|
| Traducción | Reina-Valera 1909 |
| Estado legal | Dominio público |
| Fuente original | [Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format) |
| Formato en el proyecto | JSON limpio y compacto |

---

## Roadmap

- [ ] PWA instalable (icono + manifest; el SW ya cachea el audio reproducido)
- [ ] Más versiones (NVI, LBLA, VBL…)
- [ ] Buscador de texto completo
- [ ] Marcadores y notas personales
- [ ] Plan de lectura diario

---

## Licencia

- **Código de la aplicación**: uso libre.
- **Texto bíblico (RVR 1909)**: dominio público.

---

Hecho con dedicación para la lectura de la Palabra.  
**Biblia Viviente** — lectura limpia, en cualquier dispositivo.
