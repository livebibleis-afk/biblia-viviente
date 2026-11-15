/**
 * Biblia Viviente
 * Modern Bible Reader — Multiversión & IndexedDB
 * Optimized for iOS Safari & Android
 */

const BOOK_NAMES_ES = [
  "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut", "1 Samuel", "2 Samuel",
  "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras", "Nehemías", "Ester", "Job", "Salmos", "Proverbios",
  "Eclesiastés", "Cantares", "Isaías", "Jeremías", "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós",
  "Abdías", "Jonás", "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías",
  "Mateo", "Marcos", "Lucas", "Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios", "Gálatas", "Efesios",
  "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses", "1 Timoteo", "2 Timoteo", "Tito", "Filemón",
  "Hebreos", "Santiago", "1 Pedro", "2 Pedro", "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis"
];

const STATE = {
  bible: null,
  currentVersion: 'rvr1909',
  currentBook: null,
  currentChapter: null,
  view: 'books', // books | chapters | verses
  testamentFilter: 'all',
  searchQuery: '',
  fontSizeScale: 100,
  lineSpacing: 'relaxed',
  selectedVerses: new Set(),
  highlights: JSON.parse(localStorage.getItem('bv-highlights') || '{}'),
  bookmarks: JSON.parse(localStorage.getItem('bv-bookmarks') || '[]'),
  history: JSON.parse(localStorage.getItem('bv-history') || 'null')
};

const DOM = {
  loading: document.getElementById('loading'),
  headerTitle: document.getElementById('header-title'),
  currentReferenceBadge: document.getElementById('current-reference-badge'),
  selectVersion: document.getElementById('select-version'),
  btnBack: document.getElementById('btn-back'),
  btnTheme: document.getElementById('btn-theme'),
  btnSearchGlobal: document.getElementById('btn-search-global'),
  btnFontSettings: document.getElementById('btn-font-settings'),
  popoverFont: document.getElementById('popover-font'),
  fontDecrease: document.getElementById('font-decrease'),
  fontIncrease: document.getElementById('font-increase'),
  fontSizeDisplay: document.getElementById('font-size-display'),
  btnBookmarks: document.getElementById('btn-bookmarks'),
  viewBooks: document.getElementById('view-books'),
  viewChapters: document.getElementById('view-chapters'),
  viewVerses: document.getElementById('view-verses'),
  continueReadingCard: document.getElementById('continue-reading-card'),
  continueTitle: document.getElementById('continue-title'),
  searchBooks: document.getElementById('search-books'),
  countOt: document.getElementById('count-ot'),
  countNt: document.getElementById('count-nt'),
  booksGrid: document.getElementById('books-grid'),
  chaptersGrid: document.getElementById('chapters-grid'),
  versesChapterTitle: document.getElementById('verses-chapter-title'),
  versesContainer: document.getElementById('verses-content'),
  readingProgress: document.getElementById('reading-progress'),
  btnPrev: document.getElementById('btn-prev-chapter'),
  btnNext: document.getElementById('btn-next-chapter'),
  btnChapterPicker: document.getElementById('btn-chapter-picker'),
  verseFloatingBar: document.getElementById('verse-floating-bar'),
  actionCopy: document.getElementById('action-copy'),
  actionHighlight: document.getElementById('action-highlight'),
  actionShare: document.getElementById('action-share'),
  modalSearch: document.getElementById('modal-search'),
  searchInput: document.getElementById('search-input'),
  closeSearch: document.getElementById('close-search'),
  searchResults: document.getElementById('search-results'),
  modalBookmarks: document.getElementById('modal-bookmarks'),
  closeBookmarks: document.getElementById('close-bookmarks'),
  bookmarksList: document.getElementById('bookmarks-list'),
  footerVersion: document.getElementById('footer-version')
};

// ─────────────────────────────────────────────
// IndexedDB Helper for Offline Caching
// ─────────────────────────────────────────────
const DB_NAME = 'BibliaVivienteDB';
const DB_STORE = 'versions';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
  });
}

async function getCachedVersion(versionKey) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(versionKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function cacheVersion(versionKey, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put(data, versionKey);
  } catch (e) {
    console.error('Error caching version', e);
  }
}

// ─────────────────────────────────────────────
// XML Parser for Beblia Formats
// ─────────────────────────────────────────────
function parseBebliaXML(xmlText, translationName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const bookNodes = xmlDoc.querySelectorAll('book, BIBLEBOOK');
  const books = [];

  bookNodes.forEach((bNode, bIdx) => {
    const bNum = parseInt(bNode.getAttribute('number') || bNode.getAttribute('bnumber') || (bIdx + 1));
    const bName = BOOK_NAMES_ES[bNum - 1] || bNode.getAttribute('name') || `Libro ${bNum}`;
    
    const chapterNodes = bNode.querySelectorAll('chapter, CHAPTER');
    const chapters = [];

    chapterNodes.forEach((cNode, cIdx) => {
      const cNum = parseInt(cNode.getAttribute('number') || cNode.getAttribute('cnumber') || (cIdx + 1));
      const verseNodes = cNode.querySelectorAll('verse, VERS');
      const verses = [];

      verseNodes.forEach((vNode, vIdx) => {
        const vNum = parseInt(vNode.getAttribute('number') || vNode.getAttribute('vnumber') || (vIdx + 1));
        const vText = vNode.textContent.trim();
        verses.push({ number: vNum, text: vText });
      });

      if (verses.length > 0) {
        chapters.push({ number: cNum, verses });
      }
    });

    if (chapters.length > 0) {
      books.push({ number: bNum, name: bName, chapters });
    }
  });

  return {
    translation: translationName,
    abbreviation: translationName.toUpperCase(),
    books
  };
}

// ─────────────────────────────────────────────
// Data Loader with try/finally
// ─────────────────────────────────────────────
async function loadVersion(versionKey) {
  DOM.loading.classList.remove('hidden');
  try {
    // Check Cache first
    const cached = await getCachedVersion(versionKey);
    if (cached) {
      STATE.bible = cached;
      STATE.currentVersion = versionKey;
      return;
    }

    if (versionKey === 'rvr1909') {
      const res = await fetch('data/rvr1909.json');
      if (!res.ok) throw new Error('No se pudo cargar rvr1909.json');
      let json = await res.json();
      
      // Normalización si raíz es objeto { books: [...] } o arreglo [...]
      if (Array.isArray(json)) {
        STATE.bible = { translation: 'Reina-Valera 1909', abbreviation: 'RVR1909', books: json };
      } else {
        STATE.bible = json;
        if (!STATE.bible.books) STATE.bible.books = [];
      }
    } else {
      // Versiones Beblia Remotas
      const url = `https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/${versionKey}.xml`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fallo de red al pedir ${versionKey}`);
      const xmlText = await res.text();
      STATE.bible = parseBebliaXML(xmlText, versionKey);
    }

    // Asegurar nombres en español con BOOK_NAMES_ES
    STATE.bible.books.forEach(b => {
      if (b.number >= 1 && b.number <= 66) {
        b.name = BOOK_NAMES_ES[b.number - 1];
      }
    });

    await cacheVersion(versionKey, STATE.bible);
    STATE.currentVersion = versionKey;
  } catch (err) {
    console.error('Error cargando versión:', err);
    alert(`No se pudo cargar la versión seleccionada. Volviendo a Reina-Valera 1909.`);
    DOM.selectVersion.value = 'rvr1909';
    if (versionKey !== 'rvr1909') {
      await loadVersion('rvr1909');
    }
  } finally {
    DOM.loading.hidden = true;
    DOM.loading.classList.add('hidden');
    updateUI();
  }
}

// ─────────────────────────────────────────────
// Render Functions
// ─────────────────────────────────────────────
function normalizeTestamentFilter(filter) {
  if (filter === 'old' || filter === 'ot' || filter === 'antiguo') return 'old';
  if (filter === 'new' || filter === 'nt' || filter === 'nuevo') return 'new';
  return 'all';
}

function renderBooks() {
  const { bible, searchQuery } = STATE;
  if (!bible || !bible.books) return;

  let books = bible.books;
  const filter = normalizeTestamentFilter(STATE.testamentFilter);

  if (filter === 'old') {
    books = books.filter(b => b.number <= 39);
  } else if (filter === 'new') {
    books = books.filter(b => b.number >= 40);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    books = books.filter(b => {
      const name = (b.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name.includes(q);
    });
  }

  DOM.booksGrid.innerHTML = books.map(book => `
    <button class="book-card" data-book="${book.number}" type="button">
      <span class="book-num">${String(book.number).padStart(2, '0')}</span>
      <span class="book-name">${book.name}</span>
      <span class="book-chapters">${book.chapters.length} cap.</span>
    </button>
  `).join('');
}

function renderChapters(book) {
  DOM.chaptersGrid.innerHTML = book.chapters.map(ch => `
    <button class="chapter-btn" data-chapter="${ch.number}" type="button">
      ${ch.number}
    </button>
  `).join('');
}

function renderVerses(book, chapter) {
  const versesHtml = chapter.verses.map(v => {
    const isHighlighted = STATE.highlights[`${book.number}-${chapter.number}-${v.number}`];
    return `
      <p class="verse ${isHighlighted ? 'highlighted' : ''}" data-verse="${v.number}">
        <sup class="verse-number">${v.number}</sup>
        <span class="verse-text">${escapeHtml(v.text)}</span>
      </p>
    `;
  }).join('');

  DOM.versesContainer.innerHTML = versesHtml;
  DOM.versesChapterTitle.textContent = `${book.name} ${chapter.number}`;
  DOM.currentReferenceBadge.textContent = `${book.name} ${chapter.number}`;

  // Guardar historial / Continuar leyendo
  STATE.history = { bookNumber: book.number, bookName: book.name, chapterNumber: chapter.number };
  localStorage.setItem('bv-history', JSON.stringify(STATE.history));
  updateContinueReadingCard();
}

function updateContinueReadingCard() {
  if (STATE.history) {
    DOM.continueReadingCard.classList.remove('hidden');
    DOM.continueTitle.textContent = `${STATE.history.bookName} ${STATE.history.chapterNumber}`;
  } else {
    DOM.continueReadingCard.classList.add('hidden');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// Navigation & Views
// ─────────────────────────────────────────────
function showView(view) {
  STATE.view = view;
  DOM.viewBooks.classList.add('hidden');
  DOM.viewChapters.classList.add('hidden');
  DOM.viewVerses.classList.add('hidden');

  if (view === 'books') {
    DOM.viewBooks.classList.remove('hidden');
    DOM.btnBack.classList.add('hidden');
    DOM.headerTitle.textContent = 'Biblia Viviente';
    DOM.currentReferenceBadge.textContent = STATE.bible.translation || 'Reina-Valera 1909';
  } else if (view === 'chapters') {
    DOM.viewChapters.classList.remove('hidden');
    DOM.btnBack.classList.remove('hidden');
    DOM.headerTitle.textContent = STATE.currentBook.name;
    DOM.currentReferenceBadge.textContent = `${STATE.currentBook.chapters.length} capítulos`;
  } else if (view === 'verses') {
    DOM.viewVerses.classList.remove('hidden');
    DOM.btnBack.classList.remove('hidden');
    DOM.headerTitle.textContent = `${STATE.currentBook.name} ${STATE.currentChapter.number}`;
    DOM.currentReferenceBadge.textContent = STATE.bible.translation;
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function openBook(bookNum) {
  const book = STATE.bible.books.find(b => b.number === bookNum);
  if (!book) return;
  STATE.currentBook = book;
  renderChapters(book);
  showView('chapters');
}

function openChapter(chapNum) {
  const chapter = STATE.currentBook.chapters.find(c => c.number === chapNum);
  if (!chapter) return;
  STATE.currentChapter = chapter;
  renderVerses(STATE.currentBook, chapter);
  showView('verses');
}

function updateUI() {
  if (STATE.bible) {
    renderBooks();
    DOM.footerVersion.textContent = STATE.bible.translation;
  }
}

// ─────────────────────────────────────────────
// Events & Interactions
// ─────────────────────────────────────────────
function initEvents() {
  DOM.selectVersion.addEventListener('change', (e) => {
    loadVersion(e.target.value);
  });

  DOM.btnTheme.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('bv-theme', isDark ? 'dark' : 'light');
  });

  DOM.btnBack.addEventListener('click', () => {
    if (STATE.view === 'verses') showView('chapters');
    else if (STATE.view === 'chapters') showView('books');
  });

  DOM.continueReadingCard.addEventListener('click', () => {
    if (!STATE.history) return;
    const book = STATE.bible.books.find(b => b.number === STATE.history.bookNumber);
    if (book) {
      STATE.currentBook = book;
      openChapter(STATE.history.chapterNumber);
    }
  });

  DOM.searchBooks.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value.trim();
    renderBooks();
  });

  // Filtros de Testamento
  document.querySelectorAll('.testament-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.testament-tabs .tab').forEach(t => t.classList.remove('active', 'bg-white', 'dark:bg-indigo-600', 'shadow-sm'));
      tab.classList.add('active', 'bg-white', 'dark:bg-indigo-600', 'shadow-sm');
      STATE.testamentFilter = tab.dataset.testament;
      renderBooks();
    });
  });

  DOM.booksGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.book-card');
    if (card) openBook(parseInt(card.dataset.book));
  });

  DOM.chaptersGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.chapter-btn');
    if (btn) openChapter(parseInt(btn.dataset.chapter));
  });

  DOM.btnChapterPicker.addEventListener('click', () => showView('chapters'));

  DOM.btnPrev.addEventListener('click', () => {
    const cIdx = STATE.currentBook.chapters.findIndex(c => c.number === STATE.currentChapter.number);
    if (cIdx > 0) openChapter(STATE.currentBook.chapters[cIdx - 1].number);
    else {
      const bIdx = STATE.bible.books.findIndex(b => b.number === STATE.currentBook.number);
      if (bIdx > 0) {
        STATE.currentBook = STATE.bible.books[bIdx - 1];
        renderChapters(STATE.currentBook);
        openChapter(STATE.currentBook.chapters[STATE.currentBook.chapters.length - 1].number);
      }
    }
  });

  DOM.btnNext.addEventListener('click', () => {
    const cIdx = STATE.currentBook.chapters.findIndex(c => c.number === STATE.currentChapter.number);
    if (cIdx < STATE.currentBook.chapters.length - 1) openChapter(STATE.currentBook.chapters[cIdx + 1].number);
    else {
      const bIdx = STATE.bible.books.findIndex(b => b.number === STATE.currentBook.number);
      if (bIdx < STATE.bible.books.length - 1) {
        STATE.currentBook = STATE.bible.books[bIdx + 1];
        renderChapters(STATE.currentBook);
        openChapter(STATE.currentBook.chapters[0].number);
      }
    }
  });

  // Popover Tipografía
  DOM.btnFontSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.popoverFont.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!DOM.popoverFont.contains(e.target) && !DOM.btnFontSettings.contains(e.target)) {
      DOM.popoverFont.classList.add('hidden');
    }
  });

  DOM.fontIncrease.addEventListener('click', () => {
    if (STATE.fontSizeScale < 160) {
      STATE.fontSizeScale += 10;
      applyTypography();
    }
  });

  DOM.fontDecrease.addEventListener('click', () => {
    if (STATE.fontSizeScale > 80) {
      STATE.fontSizeScale -= 10;
      applyTypography();
    }
  });

  document.querySelectorAll('.line-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.lineSpacing = btn.dataset.line;
      applyTypography();
    });
  });

  // Acciones en Versículos (Click / Touch)
  DOM.versesContainer.addEventListener('click', (e) => {
    const verseEl = e.target.closest('.verse');
    if (!verseEl) return;
    const vNum = parseInt(verseEl.dataset.verse);
    verseEl.classList.toggle('selected');
    
    const key = `${STATE.currentBook.number}-${STATE.currentChapter.number}-${vNum}`;
    if (verseEl.classList.contains('selected')) {
      STATE.selectedVerses.add(key);
    } else {
      STATE.selectedVerses.delete(key);
    }

    if (STATE.selectedVerses.size > 0) {
      DOM.verseFloatingBar.classList.remove('hidden');
    } else {
      DOM.verseFloatingBar.classList.add('hidden');
    }
  });

  // Floating Bar Actions
  DOM.actionCopy.addEventListener('click', () => {
    const textToCopy = Array.from(STATE.selectedVerses).map(k => {
      const [bNum, cNum, vNum] = k.split('-');
      const book = STATE.bible.books.find(b => b.number == bNum);
      const chap = book.chapters.find(c => c.number == cNum);
      const verse = chap.verses.find(v => v.number == vNum);
      return `${book.name} ${cNum}:${vNum} - "${verse.text}"`;
    }).join('\n');

    navigator.clipboard.writeText(textToCopy + ` (${STATE.bible.translation})`);
    alert('¡Versículos copiados al portapapeles!');
  });

  DOM.actionHighlight.addEventListener('click', () => {
    STATE.selectedVerses.forEach(k => {
      STATE.highlights[k] = !STATE.highlights[k];
      if (!STATE.highlights[k]) delete STATE.highlights[k];
    });
    localStorage.setItem('bv-highlights', JSON.stringify(STATE.highlights));
    renderVerses(STATE.currentBook, STATE.currentChapter);
    DOM.verseFloatingBar.classList.add('hidden');
    STATE.selectedVerses.clear();
  });

  DOM.actionShare.addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({
        title: 'Biblia Viviente',
        text: `Lectura desde ${STATE.bible.translation}`
      }).catch(() => {});
    } else {
      DOM.actionCopy.click();
    }
  });

  // Búsqueda Global Modal (Máx 50 resultados)
  DOM.btnSearchGlobal.addEventListener('click', () => DOM.modalSearch.classList.remove('hidden'));
  DOM.closeSearch.addEventListener('click', () => DOM.modalSearch.classList.add('hidden'));

  DOM.searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 3) {
      DOM.searchResults.innerHTML = `<div class="text-center text-slate-400 py-12 text-sm">Escribe al menos 3 caracteres para buscar</div>`;
      return;
    }

    let results = [];
    const filter = document.querySelector('.search-filter-btn.bg-indigo-600')?.dataset.filter || 'all';

    for (const book of STATE.bible.books) {
      if (filter === 'ot' && book.number > 39) continue;
      if (filter === 'nt' && book.number < 40) continue;

      for (const chap of book.chapters) {
        for (const v of chap.verses) {
          if (v.text.toLowerCase().includes(q)) {
            results.push({ book, chap, v });
            if (results.length >= 50) break;
          }
        }
        if (results.length >= 50) break;
      }
      if (results.length >= 50) break;
    }

    if (results.length === 0) {
      DOM.searchResults.innerHTML = `<div class="text-center text-slate-400 py-12 text-sm">No se encontraron resultados</div>`;
      return;
    }

    DOM.searchResults.innerHTML = results.map(r => `
      <div class="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer search-result-item" data-b="${r.book.number}" data-c="${r.chap.number}">
        <div class="text-xs font-bold text-indigo-500 mb-1">${r.book.name} ${r.chap.number}:${r.v.number}</div>
        <p class="text-sm text-slate-700 dark:text-slate-300">${escapeHtml(r.v.text)}</p>
      </div>
    `).join('');
  });

  DOM.searchResults.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (item) {
      const bNum = parseInt(item.dataset.b);
      const cNum = parseInt(item.dataset.c);
      DOM.modalSearch.classList.add('hidden');
      STATE.currentBook = STATE.bible.books.find(b => b.number === bNum);
      openChapter(cNum);
    }
  });

  // Filtros de búsqueda global
  document.querySelectorAll('.search-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-filter-btn').forEach(b => b.classList.replace('bg-indigo-600', 'bg-slate-200'));
      document.querySelectorAll('.search-filter-btn').forEach(b => b.classList.replace('text-white', 'text-slate-600'));
      btn.classList.replace('bg-slate-200', 'bg-indigo-600');
      btn.classList.replace('text-slate-600', 'text-white');
      DOM.searchInput.dispatchEvent(new Event('input'));
    });
  });

  // Marcadores Modal
  DOM.btnBookmarks.addEventListener('click', () => {
    renderBookmarksModal();
    DOM.modalBookmarks.classList.remove('hidden');
  });
  DOM.closeBookmarks.addEventListener('click', () => DOM.modalBookmarks.classList.add('hidden'));

  // Scroll progress bar
  window.addEventListener('scroll', () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    DOM.readingProgress.style.width = scrolled + '%';
  });
}

function applyTypography() {
  DOM.fontSizeDisplay.textContent = `${STATE.fontSizeScale}%`;
  document.documentElement.style.setProperty('--verse-font-size', `${STATE.fontSizeScale / 100 * 1.15}rem`);
  document.documentElement.style.setProperty('--verse-line-height', STATE.lineSpacing === 'loose' ? '2.1' : '1.75');
  DOM.popoverFont.classList.add('hidden');
}

function renderBookmarksModal() {
  if (STATE.highlights && Object.keys(STATE.highlights).length > 0) {
    DOM.bookmarksList.innerHTML = Object.keys(STATE.highlights).map(k => {
      const [bNum, cNum, vNum] = k.split('-');
      const book = STATE.bible.books.find(b => b.number == bNum);
      const chap = book?.chapters.find(c => c.number == cNum);
      const verse = chap?.verses.find(v => v.number == vNum);
      if (!verse) return '';
      return `
        <div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
          <div class="text-xs font-bold text-amber-500 mb-1">${book.name} ${cNum}:${vNum}</div>
          <p class="text-xs text-slate-600 dark:text-slate-300">${escapeHtml(verse.text)}</p>
        </div>
      `;
    }).join('');
  } else {
    DOM.bookmarksList.innerHTML = `<div class="text-center text-slate-400 py-12 text-sm">No hay versículos resaltados o marcados.</div>`;
  }
}

// ─────────────────────────────────────────────
// Initialization
%─────────────────────────────────────────────
async function init() {
  const savedTheme = localStorage.getItem('bv-theme') || 'light';
  if (savedTheme === 'dark') document.documentElement.classList.add('dark');

  initEvents();
  await loadVersion('rvr1909');
}

init();