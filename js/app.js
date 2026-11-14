/**
 * Biblia Viviente
 * Modern Bible Reader — Reina-Valera 1909
 * Optimized for iOS Safari & Android
 */

const STATE = {
  bible: null,
  currentBook: null,
  currentChapter: null,
  view: 'books', // books | chapters | verses
  testamentFilter: 'all',
  searchQuery: '',
};

// DOM refs
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  loading: $('#loading'),
  headerTitle: $('#header-title'),
  headerSubtitle: $('#header-subtitle'),
  btnBack: $('#btn-back'),
  btnTheme: $('#btn-theme'),
  viewBooks: $('#view-books'),
  viewChapters: $('#view-chapters'),
  viewVerses: $('#view-verses'),
  booksGrid: $('#books-grid'),
  chaptersGrid: $('#chapters-grid'),
  versesContent: $('#verses-content'),
  searchBooks: $('#search-books'),
  btnPrev: $('#btn-prev-chapter'),
  btnNext: $('#btn-next-chapter'),
  chapterNav: $('#chapter-nav'),
};

// ─────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('bv-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
  // else: follow system via CSS
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let next;
  if (!current) {
    // currently following system
    next = systemDark ? 'light' : 'dark';
  } else if (current === 'dark') {
    next = 'light';
  } else {
    next = 'dark';
  }

  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('bv-theme', next);

  // Update theme-color meta for browser chrome
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') ||
               document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = next === 'dark' ? '#0f172a' : '#f8fafc';
  }
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
async function loadBible() {
  try {
    const res = await fetch('data/rvr1909.json');
    if (!res.ok) throw new Error('No se pudo cargar la Biblia');
    STATE.bible = await res.json();
    return true;
  } catch (err) {
    console.error(err);
    els.loading.innerHTML = `
      <p style="color:var(--text);padding:24px;text-align:center">
        Error al cargar la Biblia.<br>
        <small style="color:var(--text-muted)">${err.message}</small>
      </p>`;
    return false;
  }
}

// ─────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────
function renderBooks() {
  const { bible, testamentFilter, searchQuery } = STATE;
  if (!bible) return;

  let books = bible.books;

  if (testamentFilter === 'old') {
    books = books.filter(b => b.number <= 39);
  } else if (testamentFilter === 'new') {
    books = books.filter(b => b.number >= 40);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    books = books.filter(b => {
      const name = b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name.includes(q);
    });
  }

  if (books.length === 0) {
    els.booksGrid.innerHTML = `<div class="empty-state">No se encontraron libros</div>`;
    return;
  }

  els.booksGrid.innerHTML = books.map(book => `
    <button class="book-card" data-book="${book.number}" type="button">
      <span class="book-num">${String(book.number).padStart(2, '0')}</span>
      <span class="book-name">${book.name}</span>
      <span class="book-chapters">${book.chapters.length} cap.</span>
    </button>
  `).join('');
}

function renderChapters(book) {
  els.chaptersGrid.innerHTML = book.chapters.map(ch => `
    <button class="chapter-btn" data-chapter="${ch.number}" type="button">
      ${ch.number}
    </button>
  `).join('');
}

function renderVerses(book, chapter) {
  const versesHtml = chapter.verses.map(v => `
    <p class="verse" id="v${v.number}">
      <sup class="verse-number">${v.number}</sup>
      <span class="verse-text">${escapeHtml(v.text)}</span>
    </p>
  `).join('');

  els.versesContent.innerHTML = versesHtml;

  // Prev / Next chapter buttons
  const bookIdx = STATE.bible.books.findIndex(b => b.number === book.number);
  const chapIdx = book.chapters.findIndex(c => c.number === chapter.number);

  const hasPrev = chapIdx > 0 || bookIdx > 0;
  const hasNext = chapIdx < book.chapters.length - 1 || bookIdx < STATE.bible.books.length - 1;

  els.btnPrev.disabled = !hasPrev;
  els.btnNext.disabled = !hasNext;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
function showView(view) {
  STATE.view = view;

  els.viewBooks.hidden = view !== 'books';
  els.viewChapters.hidden = view !== 'chapters';
  els.viewVerses.hidden = view !== 'verses';

  els.btnBack.hidden = view === 'books';

  // Header titles
  if (view === 'books') {
    els.headerTitle.textContent = 'Biblia Viviente';
    els.headerSubtitle.textContent = 'Reina-Valera 1909';
  } else if (view === 'chapters' && STATE.currentBook) {
    els.headerTitle.textContent = STATE.currentBook.name;
    els.headerSubtitle.textContent = `${STATE.currentBook.chapters.length} capítulos`;
  } else if (view === 'verses' && STATE.currentBook && STATE.currentChapter) {
    els.headerTitle.textContent = `${STATE.currentBook.name} ${STATE.currentChapter.number}`;
    els.headerSubtitle.textContent = 'Reina-Valera 1909';
  }

  // Scroll to top on view change
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function openBook(bookNumber) {
  const book = STATE.bible.books.find(b => b.number === bookNumber);
  if (!book) return;
  STATE.currentBook = book;
  STATE.currentChapter = null;
  renderChapters(book);
  showView('chapters');
}

function openChapter(chapterNumber) {
  const book = STATE.currentBook;
  if (!book) return;
  const chapter = book.chapters.find(c => c.number === chapterNumber);
  if (!chapter) return;
  STATE.currentChapter = chapter;
  renderVerses(book, chapter);
  showView('verses');
}

function goBack() {
  if (STATE.view === 'verses') {
    showView('chapters');
  } else if (STATE.view === 'chapters') {
    STATE.currentBook = null;
    showView('books');
  }
}

function goPrevChapter() {
  const book = STATE.currentBook;
  const chapter = STATE.currentChapter;
  if (!book || !chapter) return;

  const chapIdx = book.chapters.findIndex(c => c.number === chapter.number);
  if (chapIdx > 0) {
    openChapter(book.chapters[chapIdx - 1].number);
    return;
  }

  // Previous book, last chapter
  const bookIdx = STATE.bible.books.findIndex(b => b.number === book.number);
  if (bookIdx > 0) {
    const prevBook = STATE.bible.books[bookIdx - 1];
    STATE.currentBook = prevBook;
    const lastChap = prevBook.chapters[prevBook.chapters.length - 1];
    openChapter(lastChap.number);
  }
}

function goNextChapter() {
  const book = STATE.currentBook;
  const chapter = STATE.currentChapter;
  if (!book || !chapter) return;

  const chapIdx = book.chapters.findIndex(c => c.number === chapter.number);
  if (chapIdx < book.chapters.length - 1) {
    openChapter(book.chapters[chapIdx + 1].number);
    return;
  }

  // Next book, first chapter
  const bookIdx = STATE.bible.books.findIndex(b => b.number === book.number);
  if (bookIdx < STATE.bible.books.length - 1) {
    const nextBook = STATE.bible.books[bookIdx + 1];
    STATE.currentBook = nextBook;
    openChapter(nextBook.chapters[0].number);
  }
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────
function bindEvents() {
  // Theme
  els.btnTheme.addEventListener('click', toggleTheme);

  // Back
  els.btnBack.addEventListener('click', goBack);

  // Search books
  els.searchBooks.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value.trim();
    renderBooks();
  });

  // Testament tabs
  $$('.testament-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.testament-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      STATE.testamentFilter = tab.dataset.testament;
      renderBooks();
    });
  });

  // Books grid (event delegation)
  els.booksGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.book-card');
    if (card) {
      openBook(Number(card.dataset.book));
    }
  });

  // Chapters grid
  els.chaptersGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.chapter-btn');
    if (btn) {
      openChapter(Number(btn.dataset.chapter));
    }
  });

  // Chapter navigation
  els.btnPrev.addEventListener('click', goPrevChapter);
  els.btnNext.addEventListener('click', goNextChapter);

  // Keyboard: Escape goes back
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && STATE.view !== 'books') {
      goBack();
    }
  });
}

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
async function init() {
  initTheme();
  bindEvents();

  const ok = await loadBible();
  if (!ok) return;

  renderBooks();
  showView('books');

  // Hide loading
  els.loading.classList.add('hidden');
  setTimeout(() => {
    els.loading.remove();
  }, 350);
}

init();
