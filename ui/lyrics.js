'use strict';
// Lyrics parsing: plain text, LRC, Enhanced LRC (<mm:ss.xx> word stamps) and syllable timing.
// Plain script (globals for app.js) that also loads in Node for lyrics.test.js.
const lrcTime = (m, s) => +m * 60 + parseFloat(s.replace(':', '.'));

// rough syllables from vowel groups; CJK, kana and hangul are one syllable per character
function syllables(word) {
  if (/[぀-ヿ㐀-鿿가-힯]/.test(word)) return [...word];
  const parts = word.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi);
  if (!parts) return [word];
  const rest = word.slice(parts.join('').length); // trailing consonants after the last vowel
  if (rest) parts[parts.length - 1] += rest;
  return parts;
}

// shortcut: without word stamps a line is sung until just before the next line (a short breath),
// but never slower than ~0.55 s per syllable so instrumental gaps don't stretch it; exact timing needs Enhanced LRC
const estimate = (text, room) => {
  const n = text.split(/\s+/).filter(Boolean).flatMap(syllables).length;
  return Math.max(Math.min(.4, room), Math.min(room - Math.min(.35, room * .1), n * .55 + .5));
};

// -> [{ text, t0, t1 } | { sp: true }]: syllables in order, sp = a space between words
function timeLine(l, nextT = Infinity) {
  const segs = (l.segs || [{ t: null, text: l.text }]).map(s => ({ t: s.t ?? l.t, text: s.text }));
  const out = [];
  segs.forEach((s, k) => {
    const end = Math.max(s.t + .05, segs[k + 1]?.t ?? s.t + estimate(s.text, nextT - s.t));
    const syl = [];
    for (const tok of s.text.split(/(\s+)/)) {
      if (!tok) continue;
      if (/^\s/.test(tok)) { if (out.length && !out[out.length - 1].sp) out.push({ sp: true }); continue; }
      for (const x of syllables(tok)) { const o = { text: x }; syl.push(o); out.push(o); }
    }
    // longer syllables get more time
    const w = syl.map(o => Math.max(1, o.text.replace(/[^\p{L}\p{N}]/gu, '').length)), total = w.reduce((a, b) => a + b, 0);
    let t = s.t;
    syl.forEach((o, j) => { o.t0 = t; t += (end - s.t) * w[j] / total; o.t1 = t; });
  });
  if (out[out.length - 1]?.sp) out.pop();
  return out.length ? out : null;
}

function parseLyrics(text) {
  if (!text) return { lines: [], synced: false };
  const out = []; let offset = 0;
  for (const raw of text.split(/\r?\n/)) {
    const off = raw.match(/^\[offset:\s*([+-]?\d+)\]/i); if (off) { offset = +off[1] / 1000; continue; }
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    const body = raw.replace(/\[[^\]]*\]/g, '');
    const segs = [...body.matchAll(/<(\d+):(\d+(?:[.:]\d+)?)>([^<]*)/g)].map(m => ({ t: lrcTime(m[1], m[2]) - offset, text: m[3] }));
    if (segs.length && body.split('<')[0].trim()) segs.unshift({ t: null, text: body.split('<')[0] }); // text before the first word stamp
    const txt = body.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').replace(/\s+/g, ' ').trim();
    if (stamps.length) for (const s of stamps) out.push({ t: lrcTime(s[1], s[2]) - offset, text: txt, segs: segs.length ? segs : null });
    else if (!/^\[[a-z]+:.*\]$/i.test(raw.trim())) out.push({ t: null, text: raw.trim() });
  }
  const synced = out.some(l => l.t != null);
  const lines = synced ? out.filter(l => l.t != null).sort((a, b) => a.t - b.t) : out;
  while (lines.length && !lines[0].text && !synced) lines.shift();
  if (synced) lines.forEach((l, i) => { l.syl = timeLine(l, lines[i + 1]?.t); l.sy = l.syl?.filter(o => !o.sp) || null; });
  return { lines, synced };
}

if (typeof module === 'object') module.exports = { parseLyrics, syllables, timeLine };
