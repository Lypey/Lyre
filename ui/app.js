'use strict';
// ================= platform =================
const TAURI = window.__TAURI__;
const invoke = TAURI?.core?.invoke;
const appWin = TAURI?.window?.getCurrentWindow?.();
const webview = TAURI?.webview?.getCurrentWebview?.();
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1; // iPadOS says "Macintosh"
const DEVICE = !MOBILE ? 'desktop' : Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
document.documentElement.classList.add('dev-' + DEVICE);
// localStorage throws on opaque origins; fall back to memory so the app still runs
const ls = (() => { try { localStorage.length; return localStorage; } catch { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; } })();
const MEDIA_EXT = /\.(mp3|m4a|mp4|aac|wav|ogg|oga|opus|flac|webm|weba|mkv|mov|m4v|3gp|aiff?|caf|wma)$/i;
const DEFAULT_ACCENT = [232, 160, 122];
// longest text allowed in each box (stops giant names breaking the layout)
const MAX = { name: 32, tagline: 80, playlist: 60, title: 120, artist: 120, search: 100, id: 200, lyrics: 20000 };

// ================= tiny helpers =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmt = s => !isFinite(s) || s == null ? '--:--' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtLong = s => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; };
const base = n => n.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el && !k.includes('-')) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
const ICONS = {
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  next: '<path d="M5 5l10 7-10 7z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
  prev: '<path d="M19 5L9 12l10 7z" fill="currentColor" stroke="none"/><path d="M5 5v14"/>',
  shuffle: '<path d="M3 7h3c4 0 6 10 10 10h4M17 14l3 3-3 3M3 17h3c1.6 0 2.8-1.5 3.8-3.4M13.2 9.4C14.2 8 15.2 7 16 7h4M17 4l3 3-3 3"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3"/>',
  repeat1: '<path d="M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3"/><path d="M11 10.5l1.5-1v5"/>',
  heart: '<path d="M12 20s-7-4.4-9.3-8.6C1 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.6 3.7 3.9 6.9C19 15.6 12 20 12 20z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  home: '<path d="M4 11l8-7 8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  lyrics: '<path d="M4 6h16M4 11h10M4 16h16M4 21h7"/><circle cx="18.5" cy="19.5" r="1.8"/><path d="M20.3 19.5V12"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  vol1: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.8 0-1 .8-1.7 1.9-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  min: '<path d="M5 12h14"/>',
  max: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  fs: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  chart: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V9"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  list: '<rect x="3.5" y="4" width="4" height="4" rx="1"/><rect x="3.5" y="10" width="4" height="4" rx="1"/><rect x="3.5" y="16" width="4" height="4" rx="1"/><path d="M11 6h9.5M11 12h9.5M11 18h9.5"/>',
};
const icon = n => h('span', { class: 'ic', innerHTML: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>` });
const setIcon = (el, n) => el.replaceChildren(icon(n));
let toastT;
function toast(msg, sticky) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); if (!sticky) toastT = setTimeout(() => el.classList.remove('show'), 2800); }

// ================= storage (IndexedDB keeps the actual files, covers and backgrounds) =================
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('glass-player', 1);
  r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('tracks', { keyPath: 'id' }); d.createObjectStore('playlists', { keyPath: 'id' }); d.createObjectStore('kv'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const os = async (s, mode = 'readonly') => (await dbp).transaction(s, mode).objectStore(s);
const db = {
  all: async s => req((await os(s)).getAll()),
  get: async (s, k) => req((await os(s)).get(k)),
  put: async (s, v, k) => req((await os(s, 'readwrite')).put(v, k)),
  del: async (s, k) => req((await os(s, 'readwrite')).delete(k)),
};
navigator.storage?.persist?.();
const saveTrack = t => db.put('tracks', t).catch(e => { console.warn(e); toast('Storage full: this song lasts this session only'); });
const savePl = p => db.put('playlists', p).catch(console.warn);

// ================= state =================
const S = {
  tracks: new Map(), playlists: [], view: { type: 'home' }, nav: [],
  queue: [], queueSrc: null, now: null, history: [],
  shuffle: ls.getItem('gp.shuffle') === '1', repeat: ls.getItem('gp.repeat') || 'off',
  L: { lines: [], synced: false }, active: -1, lyrMsg: '', lyrSrc: '', importTo: null,
};
const media = $('#media');
const coverUrls = new Map();
const coverUrl = t => { if (!t?.cover) return null; if (!coverUrls.has(t.id)) coverUrls.set(t.id, URL.createObjectURL(t.cover)); return coverUrls.get(t.id); };
const allIds = () => [...S.tracks.values()].sort((a, b) => b.added - a.added).map(t => t.id);
const liked = () => S.playlists.find(p => p.id === 'liked');
const isLiked = t => !!t && liked()?.trackIds.includes(t.id);
const allPls = () => [{ id: 'all', name: 'All Songs', special: true }, liked(), ...S.playlists.filter(p => !p.special).sort((a, b) => a.created - b.created)].filter(Boolean);
const getPl = id => allPls().find(p => p.id === id);
const plIds = pl => pl.id === 'all' ? allIds() : pl.trackIds.filter(id => S.tracks.has(id));

// ================= importing =================
function guessFromName(fileName) {
  const n = base(fileName).replace(/_+/g, ' ').replace(/^\d{1,3}[\s.\-]+/, '').trim();
  const i = n.indexOf(' - ');
  return i > 0 ? { artist: n.slice(0, i).trim(), title: n.slice(i + 3).trim() } : { artist: '', title: n };
}
async function readTags(file) {
  // shortcut: whole file goes over IPC; skip tags above 300 MB (long videos) rather than stream
  if (!invoke || file.size > 300e6) return null;
  try { return await invoke('read_tags', new Uint8Array(await file.arrayBuffer())); }
  catch (e) { console.warn('tags', file.name, e); return null; }
}
async function shrinkCover(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || blob), 'image/jpeg', .88));
  } catch { return blob; }
}
const probe = document.createElement('audio'); probe.preload = 'metadata';
let probeQ = Promise.resolve();
const probeDuration = f => (probeQ = probeQ.then(() => new Promise(res => {
  const u = URL.createObjectURL(f), done = v => { URL.revokeObjectURL(u); probe.removeAttribute('src'); res(v); };
  probe.onloadedmetadata = () => done(probe.duration); probe.onerror = () => done(null); probe.src = u;
})));

// same file name and size = the same file added twice
const trackKey = (name, size) => `${String(name || '').toLowerCase()}|${size ?? ''}`;
// libraries from before duplicate checking: keep one copy (most played, then oldest), point playlists at it
function dedupeLibrary() {
  const keep = new Map(), gone = new Map();
  for (const t of [...S.tracks.values()].sort((a, b) => (b.plays || 0) - (a.plays || 0) || a.added - b.added)) {
    if (!t.fileName || t.file?.size == null) continue;
    const k = trackKey(t.fileName, t.file.size), k0 = keep.get(k);
    if (!k0) { keep.set(k, t); continue; }
    gone.set(t.id, k0.id);
    if (!k0.lyrics && t.lyrics) { k0.lyrics = t.lyrics; k0.lyricsSrc = t.lyricsSrc; saveTrack(k0); } // don't lose lyrics added to the copy
  }
  if (!gone.size) return;
  for (const p of S.playlists) {
    const ids = [...new Set(p.trackIds.map(id => gone.get(id) || id))];
    if (ids.join() !== p.trackIds.join()) { p.trackIds = ids; savePl(p); }
  }
  for (const id of gone.keys()) { S.tracks.delete(id); db.del('tracks', id); }
  if (gone.has(ls.getItem('gp.last'))) ls.setItem('gp.last', gone.get(ls.getItem('gp.last')));
  toast(`Removed ${gone.size} duplicate song${gone.size === 1 ? '' : 's'}`);
}

async function importFiles(files, intoId = S.importTo) {
  files = [...files]; S.importTo = null;
  const lrcs = new Map(files.filter(f => /\.lrc$/i.test(f.name)).map(f => [base(f.name).toLowerCase(), f]));
  const mediaFiles = files.filter(f => /^(audio|video)\//.test(f.type) || MEDIA_EXT.test(f.name));
  if (!mediaFiles.length) {
    if (lrcs.size && S.now) { const f = [...lrcs.values()][0]; await setTrackLyrics(S.now, await f.text(), '.lrc file'); return toast(`Lyrics added to "${S.now.title}"`); }
    return toast('No audio or video files found');
  }
  const t0 = Date.now(), added = [], dups = [];
  const have = new Map([...S.tracks.values()].map(t => [trackKey(t.fileName, t.file?.size), t]));
  for (const [n, f] of mediaFiles.entries()) {
    toast(`Importing ${n + 1} / ${mediaFiles.length}…`, true);
    const dup = have.get(trackKey(f.name, f.size));
    if (dup) { if (!dups.includes(dup)) dups.push(dup); continue; }
    const t = { id: uid(), file: f, fileName: f.name, ext: (f.name.match(/\.([^.]+)$/)?.[1] || '?').toUpperCase(), added: t0 + (mediaFiles.length - n), ...guessFromName(f.name), album: '', dur: null, cover: null, lyrics: null, lyricsSrc: '' };
    const tags = await readTags(f);
    if (tags) {
      t.title = tags.title || t.title; t.artist = tags.artist || t.artist; t.album = tags.album || ''; t.year = tags.year || null; t.trackNo = tags.track || null;
      if (tags.duration > 0) t.dur = tags.duration;
      if (tags.lyrics) { t.lyrics = tags.lyrics; t.lyricsSrc = 'Embedded'; }
      if (tags.cover) t.cover = await shrinkCover(new Blob([Uint8Array.from(atob(tags.cover), c => c.charCodeAt(0))], { type: tags.cover_mime || 'image/jpeg' }));
    }
    t.title = t.title.slice(0, MAX.title); t.artist = (t.artist || '').slice(0, MAX.artist); t.album = (t.album || '').slice(0, MAX.title);
    const lrc = lrcs.get(base(f.name).toLowerCase());
    if (lrc) { t.lyrics = await lrc.text(); t.lyricsSrc = '.lrc file'; }
    if (!t.dur) t.dur = await probeDuration(f);
    S.tracks.set(t.id, t); added.push(t); have.set(trackKey(f.name, f.size), t);
    await saveTrack(t);
  }
  const pl = intoId && S.playlists.find(p => p.id === intoId);
  // a song already in the library is reused (no second copy); a playlist holds each song once
  const inPl = pl ? dups.filter(t => pl.trackIds.includes(t.id)) : [];
  const toPl = pl ? [...added, ...dups.filter(t => !inPl.includes(t))] : [];
  if (pl && toPl.length) { pl.trackIds.push(...toPl.map(t => t.id)); savePl(pl); }
  rematch();
  const songs = n => `${n} song${n === 1 ? '' : 's'}`;
  const one = (pl ? inPl : dups).length === 1;
  if (pl && !toPl.length) toast(`${one ? 'This song is' : 'These songs are'} already in ${pl.name}`);
  else if (!pl && !added.length) toast(`${one ? 'This song is' : `All ${dups.length} songs are`} already in your library`);
  else toast(`Added ${songs(pl ? toPl.length : added.length)}${pl ? ` to ${pl.name}` : ''}` +
    (pl && inPl.length ? ` · ${songs(inPl.length)} already in it` : !pl && dups.length ? ` · ${songs(dups.length)} already in your library` : ''));
  if (!S.now && (added.length || toPl.length)) { S.queue = pl ? plIds(pl) : allIds(); load(added[0] || toPl[0]); }
  renderLibrary(); renderMain();
}
function pickFiles(intoId = null, folder = false) { S.importTo = intoId; (folder ? $('#dirIn') : $('#fileIn')).click(); }

async function filesFromDrop(dt) {
  const entries = [...dt.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean); // read before any await
  if (!entries.length) return [...dt.files];
  const out = [];
  async function walk(e) {
    if (e.isFile) out.push(await new Promise((r, j) => e.file(r, j)));
    else if (e.isDirectory) { const rd = e.createReader(); let b; do { b = await new Promise((r, j) => rd.readEntries(r, j)); for (const c of b) await walk(c); } while (b.length); }
  }
  for (const e of entries) await walk(e).catch(() => {});
  return out;
}

// ================= library sidebar =================
function plCover(pl, cls) {
  if (pl.id === 'liked') return h('div', { class: `cover ${cls} liked` }, icon('heart'));
  const urls = plIds(pl).map(id => S.tracks.get(id)).filter(t => t.cover).slice(0, 4).map(coverUrl);
  if (urls.length === 4) return h('div', { class: `cover ${cls} mosaic` }, urls.map(u => h('img', { src: u, alt: '', loading: 'lazy', draggable: false })));
  if (urls.length) return h('div', { class: `cover ${cls}` }, h('img', { src: urls[0], alt: '', loading: 'lazy', draggable: false }));
  return h('div', { class: `cover ${cls}` }, icon('music'));
}
const trackCover = (t, cls = '') => h('div', { class: `cover ${cls}` }, t?.cover ? h('img', { src: coverUrl(t), alt: '', loading: 'lazy', draggable: false }) : icon('music'));

function renderLibrary() {
  $('#plList').replaceChildren(...allPls().map(pl => {
    const n = plIds(pl).length;
    return h('div', { class: 'pl-item' + (S.view.id === pl.id ? ' active' : ''), 'data-pl': pl.id, tabIndex: 0, role: 'button',
      onclick: () => { go({ type: 'playlist', id: pl.id }); document.body.classList.remove('drawer'); },
      onkeydown: e => { if (e.key === 'Enter') e.currentTarget.click(); } },
      plCover(pl, 's'),
      h('div', { class: 'ell' }, h('div', { class: 'name ell' }, pl.name), h('div', { class: 'sub ell' }, `Playlist • ${n} song${n === 1 ? '' : 's'}`)),
      h('span', { class: 'spk' }, icon('vol')));
  }));
  markPlaying();
}

// ================= navigation =================
function go(view, replace) { if (!replace) S.nav.push(S.view); S.view = view; renderMain(); renderLibrary(); }
function back() {
  if (document.body.classList.contains('immersive')) return setImmersive(false);
  if (document.body.classList.contains('drawer')) return document.body.classList.remove('drawer');
  let v; do v = S.nav.pop(); while (v && v.type === 'search');
  $('#q').value = '';
  S.view = v || { type: 'home' }; if (S.view.type === 'playlist' && !getPl(S.view.id)) S.view = { type: 'home' };
  renderMain(); renderLibrary();
}
function updateBack() { $('#backBtn').hidden = !(document.body.classList.contains('immersive') || S.view.type !== 'home'); }

// ================= main views =================
function renderMain() {
  const m = $('#main'), key = JSON.stringify(S.view), old = $('.albums', m), keep = m.dataset.key === key && old ? [old.scrollTop, old.scrollLeft] : null;
  const v = S.view.type, crate = crateOn();
  document.body.classList.toggle('crate-mode', crate);
  m.replaceChildren(crate ? crateView() : v === 'home' ? homeView() : v === 'search' ? searchView(S.view.q) : v === 'profile' ? profileView() : playlistView(getPl(S.view.id)));
  m.dataset.key = key;
  const a = $('.albums', m); if (keep && a) [a.scrollTop, a.scrollLeft] = keep;
  placeMedia(); markPlaying(); updateBack(); syncLyrics(true);
}

function homeView() {
  const empty = !S.tracks.size;
  return h('div', { class: 'view home' },
    empty && h('div', { class: 'welcome' },
      h('h1', {}, 'Your music, your look'),
      h('div', {}, 'Add songs from your device, or drop files and folders anywhere.'),
      h('div', { class: 'muted' }, 'MP3 · MP4 · M4A · AAC · FLAC · WAV · OGG · Opus · WebM · .lrc lyrics'),
      h('div', { class: 'row' }, h('button', { class: 'pill accent', onclick: () => pickFiles() }, '+ Add files'), !MOBILE && h('button', { class: 'pill', onclick: () => pickFiles(null, true) }, '+ Add a folder'))),
    h('h2', {}, 'Playlists'),
    h('div', { class: 'grid' },
      allPls().map(pl => { const n = plIds(pl).length; return h('div', { class: 'pcard', tabIndex: 0, role: 'button', onclick: () => go({ type: 'playlist', id: pl.id }), onkeydown: e => { if (e.key === 'Enter') e.currentTarget.click(); } },
        plCover(pl, ''), h('div', { class: 'name ell' }, pl.name), h('div', { class: 'sub' }, `${n} song${n === 1 ? '' : 's'}`)); }),
      h('div', { class: 'pcard new', tabIndex: 0, role: 'button', onclick: createPlaylist, onkeydown: e => { if (e.key === 'Enter') createPlaylist(); } },
        h('div', { class: 'cover' }, icon('plus')), h('div', { class: 'name' }, 'New playlist'), h('div', { class: 'sub' }, 'Create'))));
}

function searchView(q) {
  const s = q.toLowerCase();
  const ids = allIds().filter(id => { const t = S.tracks.get(id); return `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(s); });
  return listView({ kind: 'Search', name: `“${q}”`, ids, cover: h('div', { class: 'cover xl' }, icon('search')) });
}
function playlistView(pl) {
  if (!pl) { S.view = { type: 'home' }; return homeView(); }
  return listView({ kind: 'Playlist', name: pl.name, ids: plIds(pl), pl, cover: plCover(pl, 'xl') });
}

function listView({ kind, name, ids, pl, cover }) {
  const tracks = ids.map(id => S.tracks.get(id));
  const total = tracks.reduce((s, t) => s + (t.dur || 0), 0);
  const user = pl && !pl.special;
  const compact = ls.getItem('gp.compact') === '1';
  const albums = h('div', { class: 'albums' + (compact ? ' compact' : '') });
  const body = h('div', { class: 'pl-body' + (compact ? ' compact' : '') }, albums, nowPanel);
  const compactBtn = h('button', { class: 'ib' + (compact ? ' on' : ''), title: 'Compact view', 'aria-label': 'Compact view', 'aria-pressed': String(compact),
    onclick: e => {
      const on = !albums.classList.contains('compact');
      ls.setItem('gp.compact', on ? '1' : '0');
      albums.classList.toggle('compact', on); body.classList.toggle('compact', on);
      e.currentTarget.classList.toggle('on', on); e.currentTarget.setAttribute('aria-pressed', on);
      $('.card.playing', albums)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } }, icon('list'));
  const filter = h('input', { class: 'filter', type: 'search', placeholder: 'Filter', maxLength: MAX.search, 'aria-label': 'Filter this playlist',
    oninput: e => { const q = e.target.value.toLowerCase(); $$('.card', albums).forEach(c => { c.hidden = !c.dataset.q.includes(q); }); } });
  albums.append(...(tracks.length ? tracks.map((t, i) => card(t, i, ids, pl)) : [h('div', { class: 'empty' },
    pl?.id === 'liked' ? 'Tap the heart on any song to add it here.' : 'No songs here yet.',
    pl?.id !== 'liked' && kind !== 'Search' && h('button', { class: 'pill accent', onclick: () => pickFiles(user ? pl.id : null) }, '+ Add songs'))]));
  return h('div', { class: 'view pl' },
    h('div', { class: 'pl-head' }, cover,
      h('div', { class: 'pl-info' }, h('small', {}, kind), h('h1', {}, name), h('div', { class: 'meta' }, `${tracks.length} song${tracks.length === 1 ? '' : 's'}, ${fmtLong(total)}`))),
    h('div', { class: 'pl-actions' },
      h('button', { class: 'big-play', title: 'Play', 'aria-label': 'Play', onclick: () => {
        if (!tracks.length) return; if (S.queueSrc === srcKey(pl, kind) && S.now) return toggle(); playList(ids, 0, srcKey(pl, kind)); } },
        icon(S.queueSrc === srcKey(pl, kind) && !media.paused ? 'pause' : 'play')),
      h('button', { class: 'ib', title: 'Shuffle play', 'aria-label': 'Shuffle play', onclick: () => { if (!tracks.length) return; setShuffle(true); playList(ids, Math.random() * ids.length | 0, srcKey(pl, kind)); } }, icon('shuffle')),
      pl && pl.id !== 'liked' && h('button', { class: 'ib', title: 'Add songs from your device', 'aria-label': 'Add songs', onclick: () => pickFiles(user ? pl.id : null) }, icon('plus')),
      user && h('button', { class: 'ib', title: 'Rename playlist', 'aria-label': 'Rename playlist', onclick: () => renamePlaylist(pl) }, icon('edit')),
      user && h('button', { class: 'ib', title: 'Delete playlist', 'aria-label': 'Delete playlist', onclick: () => deletePlaylist(pl) }, icon('trash')),
      h('div', { class: 'grow' }), tracks.length > 1 && filter, compactBtn),
    pl?.missing?.length > 0 && h('details', { class: 'missing' },
      h('summary', {}, `${pl.missing.length} song${pl.missing.length === 1 ? '' : 's'} from ${pl.from || 'the import'} not in your library yet`),
      h('ol', {}, pl.missing.map(m => h('li', {}, m.title, m.artist && h('span', { class: 'muted' }, ` · ${m.artist}`)))),
      h('small', { class: 'hint' }, 'Add those files and they join this playlist by themselves.')),
    body);
}
const srcKey = (pl, kind) => pl ? pl.id : kind;

function card(t, i, ids, pl) {
  return h('div', { class: 'card', 'data-id': t.id, 'data-q': `${t.title} ${t.artist} ${t.album}`.toLowerCase(), tabIndex: 0, role: 'button', 'aria-label': `${t.title} by ${t.artist || 'unknown artist'}`,
    onclick: e => { if (e.target.closest('.card-actions')) return; if (S.now === t) toggle(); else playList(ids, i, srcKey(pl, S.view.type === 'search' ? 'Search' : '')); },
    onkeydown: e => { if (e.key === 'Enter' && e.target === e.currentTarget) e.currentTarget.click(); } },
    h('div', { class: 'art' }, trackCover(t), h('span', { class: 'art-play' }, icon(S.now === t && !media.paused ? 'pause' : 'play'))),
    h('div', { class: 'ttl ell' }, t.title),
    h('div', { class: 'sub ell' }, `${t.artist || 'Unknown artist'} · ${fmt(t.dur)}`),
    h('div', { class: 'card-actions' }, likeBtn(t),
      h('button', { class: 'ib sm', title: 'More', 'aria-label': 'More options', onclick: e => trackMenu(e.currentTarget, t, pl) }, icon('more'))));
}
function likeBtn(t) {
  return h('button', { class: 'ib sm' + (isLiked(t) ? ' liked' : ''), 'data-like': t.id, title: 'Like', 'aria-label': 'Like', 'aria-pressed': String(isLiked(t)), onclick: () => toggleLike(t) }, icon('heart'));
}
function toggleLike(t) {
  if (!t) return;
  const l = liked(), on = !l.trackIds.includes(t.id);
  l.trackIds = on ? [t.id, ...l.trackIds] : l.trackIds.filter(id => id !== t.id);
  savePl(l);
  $$(`[data-like="${t.id}"]`).forEach(b => { b.classList.toggle('liked', on); b.setAttribute('aria-pressed', on); });
  if (S.now === t) $('#pLike').classList.toggle('liked', on);
  renderLibrary(); if (S.view.id === 'liked') renderMain();
  toast(on ? 'Added to Liked Songs' : 'Removed from Liked Songs');
}

// ================= playlists =================
async function createPlaylist(withTrack) {
  const name = await ask('New playlist', { value: `My playlist #${S.playlists.filter(p => !p.special).length + 1}`, ok: 'Create', max: MAX.playlist });
  if (!name) return;
  const pl = { id: uid(), name, trackIds: withTrack?.id ? [withTrack.id] : [], created: Date.now() };
  S.playlists.push(pl); await savePl(pl);
  if (withTrack?.id) { renderLibrary(); toast(`Added to ${name}`); } else go({ type: 'playlist', id: pl.id });
}
async function renamePlaylist(pl) { const n = await ask('Rename playlist', { value: pl.name, ok: 'Save', max: MAX.playlist }); if (!n) return; pl.name = n; savePl(pl); renderLibrary(); renderMain(); }
async function deletePlaylist(pl) {
  if (!await ask(`Delete “${pl.name}”?`, { input: false, ok: 'Delete', hint: 'The songs stay in your library.' })) return;
  S.playlists = S.playlists.filter(p => p !== pl); db.del('playlists', pl.id); back();
}
async function deleteTrack(t) {
  if (!await ask(`Delete “${t.title}” from your library?`, { input: false, ok: 'Delete', hint: 'It is removed from every playlist. The original file on your device is not touched.' })) return;
  S.tracks.delete(t.id); db.del('tracks', t.id);
  if (coverUrls.has(t.id)) { URL.revokeObjectURL(coverUrls.get(t.id)); coverUrls.delete(t.id); }
  for (const p of S.playlists) if (p.trackIds.includes(t.id)) { p.trackIds = p.trackIds.filter(id => id !== t.id); savePl(p); }
  if (S.now === t) stop();
  renderLibrary(); renderMain();
}
function trackMenu(anchor, t, pl) {
  const users = S.playlists.filter(p => !p.special && p.id !== pl?.id);
  menu(anchor, [
    { header: 'Add to playlist' },
    ...users.map(p => ({ label: p.name, action: () => { if (p.trackIds.includes(t.id)) return toast(`This song is already in ${p.name}`); p.trackIds.push(t.id); savePl(p); renderLibrary(); toast(`Added to ${p.name}`); } })),
    { label: '+ New playlist…', action: () => createPlaylist(t) },
    { header: 'Song' },
    { label: 'Edit lyrics…', action: () => editLyrics(t) },
    { label: 'Edit title & artist…', action: () => editInfo(t) },
    pl && !pl.special && { label: 'Remove from this playlist', action: () => { pl.trackIds = pl.trackIds.filter(id => id !== t.id); savePl(pl); renderLibrary(); renderMain(); } },
    { label: 'Delete from library', danger: true, action: () => deleteTrack(t) },
  ].filter(Boolean));
}
async function editInfo(t) {
  const title = await ask('Song title', { value: t.title, ok: 'Next', max: MAX.title }); if (title == null) return;
  const artist = await ask('Artist', { value: t.artist, ok: 'Save', max: MAX.artist }); if (artist == null) return;
  t.title = title || t.title; t.artist = artist; t.lyricsTried = false; saveTrack(t);
  if (S.now === t) updateNowUI();
  renderMain();
}

// ================= menus & dialogs =================
let openMenu = null;
function closeMenu() { openMenu?.remove(); openMenu = null; removeEventListener('pointerdown', outside, true); }
// pressing on the button that opened the menu is left to its click, which closes it (menu toggles)
function outside(e) { if (openMenu && !openMenu.contains(e.target) && !openMenu._anchor?.contains(e.target)) closeMenu(); }
function menu(anchor, items, cls = '', refresh) {
  if (openMenu && openMenu._anchor === anchor && !refresh) return closeMenu();
  closeMenu();
  const m = items.nodeType ? h('div', { class: `menu glass ${cls}` }, items) : h('div', { class: `menu glass ${cls}`, role: 'menu' }, items.map(it => it.header
    ? h('div', { class: 'menu-h' }, it.header)
    : h('button', { class: 'menu-i' + (it.danger ? ' danger' : ''), role: 'menuitem', onclick: () => { closeMenu(); it.action(); } }, it.label)));
  document.body.append(m);
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw)) + 'px';
  m.style.top = (r.bottom + mh + 8 > innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
  openMenu = m; m._anchor = anchor; setTimeout(() => addEventListener('pointerdown', outside, true));
  m.querySelector('button,input')?.focus({ preventScroll: true });
}
function ask(title, { value = '', ok = 'OK', input = true, textarea = false, hint = '', max = textarea ? MAX.lyrics : 100 } = {}) {
  return new Promise(res => {
    const field = textarea ? h('textarea', { value, spellcheck: false, maxLength: max }) : input ? h('input', { value, maxLength: max }) : null;
    // OK is first in the DOM so Enter submits it; CSS row-reverse shows it on the right
    const d = h('dialog', { class: 'glass modal' }, h('form', { method: 'dialog' }, h('h3', {}, title), field, hint && h('p', { class: 'hint' }, hint),
      h('div', { class: 'row' }, h('button', { class: 'pill accent', value: 'ok' }, ok), h('button', { class: 'pill', value: 'cancel' }, 'Cancel'))));
    d.addEventListener('close', () => { res(d.returnValue === 'ok' ? (field ? field.value.trim().slice(0, max) : true) : null); d.remove(); });
    document.body.append(d); d.showModal(); if (field && !textarea) field.select();
  });
}

// ================= crate view: stacked sleeves, a CD and a PLAY? card (layout "crate": a theme's "@layout crate", or Settings > Appearance) =================
const C = { tab: 'albums', i: 0, open: false, song: 0, list: false };
const pref = (k, d) => ls.getItem('gp.' + k) ?? d;
const crateOn = () => (pref('layout', '') || themeMeta.layout) === 'crate' && S.view.type === 'home' && S.tracks.size > 0;
const pad2 = n => String(n).padStart(2, '0');
const TABS = { albums: 'Albums', playlists: 'Playlists', songs: 'Songs' };
function crateItems(tab = C.tab) {
  let items;
  if (tab === 'playlists') items = allPls().map(pl => ({ name: pl.name, artist: 'Playlist', ids: plIds(pl), src: pl.id })).filter(a => a.ids.length);
  else if (tab === 'songs') items = allIds().map(id => { const t = S.tracks.get(id); return { name: t.title, artist: t.artist || 'Unknown artist', album: t.album, year: t.year, ids: [id], src: 'all' }; });
  else {
    const m = new Map();
    for (const id of allIds()) {
      const t = S.tracks.get(id), k = (t.album || '').toLowerCase();
      if (!m.has(k)) m.set(k, { name: t.album || 'Singles', ids: [], artists: new Set(), src: 'album:' + k });
      const a = m.get(k); a.ids.push(id); if (t.artist) a.artists.add(t.artist);
    }
    items = [...m.values()].map(a => {
      const ts = a.ids.map(id => S.tracks.get(id)).sort((x, y) => (x.trackNo || 1e9) - (y.trackNo || 1e9) || x.added - y.added);
      return { ...a, ids: ts.map(t => t.id), artist: a.artists.size > 1 ? 'Various Artists' : [...a.artists][0] || 'Unknown artist', year: ts.find(t => t.year)?.year };
    });
  }
  if (pref('order', 'added') === 'az') items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  return items;
}
let wheelAt = 0;
function crateView() {
  const items = crateItems(); C.i = Math.max(0, Math.min(C.i, items.length - 1));
  const counts = { albums: C.tab === 'albums' ? items.length : crateItems('albums').length, playlists: allPls().filter(p => plIds(p).length).length, songs: S.tracks.size };
  const root = h('div', { class: 'view crate', onwheel: e => {
      if (C.open || e.target.closest('.c-side')) return; e.preventDefault();
      if (Date.now() - wheelAt > 140 && Math.abs(e.deltaY) > 2) { wheelAt = Date.now(); crateMove(Math.sign(e.deltaY)); } } },
    h('div', { class: 'c-tabs', role: 'tablist', 'aria-label': 'Browse by' }, Object.entries(TABS).map(([k, label]) => h('button', { class: 'c-tab' + (C.tab === k ? ' on' : ''), role: 'tab', 'aria-selected': String(C.tab === k),
      onclick: () => { C.tab = k; C.i = 0; C.open = false; renderMain(); } }, label, h('span', { class: 'c-count' }, counts[k])))),
    h('div', { class: 'c-stack' }, h('div', { class: 'disc' }), items.map((a, idx) => h('div', { class: 'sleeve', 'data-i': idx, title: a.name,
      onclick: () => idx === C.i ? crateOpen(!C.open) : crateGo(idx) }, trackCover(a.ids.map(id => S.tracks.get(id)).find(t => t.cover))))),
    h('div', { class: 'c-nav' },
      h('button', { class: 'c-arrow', title: 'Previous (↑ or scroll up)', 'aria-label': 'Previous', onclick: () => crateMove(-1) }, '↑'),
      h('span', { class: 'c-pos' }),
      h('button', { class: 'c-arrow', title: 'Next (↓ or scroll down)', 'aria-label': 'Next', onclick: () => crateMove(1) }, '↓')),
    h('div', { class: 'c-select' }),
    h('div', { class: 'c-lyr' }),
    h('div', { class: 'c-side' }, h('div', { class: 'c-info' }), h('div', { class: 'c-play' })),
    DEVICE !== 'desktop' && h('div', { class: 'c-clock' }, h('span', { class: 'c-time' }), h('span', { class: 'batt', hidden: true })));
  root._items = items;
  updateCrate(root); tickClock(root);
  return root;
}
function updateCrate(root = $('.crate')) {
  const items = root?._items, a = items?.[C.i]; if (!a) return;
  root.classList.toggle('open', C.open); root.classList.toggle('playing', !media.paused);
  $$('.sleeve', root).forEach(el => {
    const d = el.dataset.i - C.i;
    el.style.setProperty('--d', Math.max(0, Math.min(d, 9))); el.style.zIndex = 100 - 2 * Math.abs(d);
    el.classList.toggle('front', d === 0); el.classList.toggle('prev', d === -1); el.classList.toggle('far', d < -1 || d > 8);
  });
  const n = a.ids.length, noun = { albums: 'Album', playlists: 'Playlist', songs: 'Song' }[C.tab];
  const btn = (ic, label, key, f) => h('button', { class: 'c-btn', onclick: f }, icon(ic), h('span', {}, label), key && h('kbd', {}, key));
  $('.c-pos', root).textContent = `${pad2(C.i + 1)} / ${pad2(items.length)}`;
  $('.c-select', root).replaceChildren(h('div', { class: 'c-big' }, `Select a${noun === 'Album' ? 'n' : ''} ${noun}`),
    h('div', { class: 'c-hint' }, 'Scroll or ↑ ↓ to browse · click the cover or press Enter to open'));
  $('.c-info', root).replaceChildren(h('small', { class: 'c-kind' }, noun), h('div', { class: 'c-ttl ell' }, a.name),
    h('div', { class: 'c-sub ell' }, C.tab === 'songs' ? [a.artist, a.album].filter(Boolean).join(' · ') : a.artist),
    h('div', { class: 'c-sub' }, [a.year, C.tab !== 'songs' && `${n} track${n === 1 ? '' : 's'}`, `${pad2(C.i + 1)}/${pad2(items.length)}`].filter(Boolean).join(' · ')),
    C.open ? '' : h('div', { class: 'c-acts' }, btn('play', 'Open', 'Enter', () => crateOpen(true))));
  const lyr = $('.c-lyr', root);
  if (!C.open) { $('.c-play', root).replaceChildren(); lyr.replaceChildren(); return; }
  const t = S.tracks.get(a.ids[C.song]), isNow = S.now === t, playing = isNow && !media.paused;
  const playIt = () => isNow ? toggle() : cratePlay();
  $('.c-play', root).replaceChildren(
    h('div', { class: 'c-np' }, h('span', { class: 'c-no' }, pad2(t.trackNo || C.song + 1)),
      h('div', { class: 'ell' }, h('div', { class: 'c-ttl ell' }, t.title), h('div', { class: 'c-sub ell' }, [t.artist || 'Unknown artist', C.tab !== 'albums' && t.album, n > 1 && `${C.song + 1}/${n}`].filter(Boolean).join(' · ')))),
    C.list ? h('div', { class: 'c-tracks' }, a.ids.map((id, j) => { const x = S.tracks.get(id);
        return h('button', { class: 'c-trk' + (j === C.song ? ' on' : '') + (S.now === x ? ' cur' : ''), onclick: () => cratePlay(j) },
          h('span', { class: 'c-no' }, pad2(x.trackNo || j + 1)), h('span', { class: 'ell' }, x.title), h('span', { class: 'c-dur' }, fmt(x.dur))); }))
      : h('button', { class: 'c-q', onclick: playIt }, h('span', {}, !isNow ? 'PLAY?' : playing ? 'PAUSE?' : 'RESUME?'), h('span', { class: 'c-qi' }, icon(playing ? 'pause' : 'play'))),
    h('div', { class: 'c-acts' },
      btn(playing ? 'pause' : 'play', playing ? 'Pause' : 'Play', 'Enter', playIt),
      n > 1 && btn('list', C.list ? 'Hide tracks' : 'Tracks', '→', () => { C.list = !C.list; updateCrate(); }),
      btn('back', 'Close', 'Esc', () => crateOpen(false))));
  $('.c-trk.on', root)?.scrollIntoView({ block: 'nearest' });
  // lyrics follow the song that is playing, so show them when it is from this sleeve
  if (a.ids.includes(S.now?.id) || C.tab === 'songs' && S.now) { if (nowPanel.parentNode !== lyr) lyr.replaceChildren(nowPanel); placeMedia(); }
  else lyr.replaceChildren(h('div', { class: 'c-lyr-empty' }, icon('lyrics'), h('span', {}, 'Lyrics show here while a song from this ' + noun.toLowerCase() + ' plays')));
}
function cratePlay(j = C.song) {
  const items = $('.crate')?._items, a = items?.[C.i]; if (!a) return;
  C.song = j;
  if (C.tab === 'songs') playList(items.map(x => x.ids[0]), C.i, 'all'); else playList(a.ids, j, a.src);
}
function crateMove(dir, keepOpen) {
  const n = $('.crate')?._items.length || 0; if (!n) return;
  crateGo(pref('endless', '0') === '1' ? (C.i + dir + n) % n : Math.max(0, Math.min(n - 1, C.i + dir)), keepOpen);
}
function crateGo(i, keepOpen) { C.i = i; C.open = !!keepOpen && C.open; C.list = false; C.song = 0; updateCrate(); }
function crateOpen(on) {
  const a = $('.crate')?._items[C.i]; C.open = on; C.list = false;
  if (on) C.song = Math.max(0, a.ids.indexOf(S.now?.id));
  updateCrate();
}
function crateKey(k) {
  const a = crateOn() && !openMenu && $('.crate')?._items[C.i]; if (!a) return false;
  const song = d => C.tab === 'songs' ? crateMove(d, true) : (C.song = (C.song + d + a.ids.length) % a.ids.length, updateCrate());
  const back = () => C.list ? (C.list = false, updateCrate()) : crateOpen(false);
  const f = C.open ? {
    arrowup: () => song(-1), arrowdown: () => song(1), enter: () => S.now?.id === a.ids[C.song] ? toggle() : cratePlay(),
    arrowright: () => { if (a.ids.length > 1) { C.list = !C.list; updateCrate(); } }, arrowleft: back, backspace: back, escape: back,
  }[k] : { arrowup: () => crateMove(-1), arrowdown: () => crateMove(1), enter: () => crateOpen(true) }[k];
  if (f) f(); return !!f;
}
async function tickClock(root = $('.crate')) {
  const tm = root && $('.c-time', root); if (!tm) return; const d = new Date(), hr = d.getHours();
  tm.textContent = `${d.getDate()}/${pad2(d.getMonth() + 1)} ${hr % 12 || 12}:${pad2(d.getMinutes())}${hr < 12 ? 'am' : 'pm'}`;
  const b = await navigator.getBattery?.().catch(() => null), el = $('.batt', root);
  if (b && el) { el.hidden = false; el.style.setProperty('--lvl', Math.round(b.level * 100) + '%'); el.title = `Battery ${Math.round(b.level * 100)}%`; }
}
setInterval(() => tickClock(), 20000);
function applyLook() {
  const de = document.documentElement, b = document.body.classList;
  de.dataset.ht = pref('halftone', 'strong');
  de.style.setProperty('--barbg', pref('barbg', '0'));
  de.dataset.font = pref('font', 'theme'); de.dataset.lyralign = pref('lyralign', 'center');
  webview?.setZoom(+pref('uiScale', 1)).catch(() => {});
  b.toggle('no-cd', pref('cdpop', '1') === '0'); b.toggle('no-clock', pref('clock', '1') === '0'); b.toggle('calm', pref('motion', 'full') === 'reduced');
}

// ================= settings panel =================
const SP = [['appearance', 'Appearance', 'palette'], ['background', 'Background', 'image'], ['equalizer', 'Equalizer', 'sliders'], ['sounds', 'Sounds', 'vol'],
  ['playback', 'Playback & lyrics', 'lyrics'], ['library', 'Library', 'music'], ['stats', 'Stats', 'chart'], ['about', 'About', 'info']];
let spEl = null;
function openPanel(sec = 'appearance') {
  closeMenu(); spEl?.remove();
  const body = h('div', { class: 'sp-body page' });
  const show = id => {
    $$('.sp-item', nav).forEach(b => { const on = b.dataset.sec === id; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    body.replaceChildren(h('div', { class: 'sp-head' }, h('h2', {}, SP.find(s => s[0] === id)[1]),
      h('button', { class: 'ib sm', title: 'Close (Esc)', 'aria-label': 'Close settings', onclick: closePanel }, icon('close'))), ...spSection(id, show));
    body.scrollTop = 0;
  };
  const nav = h('nav', { class: 'sp-nav', 'aria-label': 'Settings sections' },
    h('div', { class: 'sp-brand' }, h('img', { class: 'sp-logo', src: 'lyre.svg', alt: '' }), h('div', {}, h('b', {}, 'LYRE'), h('small', {}, 'Settings'))),
    SP.map(([id, label, ic]) => h('button', { class: 'sp-item', 'data-sec': id, onclick: () => show(id) }, icon(ic), label)),
    h('div', { class: 'grow' }), h('small', { class: 'sp-foot' }, h('span', { class: 'dot' }), `${S.tracks.size} songs in your library`));
  spEl = h('div', { class: 'sp-wrap', onclick: e => { if (e.target === spEl) closePanel(); } }, h('div', { class: 'sp', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings' }, nav, body));
  document.body.append(spEl); show(sec); $('.sp-item.on', nav).focus();
}
function closePanel() { spEl?.remove(); spEl = null; }
const spCard = (...kids) => h('div', { class: 'sp-card' }, ...kids);
function segRow(label, hint, key, opts, def, after) {
  const cur = pref(key, def);
  return h('div', { class: 'set-row sp-seg' }, h('div', {}, h('div', { class: 'set-lbl' }, label), hint && h('small', { class: 'hint' }, hint)),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, opts.map(([v, l]) => h('button', { class: 'seg-b' + (cur === v ? ' on' : ''), role: 'radio', 'aria-checked': String(cur === v),
      onclick: e => { ls.setItem('gp.' + key, v); $$('.seg-b', e.currentTarget.parentNode).forEach(b => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); applyLook(); after?.(); } }, l))));
}
let zoomT;
const prefToggle = (label, hint, key, def, after) => toggleRow(label, pref(key, def) === '1', hint, v => { ls.setItem('gp.' + key, v ? '1' : '0'); applyLook(); after?.(); });
function spSection(id, show) {
  const snds = soundControls(); // 0-2 volume, 3-5 bass/treble/balance, 6+ fade, curve, limiter
  const layout = pref('layout', '') || themeMeta.layout || 'classic';
  const layoutCard = (v, name, desc) => h('button', { class: 'sp-layout' + (layout === v ? ' on' : ''), 'aria-pressed': String(layout === v),
    onclick: () => { ls.setItem('gp.layout', v); if (v === 'classic') go({ type: 'home' }, true); else renderMain(); show('appearance'); } },
    h('span', { class: 'sp-prev ' + v }, h('i'), h('i'), h('i')), h('b', {}, name, layout === v && h('span', { class: 'badge' }, 'Active')), h('small', { class: 'muted' }, desc));
  return {
    appearance: [
      spCard(h('div', { class: 'sp-layouts' }, layoutCard('classic', 'Classic', 'Library on the left, playlists in a grid, lyrics beside your songs.'),
        layoutCard('crate', 'Crate', 'Album sleeves stacked like a record crate, a CD and a PLAY? card.'))),
      spCard(h('div', { class: 'set-lbl' }, 'Theme'), themePicker(), h('div', { class: 'line' }, h('button', { class: 'pill', onclick: showThemeTemplate }, icon('edit'), 'Make your own theme'))),
      spCard(prefToggle('CD pop-out', 'Opening an album slides its CD out of the sleeve.', 'cdpop', '1'),
        prefToggle('Endless library', 'After the last album, start again at the first.', 'endless', '0'),
        segRow('Halftone', 'How strong the dot pattern over the background is.', 'halftone', [['strong', 'Print'], ['soft', 'Soft'], ['off', 'Off']], 'strong'),
        prefToggle('Date and time', 'Top left, with battery. Phones and tablets only.', 'clock', '1'),
        segRow('Motion', 'Reduced turns off sliding and spinning.', 'motion', [['full', 'Full'], ['reduced', 'Reduced']], 'full'),
        segRow('Library order', 'How albums, playlists and songs are sorted.', 'order', [['added', 'Recently added'], ['az', 'A–Z']], 'added', renderMain),
        segRow('Font', "Theme uses each theme's own font.", 'font', [['theme', 'Theme'], ['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['rounded', 'Rounded']], 'theme'),
        segRow('Lyrics alignment', 'Where lyric lines line up.', 'lyralign', [['center', 'Centre'], ['left', 'Left']], 'center'),
        webview && rangeRow('Interface size', +pref('uiScale', 1), .8, 1.4, .05, pct, v => { ls.setItem('gp.uiScale', v); clearTimeout(zoomT); zoomT = setTimeout(applyLook, 400); }, 'Makes everything bigger or smaller.'),
        rangeRow('Play bar background', +pref('barbg', 0), 0, 1, .05, pct, v => { ls.setItem('gp.barbg', v); applyLook(); }, 'A box behind the play bar, from none to solid.')),
    ],
    background: [spCard(...lookControls())],
    equalizer: [spCard(...snds.slice(3, 6), h('div', { class: 'line' }, h('button', { class: 'pill', onclick: () => { setSound({ bass: 0, treble: 0, pan: 0 }); show('equalizer'); } }, 'Reset')))],
    sounds: [spCard(...snds.slice(0, 3), ...snds.slice(6))],
    playback: [spCard(...playbackRows())],
    library: [spCard(...libraryRows())],
    stats: [profileView()],
    about: [spCard(h('b', {}, 'Lyre 1.0.0'), h('span', { class: 'muted' }, 'Rust + Tauri. Your music stays on this device.')),
      spCard(h('div', { class: 'set-lbl' }, 'Keyboard shortcuts'), h('div', { class: 'keys' }, SHORTCUTS.map(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])))],
  }[id];
}

// ================= playback =================
function playList(ids, i, src) { S.queue = ids.slice(); S.queueSrc = src || null; play(S.tracks.get(ids[i])); }
function play(t, fromHistory) {
  if (!t) return;
  if (S.now && S.now !== t && !fromHistory) S.history.push(S.now.id);
  load(t); media.play().catch(() => {});
}
function load(t) {
  S.now = t;
  if (media.src) URL.revokeObjectURL(media.src);
  media.src = URL.createObjectURL(t.file);
  media.playbackRate = +(ls.getItem('gp.speed') || 1);
  ls.setItem('gp.last', t.id);
  lastPos = 0; heard = 0; S.counted = false;
  if (G.ctx && snd.fade) { G.fade.gain.cancelScheduledValues(0); G.fade.gain.value = 0; } // new song fades in from silence (a scheduled 0 got cancelled by fadeIn)
  applySound(); // per-song volume
  updateNowUI(); loadLyrics(t); markPlaying();
  // lyrics mode takes its colours from the song's cover
  S.coverAcc = null; applyColors();
  if (t.cover) accentFromImage(coverUrl(t)).then(a => { if (S.now === t) { S.coverAcc = a; applyColors(); } }).catch(() => {});
}
function stop() {
  S.now = null; S.coverAcc = null; media.pause(); if (media.src) URL.revokeObjectURL(media.src); media.removeAttribute('src'); media.load();
  applyColors(); updateNowUI(); setLyrics(null, ''); markPlaying(); placeMedia();
}
const queueNow = () => { const q = S.queue.filter(id => S.tracks.has(id)); return q.length ? q : allIds(); };
function next(auto) {
  const q = queueNow(); if (!q.length) return;
  if (auto && S.repeat === 'one' && S.now) { media.currentTime = 0; media.play(); return; }
  const i = q.indexOf(S.now?.id); let id;
  if (S.shuffle && q.length > 1) { do id = q[Math.random() * q.length | 0]; while (id === S.now?.id); }
  else if (i + 1 < q.length) id = q[i + 1];
  else if (S.repeat !== 'off' || !auto) id = q[0];
  else { media.pause(); media.currentTime = 0; return; }
  play(S.tracks.get(id));
}
function prev() {
  if (media.currentTime > 3) { media.currentTime = 0; return; }
  let id; while ((id = S.history.pop()) && !S.tracks.has(id));
  if (id) return play(S.tracks.get(id), true);
  const q = queueNow(), i = q.indexOf(S.now?.id);
  play(S.tracks.get(q[(i - 1 + q.length) % q.length]), true);
}
function toggle() { if (!S.now) { const q = queueNow(); if (q.length) { S.queue = q; play(S.tracks.get(q[0])); } return; } if (fadingOut) { ++fadeTok; fadingOut = false; fadeIn(); return; } media.paused ? media.play().catch(() => {}) : pauseSmooth(); }
const seekBy = s => { if (S.now && media.duration) media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + s)); };
function setShuffle(v) { S.shuffle = v; ls.setItem('gp.shuffle', v ? '1' : '0'); syncModes(); }
function syncModes() {
  $('#shufBtn').classList.toggle('on', S.shuffle); $('#shufBtn').setAttribute('aria-pressed', S.shuffle);
  setIcon($('#repBtn'), S.repeat === 'one' ? 'repeat1' : 'repeat');
  $('#repBtn').classList.toggle('on', S.repeat !== 'off'); $('#repBtn').title = `Repeat: ${S.repeat} (R)`;
  ls.setItem('gp.repeat', S.repeat);
}

function updateNowUI() {
  const t = S.now;
  $('#pTitle').textContent = t ? t.title : 'Nothing playing';
  $('#pArtist').textContent = t ? (t.artist || 'Unknown artist') : 'Add music to get started';
  $('#pCover').replaceWith(Object.assign(trackCover(t, 'p'), { id: 'pCover' }));
  $('#pLike').hidden = !t; $('#pLike').classList.toggle('liked', isLiked(t));
  document.title = t ? `${t.title} · Lyre` : 'Lyre';
  $('#imInfo').replaceChildren(trackCover(t, ''), h('h2', { class: 'ell' }, t ? t.title : 'Nothing playing'), h('div', { class: 'muted ell' }, t ? (t.artist || 'Unknown artist') : ''));
  $('#imBg').style.setProperty('--cover', t?.cover ? `url("${coverUrl(t)}")` : 'none'); $('#imBg').classList.toggle('has', !!t?.cover);
  const ca = C.open && $('.crate')?._items[C.i]; if (ca && ca.ids.includes(t?.id)) C.song = ca.ids.indexOf(t.id); // the card follows the playing song
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = t ? new MediaMetadata({ title: t.title, artist: t.artist || '', album: t.album || '', artwork: t.cover ? [{ src: coverUrl(t), sizes: '600x600', type: t.cover.type || 'image/jpeg' }] : [] }) : null;
}
function markPlaying() {
  const id = S.now?.id, playing = !media.paused;
  $$('.card').forEach(c => { const on = c.dataset.id === id; c.classList.toggle('playing', on); setIcon($('.art-play', c), on && playing ? 'pause' : 'play'); });
  $$('.pl-item').forEach(p => p.classList.toggle('playing', playing && p.dataset.pl === S.queueSrc));
  const bp = $('.big-play'); if (bp) setIcon(bp, playing && S.view.type === 'playlist' && S.queueSrc === S.view.id ? 'pause' : 'play');
  updateCrate();
  setIcon($('#playBtn'), playing ? 'pause' : 'play'); $('#playBtn').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

// media element events
let fails = 0;
media.addEventListener('ended', () => { if (sleep.v === 'end') { sleep.v = '0'; toast('Sleep timer: stopped'); return; } next(true); });
for (const ev of ['play', 'pause', 'seeked', 'ratechange', 'durationchange']) media.addEventListener(ev, () => discordSync());
media.addEventListener('play', () => { buildGraph(); G.ctx?.resume(); ++fadeTok; fadingOut = false; fadeIn(); markPlaying(); startLyricLoop(); });
media.addEventListener('pause', markPlaying);
media.addEventListener('playing', () => { fails = 0; });
media.addEventListener('error', () => {
  if (!S.now || !media.getAttribute('src')) return;
  toast(`Can't play “${S.now.title}”: this device doesn't support that format`);
  if (++fails < queueNow().length) next(true); else fails = 0; // stop once every song has failed
});
media.addEventListener('loadedmetadata', () => {
  $('#tDur').textContent = fmt(media.duration);
  if (S.now && !S.now.dur && isFinite(media.duration)) { S.now.dur = media.duration; saveTrack(S.now); }
  placeMedia();
});
let seeking = false;
const setRangeFill = el => el.style.setProperty('--p', (el.value - el.min) / (el.max - el.min) * 100 + '%');
media.addEventListener('timeupdate', () => {
  $('#tCur').textContent = fmt(media.currentTime);
  trackListening();
  if (!seeking && media.duration) { $('#seek').value = media.currentTime / media.duration * 1000; setRangeFill($('#seek')); }
  if (media.duration && navigator.mediaSession?.setPositionState) try { navigator.mediaSession.setPositionState({ duration: media.duration, position: Math.min(media.currentTime, media.duration), playbackRate: media.playbackRate }); } catch {}
});
media.addEventListener('seeked', () => syncLyrics(true));

// video tracks show in the lyrics panel (or behind the lyrics in lyrics mode)
const videoBox = h('div', { class: 'video-box', hidden: true });
function placeMedia() {
  const isV = !!S.now && media.videoWidth > 0, imm = document.body.classList.contains('immersive');
  const target = !isV ? $('#mediaHold') : imm ? $('#imVideo') : videoBox.isConnected ? videoBox : $('#mediaHold');
  if (media.parentNode !== target) target.append(media);
  videoBox.hidden = target !== videoBox;
}

// ================= lyrics =================
const lyricsBox = h('div', { class: 'lyrics', id: 'lyricsBox' });
const lyrChip = h('span', { class: 'chip' });
const nowPanel = h('section', { class: 'now', 'aria-label': 'Lyrics' },
  h('div', { class: 'now-head' }, h('span', { class: 'label' }, 'Lyrics'), lyrChip, h('div', { class: 'grow' }),
    h('button', { class: 'ib sm', title: 'Edit lyrics', 'aria-label': 'Edit lyrics', onclick: () => S.now && editLyrics(S.now) }, icon('edit')),
    h('button', { class: 'ib sm', title: 'Lyrics mode (F)', 'aria-label': 'Lyrics mode', onclick: () => setImmersive(true) }, icon('expand'))),
  videoBox, lyricsBox);

// parseLyrics lives in lyrics.js
function setLyrics(text, src) { S.L = parseLyrics(text); S.active = -1; lyrChip.textContent = text ? src : ''; renderLyrics(); syncLyrics(true); }
function renderLyrics() {
  for (const box of [lyricsBox, $('#imLyrics')]) {
    box.classList.toggle('synced', S.L.synced); box._syl = null;
    if (!S.L.lines.length) {
      box.replaceChildren(h('div', { class: 'lyr-empty' },
        h('p', {}, S.now ? (S.lyrMsg || 'No lyrics for this song yet') : 'Play a song to see its lyrics here'),
        S.now && !S.lyrMsg.startsWith('Searching') && h('div', { class: 'row' },
          h('button', { class: 'pill', onclick: () => { S.now.lyricsTried = false; loadLyrics(S.now, true); } }, 'Search online'),
          h('button', { class: 'pill', onclick: () => editLyrics(S.now) }, 'Paste lyrics'))));
      continue;
    }
    box.replaceChildren(h('div', { class: 'pad' }), ...S.L.lines.map(lineEl), h('div', { class: 'pad' }));
  }
}
// synced lines are split into word spans of syllable spans so each syllable can light up and move
function lineEl(l, i) {
  const p = h('p', { class: 'ln', 'data-i': i, onclick: () => { if (l.t != null) { media.currentTime = l.t; media.play().catch(() => {}); } } });
  if (!l.syl) { p.textContent = l.text || '♪'; return p; }
  let w = null;
  for (const s of l.syl) {
    if (s.sp) { p.append(' '); w = null; continue; }
    if (!w) p.append(w = h('span', { class: 'w' }));
    w.append(h('span', { class: 'syl' }, s.text));
  }
  return p;
}
// currentTime only ticks every few frames; between ticks extrapolate from the wall clock so the fill glides
let clk = { m: 0, w: 0 };
function mediaNow() {
  const m = media.currentTime, w = performance.now();
  if (m !== clk.m || media.paused) clk = { m, w };
  return media.paused ? m : clk.m + Math.min(.3, (w - clk.w) / 1000) * media.playbackRate;
}
function syncLyrics(force) {
  if (!S.L.synced) return;
  const now = mediaNow(), t = now + .15; let lo = 0, hi = S.L.lines.length - 1, i = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (S.L.lines[m].t <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  const boxes = [lyricsBox, $('#imLyrics')];
  if (i !== S.active || force) {
    S.active = i;
    for (const box of boxes) {
      $('.ln.on', box)?.classList.remove('on');
      const p = $(`.ln[data-i="${i}"]`, box); box._syl = p ? $$('.syl', p) : null;
      if (!p) continue;
      p.classList.add('on');
      if (box.offsetParent && Date.now() > (box._hold || 0)) box.scrollTo({ top: p.offsetTop - box.clientHeight / 2 + p.offsetHeight / 2, behavior: force ? 'auto' : 'smooth' });
    }
  }
  // every frame: each syllable's --p is how far through it we are (-20% unsung .. 120% sung); .on = being sung
  const sy = S.L.lines[i]?.sy, st = now + .05; if (!sy) return;
  for (const box of boxes) box._syl?.forEach((el, k) => {
    const s = sy[k]; if (!s) return;
    const q = Math.min(1, Math.max(0, (st - s.t0) / (s.t1 - s.t0)));
    el.classList.toggle('done', q >= 1); el.classList.toggle('on', q > 0 && q < 1);
    el.style.setProperty('--p', (q * 140 - 20).toFixed(1) + '%');
  });
}
let raf = 0;
function startLyricLoop() { if (raf) return; const step = () => { if (media.paused) { raf = 0; return; } syncLyrics(); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
for (const box of [lyricsBox, $('#imLyrics')]) for (const ev of ['wheel', 'touchmove']) box.addEventListener(ev, () => { box._hold = Date.now() + 3500; }, { passive: true });

async function setTrackLyrics(t, text, src) { t.lyrics = text || null; t.lyricsSrc = text ? src : ''; t.lyricsTried = true; await saveTrack(t); if (S.now === t) { S.lyrMsg = ''; setLyrics(t.lyrics, t.lyricsSrc); } }
async function editLyrics(t) {
  const v = await ask(`Lyrics for “${t.title}”`, { value: t.lyrics || '', textarea: true, ok: 'Save', hint: 'Plain text, or synced LRC lines like [01:23.45] lyric text.' });
  if (v != null) setTrackLyrics(t, v, 'Edited');
}
const onlineLyrics = () => ls.getItem('gp.onlineLyrics') !== '0';
async function loadLyrics(t, manual) {
  S.lyrMsg = ''; setLyrics(t.lyrics, t.lyricsSrc);
  if (t.lyrics || t.lyricsTried || (!onlineLyrics() && !manual) || !t.title) return;
  S.lyrMsg = 'Searching lyrics online…'; renderLyrics();
  try {
    const found = await fetchLrclib(t);
    t.lyricsTried = true;
    if (found) { t.lyrics = found; t.lyricsSrc = 'LRCLIB'; }
    saveTrack(t);
    if (S.now === t) { S.lyrMsg = found ? '' : 'No lyrics found online'; setLyrics(t.lyrics, t.lyricsSrc); }
  } catch (e) {
    console.warn('lyrics', e);
    if (S.now === t) { S.lyrMsg = "Couldn't reach the lyrics service (offline?)"; renderLyrics(); }
  }
}
async function fetchLrclib(t) {
  const pick = j => j?.instrumental ? '[00:00.00]♪ Instrumental ♪' : (j?.syncedLyrics || j?.plainLyrics || null);
  if (t.artist) {
    const q = new URLSearchParams({ track_name: t.title, artist_name: t.artist });
    if (t.album) q.set('album_name', t.album);
    if (t.dur) q.set('duration', Math.round(t.dur));
    const r = await fetch('https://lrclib.net/api/get?' + q);
    if (r.ok) { const l = pick(await r.json()); if (l) return l; }
  }
  const r = await fetch('https://lrclib.net/api/search?' + new URLSearchParams({ q: `${t.artist} ${t.title}`.trim() }));
  if (!r.ok) return null;
  const arr = await r.json();
  const close = arr.filter(x => !t.dur || !x.duration || Math.abs(x.duration - t.dur) < 8);
  return pick(close.find(x => x.syncedLyrics) || close[0]);
}

// ================= lyrics mode & fullscreen =================
function setImmersive(on) {
  document.body.classList.toggle('immersive', on);
  placeMedia(); updateBack(); applyColors();
  if (on) requestAnimationFrame(() => syncLyrics(true)); else { setFull(false); renderMain(); }
}
async function setFull(on) {
  try {
    if (appWin) { if (on !== await appWin.isFullscreen()) await appWin.setFullscreen(on); }
    else if (on) await document.documentElement.requestFullscreen?.();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch (e) { console.warn(e); }
}
async function toggleFull() { const now = appWin ? await appWin.isFullscreen().catch(() => false) : !!document.fullscreenElement; setFull(!now); }

// ================= theme: background → colours =================
const rgbToHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [hh / 6, s, l]; };
const hslToRgb = (hh, s, l) => { const f = n => { const k = (n + hh * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
const hexToRgb = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
const rgbToHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
let bgUrl = null, bgAccent = null;

async function accentFromImage(url) {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 48, 48);
  const d = g.getImageData(0, 0, 48, 48).data, buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const [hh, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (l < .1 || l > .96) continue;
    const w = s * (1 - Math.abs(l - .5) * 1.4) + .01, k = Math.round(hh * 24) % 24, b = buckets.get(k) || { w: 0, r: 0, g: 0, b: 0 };
    b.w += w; b.r += d[i] * w; b.g += d[i + 1] * w; b.b += d[i + 2] * w; buckets.set(k, b);
  }
  const best = [...buckets.values()].sort((a, b) => b.w - a.w)[0];
  return best ? [best.r / best.w, best.g / best.w, best.b / best.w] : null;
}
function applyColors() {
  const manual = ls.getItem('gp.accent'), T = themeMeta, light = T.mode === 'light';
  // in lyrics mode the song's cover wins over the background image; both are clamped to the theme's light/dark
  const auto = (document.body.classList.contains('immersive') && S.coverAcc) || bgAccent;
  const src = manual ? hexToRgb(manual) : auto || (T.accent ? hexToRgb(T.accent) : DEFAULT_ACCENT);
  const [hh, s, l] = rgbToHsl(...src);
  // keep the accent readable on the theme's glass and the text a soft tint of it
  const acc = manual || (T.accent && !auto) ? src.map(Math.round)
    : light ? hslToRgb(hh, Math.max(s, .55), Math.min(.5, Math.max(.35, l))) : hslToRgb(hh, Math.max(s, .45), Math.min(.74, Math.max(.6, l)));
  const txt = T.text && !auto ? hexToRgb(T.text) : hslToRgb(hh, Math.min(s, .4) * .8, light ? .14 : .92);
  const root = document.documentElement.style;
  root.setProperty('--accent-rgb', acc.join(','));
  root.setProperty('--text-rgb', txt.join(','));
  $('meta[name=theme-color]').content = rgbToHex(hslToRgb(hh, Math.min(s, .4), light ? .85 : .06));
  return acc;
}
function applyGlass() {
  const root = document.documentElement.style;
  root.setProperty('--blur', (ls.getItem('gp.blur') ?? 18) + 'px');
  root.setProperty('--dim', ls.getItem('gp.dim') ?? .55);
  root.setProperty('--glass-a', ls.getItem('gp.glass') ?? .42);
  document.documentElement.classList.toggle('no-glass', ls.getItem('gp.fxGlass') === '0');
  document.documentElement.classList.toggle('no-glow', ls.getItem('gp.fxGlow') === '0');
}

// ================= themes: plain .css files with a /* @name ... */ header =================
let themeMeta = {}, builtinCache = null;
const GLASS_THEME = { id: 'glass', name: 'Glass', description: 'Dark glass (default)', builtin: true, css: '', preview: 'radial-gradient(circle at 25% 20%,#e8a07a88,transparent 55%),#0b090b' };
function parseThemeMeta(css) {
  const m = {}, head = css.match(/\/\*[\s\S]*?\*\//)?.[0] || '';
  for (const [, k, v] of head.matchAll(/^[ \t*]*@(name|author|description|mode|accent|text|preview|layout|window)[ \t]+([^\n]+)/gm)) if (!(k in m)) m[k] = v.replace(/\*\/\s*$/, '').trim();
  for (const k of ['accent', 'text']) if (m[k] && !/^#[0-9a-f]{6}$/i.test(m[k])) delete m[k]; // only #rrggbb colours
  if (m.preview) m.preview = m.preview.replace(/[;{}<>]/g, ''); // it goes into a style attribute
  return m;
}
async function builtinThemes() {
  if (!builtinCache) try {
    const files = await (await fetch('themes/index.json')).json();
    builtinCache = await Promise.all(files.map(async f => { const css = await (await fetch('themes/' + f)).text(); return { ...parseThemeMeta(css), id: 'builtin:' + f, css, builtin: true }; }));
  } catch (e) { console.warn('themes', e); builtinCache = []; }
  return builtinCache;
}
const userThemes = async () => (await db.get('kv', 'themes').catch(() => null)) || [];
const allThemes = async () => [GLASS_THEME, ...await builtinThemes(), ...await userThemes()];
async function applyTheme(id = ls.getItem('gp.theme') || 'glass') {
  const th = (await allThemes()).find(t => t.id === id) || GLASS_THEME;
  $('#themeCss').textContent = th.css;
  themeMeta = parseThemeMeta(th.css);
  document.documentElement.dataset.theme = th.id;
  applyColors();
  // "@window acrylic|mica|blur": Windows blurs the desktop behind the (transparent) window; html.win-fx tells the theme it worked
  const fx = ['acrylic', 'mica', 'blur'].includes(themeMeta.window) ? themeMeta.window : null;
  document.documentElement.classList.remove('win-fx');
  if (appWin && !MOBILE) (fx ? appWin.setEffects({ effects: [fx], color: [14, 16, 22, 110] }) : appWin.clearEffects())
    .then(() => document.documentElement.classList.toggle('win-fx', !!fx)).catch(e => console.warn('window effect', e));
}
async function pickTheme(id) {
  ls.setItem('gp.theme', id); ls.removeItem('gp.accent'); // a theme brings its own colours
  await applyTheme(id); renderMain();
  if (bgUrl) toast("Theme on. Your own background is kept: Reset it to see the theme's background");
}
async function importTheme(file) {
  const css = await file.text();
  if (css.length > 2e6) return toast('That theme file is too big');
  const meta = parseThemeMeta(css), name = meta.name || base(file.name);
  const id = 'user:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const list = (await userThemes()).filter(t => t.id !== id);
  list.push({ ...meta, name, id, css, builtin: false });
  await db.put('kv', list, 'themes').catch(() => toast('Not enough storage for that theme'));
  await pickTheme(id); toast(`Theme "${name}" added`);
  if (S.view.type === 'settings') renderMain();
}
async function deleteTheme(id) {
  await db.put('kv', (await userThemes()).filter(t => t.id !== id), 'themes');
  if ((ls.getItem('gp.theme') || 'glass') === id) await pickTheme('glass');
}
async function showThemeTemplate() {
  let tpl = ''; try { tpl = await (await fetch('themes/template.css')).text(); } catch {}
  ask('Make your own theme', { value: tpl, textarea: true, ok: 'Close', hint: 'Copy this into a new .css file, change it, then use Import theme (or drop the file on the window).' });
}
function themePicker() {
  const box = h('div', { class: 'themes' });
  const fill = async () => {
    const cur = ls.getItem('gp.theme') || 'glass';
    box.replaceChildren(...(await allThemes()).map(t => h('button', { class: 'theme-card' + (t.id === cur ? ' on' : ''), 'aria-pressed': String(t.id === cur), onclick: async () => { await pickTheme(t.id); fill(); } },
      h('span', { class: 'theme-prev', style: `background:${t.preview || 'linear-gradient(135deg,#555,#222)'}` }),
      h('b', { class: 'ell' }, t.name || 'Untitled'), h('small', { class: 'muted ell' }, t.description || (t.builtin ? 'Built in' : 'Imported')),
      !t.builtin && h('span', { class: 'theme-del', role: 'button', title: 'Delete theme', 'aria-label': `Delete ${t.name}`, onclick: async e => { e.stopPropagation(); await deleteTheme(t.id); fill(); } }, icon('trash')))),
      h('button', { class: 'theme-card add', onclick: () => $('#themeIn').click() }, h('span', { class: 'theme-prev' }, icon('plus')), h('b', {}, 'Import theme'), h('small', { class: 'muted' }, '.css file')));
  };
  fill();
  return box;
}

async function applyBackground() {
  let blob = null; try { blob = await db.get('kv', 'bg'); } catch {}
  if (bgUrl) URL.revokeObjectURL(bgUrl);
  bgUrl = blob ? URL.createObjectURL(blob) : null;
  $('#bg').style.backgroundImage = bgUrl ? `url("${bgUrl}")` : '';
  bgAccent = null;
  if (bgUrl) try { bgAccent = await accentFromImage(bgUrl); } catch (e) { console.warn(e); }
  applyColors();
}
async function setBackground(file) {
  if (!file?.type.startsWith('image/')) return toast('Pick an image (JPG, PNG, WebP or GIF)');
  await db.put('kv', file, 'bg').catch(() => toast('Not enough storage for that image'));
  await applyBackground(); toast('Background updated');
}

// ================= form rows (shared by popovers and pages) =================
function rangeRow(label, value, min, max, step, show, onInput, hint, disabled) {
  const out = h('span', { class: 'val' }, show(value));
  const r = h('input', { type: 'range', min, max, step, value, disabled, 'aria-label': label,
    oninput: e => { const v = +e.target.value; out.textContent = show(v); setRangeFill(e.target); onInput(v); } });
  setRangeFill(r);
  return h('label', { class: 'set-row' + (disabled ? ' off' : '') }, h('span', { class: 'set-lbl' }, h('span', {}, label), out), r, hint && h('small', { class: 'hint' }, hint));
}
function toggleRow(label, on, hint, onChange) {
  return h('label', { class: 'set-row' }, h('span', { class: 'set-lbl' }, h('span', {}, label),
    h('input', { type: 'checkbox', class: 'switch', checked: on, 'aria-label': label, onchange: e => onChange(e.target.checked) })), hint && h('small', { class: 'hint' }, hint));
}
const pct = v => Math.round(v * 100) + '%';
const dbFmt = v => (v > 0 ? '+' : '') + v + ' dB';

// ================= look (background, colours, glass) =================
function lookControls() {
  const color = h('input', { type: 'color', value: rgbToHex(applyColors()), 'aria-label': 'Accent colour', oninput: e => { ls.setItem('gp.accent', e.target.value); auto.checked = false; applyColors(); } });
  const auto = h('input', { type: 'checkbox', class: 'switch', checked: !ls.getItem('gp.accent'), 'aria-label': 'Accent from background',
    onchange: e => { if (e.target.checked) ls.removeItem('gp.accent'); else ls.setItem('gp.accent', color.value); color.value = rgbToHex(applyColors()); } });
  const glass = (key, label, min, max, step, def, show) => rangeRow(label, +(ls.getItem(key) ?? def), min, max, step, show, v => { ls.setItem(key, v); applyGlass(); });
  return [
    h('div', { class: 'set-row' }, h('span', { class: 'set-lbl' }, 'Background image (colours follow it)'),
      h('div', { class: 'line' }, h('button', { class: 'pill accent', onclick: () => $('#bgIn').click() }, 'Choose image…'),
        h('button', { class: 'pill', onclick: async () => { await db.del('kv', 'bg').catch(() => {}); applyBackground(); } }, 'Reset'))),
    h('div', { class: 'set-row' }, h('span', { class: 'set-lbl' }, h('span', {}, 'Accent from background'), auto),
      h('div', { class: 'line' }, color, h('div', { class: 'swatches' }, ['#e8a07a', '#ff6b9a', '#b18cff', '#6cc4ff', '#5fe0b4', '#f5d06b', '#ff5f5f', '#e6e6e6'].map(c =>
        h('button', { class: 'swatch', style: `background:${c}`, title: c, 'aria-label': `Accent ${c}`, onclick: () => { ls.setItem('gp.accent', c); auto.checked = false; color.value = c; applyColors(); } }))))),
    glass('gp.blur', 'Glass blur', 0, 40, 1, 18, v => v + 'px'),
    glass('gp.glass', 'Glass darkness', 0, .9, .02, .42, pct),
    glass('gp.dim', 'Background dim', 0, .9, .05, .55, pct),
    toggleRow('Glass effect', ls.getItem('gp.fxGlass') !== '0', 'Frosted see-through panels. Off is solid and lighter on slow PCs.', v => { ls.setItem('gp.fxGlass', v ? '1' : '0'); applyGlass(); }),
    toggleRow('Glow', ls.getItem('gp.fxGlow') !== '0', 'Glowing lyrics and cover in lyrics mode.', v => { ls.setItem('gp.fxGlow', v ? '1' : '0'); applyGlass(); }),
  ];
}

// ================= sound: media → bass → treble → balance → volume → fade → limiter =================
const SND_DEFAULT = { vol: .8, base: 1, bass: 0, treble: 0, pan: 0, fade: 250, curve: true, limiter: true, muted: false };
const snd = { ...SND_DEFAULT, ...(() => { try { return JSON.parse(ls.getItem('gp.sound') || '{}'); } catch { return {}; } })() };
if (!ls.getItem('gp.sound') && ls.getItem('gp.vol') != null) snd.vol = +ls.getItem('gp.vol'); // keep the old volume
const G = {};
const dbToGain = db => Math.pow(10, db / 20);
// natural curve: loudness is heard logarithmically, so squaring the slider makes each step sound even
const effGain = () => snd.muted ? 0 : (snd.curve ? snd.vol * snd.vol : snd.vol) * snd.base * dbToGain(S.now?.gainDb || 0);
function buildGraph() {
  if (G.ctx || G.failed) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(media);
    G.bass = Object.assign(ctx.createBiquadFilter(), { type: 'lowshelf' }); G.bass.frequency.value = 180;
    G.treble = Object.assign(ctx.createBiquadFilter(), { type: 'highshelf' }); G.treble.frequency.value = 3500;
    G.pan = ctx.createStereoPanner(); G.gain = ctx.createGain(); G.fade = ctx.createGain();
    G.gain.gain.value = effGain(); G.bass.gain.value = snd.bass; G.treble.gain.value = snd.treble; G.pan.pan.value = snd.pan;
    G.fade.gain.value = snd.fade ? 0 : 1; // gains default to 1 (full volume): start where the sliders are so the first second isn't loud
    G.lim = ctx.createDynamicsCompressor();
    G.lim.threshold.value = -1.5; G.lim.knee.value = 0; G.lim.ratio.value = 20; G.lim.attack.value = .002; G.lim.release.value = .2;
    src.connect(G.bass).connect(G.treble).connect(G.pan).connect(G.gain).connect(G.fade);
    G.ctx = ctx; wireLimiter(); applySound();
  } catch (e) { console.warn('sound graph', e); G.failed = true; }
}
function wireLimiter() {
  G.fade.disconnect(); G.lim.disconnect();
  if (snd.limiter) G.fade.connect(G.lim).connect(G.ctx.destination); else G.fade.connect(G.ctx.destination);
}
function applySound() {
  const g = effGain();
  if (G.ctx) {
    const t = G.ctx.currentTime; media.volume = 1; media.muted = false;
    G.gain.gain.setTargetAtTime(g, t, .02); G.bass.gain.setTargetAtTime(snd.bass, t, .02);
    G.treble.gain.setTargetAtTime(snd.treble, t, .02); G.pan.pan.setTargetAtTime(snd.pan, t, .02);
  } else { media.volume = Math.min(1, g); media.muted = snd.muted; }
  const vol = $('#vol'); vol.value = snd.vol; setRangeFill(vol);
  setIcon($('#muteBtn'), snd.muted || snd.vol === 0 ? 'mute' : snd.vol < .5 ? 'vol1' : 'vol');
  $('#muteBtn').setAttribute('aria-pressed', snd.muted);
}
let sndSaveT;
function setSound(patch) {
  const relimit = 'limiter' in patch && patch.limiter !== snd.limiter;
  Object.assign(snd, patch);
  if (relimit && G.ctx) wireLimiter();
  applySound();
  clearTimeout(sndSaveT); sndSaveT = setTimeout(() => ls.setItem('gp.sound', JSON.stringify(snd)), 250);
}
let fadeTok = 0, fadingOut = false;
function fadeIn() {
  if (!G.ctx) return;
  const p = G.fade.gain, t = G.ctx.currentTime; p.cancelScheduledValues(t);
  if (!snd.fade) return p.setValueAtTime(1, t);
  p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(1, t + snd.fade / 1000);
}
function pauseSmooth() {
  if (media.paused) return;
  if (!G.ctx || !snd.fade) return media.pause();
  const tok = ++fadeTok, p = G.fade.gain, t = G.ctx.currentTime; fadingOut = true;
  p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + snd.fade / 1000);
  setTimeout(() => { if (tok === fadeTok) { fadingOut = false; media.pause(); } }, snd.fade);
}
let gainSaveT;
function soundControls() {
  const t = S.now, set = k => v => setSound({ [k]: v });
  return [
    rangeRow('Volume', snd.vol, 0, 1, .01, pct, v => setSound({ vol: v, muted: false })),
    rangeRow('Base volume', snd.base, 0, 2, .05, pct, set('base'), 'Scales everything. Over 100% boosts quiet music.'),
    rangeRow(t ? `This song: ${t.title}` : 'This song (play one first)', t?.gainDb || 0, -12, 12, .5, dbFmt,
      v => { if (!S.now) return; S.now.gainDb = v; applySound(); clearTimeout(gainSaveT); const s = S.now; gainSaveT = setTimeout(() => saveTrack(s), 400); }, 'Remembered for this song only.', !t),
    rangeRow('Bass', snd.bass, -12, 12, .5, dbFmt, set('bass')),
    rangeRow('Treble', snd.treble, -12, 12, .5, dbFmt, set('treble')),
    rangeRow('Balance', snd.pan, -1, 1, .05, v => Math.abs(v) < .01 ? 'Centre' : `${v < 0 ? 'L' : 'R'} ${pct(Math.abs(v))}`, set('pan')),
    rangeRow('Fade in / out', snd.fade, 0, 2000, 50, v => v ? (v / 1000).toFixed(2) + ' s' : 'Off', set('fade'), 'Smooth start and pause.'),
    toggleRow('Natural volume curve', snd.curve, 'Each step of the slider sounds equally big.', set('curve')),
    toggleRow('Limiter', snd.limiter, 'Stops crackling when boosting.', set('limiter')),
    G.failed && h('small', { class: 'hint danger' }, 'Sound effects are unavailable on this device; volume still works.'),
  ].filter(Boolean);
}
function openSound(anchor, refresh) {
  menu(anchor, h('div', { class: 'settings' },
    h('div', { class: 'line' }, h('h3', {}, 'Sound'), h('div', { class: 'grow' }),
      h('button', { class: 'pill', onclick: () => setSound({ muted: !snd.muted }) || openSound(anchor, true) }, snd.muted ? 'Unmute' : 'Mute'),
      h('button', { class: 'pill', onclick: () => { setSound({ ...SND_DEFAULT, vol: snd.vol }); if (S.now?.gainDb) { S.now.gainDb = 0; saveTrack(S.now); applySound(); } openSound(anchor, true); } }, 'Reset')),
    ...soundControls()), '', refresh);
}

// ================= Discord Rich Presence (the Rust side talks to the local Discord app) =================
let rpcT, rpcLive = false, rpcWarned = false;
function discordSync(report) {
  if (!invoke || MOBILE) return;
  clearTimeout(rpcT); rpcT = setTimeout(async () => {
    const t = S.now, on = pref('discord', '1') === '1';
    if (!on && !rpcLive) return;
    const txt = s => String(s || '').padEnd(2).slice(0, 128); // Discord wants 2-128 characters
    const now = Date.now(), rate = media.playbackRate || 1, left = (media.duration - media.currentTime) / rate;
    const art = on && t && !media.paused ? await discordArt(t) : '';
    if (t !== S.now) return; // song changed while the cover was looked up; its own update follows
    const activity = on && t && !media.paused ? {
      // status_display_type 2: the member list says "Listening to <song>" (like Spotify), not "Listening to Lyre"
      type: 2, status_display_type: 2, details: txt(t.title), state: txt(t.artist || 'Unknown artist'),
      assets: { large_image: art || 'lyre', large_text: txt(t.album || t.title), ...(art && { small_image: 'lyre', small_text: 'Lyre' }) },
      ...(isFinite(left) && { timestamps: { start: Math.round(now - media.currentTime * 1000 / rate), end: Math.round(now + left * 1000) } }),
    } : null;
    try { await invoke('discord_activity', { activity }); rpcLive = !!activity; }
    catch (e) { console.warn('discord', e); if (report || !rpcWarned) toast(`Discord: ${e}`); rpcWarned = true; }
  }, report ? 0 : 1000); // Discord allows about 5 updates per 20 s
}
// Discord can only show covers from a web link, so find the album cover on Apple's public iTunes search (remembered per song)
async function discordArt(t) {
  if (t.artUrl !== undefined) return t.artUrl;
  if (pref('discordArt', '1') !== '1' || !t.title) return '';
  try {
    const r = await fetch('https://itunes.apple.com/search?' + new URLSearchParams({ term: `${t.artist || ''} ${t.title}`.trim(), entity: 'song', limit: 10 }));
    const hit = ((await r.json()).results || []).find(x => matchTracks([{ title: x.trackName, artist: x.artistName }], [t]).ids.length);
    t.artUrl = hit?.artworkUrl100?.replace('100x100bb', '512x512bb') || ''; saveTrack(t);
    return t.artUrl;
  } catch { return ''; } // offline: try again next time
}

// ================= playlist import: Spotify / YouTube Music sign-in, or an exported file =================
// Your app's client IDs from developer.spotify.com and console.cloud.google.com (a "Desktop app" OAuth client;
// Google says that type's secret can ship in the app). Register this redirect URI with both:
const REDIRECT = 'http://127.0.0.1:43117/callback';
const SPOTIFY_CLIENT_ID = '';
const GOOGLE_CLIENT_ID = '', GOOGLE_CLIENT_SECRET = '';
const SERVICES = {
  spotify: { name: 'Spotify', id: SPOTIFY_CLIENT_ID, dashboard: 'https://developer.spotify.com/dashboard',
    setup: `Needs Spotify Premium: Spotify only lets Premium accounts use apps like Lyre.\n\nOne-time setup, opened in your browser: Create app, add the Redirect URI ${REDIRECT}, tick "Web API", Save, then paste the app's Client ID here.`, auth: 'https://accounts.spotify.com/authorize', token: 'https://accounts.spotify.com/api/token', scope: 'playlist-read-private playlist-read-collaborative' },
  youtube: { name: 'YouTube Music', id: GOOGLE_CLIENT_ID, secret: GOOGLE_CLIENT_SECRET, dashboard: 'https://console.cloud.google.com/apis/credentials',
    setup: 'One-time setup, opened in your browser: enable "YouTube Data API v3", set up the OAuth consent screen (add yourself as a test user), then Create credentials > OAuth client ID > Desktop app. Paste the Client ID here.', auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/youtube.readonly' },
};
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokens = {}; // kept in memory only: nothing about the user's account is saved
async function signIn(svc) {
  const sv = SERVICES[svc];
  if (tokens[svc]?.exp > Date.now()) return tokens[svc].access;
  const id = sv.id || ls.getItem(`gp.${svc}Id`) || await setupClient(svc);
  const secret = sv.secret || ls.getItem(`gp.${svc}Secret`);
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48))), state = uid();
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const url = sv.auth + '?' + new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: REDIRECT, scope: sv.scope, state, code_challenge_method: 'S256', code_challenge: challenge });
  $('#toast').classList.remove('show');
  const wait = waitDialog(sv.name, url);
  let raw;
  try { raw = await invoke('oauth', { url }); } finally { wait.done(); }
  appWin?.setFocus().catch(() => {}); // back from the browser
  const q = new URLSearchParams(raw);
  if (q.get('state') !== state) throw new Error('sign-in was interrupted, try again');
  if (!q.get('code')) throw new Error(q.get('error') === 'access_denied' ? 'sign-in cancelled' : q.get('error') || 'sign-in failed');
  const r = await fetch(sv.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT, client_id: id, code_verifier: verifier, ...(secret ? { client_secret: secret } : {}) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || 'sign-in failed');
  tokens[svc] = { access: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return j.access_token;
}
// stays up while the browser sign-in runs, so it's clear Lyre is waiting (and how to retry)
function waitDialog(name, url) {
  const d = h('dialog', { class: 'glass modal' }, h('form', { method: 'dialog' }, h('h3', {}, `Sign in to ${name}`),
    h('p', { class: 'hint' }, `${name}'s sign-in page is open in your web browser. Sign in, press Agree, then come back here. If you can't see it:`),
    h('div', { class: 'line', style: 'margin-top:10px' },
      h('button', { class: 'pill', type: 'button', onclick: () => invoke('open_url', { url }).catch(e => toast(String(e))) }, 'Open it again'),
      h('button', { class: 'pill', type: 'button', onclick: () => navigator.clipboard.writeText(url).then(() => toast('Link copied: paste it into your browser')) }, 'Copy link')),
    h('div', { class: 'row' }, h('button', { class: 'pill', value: 'cancel' }, 'Cancel'))));
  let finished = false;
  d.addEventListener('close', () => { if (!finished) invoke('oauth_cancel'); d.remove(); }); // Cancel or Esc
  document.body.append(d); d.showModal();
  return { done: () => { finished = true; if (d.open) d.close(); } };
}
// the IDs in the code ship to everyone; this is for when they're empty (saved on this device only)
async function setupClient(svc) {
  const sv = SERVICES[svc];
  $('#toast').classList.remove('show');
  invoke('open_url', { url: sv.dashboard }).catch(() => {});
  const id = await ask(`Set up ${sv.name} sign-in`, { ok: 'Save', hint: sv.setup, max: MAX.id });
  if (!id) throw new Error('sign-in needs a client ID');
  if (svc === 'youtube') {
    const sec = await ask('Google client secret', { ok: 'Save', hint: 'Shown next to the Client ID in Google Cloud.', max: MAX.id });
    if (!sec) throw new Error('sign-in needs the client secret');
    ls.setItem('gp.youtubeSecret', sec);
  }
  ls.setItem(`gp.${svc}Id`, id);
  toast(`Sign in to ${sv.name} in your browser…`, true);
  return id;
}
async function apiAll(url, token, pick, nextOf) {
  const out = [];
  while (url && out.length < 10000) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const body = await r.text(); let j = {};
    try { j = JSON.parse(body); } catch {} // Spotify's 403 is plain text
    if (!r.ok) {
      const why = j.error?.message || body.trim().slice(0, 300) || `error ${r.status}`;
      throw new Error(r.status === 403 && url.startsWith(SP_API)
        ? `Spotify refused access (403): ${why}\n\nWhile a Spotify app is in Development Mode, Spotify only lets in accounts listed under your app's "User Management" on developer.spotify.com (up to 5), and the app's owner needs Spotify Premium. Add the Spotify account you signed in with there, then try again.`
        : why);
    }
    out.push(...pick(j)); url = nextOf(j);
  }
  return out;
}
const SP_API = 'https://api.spotify.com/v1', YT_API = 'https://www.googleapis.com/youtube/v3';
const ytNext = base => j => j.nextPageToken ? `${base}&pageToken=${j.nextPageToken}` : null;
const REMOTE = {
  spotify: {
    lists: tok => apiAll(`${SP_API}/me/playlists?limit=50`, tok, j => j.items.filter(Boolean).map(p => ({ id: p.id, name: p.name, n: p.items?.total ?? p.tracks?.total })), j => j.next),
    // Feb 2026 API: /items, each entry's song is in .item (older responses: .track); Spotify only returns songs of playlists you own or collaborate on
    songs: (tok, id) => apiAll(`${SP_API}/playlists/${id}/items?limit=50`, tok, j => (j.items || []).map(it => typeof it.item === 'object' && it.item || typeof it.track === 'object' && it.track).filter(t => t?.name)
      .map(t => ({ title: t.name, artist: (t.artists || []).map(a => a.name).join(', '), album: t.album?.name || '' })), j => j.next),
  },
  youtube: {
    lists: tok => { const u = `${YT_API}/playlists?part=snippet,contentDetails&mine=true&maxResults=50`; return apiAll(u, tok, j => (j.items || []).map(p => ({ id: p.id, name: p.snippet.title, n: p.contentDetails?.itemCount })), ytNext(u)); },
    songs: (tok, id) => { const u = `${YT_API}/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(id)}`;
      return apiAll(u, tok, j => (j.items || []).map(i => i.snippet).filter(x => x && !/^(Deleted|Private) video$/.test(x.title)).map(x => {
        const ch = x.videoOwnerChannelTitle || '';
        // YouTube Music songs come from "Artist - Topic" channels; music videos are usually titled "Artist - Song"
        return / - Topic$/.test(ch) || !x.title.includes(' - ') ? { title: x.title, artist: ch.replace(/ - Topic$/, ''), album: '' } : { ...splitDash(x.title), album: '' };
      }), ytNext(u)); },
  },
};
async function importFrom(svc) {
  closePanel(); closeMenu();
  if (svc === 'file') return $('#plIn').click();
  const sv = SERVICES[svc];
  try {
    toast(`Sign in to ${sv.name} in your browser…`, true);
    const tok = await signIn(svc);
    toast('Loading your playlists…', true);
    const lists = await REMOTE[svc].lists(tok);
    $('#toast').classList.remove('show');
    if (!lists.length) return toast(`No playlists found on your ${sv.name} account`);
    const pick = await choose(`Import from ${sv.name}`, lists.map(p => ({ label: p.name, sub: p.n != null ? `${p.n} songs` : '', value: p })),
      "Lyre makes a playlist from the songs you've already added and lists the rest, so you know what's missing.");
    if (!pick) return;
    toast(`Reading “${pick.name}”…`, true);
    const items = await REMOTE[svc].songs(tok, pick.id);
    if (!items.length) return toast(svc === 'spotify' ? 'Spotify only shares the songs of playlists you own or collaborate on' : 'That playlist is empty');
    makeImported(pick.name, items, sv.name);
  } catch (e) {
    console.warn(e); $('#toast').classList.remove('show');
    const msg = String(e.message || e);
    if (msg === 'sign-in cancelled') return toast('Sign-in cancelled');
    ask(`${sv.name} import didn't work`, { input: false, ok: 'OK', hint: msg }); // stays until closed, so the reason can be read
  }
}
function makeImported(name, items, from) {
  const { ids, missing } = matchTracks(items, [...S.tracks.values()]);
  const pl = { id: uid(), name: String(name).slice(0, MAX.playlist), trackIds: ids, missing: missing.map(m => ({ ...m, title: m.title.slice(0, MAX.title), artist: (m.artist || '').slice(0, MAX.artist) })), from, created: Date.now() };
  S.playlists.push(pl); savePl(pl); go({ type: 'playlist', id: pl.id });
  toast(`${name}: found ${ids.length} of ${items.length} songs in your library`);
}
// songs added later join the imported playlists they were missing from
function rematch() {
  for (const p of S.playlists) if (p.missing?.length) {
    const { ids, missing } = matchTracks(p.missing, [...S.tracks.values()]);
    if (ids.length) { p.trackIds.push(...ids.filter(id => !p.trackIds.includes(id))); p.missing = missing; savePl(p); }
  }
}
async function importPlaylistFile(f) {
  try {
    const { name, items } = parsePlaylistFile(decodeText(new Uint8Array(await f.arrayBuffer())), f.name);
    if (!items.length) return toast('No songs found in that file');
    makeImported(name, items, 'the file');
  } catch (e) { toast(e.message || String(e)); }
}
function choose(title, items, hint) {
  return new Promise(res => {
    const d = h('dialog', { class: 'glass modal' }, h('form', { method: 'dialog' }, h('h3', {}, title),
      h('div', { class: 'choose' }, items.map((it, i) => h('button', { class: 'menu-i', value: String(i) }, h('span', { class: 'ell grow' }, it.label), it.sub && h('small', { class: 'muted' }, it.sub)))),
      hint && h('p', { class: 'hint' }, hint),
      h('div', { class: 'row' }, h('button', { class: 'pill', value: 'cancel' }, 'Cancel'))));
    d.addEventListener('close', () => { res(/^\d+$/.test(d.returnValue) ? items[+d.returnValue].value : null); d.remove(); });
    document.body.append(d); d.showModal();
  });
}
const importMenu = () => [
  invoke && { label: 'Import from Spotify (needs Premium)…', action: () => importFrom('spotify') },
  invoke && { label: 'Import from YouTube Music…', action: () => importFrom('youtube') },
  { label: 'Import a playlist file…', action: () => importFrom('file') },
].filter(Boolean);

// ================= listening stats =================
let lastPos = 0, heard = 0, listenBuf = 0;
const listenSecs = () => +(ls.getItem('gp.listenSec') || 0) + listenBuf;
function trackListening() {
  const d = media.currentTime - lastPos; lastPos = media.currentTime;
  if (media.paused || d <= 0 || d > 1.5 || !S.now) return;
  heard += d; listenBuf += d;
  if (listenBuf > 10) { ls.setItem('gp.listenSec', Math.round(listenSecs())); listenBuf = 0; }
  if (!S.counted && heard >= Math.min(30, (media.duration || 60) * .5)) {
    S.counted = true; const t = S.now;
    t.plays = (t.plays || 0) + 1; t.lastPlayed = Date.now(); saveTrack(t);
    const r = recentIds().filter(id => id !== t.id); r.unshift(t.id); ls.setItem('gp.recent', JSON.stringify(r.slice(0, 30)));
  }
}
const recentIds = () => { try { return JSON.parse(ls.getItem('gp.recent') || '[]'); } catch { return []; } };

// ================= profile =================
const profile = () => { try { const p = { name: 'Listener', tagline: '', ...JSON.parse(ls.getItem('gp.profile') || '{}') }; return { name: String(p.name).slice(0, MAX.name), tagline: String(p.tagline).slice(0, MAX.tagline) }; } catch { return { name: 'Listener', tagline: '' }; } };
let avatarUrl = null;
async function loadAvatar() {
  let b = null; try { b = await db.get('kv', 'avatar'); } catch {}
  if (avatarUrl) URL.revokeObjectURL(avatarUrl);
  avatarUrl = b ? URL.createObjectURL(b) : null;
  $('#profileBtn').replaceChildren(avatarEl('sm'));
  if (S.view.type === 'profile' || S.view.type === 'settings') renderMain();
}
const avatarEl = cls => h('div', { class: `avatar ${cls}` }, avatarUrl ? h('img', { src: avatarUrl, alt: '' }) : ((profile().name.trim()[0] || '?').toUpperCase()));
async function setAvatar(f) {
  if (!f?.type.startsWith('image/')) return toast('Pick an image');
  await db.put('kv', await shrinkCover(f), 'avatar').catch(() => toast('Not enough storage for that image'));
  loadAvatar();
}
async function editProfile() {
  const p = profile();
  const name = await ask('Your name', { value: p.name, ok: 'Next', max: MAX.name }); if (name == null) return;
  const tagline = await ask('Tagline (optional)', { value: p.tagline, ok: 'Save', hint: 'A short line under your name, like your favourite genre.', max: MAX.tagline }); if (tagline == null) return;
  ls.setItem('gp.profile', JSON.stringify({ name: name || 'Listener', tagline }));
  loadAvatar(); renderMain();
}
const stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, String(value)), h('span', {}, label));
function profileView() {
  const p = profile(), tracks = [...S.tracks.values()];
  const plays = tracks.reduce((s, t) => s + (t.plays || 0), 0);
  const top = tracks.filter(t => t.plays).sort((a, b) => b.plays - a.plays || b.lastPlayed - a.lastPlayed).slice(0, 8).map(t => t.id);
  const artists = new Map(); for (const t of tracks) if (t.plays && t.artist) artists.set(t.artist, (artists.get(t.artist) || 0) + t.plays);
  const topArtists = [...artists].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const recent = recentIds().filter(id => S.tracks.has(id)).slice(0, 8);
  const songList = ids => h('div', { class: 'albums compact static' }, ids.map((id, i) => card(S.tracks.get(id), i, ids, null)));
  return h('div', { class: 'view page' },
    h('div', { class: 'profile-head' },
      h('button', { class: 'avatar-btn', title: 'Change picture', 'aria-label': 'Change profile picture', onclick: () => $('#avIn').click() }, avatarEl('xl')),
      h('div', { class: 'pl-info' }, h('small', {}, 'Profile'), h('h1', {}, p.name), p.tagline && h('div', { class: 'meta' }, p.tagline),
        h('div', { class: 'line', style: 'margin-top:14px' }, h('button', { class: 'pill', onclick: editProfile }, icon('edit'), 'Edit profile'),
          h('button', { class: 'pill', onclick: () => $('#avIn').click() }, 'Change picture'),
          avatarUrl && h('button', { class: 'pill', onclick: async () => { await db.del('kv', 'avatar').catch(() => {}); loadAvatar(); } }, 'Remove picture')))),
    h('div', { class: 'stats' },
      stat('Songs', S.tracks.size), stat('Playlists', S.playlists.filter(x => !x.special).length),
      stat('Liked', liked().trackIds.filter(id => S.tracks.has(id)).length), stat('Plays', plays), stat('Listening', fmtLong(listenSecs()))),
    h('section', { class: 'section' }, h('h2', {}, 'Top songs'), top.length ? songList(top) : h('p', { class: 'muted' }, 'Play some music: your most played songs show up here.')),
    topArtists.length > 0 && h('section', { class: 'section' }, h('h2', {}, 'Top artists'),
      h('div', { class: 'line' }, topArtists.map(([a, n]) => h('button', { class: 'pill', onclick: () => { $('#q').value = a; go({ type: 'search', q: a }); } }, a, h('span', { class: 'muted' }, `${n} play${n === 1 ? '' : 's'}`))))),
    recent.length > 0 && h('section', { class: 'section' }, h('h2', {}, 'Recently played'), songList(recent)),
    h('p', { class: 'muted small' }, 'Your profile and stats are stored only on this device.'));
}

// ================= settings page =================
const SHORTCUTS = [['Space', 'Play / pause'], ['← →', 'Seek 5 seconds'], ['Shift + ← →', 'Previous / next song'], ['↑ ↓', 'Volume (Crate: browse, pick a song)'], ['Enter', 'Crate: open / play'], ['→', 'Crate: track list'], ['M', 'Mute'], ['S', 'Shuffle'], ['R', 'Repeat'], ['L', 'Like song'], ['F', 'Lyrics mode'], ['F11', 'Full screen'], ['/', 'Search'], ['Esc', 'Back']];
function applyLyrScale() { document.documentElement.style.setProperty('--lyr', ls.getItem('gp.lyrScale') || 1); }
async function deleteAll() {
  if (!await ask(`Delete all ${S.tracks.size} songs and your playlists?`, { input: false, ok: 'Delete everything', hint: 'This empties Lyre. The original files on your device are not touched.' })) return;
  stop();
  for (const s of ['tracks', 'playlists']) await req((await os(s, 'readwrite')).clear()).catch(() => {});
  coverUrls.forEach(u => URL.revokeObjectURL(u)); coverUrls.clear(); S.tracks.clear(); S.queue = []; S.history = [];
  const l = { id: 'liked', name: 'Liked Songs', trackIds: [], special: true, created: 0 }; S.playlists = [l]; savePl(l);
  ls.setItem('gp.recent', '[]'); renderLibrary(); renderMain(); toast('Library emptied');
}
// sleep timer lasts this session only
const sleep = { v: '0', t: 0 };
function setSleep(v) {
  clearTimeout(sleep.t); sleep.v = v;
  if (v === 'end') return toast('Stopping after this song');
  if (v === '0') return toast('Sleep timer off');
  sleep.t = setTimeout(() => { sleep.v = '0'; pauseSmooth(); toast('Sleep timer: paused'); }, v * 60000);
  toast(`Pausing in ${v} min`);
}
const playbackRows = () => [
  h('label', { class: 'set-row' }, h('span', { class: 'set-lbl' }, 'Sleep timer'),
    h('select', { onchange: e => setSleep(e.target.value) },
      [['0', 'Off'], ['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 hour'], ['90', '1½ hours'], ['end', 'End of this song']].map(([v, l]) => h('option', { value: v, selected: sleep.v === v }, l)))),
  invoke && !MOBILE && toggleRow('Show in Discord', pref('discord', '1') === '1', "Shows the song you're playing on your Discord profile. Needs the Discord app open on this PC.",
    v => { ls.setItem('gp.discord', v ? '1' : '0'); discordSync(v); }),
  invoke && !MOBILE && toggleRow('Album cover in Discord', pref('discordArt', '1') === '1', "Finds the song's cover online so Discord can show it. Sends title & artist to Apple's iTunes search.",
    v => { ls.setItem('gp.discordArt', v ? '1' : '0'); discordSync(); }),
  h('label', { class: 'set-row' }, h('span', { class: 'set-lbl' }, 'Playback speed'),
    h('select', { onchange: e => { ls.setItem('gp.speed', e.target.value); media.playbackRate = +e.target.value; } },
      ['0.5', '0.75', '1', '1.25', '1.5', '2'].map(v => h('option', { value: v, selected: (ls.getItem('gp.speed') || '1') === v }, v + '×')))),
  toggleRow('Resume last song on launch', ls.getItem('gp.resume') !== '0', 'Opens on the song you were playing (paused).', v => ls.setItem('gp.resume', v ? '1' : '0')),
  toggleRow('Compact playlists', ls.getItem('gp.compact') === '1', 'Small covers with names beside them (Classic layout).', v => ls.setItem('gp.compact', v ? '1' : '0')),
  toggleRow('Find lyrics online', onlineLyrics(), 'Sends song title & artist to lrclib.net.', v => ls.setItem('gp.onlineLyrics', v ? '1' : '0')),
  rangeRow('Lyrics size', +(ls.getItem('gp.lyrScale') || 1), .8, 1.6, .05, pct, v => { ls.setItem('gp.lyrScale', v); applyLyrScale(); }),
];
function libraryRows() {
  const storage = h('span', { class: 'muted' }, 'Checking storage…');
  navigator.storage?.estimate?.().then(e => { storage.textContent = `${(e.usage / 1048576).toFixed(0)} MB used · ${(e.quota / 1073741824).toFixed(0)} GB available`; }).catch(() => { storage.textContent = ''; });
  return [h('b', {}, `${S.tracks.size} songs · ${S.playlists.filter(x => !x.special).length} playlists`), storage,
    h('div', { class: 'line' }, h('button', { class: 'pill accent', onclick: () => pickFiles() }, '+ Add files'), !MOBILE && h('button', { class: 'pill', onclick: () => pickFiles(null, true) }, '+ Add a folder'),
      h('button', { class: 'pill', onclick: () => { closePanel(); createPlaylist(); } }, 'New playlist'),
      h('button', { class: 'pill danger', onclick: deleteAll }, icon('trash'), 'Delete all music')),
    h('div', { class: 'set-lbl' }, 'Import playlists'),
    h('div', { class: 'line' }, importMenu().map(it => h('button', { class: 'pill', onclick: it.action }, it.label.replace('…', ''))),
      ['spotify', 'youtube'].some(k => ls.getItem(`gp.${k}Id`)) && h('button', { class: 'pill', title: 'Forget the client IDs pasted on this device', onclick: e => {
        for (const k of ['gp.spotifyId', 'gp.youtubeId', 'gp.youtubeSecret']) ls.removeItem(k); e.currentTarget.remove(); toast('Sign-in setup cleared'); } }, 'Reset sign-in setup')),
    h('small', { class: 'hint' }, 'Lyre matches the songs to music you have added. Apple Music or iTunes: File > Library > Export Playlist, then import the file. Other services: export a CSV (for example with Exportify or TuneMyMusic). Spotify: needs Spotify Premium (Spotify\'s rule for apps like Lyre), and it only shares playlists you own or collaborate on. No Premium? Export a CSV and import the file instead.')];
}

// ================= wiring =================
function bindStatic() {
  const icons = { menuBtn: 'menu', homeBtn: 'home', searchIc: 'search', themeBtn: 'gear', imBtn: 'lyrics', imBtn2: 'lyrics', fsBtn: 'fs', pLike: 'heart', soundBtn: 'sliders', shufBtn: 'shuffle', prevBtn: 'prev', nextBtn: 'next', createBtn: 'plus' };
  for (const [id, n] of Object.entries(icons)) setIcon($('#' + id), n);
  $('#backBtn').append(icon('back'), 'Back');
  $('#addBtn').append(icon('plus'), h('span', { class: 'txt' }, 'Add music'));
  $('#createBtn').append('Create');
  $$('#winBtns [data-win]').forEach((b, i) => setIcon(b, ['min', 'max', 'close'][i]));

  if (appWin && !MOBILE) {
    $('#winBtns').hidden = false;
    $$('#winBtns [data-win]').forEach(b => b.onclick = () => appWin[b.dataset.win]());
  }
  $('#menuBtn').onclick = () => document.body.classList.toggle('drawer');
  document.body.addEventListener('click', e => { if (e.target === document.body) document.body.classList.remove('drawer'); });
  $('#homeBtn').onclick = () => { $('#q').value = ''; go({ type: 'home' }); };
  $('#backBtn').onclick = back;
  $('#addBtn').onclick = e => menu(e.currentTarget, [
    { label: 'Add files…', action: () => pickFiles(S.view.type === 'playlist' && !getPl(S.view.id)?.special ? S.view.id : null) },
    !MOBILE && { label: 'Add a folder…', action: () => pickFiles(S.view.type === 'playlist' && !getPl(S.view.id)?.special ? S.view.id : null, true) },
    { label: 'New playlist…', action: () => createPlaylist() },
    { header: 'Import a playlist' }, ...importMenu(),
  ].filter(Boolean));
  $('#addFilesBtn').onclick = () => pickFiles();
  $('#addFolderBtn').onclick = () => pickFiles(null, true);
  if (MOBILE) $('#addFolderBtn').hidden = true;
  $('#createBtn').onclick = () => createPlaylist();
  $('#themeBtn').onclick = () => spEl ? closePanel() : openPanel();
  $('#imBtn').onclick = $('#imBtn2').onclick = () => setImmersive(!document.body.classList.contains('immersive'));
  $('#fsBtn').onclick = toggleFull;
  $('#pLike').onclick = () => toggleLike(S.now);
  $('#playBtn').onclick = toggle; $('#nextBtn').onclick = () => next(); $('#prevBtn').onclick = prev;
  $('#shufBtn').onclick = () => { setShuffle(!S.shuffle); toast('Shuffle ' + (S.shuffle ? 'on' : 'off')); };
  $('#repBtn').onclick = () => { S.repeat = { off: 'all', all: 'one', one: 'off' }[S.repeat]; syncModes(); toast('Repeat ' + S.repeat); };
  $('#fileIn').onchange = $('#dirIn').onchange = e => { const f = [...e.target.files]; e.target.value = ''; importFiles(f); };
  $('#bgIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) setBackground(f); };

  let qT; $('#q').addEventListener('input', e => { clearTimeout(qT); qT = setTimeout(() => {
    const q = e.target.value.trim();
    if (q) go({ type: 'search', q }, S.view.type === 'search'); else if (S.view.type === 'search') back();
  }, 160); });

  const seek = $('#seek');
  seek.addEventListener('input', () => { seeking = true; setRangeFill(seek); if (media.duration) $('#tCur').textContent = fmt(seek.value / 1000 * media.duration); });
  seek.addEventListener('change', () => { seeking = false; if (media.duration) media.currentTime = seek.value / 1000 * media.duration; });
  const vol = $('#vol');
  vol.addEventListener('input', () => setSound({ vol: +vol.value, muted: false }));
  $('#muteBtn').onclick = () => setSound({ muted: !snd.muted });
  $('#soundBtn').onclick = e => openSound(e.currentTarget);
  $('#profileBtn').onclick = e => menu(e.currentTarget, [
    { label: 'Profile', action: () => go({ type: 'profile' }) },
    { label: 'Settings', action: () => openPanel() },
    { label: 'Sound…', action: () => openSound($('#soundBtn')) },
  ]);
  $('#plIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importPlaylistFile(f); };
  $('#themeIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importTheme(f); };
  $('#avIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) setAvatar(f); };
  applySound(); syncModes(); applyLyrScale();

  addEventListener('keydown', e => {
    if (e.target.closest('input:not(#vol):not(#seek),textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (spEl) { if (k === 'escape') { e.preventDefault(); closePanel(); } return; }
    if ((k !== 'enter' || !e.target.closest('button,[role=button]') || e.target.closest('.crate')) && crateKey(k)) { e.preventDefault(); return; }
    const volBy = d => setSound({ vol: Math.round(Math.min(1, Math.max(0, snd.vol + d)) * 100) / 100, muted: false });
    const act = {
      ' ': toggle, k: toggle, m: () => setSound({ muted: !snd.muted }), s: () => $('#shufBtn').click(), r: () => $('#repBtn').click(), l: () => S.now && toggleLike(S.now),
      f: () => setImmersive(!document.body.classList.contains('immersive')), f11: toggleFull, escape: () => openMenu ? closeMenu() : back(),
      arrowright: () => e.shiftKey ? next() : seekBy(5), arrowleft: () => e.shiftKey ? prev() : seekBy(-5),
      arrowup: () => volBy(.05), arrowdown: () => volBy(-.05), '/': () => $('#q').focus(),
    }[k];
    if (act && !(k === ' ' && e.target.closest('button,[role=button]'))) { e.preventDefault(); act(); }
  });

  if ('mediaSession' in navigator) for (const [a, f] of [['play', () => media.play()], ['pause', pauseSmooth], ['previoustrack', prev], ['nexttrack', () => next()],
    ['seekbackward', () => seekBy(-10)], ['seekforward', () => seekBy(10)], ['seekto', d => { media.currentTime = d.seekTime; }]]) try { navigator.mediaSession.setActionHandler(a, f); } catch {}

  // drag & drop anywhere (music, folders, .lrc lyrics, or an image straight onto the background)
  let depth = 0; const hasFiles = e => e.dataTransfer?.types.includes('Files');
  addEventListener('dragenter', e => { if (hasFiles(e)) { depth++; document.body.classList.add('dragging'); } });
  addEventListener('dragleave', e => { if (hasFiles(e) && --depth <= 0) { depth = 0; document.body.classList.remove('dragging'); } });
  addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
    const files = await filesFromDrop(e.dataTransfer);
    if (files.length === 1 && files[0].type.startsWith('image/')) return setBackground(files[0]);
    if (files.length === 1 && /\.css$/i.test(files[0].name)) return importTheme(files[0]);
    if (files.length === 1 && /\.(csv|m3u8?)$/i.test(files[0].name)) return importPlaylistFile(files[0]);
    importFiles(files, S.view.type === 'playlist' && !getPl(S.view.id)?.special ? S.view.id : null);
  });
}

async function boot() {
  bindStatic(); applyGlass(); applyLook(); await applyTheme();
  try {
    const [tracks, pls] = await Promise.all([db.all('tracks'), db.all('playlists')]);
    tracks.forEach(t => S.tracks.set(t.id, t)); S.playlists = pls;
  } catch (e) { console.warn(e); toast('Saved library unavailable: songs last this session only'); }
  dedupeLibrary();
  if (!liked()) { const l = { id: 'liked', name: 'Liked Songs', trackIds: [], special: true, created: 0 }; S.playlists.push(l); savePl(l); }
  renderLibrary(); renderMain(); setLyrics(null, ''); updateNowUI();
  const last = S.tracks.get(ls.getItem('gp.last'));
  if (last && ls.getItem('gp.resume') !== '0') { S.queue = allIds(); load(last); }
  loadAvatar();
  applyBackground();
  checkUpdate();
}
// desktop only (no updater on mobile/browser): download quietly, then let the user pick when to restart
async function checkUpdate() {
  try {
    const u = await TAURI?.updater?.check();
    if (!u) return;
    await u.download();
    const d = h('dialog', { class: 'glass modal' }, h('form', { method: 'dialog' }, h('h3', {}, `Lyre ${u.version} is ready`),
      h('p', { class: 'hint' }, 'Restart to finish updating. Your library and settings stay.'),
      h('div', { class: 'row' }, h('button', { class: 'pill', value: 'later' }, 'Later'), h('button', { class: 'pill', value: 'now' }, 'Restart now'))));
    d.addEventListener('close', async () => {
      d.remove();
      if (d.returnValue !== 'now') return;
      try { await u.install(); await TAURI.process.relaunch(); } catch (e) { toast(`Update failed: ${e}`); }
    });
    document.body.append(d); d.showModal();
  } catch (e) { console.warn('update', e); } // offline or no release yet: try again next start
}
boot();
