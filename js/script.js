/* ═══════════════════════════════════════════════
   AURA MUSIC PLAYER — script.js
   ═══════════════════════════════════════════════ */

'use strict';

/* ───────────────────────────────────────
   STATE
─────────────────────────────────────── */
const state = {
  tracks: [],
  playlists: [],
  currentIndex: -1,
  currentPlaylistId: null,   // null = main library
  isPlaying: false,
  shuffle: false,
  repeat: 'none',           // 'none' | 'all' | 'one'
  volume: 1,
  muted: false,
  liked: new Set(),
  recent: [],
  currentPage: 'home',
  currentView: 'home',      // for history
  history: ['home'],
  historyIdx: 0,
  isDraggingProgress: false,
  isDraggingVol: false,
  miniPlayerVisible: false,
  fullscreenOpen: false,
  currentContextMenu: null,
  audioCtx: null,
  analyser: null,
  source: null,
  fsVisBars: [],
  themes: ['dark', 'purple', 'blue'],
  themeIdx: 0,
};

/* ───────────────────────────────────────
   DOM REFERENCES
─────────────────────────────────────── */
const $ = id => document.getElementById(id);
const audio = $('audioPlayer');

const DOM = {
  // Player bar
  playBtn: $('playBtn'),
  prevBtn: $('prevBtn'),
  nextBtn: $('nextBtn'),
  shuffleBtn: $('shuffleBtn'),
  repeatBtn: $('repeatBtn'),
  progressBar: $('progressBar'),
  progressFill: $('progressFill'),
  progressThumb: $('progressThumb'),
  currentTime: $('currentTime'),
  totalTime: $('totalTime'),
  nowPlayingTitle: $('nowPlayingTitle'),
  nowPlayingArtist: $('nowPlayingArtist'),
  nowPlayingCover: $('nowPlayingCover'),
  heartBtn: $('heartBtn'),
  muteBtn: $('muteBtn'),
  volBar: $('volBar'),
  volFill: $('volFill'),
  visualizerMini: $('visualizerMini'),
  fullscreenBtn: $('fullscreenBtn'),

  // Fullscreen
  fullscreenPlayer: $('fullscreenPlayer'),
  fsBg: $('fsBg'),
  fsClose: $('fsClose'),
  fsCover: $('fsCover'),
  fsTitle: $('fsTitle'),
  fsArtist: $('fsArtist'),
  fsPlayBtn: $('fsPlayBtn'),
  fsPrevBtn: $('fsPrevBtn'),
  fsNextBtn: $('fsNextBtn'),
  fsShuffleBtn: $('fsShuffleBtn'),
  fsRepeatBtn: $('fsRepeatBtn'),
  fsProgress: $('fsProgress'),
  fsProgressFill: $('fsProgressFill'),
  fsProgressThumb: $('fsProgressThumb'),
  fsCurrent: $('fsCurrent'),
  fsDuration: $('fsDuration'),
  fsVolSlider: $('fsVolSlider'),
  fsVisualizer: $('fsVisualizer'),

  // Mini player
  miniPlayer: $('miniPlayer'),
  mpCover: $('mpCover'),
  mpTitle: $('mpTitle'),
  mpArtist: $('mpArtist'),
  mpPlay: $('mpPlay'),
  mpPrev: $('mpPrev'),
  mpNext: $('mpNext'),
  mpExpand: $('mpExpand'),
  miniPlayerToggle: $('miniPlayerToggle'),

  // Layout
  sidebar: $('sidebar'),
  pagesWrap: $('pagesWrap'),
  searchInput: $('searchInput'),
  playlistList: $('playlistList'),
  trackList: $('trackList'),
  recentGrid: $('recentGrid'),
  recommendGrid: $('recommendGrid'),
  trackCountBadge: $('trackCountBadge'),
  playlistDetail: $('playlistDetail'),
  plTrackList: $('plTrackList'),
  plPageTitle: $('plPageTitle'),
  plPageCount: $('plPageCount'),
  plCoverBig: $('plCoverBig'),
  plPlayAll: $('plPlayAll'),
  plDeleteBtn: $('plDeleteBtn'),
  searchResults: $('searchResults'),
  dropOverlay: $('dropOverlay'),
  fileInput: $('fileInput'),
  dropZoneBtn: $('dropZoneBtn'),
  modalOverlay: $('modalOverlay'),
  modalInput: $('modalInput'),
  modalTitle: $('modalTitle'),
  modalConfirm: $('modalConfirm'),
  modalCancel: $('modalCancel'),
  toast: $('toast'),
  loadingOverlay: $('loadingOverlay'),
  themeBtn: $('themeBtn'),
  greeting: $('greeting'),
  navBack: $('navBack'),
  navFwd: $('navFwd'),
  newPlaylistBtn: $('newPlaylistBtn'),
  newPlaylistBtnMain: $('newPlaylistBtnMain'),
};

/* ───────────────────────────────────────
   INIT
─────────────────────────────────────── */
function init() {
  loadFromStorage();
  setGreeting();
  buildVisualizerBars();
  renderAll();
  bindEvents();
  updatePlayerBar();
}

/* ───────────────────────────────────────
   STORAGE
─────────────────────────────────────── */
function loadFromStorage() {
  try {
    const t = localStorage.getItem('aura_tracks');
    if (t) state.tracks = JSON.parse(t);
    const p = localStorage.getItem('aura_playlists');
    if (p) state.playlists = JSON.parse(p);
    const l = localStorage.getItem('aura_liked');
    if (l) state.liked = new Set(JSON.parse(l));
    const r = localStorage.getItem('aura_recent');
    if (r) state.recent = JSON.parse(r);
    const th = localStorage.getItem('aura_theme');
    if (th) {
      state.themeIdx = parseInt(th) || 0;
      applyTheme();
    }
    const v = localStorage.getItem('aura_volume');
    if (v) { state.volume = parseFloat(v); audio.volume = state.volume; }
  } catch(e) { console.warn('Storage load error', e); }
}

function saveToStorage() {
  try {
    // Only save metadata (not blob URLs — they expire)
    const saveTracks = state.tracks.map(t => ({
      ...t, src: t.isFile ? null : t.src
    }));
    localStorage.setItem('aura_tracks', JSON.stringify(saveTracks));
    localStorage.setItem('aura_playlists', JSON.stringify(state.playlists));
    localStorage.setItem('aura_liked', JSON.stringify([...state.liked]));
    localStorage.setItem('aura_recent', JSON.stringify(state.recent.slice(0,20)));
    localStorage.setItem('aura_volume', state.volume);
  } catch(e) { console.warn('Storage save error', e); }
}

/* ───────────────────────────────────────
   DEMO TRACKS (built-in placeholders)
─────────────────────────────────────── */
function seedDemoTracks() {
  if (state.tracks.length > 0) return;
  const demos = [
    { title: 'Midnight Drive', artist: 'Lo-Fi Collective', genre: 'Lo-Fi' },
    { title: 'Electric Soul', artist: 'The Neon Waves', genre: 'Electronic' },
    { title: 'Rainy Afternoon', artist: 'Café Vibes', genre: 'Ambient' },
    { title: 'Deep Space', artist: 'Synthwave Express', genre: 'Synthwave' },
    { title: 'Urban Jungle', artist: 'City Beats', genre: 'Hip-Hop' },
    { title: 'Neon Lights', artist: 'Retro Future', genre: 'Electronic' },
    { title: 'Ocean Breeze', artist: 'Chill Studio', genre: 'Ambient' },
    { title: 'Lost in Tokyo', artist: 'Vaporwave Dreams', genre: 'Vaporwave' },
  ];
  state.tracks = demos.map((d, i) => ({
    id: `demo-${i}`,
    title: d.title,
    artist: d.artist,
    genre: d.genre,
    src: null,
    isFile: false,
    isDemo: true,
    duration: null,
    addedAt: Date.now() - (i * 86400000),
  }));
}

/* ───────────────────────────────────────
   RENDER ALL
─────────────────────────────────────── */
function renderAll() {
  seedDemoTracks();
  renderTrackList();
  renderPlaylists();
  renderRecent();
  renderRecommended();
  updateBadge();
}

function renderTrackList(tracks = state.tracks, container = DOM.trackList, showActions = true) {
  container.innerHTML = '';
  if (!tracks.length) {
    container.innerHTML = `<p class="empty-state">No tracks yet — import MP3 files above ↑</p>`;
    return;
  }
  tracks.forEach((track, i) => {
    container.appendChild(createTrackItem(track, i, showActions));
  });
}

function createTrackItem(track, idx, showActions = true) {
  const el = document.createElement('div');
  el.className = 'track-item';
  el.dataset.id = track.id;
  if (state.tracks[state.currentIndex]?.id === track.id) el.classList.add('active');

  const coverHtml = track.coverUrl
    ? `<img src="${track.coverUrl}" alt="" />`
    : `<span>♪</span>`;

  const eqHtml = state.tracks[state.currentIndex]?.id === track.id && state.isPlaying
    ? `<div class="eq-bars"><span></span><span></span><span></span><span></span></div>`
    : '';

  const dur = track.duration ? formatTime(track.duration) : '—';
  const isDemo = track.isDemo;

  el.innerHTML = `
    <div class="track-num" style="position:relative">
      <span style="transition:opacity 0.2s">${idx + 1}</span>
      <div class="track-play-icon" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
    </div>
    <div class="track-cover">${coverHtml}</div>
    <div class="track-meta">
      <div class="track-title">${esc(track.title)}</div>
      <div class="track-artist">${esc(track.artist || 'Unknown Artist')}${isDemo ? ' <span style="font-size:10px;color:var(--text-muted)">(demo)</span>' : ''}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      ${eqHtml}
      ${showActions ? `<div class="track-actions">
        <button class="add-to-pl-btn" data-action="addtopl">+ Playlist</button>
        <button class="icon-btn" style="width:24px;height:24px" data-action="remove" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>` : ''}
      <span class="track-duration">${dur}</span>
    </div>
  `;

  // Events
  el.addEventListener('click', e => {
    if (e.target.closest('[data-action]')) return;
    playTrackById(track.id);
  });

  el.addEventListener('contextmenu', e => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, track);
  });

  const addBtn = el.querySelector('[data-action="addtopl"]');
  if (addBtn) addBtn.addEventListener('click', e => { e.stopPropagation(); openAddToPlaylistMenu(e, track); });

  const removeBtn = el.querySelector('[data-action="remove"]');
  if (removeBtn) removeBtn.addEventListener('click', e => { e.stopPropagation(); removeTrack(track.id); });

  // hover play icon
  el.addEventListener('mouseenter', () => {
    const numEl = el.querySelector('.track-num > span');
    const iconEl = el.querySelector('.track-play-icon');
    if (numEl) numEl.style.opacity = '0';
    if (iconEl) iconEl.style.opacity = '1';
  });
  el.addEventListener('mouseleave', () => {
    const numEl = el.querySelector('.track-num > span');
    const iconEl = el.querySelector('.track-play-icon');
    if (numEl) numEl.style.opacity = '1';
    if (iconEl) iconEl.style.opacity = '0';
  });

  return el;
}

function renderPlaylists() {
  DOM.playlistList.innerHTML = '';
  state.playlists.forEach(pl => {
    const el = document.createElement('div');
    el.className = 'playlist-item';
    el.innerHTML = `<div class="pl-icon">🎵</div><span class="pl-name">${esc(pl.name)}</span>`;
    el.addEventListener('click', () => openPlaylist(pl.id));
    DOM.playlistList.appendChild(el);
  });

  // Library detail
  DOM.playlistDetail.innerHTML = '';
  if (!state.playlists.length) {
    DOM.playlistDetail.innerHTML = `<p class="empty-state">No playlists yet. Create one!</p>`;
    return;
  }
  state.playlists.forEach(pl => {
    const el = document.createElement('div');
    el.className = 'pl-card';
    el.innerHTML = `
      <div class="pl-card-cover">🎵</div>
      <div class="pl-card-info">
        <div class="pl-card-name">${esc(pl.name)}</div>
        <div class="pl-card-count">${pl.tracks.length} song${pl.tracks.length !== 1 ? 's' : ''}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    `;
    el.addEventListener('click', () => openPlaylist(pl.id));
    DOM.playlistDetail.appendChild(el);
  });
}

function renderRecent() {
  DOM.recentGrid.innerHTML = '';
  const tracks = state.recent.slice(0,6).map(id => state.tracks.find(t => t.id === id)).filter(Boolean);
  if (!tracks.length) {
    DOM.recentGrid.innerHTML = `<p class="empty-state" style="grid-column:1/-1;padding:20px 0">Play some tracks to see them here</p>`;
    return;
  }
  tracks.forEach(t => DOM.recentGrid.appendChild(createMusicCard(t)));
}

function renderRecommended() {
  DOM.recommendGrid.innerHTML = '';
  if (!state.tracks.length) return;
  const shuffled = [...state.tracks].sort(() => Math.random() - 0.5).slice(0,6);
  shuffled.forEach(t => DOM.recommendGrid.appendChild(createMusicCard(t)));
}

function createMusicCard(track) {
  const el = document.createElement('div');
  el.className = 'music-card';
  const coverHtml = track.coverUrl ? `<img src="${track.coverUrl}" alt="" />` : '';
  el.innerHTML = `
    <div class="card-cover">
      ${coverHtml}
      ${!track.coverUrl ? '♪' : ''}
      <div class="card-play-overlay">
        <div class="card-play-btn">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
    </div>
    <div class="card-title">${esc(track.title)}</div>
    <div class="card-artist">${esc(track.artist || 'Unknown')}</div>
  `;
  el.addEventListener('click', () => playTrackById(track.id));
  return el;
}

function updateBadge() {
  DOM.trackCountBadge.textContent = `${state.tracks.length} track${state.tracks.length !== 1 ? 's' : ''}`;
}

/* ───────────────────────────────────────
   NAVIGATION
─────────────────────────────────────── */
function navigate(page, pushHistory = true) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
  }
  // Sidebar nav highlight
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  state.currentPage = page;

  if (pushHistory) {
    state.history = state.history.slice(0, state.historyIdx + 1);
    state.history.push(page);
    state.historyIdx = state.history.length - 1;
  }
  updateNavArrows();
}

function updateNavArrows() {
  DOM.navBack.style.opacity = state.historyIdx > 0 ? '1' : '0.3';
  DOM.navFwd.style.opacity = state.historyIdx < state.history.length - 1 ? '1' : '0.3';
}

function openPlaylist(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  state.currentPlaylistId = id;
  DOM.plPageTitle.textContent = pl.name;
  DOM.plPageCount.textContent = `${pl.tracks.length} songs`;
  DOM.plCoverBig.textContent = '🎵';

  // Render tracks
  const tracks = pl.tracks.map(tid => state.tracks.find(t => t.id === tid)).filter(Boolean);
  renderTrackList(tracks, DOM.plTrackList, false);
  navigate('playlist');
}

/* ───────────────────────────────────────
   PLAYBACK
─────────────────────────────────────── */
function playTrackById(id, listOverride = null) {
  const list = listOverride || state.tracks;
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return;

  // If playlist context
  if (state.currentPage === 'playlist' && state.currentPlaylistId) {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (pl) {
      const plTracks = pl.tracks.map(tid => state.tracks.find(t => t.id === tid)).filter(Boolean);
      const plIdx = plTracks.findIndex(t => t.id === id);
      if (plIdx !== -1) {
        playIndex(plIdx, plTracks);
        return;
      }
    }
  }
  playIndex(idx, state.tracks);
}

function playIndex(idx, list = state.tracks) {
  const track = list[idx];
  if (!track) return;

  // Find real index in state.tracks
  const realIdx = state.tracks.findIndex(t => t.id === track.id);
  state.currentIndex = realIdx;

  showLoading();

  if (track.src) {
    audio.src = track.src;
    audio.load();
    audio.play().then(() => {
      state.isPlaying = true;
      hideLoading();
      onPlayStateChange();
    }).catch(err => {
      hideLoading();
      if (track.isDemo) {
        toast('🎵 Demo track — import MP3 to play audio');
        state.isPlaying = false;
      }
      onPlayStateChange();
    });
  } else {
    // Demo track
    hideLoading();
    if (track.isDemo) toast('🎵 Demo track — drag & drop MP3 files to play!');
    state.isPlaying = false;
    onPlayStateChange();
    return;
  }

  addToRecent(track.id);
  updatePlayerBar();
  refreshTrackHighlight();
  initAudioContext();
}

function addToRecent(id) {
  state.recent = [id, ...state.recent.filter(r => r !== id)].slice(0,20);
  renderRecent();
  saveToStorage();
}

function togglePlay() {
  if (state.currentIndex === -1) {
    if (state.tracks.length) playIndex(0);
    return;
  }
  const track = state.tracks[state.currentIndex];
  if (!track || !track.src) {
    toast('No audio source — import MP3 files');
    return;
  }
  if (state.isPlaying) {
    audio.pause();
    state.isPlaying = false;
  } else {
    audio.play().then(() => { state.isPlaying = true; onPlayStateChange(); }).catch(() => {});
  }
  onPlayStateChange();
}

function playNext() {
  if (!state.tracks.length) return;
  let nextIdx;
  if (state.shuffle) {
    nextIdx = Math.floor(Math.random() * state.tracks.length);
  } else {
    nextIdx = (state.currentIndex + 1) % state.tracks.length;
  }
  playIndex(nextIdx);
}

function playPrev() {
  if (!state.tracks.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let prevIdx;
  if (state.shuffle) {
    prevIdx = Math.floor(Math.random() * state.tracks.length);
  } else {
    prevIdx = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
  }
  playIndex(prevIdx);
}

function onPlayStateChange() {
  updatePlayButtons();
  updatePlayerBar();
  refreshTrackHighlight();
  DOM.visualizerMini.classList.toggle('active', state.isPlaying);
  DOM.nowPlayingCover.classList.toggle('playing', state.isPlaying);
  DOM.fsCover.classList.toggle('playing', state.isPlaying);
}

function updatePlayButtons() {
  [DOM.playBtn, DOM.fsPlayBtn, DOM.mpPlay].forEach(btn => {
    if (!btn) return;
    const play = btn.querySelector('.icon-play');
    const pause = btn.querySelector('.icon-pause');
    if (play) play.style.display = state.isPlaying ? 'none' : '';
    if (pause) pause.style.display = state.isPlaying ? '' : 'none';
  });
}

function updatePlayerBar() {
  const track = state.tracks[state.currentIndex];
  if (!track) return;
  DOM.nowPlayingTitle.textContent = track.title;
  DOM.nowPlayingArtist.textContent = track.artist || 'Unknown Artist';
  updateCoverEl(DOM.nowPlayingCover, track);
  updateCoverEl(DOM.fsCover, track, true);
  updateCoverEl(DOM.mpCover, track);
  DOM.fsTitle.textContent = track.title;
  DOM.fsArtist.textContent = track.artist || 'Unknown Artist';
  DOM.mpTitle.textContent = track.title;
  DOM.mpArtist.textContent = track.artist || 'Unknown Artist';
  DOM.heartBtn.classList.toggle('liked', state.liked.has(track.id));
}

function updateCoverEl(el, track, large = false) {
  if (!el) return;
  if (track.coverUrl) {
    el.innerHTML = `<img src="${track.coverUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />`;
  } else {
    el.innerHTML = large ? '<span style="font-size:60px;color:var(--text-muted)">♪</span>' : '<div class="cover-placeholder">♪</div>';
  }
}

function refreshTrackHighlight() {
  document.querySelectorAll('.track-item').forEach(el => {
    const id = el.dataset.id;
    const isCurrent = state.tracks[state.currentIndex]?.id === id;
    el.classList.toggle('active', isCurrent);
    const eq = el.querySelector('.eq-bars');
    if (eq) eq.remove();
    if (isCurrent && state.isPlaying) {
      const durEl = el.querySelector('.track-duration');
      if (durEl) {
        const eqEl = document.createElement('div');
        eqEl.className = 'eq-bars';
        eqEl.innerHTML = '<span></span><span></span><span></span><span></span>';
        durEl.parentElement.insertBefore(eqEl, durEl);
      }
    }
  });
}

/* ───────────────────────────────────────
   AUDIO EVENTS
─────────────────────────────────────── */
audio.addEventListener('timeupdate', () => {
  if (!audio.duration || state.isDraggingProgress) return;
  const pct = audio.currentTime / audio.duration;
  DOM.progressFill.style.width = (pct * 100) + '%';
  DOM.progressThumb.style.left = (pct * 100) + '%';
  DOM.currentTime.textContent = formatTime(audio.currentTime);
  DOM.totalTime.textContent = formatTime(audio.duration);

  // FS
  DOM.fsProgressFill.style.width = (pct * 100) + '%';
  DOM.fsProgressThumb.style.left = (pct * 100) + '%';
  DOM.fsCurrent.textContent = formatTime(audio.currentTime);
  DOM.fsDuration.textContent = formatTime(audio.duration);
});

audio.addEventListener('loadedmetadata', () => {
  const track = state.tracks[state.currentIndex];
  if (track) {
    track.duration = audio.duration;
    saveToStorage();
  }
  DOM.totalTime.textContent = formatTime(audio.duration);
  DOM.fsDuration.textContent = formatTime(audio.duration);
});

audio.addEventListener('ended', () => {
  if (state.repeat === 'one') {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  if (state.repeat === 'all' || state.currentIndex < state.tracks.length - 1) {
    playNext();
  } else {
    state.isPlaying = false;
    onPlayStateChange();
  }
});

audio.addEventListener('error', () => {
  hideLoading();
  state.isPlaying = false;
  onPlayStateChange();
});

/* ───────────────────────────────────────
   PROGRESS / VOLUME
─────────────────────────────────────── */
function seekTo(pct) {
  if (audio.duration) audio.currentTime = audio.duration * pct;
}

function setupProgressBar(barEl, fillEl, thumbEl, onSeek) {
  let dragging = false;
  const getPos = e => {
    const rect = barEl.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };
  barEl.addEventListener('mousedown', e => {
    dragging = true;
    state.isDraggingProgress = true;
    const pct = getPos(e);
    fillEl.style.width = (pct * 100) + '%';
    if (thumbEl) thumbEl.style.left = (pct * 100) + '%';
    onSeek(pct);
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const pct = getPos(e);
    fillEl.style.width = (pct * 100) + '%';
    if (thumbEl) thumbEl.style.left = (pct * 100) + '%';
    onSeek(pct);
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; state.isDraggingProgress = false; }
  });
  barEl.addEventListener('click', e => {
    const pct = getPos(e);
    fillEl.style.width = (pct * 100) + '%';
    if (thumbEl) thumbEl.style.left = (pct * 100) + '%';
    onSeek(pct);
  });
}

function setupVolBar() {
  let dragging = false;
  const getPos = e => {
    const rect = DOM.volBar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };
  const apply = pct => {
    state.volume = pct;
    audio.volume = pct;
    DOM.volFill.style.width = (pct * 100) + '%';
    DOM.fsVolSlider.value = pct;
    saveToStorage();
  };
  DOM.volBar.addEventListener('mousedown', e => { dragging = true; apply(getPos(e)); });
  document.addEventListener('mousemove', e => { if (dragging) apply(getPos(e)); });
  document.addEventListener('mouseup', () => { dragging = false; });
  DOM.volBar.addEventListener('click', e => apply(getPos(e)));

  DOM.fsVolSlider.addEventListener('input', e => apply(parseFloat(e.target.value)));
}

/* ───────────────────────────────────────
   SHUFFLE / REPEAT
─────────────────────────────────────── */
function toggleShuffle() {
  state.shuffle = !state.shuffle;
  [DOM.shuffleBtn, DOM.fsShuffleBtn].forEach(btn => btn?.classList.toggle('active', state.shuffle));
  toast(state.shuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
}

function toggleRepeat() {
  const modes = ['none','all','one'];
  state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
  [DOM.repeatBtn, DOM.fsRepeatBtn].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('active', state.repeat !== 'none');
    btn.title = state.repeat === 'one' ? 'Repeat One' : state.repeat === 'all' ? 'Repeat All' : 'Repeat Off';
  });
  const msgs = { none: '🔁 Repeat off', all: '🔁 Repeat all', one: '🔂 Repeat one' };
  toast(msgs[state.repeat]);
}

/* ───────────────────────────────────────
   FILE IMPORT
─────────────────────────────────────── */
function handleFiles(files) {
  const mp3s = [...files].filter(f => f.type.startsWith('audio/') || f.name.endsWith('.mp3'));
  if (!mp3s.length) { toast('No MP3 files found'); return; }

  let loaded = 0;
  showLoading();

  mp3s.forEach(file => {
    const url = URL.createObjectURL(file);
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const parts = title.split(' - ');
    const trackTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : title;
    const artist = parts.length > 1 ? parts[0].trim() : 'Unknown Artist';

    const track = {
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: trackTitle,
      artist,
      src: url,
      isFile: true,
      isDemo: false,
      duration: null,
      coverUrl: null,
      addedAt: Date.now(),
    };

    // Try to extract metadata
    const tmpAudio = new Audio(url);
    tmpAudio.addEventListener('loadedmetadata', () => {
      track.duration = tmpAudio.duration;
    });

    state.tracks.unshift(track);
    loaded++;

    if (loaded === mp3s.length) {
      hideLoading();
      renderAll();
      saveToStorage();
      toast(`✅ ${loaded} track${loaded > 1 ? 's' : ''} imported`);
    }
  });
}

/* ───────────────────────────────────────
   PLAYLIST MANAGEMENT
─────────────────────────────────────── */
let modalCallback = null;

function openModal(title, placeholder, callback) {
  DOM.modalTitle.textContent = title;
  DOM.modalInput.placeholder = placeholder;
  DOM.modalInput.value = '';
  DOM.modalOverlay.classList.add('open');
  DOM.modalInput.focus();
  modalCallback = callback;
}

function closeModal() {
  DOM.modalOverlay.classList.remove('open');
  modalCallback = null;
}

function createPlaylist(name) {
  if (!name.trim()) return;
  const pl = {
    id: `pl-${Date.now()}`,
    name: name.trim(),
    tracks: [],
    createdAt: Date.now(),
  };
  state.playlists.push(pl);
  saveToStorage();
  renderPlaylists();
  toast(`🎵 Playlist "${pl.name}" created`);
}

function deletePlaylist(id) {
  state.playlists = state.playlists.filter(p => p.id !== id);
  saveToStorage();
  renderPlaylists();
  navigate('library');
  toast('🗑 Playlist deleted');
}

function addTrackToPlaylist(trackId, playlistId) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  if (pl.tracks.includes(trackId)) { toast('Already in playlist'); return; }
  pl.tracks.push(trackId);
  saveToStorage();
  renderPlaylists();
  toast(`✅ Added to "${pl.name}"`);
}

function removeTrack(id) {
  state.tracks = state.tracks.filter(t => t.id !== id);
  if (state.tracks[state.currentIndex]?.id === id) {
    state.currentIndex = -1;
    audio.pause();
    state.isPlaying = false;
    onPlayStateChange();
  }
  renderAll();
  saveToStorage();
  toast('🗑 Track removed');
}

/* ───────────────────────────────────────
   SEARCH
─────────────────────────────────────── */
function doSearch(query) {
  if (!query.trim()) {
    DOM.searchResults.innerHTML = `<p class="empty-state">Type something to search…</p>`;
    return;
  }
  const q = query.toLowerCase();
  const results = state.tracks.filter(t =>
    t.title.toLowerCase().includes(q) || (t.artist && t.artist.toLowerCase().includes(q))
  );
  DOM.searchResults.innerHTML = '';
  if (!results.length) {
    DOM.searchResults.innerHTML = `<p class="empty-state">No results for "${esc(query)}"</p>`;
    return;
  }
  results.forEach((t, i) => DOM.searchResults.appendChild(createTrackItem(t, i, false)));
}

/* ───────────────────────────────────────
   FULLSCREEN PLAYER
─────────────────────────────────────── */
function openFullscreen() {
  state.fullscreenOpen = true;
  DOM.fullscreenPlayer.classList.add('open');
  updatePlayerBar();
}

function closeFullscreen() {
  state.fullscreenOpen = false;
  DOM.fullscreenPlayer.classList.remove('open');
}

/* ───────────────────────────────────────
   MINI PLAYER
─────────────────────────────────────── */
function toggleMiniPlayer() {
  state.miniPlayerVisible = !state.miniPlayerVisible;
  DOM.miniPlayer.style.display = state.miniPlayerVisible ? 'flex' : 'none';
}

/* ───────────────────────────────────────
   AUDIO VISUALIZER
─────────────────────────────────────── */
function initAudioContext() {
  if (state.audioCtx) return;
  try {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 64;
    state.source = state.audioCtx.createMediaElementSource(audio);
    state.source.connect(state.analyser);
    state.analyser.connect(state.audioCtx.destination);
    animateVisualizer();
  } catch(e) {
    console.warn('Web Audio API not available');
  }
}

function buildVisualizerBars() {
  const container = DOM.fsVisualizer;
  container.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const bar = document.createElement('div');
    bar.style.cssText = `
      width: 4px;
      border-radius: 3px;
      background: var(--accent);
      opacity: 0.7;
      height: 4px;
      transition: height 0.08s ease;
    `;
    container.appendChild(bar);
    state.fsVisBars.push(bar);
  }
}

function animateVisualizer() {
  if (!state.analyser) return;
  const data = new Uint8Array(state.analyser.frequencyBinCount);
  const bars = state.fsVisBars;

  function draw() {
    requestAnimationFrame(draw);
    if (!state.isPlaying) {
      bars.forEach(b => b.style.height = '4px');
      return;
    }
    state.analyser.getByteFrequencyData(data);
    bars.forEach((bar, i) => {
      const val = data[i] || 0;
      const h = Math.max(4, (val / 255) * 80);
      bar.style.height = h + 'px';
    });
  }
  draw();
}

/* ───────────────────────────────────────
   CONTEXT MENU
─────────────────────────────────────── */
function showContextMenu(x, y, track) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';

  const plItems = state.playlists.map(pl => `
    <div class="ctx-item" data-plid="${pl.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      ${esc(pl.name)}
    </div>
  `).join('');

  menu.innerHTML = `
    <div class="ctx-item" data-action="play">
      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Play
    </div>
    <div class="ctx-item" data-action="like">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
      ${state.liked.has(track.id) ? 'Unlike' : 'Like'}
    </div>
    ${plItems ? `<div class="ctx-divider"></div><div style="padding:4px 12px;font-size:10px;color:var(--text-muted);letter-spacing:0.08em">ADD TO PLAYLIST</div>${plItems}` : ''}
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" data-action="remove">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      Remove
    </div>
  `;

  menu.addEventListener('click', e => {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    const action = item.dataset.action;
    const plid = item.dataset.plid;
    if (action === 'play') playTrackById(track.id);
    else if (action === 'like') toggleLike(track.id);
    else if (action === 'remove') removeTrack(track.id);
    else if (plid) addTrackToPlaylist(track.id, plid);
    removeContextMenu();
  });

  document.body.appendChild(menu);
  state.currentContextMenu = menu;
  setTimeout(() => document.addEventListener('click', removeContextMenu, { once: true }), 10);
}

function removeContextMenu() {
  if (state.currentContextMenu) {
    state.currentContextMenu.remove();
    state.currentContextMenu = null;
  }
}

function openAddToPlaylistMenu(e, track) {
  const rect = e.target.getBoundingClientRect();
  showContextMenu(rect.left, rect.bottom + 4, track);
}

/* ───────────────────────────────────────
   LIKE
─────────────────────────────────────── */
function toggleLike(id) {
  if (state.liked.has(id)) {
    state.liked.delete(id);
    toast('💔 Removed from liked');
  } else {
    state.liked.add(id);
    toast('💚 Added to liked');
  }
  const track = state.tracks[state.currentIndex];
  DOM.heartBtn.classList.toggle('liked', track && state.liked.has(track.id));
  saveToStorage();
}

/* ───────────────────────────────────────
   MUTE
─────────────────────────────────────── */
function toggleMute() {
  state.muted = !state.muted;
  audio.muted = state.muted;
  DOM.volIcon.innerHTML = state.muted
    ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`
    : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>`;
}

/* ───────────────────────────────────────
   THEME
─────────────────────────────────────── */
function applyTheme() {
  const themes = ['dark', 'purple', 'blue'];
  document.documentElement.setAttribute('data-theme', themes[state.themeIdx]);
}

function cycleTheme() {
  state.themeIdx = (state.themeIdx + 1) % state.themes.length;
  applyTheme();
  localStorage.setItem('aura_theme', state.themeIdx);
  const names = ['🌑 Dark', '🟣 Purple', '🔵 Blue'];
  toast(names[state.themeIdx]);
}

/* ───────────────────────────────────────
   HELPERS
─────────────────────────────────────── */
function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  DOM.greeting.textContent = greet;
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(DOM.toast._timer);
  DOM.toast._timer = setTimeout(() => DOM.toast.classList.remove('show'), 2600);
}

function showLoading() { DOM.loadingOverlay.classList.add('show'); }
function hideLoading() { DOM.loadingOverlay.classList.remove('show'); }

/* ───────────────────────────────────────
   EVENT BINDING
─────────────────────────────────────── */
function bindEvents() {
  // Player controls
  DOM.playBtn.addEventListener('click', togglePlay);
  DOM.prevBtn.addEventListener('click', playPrev);
  DOM.nextBtn.addEventListener('click', playNext);
  DOM.shuffleBtn.addEventListener('click', toggleShuffle);
  DOM.repeatBtn.addEventListener('click', toggleRepeat);
  DOM.heartBtn.addEventListener('click', () => {
    const t = state.tracks[state.currentIndex];
    if (t) toggleLike(t.id);
  });
  DOM.muteBtn.addEventListener('click', toggleMute);

  // Fullscreen player controls
  DOM.fsPlayBtn.addEventListener('click', togglePlay);
  DOM.fsPrevBtn.addEventListener('click', playPrev);
  DOM.fsNextBtn.addEventListener('click', playNext);
  DOM.fsShuffleBtn.addEventListener('click', toggleShuffle);
  DOM.fsRepeatBtn.addEventListener('click', toggleRepeat);
  DOM.fullscreenBtn.addEventListener('click', openFullscreen);
  DOM.fsClose.addEventListener('click', closeFullscreen);

  // Mini player
  DOM.miniPlayerToggle.addEventListener('click', toggleMiniPlayer);
  DOM.mpPlay.addEventListener('click', togglePlay);
  DOM.mpPrev.addEventListener('click', playPrev);
  DOM.mpNext.addEventListener('click', playNext);
  DOM.mpExpand.addEventListener('click', openFullscreen);

  // Progress bars
  setupProgressBar(DOM.progressBar, DOM.progressFill, DOM.progressThumb, seekTo);
  setupProgressBar(DOM.fsProgress, DOM.fsProgressFill, DOM.fsProgressThumb, seekTo);
  setupVolBar();
  DOM.volFill.style.width = (state.volume * 100) + '%';
  DOM.fsVolSlider.value = state.volume;

  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  DOM.navBack.addEventListener('click', () => {
    if (state.historyIdx > 0) {
      state.historyIdx--;
      navigate(state.history[state.historyIdx], false);
    }
  });

  DOM.navFwd.addEventListener('click', () => {
    if (state.historyIdx < state.history.length - 1) {
      state.historyIdx++;
      navigate(state.history[state.historyIdx], false);
    }
  });

  // Search
  DOM.searchInput.addEventListener('input', e => {
    const q = e.target.value;
    if (q.trim()) {
      navigate('search', false);
      doSearch(q);
    }
  });

  DOM.searchInput.addEventListener('focus', () => {
    if (state.currentPage !== 'search') navigate('search');
  });

  // File import
  DOM.dropZoneBtn.addEventListener('click', () => DOM.fileInput.click());
  DOM.fileInput.addEventListener('change', e => handleFiles(e.target.files));

  // Drag & drop
  document.addEventListener('dragover', e => {
    e.preventDefault();
    DOM.dropOverlay.classList.add('active');
  });

  document.addEventListener('dragleave', e => {
    if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
      DOM.dropOverlay.classList.remove('active');
    }
  });

  document.addEventListener('drop', e => {
    e.preventDefault();
    DOM.dropOverlay.classList.remove('active');
    handleFiles(e.dataTransfer.files);
  });

  // Playlists
  DOM.newPlaylistBtn.addEventListener('click', () => openModal('New Playlist', 'Name your playlist…', createPlaylist));
  DOM.newPlaylistBtnMain.addEventListener('click', () => openModal('New Playlist', 'Name your playlist…', createPlaylist));
  DOM.modalCancel.addEventListener('click', closeModal);
  DOM.modalConfirm.addEventListener('click', () => {
    if (modalCallback) modalCallback(DOM.modalInput.value);
    closeModal();
  });
  DOM.modalInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { if (modalCallback) modalCallback(DOM.modalInput.value); closeModal(); }
    if (e.key === 'Escape') closeModal();
  });
  DOM.modalOverlay.addEventListener('click', e => { if (e.target === DOM.modalOverlay) closeModal(); });

  // Playlist page
  DOM.plPlayAll.addEventListener('click', () => {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (!pl || !pl.tracks.length) { toast('Playlist is empty'); return; }
    const firstId = pl.tracks[0];
    playTrackById(firstId);
  });

  DOM.plDeleteBtn.addEventListener('click', () => {
    if (state.currentPlaylistId) deletePlaylist(state.currentPlaylistId);
  });

  // Theme
  DOM.themeBtn.addEventListener('click', cycleTheme);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    switch(e.code) {
      case 'Space': e.preventDefault(); togglePlay(); break;
      case 'ArrowRight': e.preventDefault(); e.shiftKey ? playNext() : seekRelative(5); break;
      case 'ArrowLeft': e.preventDefault(); e.shiftKey ? playPrev() : seekRelative(-5); break;
      case 'ArrowUp': e.preventDefault(); changeVolume(0.1); break;
      case 'ArrowDown': e.preventDefault(); changeVolume(-0.1); break;
      case 'KeyS': toggleShuffle(); break;
      case 'KeyR': toggleRepeat(); break;
      case 'KeyF': state.fullscreenOpen ? closeFullscreen() : openFullscreen(); break;
      case 'KeyM': toggleMute(); break;
      case 'Escape': closeFullscreen(); removeContextMenu(); closeModal(); break;
    }
  });

  // ⌘K focus search
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      DOM.searchInput.focus();
    }
  });
}

function seekRelative(secs) {
  if (audio.duration) audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + secs));
}

function changeVolume(delta) {
  state.volume = Math.min(1, Math.max(0, state.volume + delta));
  audio.volume = state.volume;
  DOM.volFill.style.width = (state.volume * 100) + '%';
  DOM.fsVolSlider.value = state.volume;
}

/* ───────────────────────────────────────
   START
─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
