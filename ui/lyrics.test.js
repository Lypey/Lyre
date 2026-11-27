// node ui/lyrics.test.js
const assert = require('assert');
const { parseLyrics, syllables } = require('./lyrics.js');

assert.deepStrictEqual(syllables('beautiful'), ['beau', 'ti', 'ful']);
assert.deepStrictEqual(syllables('hello,'), ['hel', 'lo,']);
assert.strictEqual(syllables('strengths').join(''), 'strengths'); // no letters lost
assert.deepStrictEqual(syllables('hmm'), ['hmm']);
assert.deepStrictEqual(syllables('你好'), ['你', '好']);

// line-timed LRC: syllables fill the line in order and never pass the next line
const a = parseLyrics('[ar:Someone]\n[00:01.00]Hello beautiful world\n[00:03.00]Next');
assert.ok(a.synced);
const sy = a.lines[0].sy;
assert.deepStrictEqual(sy.map(s => s.text), ['Hel', 'lo', 'beau', 'ti', 'ful', 'world']);
assert.strictEqual(sy[0].t0, 1);
for (let i = 1; i < sy.length; i++) assert.ok(Math.abs(sy[i].t0 - sy[i - 1].t1) < 1e-9);
assert.ok(sy.at(-1).t1 <= 3 + 1e-9);
assert.strictEqual(a.lines[0].syl.filter(o => o.sp).length, 2); // two spaces between three words
assert.ok(sy.at(-1).t1 > 2.7); // fills the gap to the next line, minus a short breath
// a long instrumental gap doesn't stretch the line: 2 syllables -> ~1.6 s, not 20 s
const g = parseLyrics('[00:00.00]Hello\n[00:20.00]Next').lines[0].sy;
assert.ok(Math.abs(g.at(-1).t1 - 1.6) < 1e-9);

// Enhanced LRC: word stamps are used, and stamps are stripped from the text
const b = parseLyrics('[offset:+0]\n[00:10.00]<00:10.00>Hel<00:10.50>lo <00:11.00>you<00:12.00>');
const l = b.lines[0];
assert.strictEqual(l.text, 'Hello you');
assert.deepStrictEqual(l.sy.map(s => [s.text, s.t0, s.t1]), [['Hel', 10, 10.5], ['lo', 10.5, 11], ['you', 11, 12]]);

// plain lyrics stay untimed
const c = parseLyrics('just words\nmore');
assert.ok(!c.synced && !c.lines[0].syl);

console.log('lyrics ok');
