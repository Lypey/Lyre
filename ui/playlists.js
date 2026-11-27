'use strict';
// Playlist import: read exported playlist files (CSV, Apple Music/iTunes .txt, .m3u) and match songs to the library.
// Plain script (globals for app.js) that also loads in Node for playlists.test.js.

// iTunes/Apple Music exports are UTF-16; everything else is UTF-8
function decodeText(u8) {
  const enc = u8[0] === 0xff && u8[1] === 0xfe ? 'utf-16le' : u8[0] === 0xfe && u8[1] === 0xff ? 'utf-16be' : 'utf-8';
  return new TextDecoder(enc).decode(u8).replace(/^﻿/, '');
}

function rows(text, d) {
  const out = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === d) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); out.push(row); }
  return out.filter(r => r.some(x => x.trim()));
}

// "Artist - Title" (file names, M3U titles, YouTube video titles)
function splitDash(s) {
  const i = s.indexOf(' - ');
  return i > 0 ? { artist: s.slice(0, i).trim(), title: s.slice(i + 3).trim() } : { artist: '', title: s.trim() };
}

/** -> { name, items: [{ title, artist, album }] } */
function parsePlaylistFile(text, fileName) {
  const name = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  if (/\.m3u8?$/i.test(fileName) || text.startsWith('#EXTM3U')) {
    const items = []; let inf = null;
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim(); if (!l) continue;
      if (l.startsWith('#EXTINF')) inf = l.replace(/^#EXTINF:[^,]*,/, '');
      else if (!l.startsWith('#')) {
        items.push({ ...splitDash(inf || l.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/^\d{1,3}[\s.\-]+/, '')), album: '' });
        inf = null;
      }
    }
    return { name, items };
  }
  const first = text.split(/\r?\n/, 1)[0];
  const table = rows(text, first.includes('\t') ? '\t' : ',');
  const head = (table.shift() || []).map(x => x.trim().toLowerCase());
  const col = re => head.findIndex(x => re.test(x));
  const ti = col(/^(track name|name|title|song|song name|track)$/), ai = col(/artist/), al = col(/^album( name| title)?$/);
  if (ti < 0) throw new Error('No song title column found (expected a header like "Track Name" or "Name")');
  return { name, items: table.map(r => ({ title: (r[ti] || '').trim(), artist: ai < 0 ? '' : (r[ai] || '').trim(), album: al < 0 ? '' : (r[al] || '').trim() })).filter(x => x.title) };
}

const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ');
const normTitle = s => {
  const t = fold(s).replace(/\s*[([][^)\]]*[)\]]/g, '') // (feat. x), [Official Video], (2011 Remaster)
    .replace(/\s+-\s+.*\b(remaster(ed)?|live|edit|version|mix|mono|stereo)\b.*$/, '').replace(/\s(feat|ft)\.?\s.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return t || fold(s).replace(/[^a-z0-9]+/g, ' ').trim();
};
// every artist named, so "A, B" matches a library song tagged "B"
const artistSet = s => new Set(fold(s).replace(/\s+-\s+topic$/, '').replace(/vevo$/, '').split(/\s*(?:,|;|\/|\band\b|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/)
  .map(a => a.replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean));

/** items: [{title, artist}], tracks: library tracks -> { ids: matched track ids in order, missing: items not found } */
function matchTracks(items, tracks) {
  const idx = new Map();
  for (const t of tracks) { const k = normTitle(t.title); if (!idx.has(k)) idx.set(k, []); idx.get(k).push(t); }
  const ids = [], missing = [];
  for (const it of items) {
    const cands = idx.get(normTitle(it.title)) || [], want = artistSet(it.artist);
    const hit = cands.find(t => { const have = artistSet(t.artist); return !want.size || !have.size || [...want].some(a => have.has(a)); });
    if (hit && !ids.includes(hit.id)) ids.push(hit.id); else if (!hit) missing.push(it);
  }
  return { ids, missing };
}

if (typeof module === 'object') module.exports = { decodeText, parsePlaylistFile, matchTracks, splitDash };
