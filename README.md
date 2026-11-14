# Biblia Viviente

Aplicación web moderna para lectura de la Biblia, optimizada para **iOS Safari** y **Android**.

**Versión incluida:** Reina-Valera 1909 (dominio público)

---

## Características

- Lectura limpia: Libro → Capítulo → Versículos
- Diseño responsive (móvil, tablet y escritorio)
- **Modo oscuro / claro** (respeta preferencia del sistema + toggle manual)
- Optimizado para pantallas con notch (safe-area)
- Tipografía de lectura cómoda (Source Serif 4)
- Interfaz táctil con áreas grandes
- Navegación rápida entre capítulos
- Buscador de libros
- Filtro Antiguo / Nuevo Testamento
- Sin frameworks pesados — HTML, CSS y JavaScript moderno

---

## Estructura del proyecto

```
biblia-viviente/
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos (tema, responsive, dark mode)
├── js/
│   └── app.js          # Lógica de la aplicación
├── data/
│   └── rvr1909.json    # Biblia Reina-Valera 1909 en formato JSON
├── assets/
│   └── icons/          # (futuros iconos / PWA)
└── README.md
```

---

## Cómo usarla

### Opción 1 — Abrir localmente

Simplemente abre `index.html` en el navegador.

> **Nota:** Algunos navegadores bloquean `fetch` de archivos locales.  
> Si ves un error de carga, usa un servidor local:

```bash
# Con Python
python3 -m http.server 8080

# Con Node (si tienes npx)
npx serve .
```

Luego visita: `http://localhost:8080`

### Opción 2 — Desplegar

Puedes subir la carpeta completa a:

- **GitHub Pages**
- **Netlify** / **Vercel** (arrastrar y soltar)
- Cualquier hosting estático

---

## Tecnología

| Capa        | Tecnología                          |
|-------------|-------------------------------------|
| Markup      | HTML5 semántico                     |
| Estilos     | CSS moderno (variables, `color-mix`, `dvh`, safe-area) |
| Lógica      | JavaScript ES Modules (vanilla)     |
| Datos       | JSON (convertido desde XML de Beblia) |
| Tipografía  | Inter + Source Serif 4 (Google Fonts) |

---

## Datos bíblicos

El archivo `data/rvr1909.json` proviene del repositorio:

[Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format)

- Traducción: **Reina-Valera 1909**
- Estado: **Dominio público**
- Convertido a JSON limpio para mejor rendimiento en el navegador

---

## Roadmap posible

- [ ] PWA (instalable + offline)
- [ ] Más versiones (NVI, LBLA, VBL…)
- [ ] Comparación de versiones
- [ ] Buscador de texto completo
- [ ] Marcadores y notas personales
- [ ] Plan de lectura

---

## Licencia

- **Código de la aplicación:** uso libre.
- **Texto bíblico (RVR 1909):** dominio público.

---

Hecho con ❤️ para la lectura de la Palabra.
