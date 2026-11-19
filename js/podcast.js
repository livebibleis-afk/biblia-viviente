/**
 * Podcast de Biblia Viviente — Dr. Armando Alducin F.
 * Lee data/podcast/episodes.json. No descarga audio hasta que el oyente pulsa play.
 */
(function () {
  const audio = document.getElementById('podcast-audio');
  const listEl = document.getElementById('podcast-list');
  const filtersEl = document.getElementById('podcast-filters');
  const searchEl = document.getElementById('search-podcast');
  const nowEl = document.getElementById('podcast-now');
  const nowPlay = document.getElementById('podcast-now-play');
  const nowTitle = document.getElementById('podcast-now-title');
  const nowSeries = document.getElementById('podcast-now-series');
  const seekEl = document.getElementById('podcast-seek');
  const currentEl = document.getElementById('podcast-current');
  const durationEl = document.getElementById('podcast-duration');

  if (!listEl || !audio) return;

  const state = {
    data: null,
    error: null,
    loading: true,
    query: '',
    series: 'all',
    currentId: null,
    seeking: false
  };

  function fold(value) {
    return (value || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function escapeHtml(text) {
    return (text || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    return minutes + ':' + String(secs).padStart(2, '0');
  }

  function episodes() {
    return (state.data && state.data.episodes) || [];
  }

  function groups(items) {
    const map = new Map();
    items.forEach((episode) => {
      const name = episode.series || 'Sin serie';
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(episode);
    });
    const list = [...map.entries()];
    list.forEach((entry) => entry[1].sort((a, b) => (a.track || 0) - (b.track || 0)));
    list.sort((a, b) => {
      const yearA = Math.max(...a[1].map((episode) => episode.year || 0));
      const yearB = Math.max(...b[1].map((episode) => episode.year || 0));
      return yearB - yearA;
    });
    return list;
  }

  function matches(episode) {
    if (state.series !== 'all' && (episode.series || 'Sin serie') !== state.series) return false;
    if (!state.query) return true;
    const haystack = [
      episode.title,
      episode.series,
      episode.summary,
      episode.artist,
      episode.album,
      (episode.topics || []).join(' '),
      (episode.references || []).join(' ')
    ].join(' ');
    return fold(haystack).includes(fold(state.query));
  }

  function sourceLabel(url) {
    if (!url) return '';
    if (/youtu\.?be|youtube\.com/i.test(url)) return 'Ver en YouTube';
    if (/tiktok\.com/i.test(url)) return 'Ver en TikTok';
    return 'Ver origen';
  }

  function renderFilters() {
    if (!filtersEl) return;
    const names = groups(episodes()).map((entry) => entry[0]);
    const buttons = ['all', ...names].map((name) => {
      const label = name === 'all' ? 'Todas' : name;
      const pressed = state.series === name ? 'true' : 'false';
      const active = state.series === name ? ' is-active' : '';
      return `<button type="button" class="podcast-filter${active}" data-series="${escapeHtml(name)}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
    });
    filtersEl.innerHTML = buttons.join('');
  }

  function episodeCard(episode) {
    const playable = Boolean(episode.audio_url);
    const playing = playable && state.currentId === episode.id && !audio.paused;
    const icon = playable ? (playing ? 'fa-pause' : 'fa-play') : 'fa-clock';
    const duration = episode.duration ? formatTime(episode.duration) : '';
    const meta = [
      episode.series,
      'Pista ' + String(episode.track || 1).padStart(2, '0'),
      episode.date ? episode.date.split('-').reverse().join('/') : (episode.year || ''),
      duration
    ].filter(Boolean).join(' · ');
    const topics = (episode.topics || []).map((topic) => `<span class="podcast-chip">${escapeHtml(topic)}</span>`).join('');
    const refs = (episode.references || []).map((ref) => `<span class="podcast-ref">${escapeHtml(ref)}</span>`).join('');
    const chapters = (episode.chapters || []).length
      ? `<details class="podcast-chapters"><summary>Capítulos</summary><ol>${episode.chapters.map((chapter) => `<li><button type="button" data-seek="${Number(chapter.start) || 0}" data-id="${escapeHtml(episode.id)}">${escapeHtml(formatTime(chapter.start || 0))} ${escapeHtml(chapter.title || '')}</button></li>`).join('')}</ol></details>`
      : '';
    const source = episode.source_url
      ? `<a class="podcast-source" href="${escapeHtml(episode.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel(episode.source_url))}</a>`
      : '';
    const badge = playable ? '' : '<span class="podcast-badge">Próximamente</span>';
    return `
      <article class="podcast-episode${playing ? ' is-playing' : ''}" data-id="${escapeHtml(episode.id)}">
        <button type="button" class="podcast-play" data-play="${escapeHtml(episode.id)}" ${playable ? '' : 'disabled'} aria-label="${playable ? 'Reproducir' : 'Audio aún no publicado'}: ${escapeHtml(episode.title)}">
          <i class="fa-solid ${icon}"></i>
        </button>
        <div class="podcast-episode-body">
          <div class="podcast-episode-title-row">
            <h3>${escapeHtml(episode.title)}</h3>
            ${badge}
          </div>
          <p class="podcast-episode-meta">${escapeHtml(meta)}</p>
          ${episode.summary ? `<p class="podcast-summary">${escapeHtml(episode.summary)}</p>` : ''}
          ${topics ? `<div class="podcast-chips">${topics}</div>` : ''}
          ${refs ? `<div class="podcast-refs">${refs}</div>` : ''}
          ${chapters}
          ${source}
        </div>
      </article>`;
  }

  function render() {
    const countEl = document.getElementById('podcast-entry-count');
    if (state.loading) {
      listEl.innerHTML = '<p class="empty-state">Cargando episodios…</p>';
      return;
    }
    if (state.error || !state.data) {
      listEl.innerHTML = '<p class="empty-state">No se pudo cargar el catálogo del podcast.</p>';
      return;
    }
    const podcast = state.data.podcast || {};
    const titleEl = document.getElementById('podcast-heading');
    const descEl = document.getElementById('podcast-desc');
    const coverEl = document.getElementById('podcast-cover');
    const rssEl = document.getElementById('podcast-rss');
    if (titleEl) titleEl.textContent = podcast.author || 'Dr. Armando Alducin F.';
    if (descEl) descEl.textContent = podcast.description || '';
    if (coverEl && podcast.cover) coverEl.src = podcast.cover;
    if (rssEl && podcast.feed) rssEl.href = podcast.feed;
    if (countEl) {
      const total = episodes().length;
      countEl.textContent = total ? ` · ${total} ${total === 1 ? 'episodio' : 'episodios'}` : '';
    }
    renderFilters();
    const visible = episodes().filter(matches);
    if (!visible.length) {
      listEl.innerHTML = '<p class="empty-state">Ningún episodio coincide con la búsqueda.</p>';
      return;
    }
    listEl.innerHTML = groups(visible).map(([name, items]) => `
      <section class="podcast-series">
        <h2 class="podcast-series-title">${escapeHtml(name)} <span>${items.length}</span></h2>
        <div class="podcast-series-list">
          ${items.map(episodeCard).join('')}
        </div>
      </section>`).join('');
  }

  function findEpisode(id) {
    return episodes().find((episode) => episode.id === id);
  }

  function syncTransport() {
    const playing = state.currentId && !audio.paused;
    document.querySelectorAll('.podcast-episode').forEach((card) => {
      const on = playing && card.dataset.id === state.currentId;
      card.classList.toggle('is-playing', on);
      const icon = card.querySelector('.podcast-play i');
      const button = card.querySelector('.podcast-play');
      if (!icon || !button || button.disabled) return;
      icon.className = on ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    });
    const nowIcon = nowPlay && nowPlay.querySelector('i');
    if (nowIcon) nowIcon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    if (nowPlay) nowPlay.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  }

  function showNow(episode) {
    if (!nowEl) return;
    nowEl.classList.remove('hidden');
    nowEl.hidden = false;
    document.body.classList.add('podcast-playing');
    if (nowTitle) nowTitle.textContent = episode.title || '';
    if (nowSeries) nowSeries.textContent = episode.series || '';
    if (durationEl) durationEl.textContent = formatTime(episode.duration || audio.duration || 0);
  }

  function playEpisode(episode, startAt) {
    if (!episode || !episode.audio_url) return;
    if (typeof pauseChapterAudio === 'function') pauseChapterAudio();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const same = state.currentId === episode.id && audio.src;
    if (!same) {
      audio.src = episode.audio_url;
      state.currentId = episode.id;
    }
    showNow(episode);
    const start = typeof startAt === 'number' ? startAt : null;
    audio.play().then(() => {
      if (start !== null && isFinite(start)) audio.currentTime = start;
      syncTransport();
    }).catch(() => {
      if (nowSeries) nowSeries.textContent = 'No se pudo reproducir este audio.';
      syncTransport();
    });
    syncTransport();
  }

  function toggleCurrent() {
    const episode = findEpisode(state.currentId);
    if (!episode) return;
    if (audio.paused) playEpisode(episode);
    else audio.pause();
  }

  function closePlayer() {
    if (!audio.paused) audio.pause();
    if (nowEl) {
      nowEl.classList.add('hidden');
      nowEl.hidden = true;
    }
    document.body.classList.remove('podcast-playing');
    syncTransport();
  }

  if (listEl) {
    listEl.addEventListener('click', (event) => {
      const seek = event.target.closest('[data-seek]');
      if (seek) {
        const episode = findEpisode(seek.dataset.id);
        playEpisode(episode, Number(seek.dataset.seek) || 0);
        return;
      }
      const button = event.target.closest('[data-play]');
      if (!button || button.disabled) return;
      const episode = findEpisode(button.dataset.play);
      if (!episode) return;
      if (state.currentId === episode.id && !audio.paused) audio.pause();
      else playEpisode(episode);
    });
  }

  if (filtersEl) {
    filtersEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-series]');
      if (!button) return;
      state.series = button.dataset.series || 'all';
      render();
      syncTransport();
    });
  }

  if (searchEl) {
    searchEl.addEventListener('input', () => {
      state.query = searchEl.value.trim();
      render();
      syncTransport();
    });
  }

  if (nowPlay) nowPlay.addEventListener('click', toggleCurrent);

  if (seekEl) {
    seekEl.addEventListener('pointerdown', () => { state.seeking = true; });
    seekEl.addEventListener('pointerup', () => { state.seeking = false; });
    seekEl.addEventListener('input', () => {
      if (currentEl) currentEl.textContent = formatTime(Number(seekEl.value) || 0);
    });
    seekEl.addEventListener('change', () => {
      audio.currentTime = Number(seekEl.value) || 0;
      state.seeking = false;
    });
  }

  audio.addEventListener('timeupdate', () => {
    if (!state.seeking && seekEl) seekEl.value = String(audio.currentTime || 0);
    if (currentEl) currentEl.textContent = formatTime(audio.currentTime || 0);
  });
  audio.addEventListener('durationchange', () => {
    const duration = audio.duration || 0;
    if (seekEl) seekEl.max = String(duration || 0);
    if (durationEl) durationEl.textContent = formatTime(duration);
  });
  audio.addEventListener('play', syncTransport);
  audio.addEventListener('pause', syncTransport);
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    syncTransport();
  });

  fetch('data/podcast/episodes.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then((data) => {
      state.data = data;
      state.loading = false;
      render();
    })
    .catch(() => {
      state.error = true;
      state.loading = false;
      render();
    });

  window.BibliaPodcast = {
    onShow: render,
    close: closePlayer,
    pause: function () {
      if (!audio.paused) audio.pause();
    }
  };
})();
