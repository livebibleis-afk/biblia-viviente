/**
 * Biblia Viviente
 * Modern Bible Reader — Multiversión & IndexedDB
 * Optimized for iOS Safari & Android
 * Audio por versículo: Web Speech API (español)
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
  view: 'books',
  testamentFilter: 'all',
  searchQuery: '',
  fontSizeScale: 100,
  lineSpacing: 'relaxed',
  selectedVerses: new Set(),
  highlights: JSON.parse(localStorage.getItem('bv-highlights') || '{}'),
  bookmarks: JSON.parse(localStorage.getItem('bv-bookmarks') || '[]'),
  history: JSON.parse(localStorage.getItem('bv-history') || 'null')
};

/* ========== Audio por versículo (Web Speech API) ========== */
const AUDIO = {
  speaking: false,
  paused: false,
  queueIndex: -1,
  queueList: [],
  preferredVoice: null
};

function getSpanishVoice() {
  const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  if (!voices.length) return null;
  return voices.find(v => /es(-|_)?(PE|MX|ES|US|AR|CO)/i.test(v.lang))
    || voices.find(v => /^es/i.test(v.lang))
    || voices.find(v => /spanish|español/i.test(v.name))
    || null;
}

function stopAudio() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  AUDIO.speaking = false;
  AUDIO.paused = false;
  AUDIO.queueIndex = -1;
  AUDIO.queueList = [];
  document.querySelectorAll('.verse.speaking').forEach(el => el.classList.remove('speaking'));
  updateAudioButtonUI(false);
}

function updateAudioButtonUI(isPlaying) {
  const btn = document.getElementById('btn-audio');
  if (!btn) return;
  if (isPlaying) {
    btn.innerHTML = '<i class="fa-solid fa-stop"></i><span>Detener</span>';
    btn.classList.add('is-playing');
  } else {
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i><span>Escuchar</span>';
    btn.classList.remove('is-playing');
  }
}

function speakText(text, onEnd) {
  if (!window.speechSynthesis) {
    alert('Tu navegador no soporta lectura en voz alta.');
    if (onEnd) onEnd();
    return;
  }
  speechSynthesis.cancel();
  if (typeof pauseChapterAudio === 'function') pauseChapterAudio();
  if (window.BibliaPodcast && window.BibliaPodcast.pause) window.BibliaPodcast.pause();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  u.rate = 0.95;
  u.pitch = 1;
  const voice = AUDIO.preferredVoice || getSpanishVoice();
  if (voice) {
    AUDIO.preferredVoice = voice;
    u.voice = voice;
    u.lang = voice.lang || 'es-ES';
  }
  u.onend = () => { if (onEnd) onEnd(); };
  u.onerror = () => { if (onEnd) onEnd(); };
  speechSynthesis.speak(u);
}

function speakVerse(verseNumber, text) {
  stopAudio();
  const el = document.querySelector(`.verse[data-verse="${verseNumber}"]`);
  if (el) el.classList.add('speaking');
  AUDIO.speaking = true;
  updateAudioButtonUI(true);
  speakText(text, () => {
    if (el) el.classList.remove('speaking');
    AUDIO.speaking = false;
    updateAudioButtonUI(false);
  });
}

function speakChapterVerses(verses) {
  if (!verses || !verses.length) return;
  stopAudio();
  AUDIO.queueList = verses.map(v => ({ number: v.number, text: v.text }));
  AUDIO.queueIndex = 0;
  AUDIO.speaking = true;
  updateAudioButtonUI(true);

  function playNext() {
    if (AUDIO.queueIndex < 0 || AUDIO.queueIndex >= AUDIO.queueList.length) {
      stopAudio();
      return;
    }
    document.querySelectorAll('.verse.speaking').forEach(el => el.classList.remove('speaking'));
    const item = AUDIO.queueList[AUDIO.queueIndex];
    const el = document.querySelector(`.verse[data-verse="${item.number}"]`);
    if (el) {
      el.classList.add('speaking');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    speakText(item.text, () => {
      AUDIO.queueIndex += 1;
      if (AUDIO.queueIndex < AUDIO.queueList.length) playNext();
      else stopAudio();
    });
  }
  playNext();
}

function toggleChapterAudio() {
  if (AUDIO.speaking) {
    stopAudio();
    return;
  }
  if (!STATE.currentChapter || !STATE.currentChapter.verses) return;
  speakChapterVerses(STATE.currentChapter.verses);
}

function speakSelectedVerses() {
  if (!STATE.currentBook || !STATE.currentChapter) return;
  const verses = [];
  [...STATE.selectedVerses].forEach(key => {
    const parts = key.split('-');
    const vNum = parseInt(parts[2], 10);
    const v = STATE.currentChapter.verses.find(x => x.number === vNum);
    if (v) verses.push(v);
  });
  verses.sort((a, b) => a.number - b.number);
  if (verses.length === 0) return;
  speakChapterVerses(verses);
}

if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => { AUDIO.preferredVoice = getSpanishVoice(); };
  AUDIO.preferredVoice = getSpanishVoice();
}

/* ========== Audio grabado por capítulo (HTML5) ==========
 * Ruta: audio/<version>/<libro-2d>/<capitulo-3d>.mp3
 * Ejemplo: audio/nvi/63/001.mp3  (2 Juan 1, audio NVI)
 * La carpeta de audio la elige AUDIO_CONFIG.version (por defecto nvi),
 * no el selector de texto (STATE.currentVersion).
 * Sidecar opcional con tiempos por versículo: .../003.json
 * { "verses": [{ "number": 1, "start": 0.0, "end": 4.2 }] }
 * Para alojar fuera del repo, cambia AUDIO_CONFIG.baseUrl
 * a una URL absoluta (Archive.org, GitHub Releases, etc.).
 */
const AUDIO_CONFIG = {
  baseUrl: 'audio',
  // Carpeta de audio independiente del texto (el selector de versión no la cambia).
  version: 'nvi',
  versionFolders: {
    rvr1909: 'rvr1909',
    Spanish1960Bible: 'rvr1960',
    SpanishNVIBible: 'nvi',
    nvi: 'nvi',
    SpanishTLABible: 'tla',
    SpanishLBLABible: 'lbla'
  }
};

const AUDIO_VERSION_STORAGE = 'bv-audio-version';

function resolveAudioVersion(key) {
  const raw = String(key || AUDIO_CONFIG.version || 'nvi');
  return AUDIO_CONFIG.versionFolders[raw] || raw || 'nvi';
}

function currentAudioVersion() {
  return resolveAudioVersion(AUDIO_CONFIG.version);
}

function setAudioVersion(versionKey) {
  AUDIO_CONFIG.version = resolveAudioVersion(versionKey);
  try { localStorage.setItem(AUDIO_VERSION_STORAGE, AUDIO_CONFIG.version); } catch (err) { /* ignore */ }
  const sel = document.getElementById('select-audio-version');
  if (sel && sel.value !== AUDIO_CONFIG.version) sel.value = AUDIO_CONFIG.version;
  if (STATE.view === 'verses' && STATE.currentBook && STATE.currentChapter) {
    syncChapterAudio(STATE.currentBook, STATE.currentChapter);
  }
}

function initAudioVersion() {
  let saved = null;
  try { saved = localStorage.getItem(AUDIO_VERSION_STORAGE); } catch (err) { saved = null; }
  AUDIO_CONFIG.version = resolveAudioVersion(saved || AUDIO_CONFIG.version || 'nvi');
  const sel = document.getElementById('select-audio-version');
  if (sel) sel.value = AUDIO_CONFIG.version;
}

const CHAPTER_AUDIO = {
  cues: [],
  token: 0,
  seeking: false,
  eventsBound: false
};

function padBook(n) { return String(n).padStart(2, '0'); }
function padChapter(n) { return String(n).padStart(3, '0'); }

function chapterAudioPaths(version, bookNum, chapNum) {
  const base = String(AUDIO_CONFIG.baseUrl || 'audio').replace(/\/$/, '');
  const book = padBook(bookNum);
  const chap = padChapter(chapNum);
  return {
    mp3: `${base}/${version}/${book}/${chap}.mp3`,
    cues: `${base}/${version}/${book}/${chap}.json`
  };
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function hideChapterAudioPlayer() {
  const player = document.getElementById('chapter-audio-player');
  const audio = document.getElementById('chapter-audio');
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  CHAPTER_AUDIO.cues = [];
  clearVerseAudioSync();
  if (player) {
    player.hidden = true;
    player.classList.add('hidden');
  }
  updateChapterAudioPlayUI(false);
}

function updateChapterAudioPlayUI(isPlaying) {
  const btn = document.getElementById('btn-chapter-audio-play');
  if (!btn) return;
  btn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  btn.setAttribute('aria-label', isPlaying ? 'Pausar audio del capítulo' : 'Reproducir audio del capítulo');
}

function pauseChapterAudio() {
  const audio = document.getElementById('chapter-audio');
  if (audio && !audio.paused) audio.pause();
  updateChapterAudioPlayUI(false);
}

function clearVerseAudioSync() {
  document.querySelectorAll('.verse.audio-synced').forEach(el => el.classList.remove('audio-synced'));
}

function syncVerseHighlight(currentTime) {
  if (!CHAPTER_AUDIO.cues.length) return;
  const cue = CHAPTER_AUDIO.cues.find(c => {
    const start = Number(c.start);
    const end = Number(c.end);
    return currentTime >= start && (Number.isFinite(end) ? currentTime < end : true);
  });
  document.querySelectorAll('.verse.audio-synced').forEach(el => el.classList.remove('audio-synced'));
  if (!cue) return;
  const el = document.querySelector(`.verse[data-verse="${cue.number}"]`);
  if (el) {
    el.classList.add('audio-synced');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function checkAudioAvailable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 501) return null;
    return false;
  } catch (err) {
    return null;
  }
}

async function loadCueSheet(url, token) {
  try {
    const res = await fetch(url);
    if (!res.ok || token !== CHAPTER_AUDIO.token) return;
    const data = await res.json();
    const verses = Array.isArray(data) ? data : (data.verses || []);
    CHAPTER_AUDIO.cues = verses.filter(v => v && Number.isFinite(Number(v.number)) && Number.isFinite(Number(v.start)));
  } catch (err) {
    CHAPTER_AUDIO.cues = [];
  }
}

function showChapterAudioPlayer() {
  const player = document.getElementById('chapter-audio-player');
  if (!player) return;
  player.hidden = false;
  player.classList.remove('hidden');
}

async function syncChapterAudio(book, chapter) {
  const audio = document.getElementById('chapter-audio');
  if (!audio || !book || !chapter) {
    hideChapterAudioPlayer();
    return;
  }
  const token = ++CHAPTER_AUDIO.token;
  hideChapterAudioPlayer();
  const version = currentAudioVersion();
  const paths = chapterAudioPaths(version, book.number, chapter.number);
  const available = await checkAudioAvailable(paths.mp3);
  if (token !== CHAPTER_AUDIO.token) return;

  const attachAndShow = () => {
    if (token !== CHAPTER_AUDIO.token) return;
    audio.src = paths.mp3;
    showChapterAudioPlayer();
    loadCueSheet(paths.cues, token);
  };

  if (available === true) {
    attachAndShow();
    return;
  }
  if (available === false) return;

  const onReady = () => {
    audio.removeEventListener('loadedmetadata', onReady);
    audio.removeEventListener('error', onErr);
    if (token !== CHAPTER_AUDIO.token) return;
    showChapterAudioPlayer();
    loadCueSheet(paths.cues, token);
  };
  const onErr = () => {
    audio.removeEventListener('loadedmetadata', onReady);
    audio.removeEventListener('error', onErr);
    if (token !== CHAPTER_AUDIO.token) return;
    hideChapterAudioPlayer();
  };
  audio.addEventListener('loadedmetadata', onReady);
  audio.addEventListener('error', onErr);
  audio.src = paths.mp3;
}

function bindChapterAudioEvents() {
  if (CHAPTER_AUDIO.eventsBound) return;
  const audio = document.getElementById('chapter-audio');
  const playBtn = document.getElementById('btn-chapter-audio-play');
  const seek = document.getElementById('chapter-audio-seek');
  const currentEl = document.getElementById('chapter-audio-current');
  const durationEl = document.getElementById('chapter-audio-duration');
  if (!audio) return;
  CHAPTER_AUDIO.eventsBound = true;

  const refreshTimes = () => {
    if (currentEl) currentEl.textContent = formatAudioTime(audio.currentTime);
    if (durationEl) durationEl.textContent = formatAudioTime(audio.duration);
    if (seek && !CHAPTER_AUDIO.seeking && Number.isFinite(audio.duration)) {
      seek.max = audio.duration;
      seek.value = audio.currentTime;
    }
  };

  audio.addEventListener('play', () => {
    stopAudio();
    updateChapterAudioPlayUI(true);
  });
  audio.addEventListener('pause', () => updateChapterAudioPlayUI(false));
  audio.addEventListener('ended', () => {
    updateChapterAudioPlayUI(false);
    clearVerseAudioSync();
  });
  audio.addEventListener('timeupdate', () => {
    refreshTimes();
    syncVerseHighlight(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', refreshTimes);

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!audio.src) return;
      if (audio.paused) {
        stopAudio();
        if (window.BibliaPodcast && window.BibliaPodcast.pause) window.BibliaPodcast.pause();
        audio.play().catch(() => updateChapterAudioPlayUI(false));
      } else {
        audio.pause();
      }
    });
  }
  if (seek) {
    seek.addEventListener('input', () => {
      CHAPTER_AUDIO.seeking = true;
      if (currentEl) currentEl.textContent = formatAudioTime(Number(seek.value));
    });
    seek.addEventListener('change', () => {
      audio.currentTime = Number(seek.value) || 0;
      CHAPTER_AUDIO.seeking = false;
    });
  }
  const audioVersionSel = document.getElementById('select-audio-version');
  if (audioVersionSel) {
    audioVersionSel.addEventListener('change', (e) => setAudioVersion(e.target.value));
  }
}


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
  footerVersion: document.getElementById('footer-version'),
  chapterAudioPlayer: document.getElementById('chapter-audio-player'),
  chapterAudio: document.getElementById('chapter-audio'),
  btnChapterAudioPlay: document.getElementById('btn-chapter-audio-play'),
  chapterAudioSeek: document.getElementById('chapter-audio-seek')
};

const DB_NAME = 'BibliaVivienteDB';
const DB_STORE = 'versions';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
  });
}

async function getCachedVersion(versionKey) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(versionKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) { return null; }
}

async function cacheVersion(versionKey, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(data, versionKey);
  } catch (e) { console.error('Error caching version', e); }
}

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
        verses.push({ number: vNum, text: vNode.textContent.trim() });
      });
      if (verses.length > 0) chapters.push({ number: cNum, verses });
    });
    if (chapters.length > 0) books.push({ number: bNum, name: bName, chapters });
  });
  return { translation: translationName, abbreviation: translationName.toUpperCase(), books };
}

async function loadVersion(versionKey) {
  if (DOM.loading) { DOM.loading.classList.remove('hidden'); DOM.loading.hidden = false; DOM.loading.style.display = ''; }
  try {
    const cached = await getCachedVersion(versionKey);
    if (cached) { STATE.bible = cached; STATE.currentVersion = versionKey; return; }
    if (versionKey === 'rvr1909') {
      const res = await fetch('data/rvr1909.json');
      if (!res.ok) throw new Error('No se pudo cargar data/rvr1909.json (' + res.status + ')');
      let json = await res.json();
      STATE.bible = Array.isArray(json)
        ? { translation: 'Reina-Valera 1909', abbreviation: 'RVR1909', books: json }
        : (json.books ? json : { ...json, books: [] });
    } else {
      const url = `https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/${versionKey}.xml`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fallo de red al pedir ${versionKey}`);
      STATE.bible = parseBebliaXML(await res.text(), versionKey);
    }
    STATE.bible.books.forEach(b => { if (b.number >= 1 && b.number <= 66) b.name = BOOK_NAMES_ES[b.number - 1]; });
    await cacheVersion(versionKey, STATE.bible);
    STATE.currentVersion = versionKey;
  } catch (err) {
    console.error('Error cargando versión:', err);
    const msg = (err && err.message) ? err.message : String(err);
    if (DOM.loading) {
      DOM.loading.innerHTML = `<div style="max-width:320px;padding:24px;text-align:center;font-family:system-ui,sans-serif"><p style="font-weight:600;margin-bottom:8px">No se pudo cargar la Biblia</p><p style="color:#64748b;font-size:0.875rem;margin-bottom:16px">${msg}</p><button onclick="location.reload()" style="padding:10px 16px;border-radius:10px;background:#4f46e5;color:#fff;font-weight:600;border:none;cursor:pointer">Reintentar</button></div>`;
      DOM.loading.classList.remove('hidden');
    }
    if (versionKey !== 'rvr1909' && DOM.selectVersion) { DOM.selectVersion.value = 'rvr1909'; await loadVersion('rvr1909'); }
  } finally {
    if (STATE.bible) {
      if (DOM.loading) { DOM.loading.hidden = true; DOM.loading.classList.add('hidden'); DOM.loading.style.display = 'none'; }
      updateUI();
      showView('books');
    }
  }
}

function normalizeTestamentFilter(filter) {
  if (filter === 'old' || filter === 'ot' || filter === 'antiguo') return 'old';
  if (filter === 'new' || filter === 'nt' || filter === 'nuevo') return 'new';
  return 'all';
}

function renderBooks() {
  try {
    const { bible, searchQuery } = STATE;
    if (!bible || !bible.books || !DOM.booksGrid) return;
    let books = bible.books;
    const filter = normalizeTestamentFilter(STATE.testamentFilter);
    if (filter === 'old') books = books.filter(b => b.number <= 39);
    else if (filter === 'new') books = books.filter(b => b.number >= 40);
    if (searchQuery) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      books = books.filter(b => (b.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
    }
    if (books.length === 0) { DOM.booksGrid.innerHTML = '<div class="empty-state">No se encontraron libros</div>'; return; }
    DOM.booksGrid.innerHTML = books.map(book => `
      <button class="book-card" data-book="${book.number}" type="button">
        <span class="book-num">${String(book.number).padStart(2, '0')}</span>
        <span class="book-name">${book.name}</span>
        <span class="book-chapters">${(book.chapters || []).length} cap.</span>
      </button>`).join('');
  } catch (err) { console.error('renderBooks:', err); }
}

function renderChapters(book) {
  try {
    if (!DOM.chaptersGrid || !book) return;
    DOM.chaptersGrid.innerHTML = book.chapters.map(ch => `<button class="chapter-btn" data-chapter="${ch.number}" type="button">${ch.number}</button>`).join('');
  } catch (err) { console.error('renderChapters:', err); }
}

function renderVerses(book, chapter) {
  try {
    if (!DOM.versesContainer) return;
    stopAudio();
    const versesHtml = chapter.verses.map(v => {
      const isHighlighted = STATE.highlights[`${book.number}-${chapter.number}-${v.number}`];
      return `
        <p class="verse ${isHighlighted ? 'highlighted' : ''}" data-verse="${v.number}">
          <sup class="verse-number">${v.number}</sup>
          <span class="verse-text">${escapeHtml(v.text)}</span>
          <button type="button" class="verse-audio-btn" data-verse-audio="${v.number}" title="Escuchar versículo" aria-label="Escuchar versículo ${v.number}">
            <i class="fa-solid fa-volume-high"></i>
          </button>
        </p>`;
    }).join('');
    DOM.versesContainer.innerHTML = versesHtml;
    if (DOM.versesChapterTitle) DOM.versesChapterTitle.textContent = `${book.name} ${chapter.number}`;
    if (DOM.currentReferenceBadge) DOM.currentReferenceBadge.textContent = `${book.name} ${chapter.number}`;
    STATE.history = { bookNumber: book.number, bookName: book.name, chapterNumber: chapter.number };
    localStorage.setItem('bv-history', JSON.stringify(STATE.history));
    updateContinueReadingCard();
    syncChapterAudio(book, chapter);
  } catch (err) { console.error('renderVerses:', err); }
}

function updateContinueReadingCard() {
  if (!DOM.continueReadingCard) return;
  if (STATE.history) {
    DOM.continueReadingCard.classList.remove('hidden');
    if (DOM.continueTitle) DOM.continueTitle.textContent = `${STATE.history.bookName} ${STATE.history.chapterNumber}`;
  } else DOM.continueReadingCard.classList.add('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function scrollToPodcast() {
  const el = document.getElementById('podcast');
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function showView(view) {
  try {
    if (view === 'podcast') view = 'books';
    STATE.view = view;
    if (DOM.viewBooks) DOM.viewBooks.classList.add('hidden');
    if (DOM.viewChapters) DOM.viewChapters.classList.add('hidden');
    if (DOM.viewVerses) DOM.viewVerses.classList.add('hidden');
    if (view !== 'verses') pauseChapterAudio();
    const versionDot = document.getElementById('header-version-dot');
    if (DOM.selectVersion) DOM.selectVersion.classList.remove('hidden');
    if (versionDot) versionDot.classList.remove('hidden');
    if (view === 'books') {
      if (DOM.viewBooks) DOM.viewBooks.classList.remove('hidden');
      if (DOM.btnBack) DOM.btnBack.classList.add('hidden');
      if (DOM.headerTitle) DOM.headerTitle.textContent = 'Biblia Viviente';
      if (DOM.currentReferenceBadge) DOM.currentReferenceBadge.textContent = (STATE.bible && STATE.bible.translation) || 'Reina-Valera 1909';
    } else if (view === 'chapters' && STATE.currentBook) {
      if (DOM.viewChapters) DOM.viewChapters.classList.remove('hidden');
      if (DOM.btnBack) DOM.btnBack.classList.remove('hidden');
      if (DOM.headerTitle) DOM.headerTitle.textContent = STATE.currentBook.name;
      if (DOM.currentReferenceBadge) DOM.currentReferenceBadge.textContent = `${STATE.currentBook.chapters.length} capítulos`;
    } else if (view === 'verses' && STATE.currentBook && STATE.currentChapter) {
      if (DOM.viewVerses) DOM.viewVerses.classList.remove('hidden');
      if (DOM.btnBack) DOM.btnBack.classList.remove('hidden');
      if (DOM.headerTitle) DOM.headerTitle.textContent = `${STATE.currentBook.name} ${STATE.currentChapter.number}`;
      if (DOM.currentReferenceBadge) DOM.currentReferenceBadge.textContent = STATE.bible.translation || '';
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (view === 'books' && location.hash === '#podcast') scrollToPodcast();
  } catch (err) { console.error('showView:', err); }
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
    if (DOM.footerVersion) DOM.footerVersion.textContent = STATE.bible.translation || 'Reina-Valera 1909';
  }
}

function applyTypography() {
  if (DOM.fontSizeDisplay) DOM.fontSizeDisplay.textContent = `${STATE.fontSizeScale}%`;
  document.documentElement.style.setProperty('--verse-font-size', `${STATE.fontSizeScale / 100 * 1.15}rem`);
  document.documentElement.style.setProperty('--verse-line-height', STATE.lineSpacing === 'loose' ? '2.1' : '1.75');
  if (DOM.popoverFont) DOM.popoverFont.classList.add('hidden');
}

function renderBookmarksModal() {
  if (!DOM.bookmarksList) return;
  if (STATE.highlights && Object.keys(STATE.highlights).length > 0 && STATE.bible) {
    DOM.bookmarksList.innerHTML = Object.keys(STATE.highlights).map(k => {
      const [bNum, cNum, vNum] = k.split('-');
      const book = STATE.bible.books.find(b => b.number == bNum);
      const chap = book && book.chapters.find(c => c.number == cNum);
      const verse = chap && chap.verses.find(v => v.number == vNum);
      if (!verse) return '';
      return `<div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10"><div class="text-xs font-bold text-amber-500 mb-1">${book.name} ${cNum}:${vNum}</div><p class="text-xs text-slate-600 dark:text-slate-300">${escapeHtml(verse.text)}</p></div>`;
    }).join('');
  } else {
    DOM.bookmarksList.innerHTML = '<div class="text-center text-slate-400 py-12 text-sm">No hay versículos resaltados o marcados.</div>';
  }
}

function initEvents() {
  bindChapterAudioEvents();
  if (DOM.selectVersion) DOM.selectVersion.addEventListener('change', (e) => {
    loadVersion(e.target.value);
  });
  if (DOM.btnTheme) DOM.btnTheme.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('bv-theme', isDark ? 'dark' : 'light');
  });
  if (DOM.btnBack) DOM.btnBack.addEventListener('click', () => {
    if (STATE.view === 'verses') showView('chapters');
    else if (STATE.view === 'chapters') showView('books');
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#podcast') {
      if (STATE.view !== 'books') showView('books');
      else scrollToPodcast();
    }
  });
  if (DOM.continueReadingCard) DOM.continueReadingCard.addEventListener('click', () => {
    if (!STATE.history || !STATE.bible) return;
    const book = STATE.bible.books.find(b => b.number === STATE.history.bookNumber);
    if (book) { STATE.currentBook = book; openChapter(STATE.history.chapterNumber); }
  });
  if (DOM.searchBooks) DOM.searchBooks.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value.trim();
    renderBooks();
  });
  document.querySelectorAll('.testament-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.testament-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      STATE.testamentFilter = tab.dataset.testament;
      renderBooks();
    });
  });
  if (DOM.booksGrid) DOM.booksGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.book-card');
    if (card) openBook(parseInt(card.dataset.book, 10));
  });
  if (DOM.chaptersGrid) DOM.chaptersGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.chapter-btn');
    if (btn) openChapter(parseInt(btn.dataset.chapter, 10));
  });
  if (DOM.btnChapterPicker) DOM.btnChapterPicker.addEventListener('click', () => showView('chapters'));
  if (DOM.btnPrev) DOM.btnPrev.addEventListener('click', () => {
    if (!STATE.currentBook || !STATE.currentChapter) return;
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
  if (DOM.btnNext) DOM.btnNext.addEventListener('click', () => {
    if (!STATE.currentBook || !STATE.currentChapter) return;
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
  if (DOM.btnFontSettings && DOM.popoverFont) {
    DOM.btnFontSettings.addEventListener('click', (e) => { e.stopPropagation(); DOM.popoverFont.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (!DOM.popoverFont.contains(e.target) && !DOM.btnFontSettings.contains(e.target)) DOM.popoverFont.classList.add('hidden');
    });
  }
  if (DOM.fontIncrease) DOM.fontIncrease.addEventListener('click', () => { if (STATE.fontSizeScale < 160) { STATE.fontSizeScale += 10; applyTypography(); } });
  if (DOM.fontDecrease) DOM.fontDecrease.addEventListener('click', () => { if (STATE.fontSizeScale > 80) { STATE.fontSizeScale -= 10; applyTypography(); } });
  document.querySelectorAll('.line-btn').forEach(btn => {
    btn.addEventListener('click', () => { STATE.lineSpacing = btn.dataset.line; applyTypography(); });
  });

  if (DOM.versesContainer) {
    DOM.versesContainer.addEventListener('click', (e) => {
      const audioBtn = e.target.closest('.verse-audio-btn');
      if (audioBtn) {
        e.preventDefault();
        e.stopPropagation();
        const vNum = parseInt(audioBtn.dataset.verseAudio, 10);
        const verse = STATE.currentChapter && STATE.currentChapter.verses.find(v => v.number === vNum);
        if (verse) speakVerse(vNum, verse.text);
        return;
      }
      const verseEl = e.target.closest('.verse');
      if (!verseEl || !STATE.currentBook || !STATE.currentChapter) return;
      const vNum = parseInt(verseEl.dataset.verse, 10);
      verseEl.classList.toggle('selected');
      const key = `${STATE.currentBook.number}-${STATE.currentChapter.number}-${vNum}`;
      if (verseEl.classList.contains('selected')) STATE.selectedVerses.add(key);
      else STATE.selectedVerses.delete(key);
      if (DOM.verseFloatingBar) {
        if (STATE.selectedVerses.size > 0) DOM.verseFloatingBar.classList.remove('hidden');
        else DOM.verseFloatingBar.classList.add('hidden');
      }
    });
  }

  const btnAudio = document.getElementById('btn-audio');
  if (btnAudio) btnAudio.addEventListener('click', () => toggleChapterAudio());
  const actionListen = document.getElementById('action-listen');
  if (actionListen) actionListen.addEventListener('click', () => speakSelectedVerses());

  if (DOM.btnBookmarks && DOM.modalBookmarks) {
    DOM.btnBookmarks.addEventListener('click', () => { renderBookmarksModal(); DOM.modalBookmarks.classList.remove('hidden'); });
  }
  if (DOM.closeBookmarks && DOM.modalBookmarks) DOM.closeBookmarks.addEventListener('click', () => DOM.modalBookmarks.classList.add('hidden'));
  if (DOM.btnSearchGlobal && DOM.modalSearch) DOM.btnSearchGlobal.addEventListener('click', () => DOM.modalSearch.classList.remove('hidden'));
  if (DOM.closeSearch && DOM.modalSearch) DOM.closeSearch.addEventListener('click', () => DOM.modalSearch.classList.add('hidden'));

  window.addEventListener('scroll', () => {
    if (!DOM.readingProgress) return;
    const h = document.documentElement;
    const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
    DOM.readingProgress.style.width = Math.min(100, Math.max(0, pct)) + '%';
  });
}

async function init() {
  try {
    const savedTheme = localStorage.getItem('bv-theme') || 'light';
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    const required = ['loading', 'booksGrid', 'viewBooks'];
    for (const key of required) {
      if (!DOM[key]) throw new Error('Falta el elemento DOM: ' + key + '. Revisa index.html');
    }
    initEvents();
    initAudioVersion();
    await loadVersion('rvr1909');
    if (location.hash === '#podcast') scrollToPodcast();
  } catch (err) {
    console.error('Error en init:', err);
    const el = document.getElementById('loading') || document.body;
    el.innerHTML = `<div style="padding:32px;text-align:center;font-family:system-ui,sans-serif"><p style="font-weight:700;margin-bottom:8px">Error al iniciar la aplicación</p><p style="color:#64748b;font-size:14px;margin-bottom:16px">${err.message || err}</p><button onclick="location.reload()" style="padding:10px 16px;border-radius:10px;background:#4f46e5;color:#fff;border:none;cursor:pointer">Reintentar</button></div>`;
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
