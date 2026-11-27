// node ui/playlists.test.js
const assert = require('assert');
const { decodeText, parsePlaylistFile, matchTracks } = require('./playlists.js');

// Exportify / TuneMyMusic CSV with quoted commas
const csv = parsePlaylistFile('"Track URI","Track Name","Album Name","Artist Name(s)"\r\n"x","Hello, World","Alb","A, B"\r\n"y","Song ""Two""","","C"\r\n', 'Road Trip.csv');
assert.strictEqual(csv.name, 'Road Trip');
assert.deepStrictEqual(csv.items, [{ title: 'Hello, World', artist: 'A, B', album: 'Alb' }, { title: 'Song "Two"', artist: 'C', album: '' }]);

// Apple Music / iTunes "Export Playlist" .txt: UTF-16LE, tab separated
const txt = '﻿Name\tArtist\tComposer\tAlbum\r\nSong One\tArtist X\t\tAlbum Y\r\n';
const u16 = new Uint8Array([0xff, 0xfe, ...[...txt.slice(1)].flatMap(c => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])]);
assert.deepStrictEqual(parsePlaylistFile(decodeText(u16), 'Mix.txt').items, [{ title: 'Song One', artist: 'Artist X', album: 'Album Y' }]);

// M3U with and without #EXTINF
const m3u = parsePlaylistFile('#EXTM3U\n#EXTINF:200,Daft Punk - One More Time\nC:\\Music\\x.mp3\n/music/03 - Bob - Tune.flac\n', 'p.m3u');
assert.deepStrictEqual(m3u.items.map(i => [i.artist, i.title]), [['Daft Punk', 'One More Time'], ['Bob', 'Tune']]);

assert.throws(() => parsePlaylistFile('foo,bar\n1,2', 'x.csv'), /title column/);

// matching: brackets, feat., accents, multi-artist, wrong artist
const lib = [
  { id: 1, title: 'One More Time', artist: 'Daft Punk' },
  { id: 2, title: 'Beyoncé Song (feat. Jay)', artist: 'Beyoncé' },
  { id: 3, title: 'Intro', artist: 'The xx' },
  { id: 4, title: 'Hello, World', artist: 'B' },
];
const r = matchTracks([
  { title: 'One More Time (Official Video)', artist: 'Daft Punk' },
  { title: 'Beyonce Song', artist: 'Beyonce, Jay' },
  { title: 'Intro', artist: 'M83' },
  { title: 'Hello, World', artist: 'A, B' },
  { title: 'Not Here', artist: 'Nobody' },
], lib);
assert.deepStrictEqual(r.ids, [1, 2, 4]);
assert.deepStrictEqual(r.missing.map(m => m.title), ['Intro', 'Not Here']);
assert.deepStrictEqual(matchTracks([{ title: 'Tune', artist: 'Topic Guy - Topic' }], [{ id: 9, title: 'Tune', artist: 'Topic Guy' }]).ids, [9]);
console.log('playlists ok');
