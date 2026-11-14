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
| **Sin dependencias** | Solo HTML, CSS y JavaScript moderno |

---

## Estructura del proyecto

```text
biblia-viviente/
├── index.html          # Aplicación principal
├── css/
│   └── styles.css      # Estilos (tema claro/oscuro + responsive)
├── js/
│   └── app.js          # Lógica de navegación y renderizado
├── data/
│   └── rvr1909.json    # Biblia completa (Reina-Valera 1909)
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

## Datos bíblicos

| Campo | Valor |
|-------|-------|
| Traducción | Reina-Valera 1909 |
| Estado legal | Dominio público |
| Fuente original | [Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format) |
| Formato en el proyecto | JSON limpio y compacto |

---

## Roadmap

- [ ] PWA (instalable + funcionamiento offline)
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
