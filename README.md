# Lyre

Local music player: Rust (Tauri 2) core, glass UI, playlists, synced lyrics, theme from your background image.

- `ui/` the interface (plain HTML/CSS/JS, no build step)
- `src-tauri/` the Rust app (reads tags, cover art and embedded lyrics with `lofty`)

## Run / build

Needs Rust and Node (for the Tauri CLI via `npx`).

On Windows, `.\build.ps1` builds everything and copies `Lyre.exe` and the installers into `release\`.

```
cd src-tauri
npx @tauri-apps/cli@^2 dev      # run with live reload
npx @tauri-apps/cli@^2 build    # installers in target/release/bundle
cargo test                      # tag-reader tests (macOS/Linux/MSVC)
```

On the Windows GNU toolchain, test binaries linked with Tauri crash at start (no comctl32 v6 manifest), so run the tag tests from a tiny crate that only includes `src/tags.rs` (`#[path = ".../src/tags.rs"] mod tags;` with `lofty`, `base64`, `serde`).

The standalone `Lyre.exe` from a GNU build needs `WebView2Loader.dll` next to it (the installers already include it).

Platform notes:

- **Windows**: needs WebView2 (built into Windows 10/11). This PC builds with the GNU Rust toolchain plus WinLibs MinGW on PATH.
- **macOS**: build on a Mac (`xcode-select --install` first). Produces `.app` and `.dmg`.
- **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev`, then build. Produces `.deb`, `.rpm`, `.AppImage`. Install `gstreamer1.0-plugins-good/-bad/-libav` for MP3/AAC/MP4 playback.
- **Android**: install Android Studio + NDK, add `"cdylib"` back to `crate-type` in `src-tauri/Cargo.toml`, then `npx @tauri-apps/cli@^2 android init` and `... android build`.
- **iOS**: on a Mac with Xcode: `... ios init` and `... ios build`.

## Releasing (downloads + auto-update)

Downloads: https://github.com/Lypey/lyre/releases/latest

1. Raise `version` in `src-tauri/tauri.conf.json` (e.g. `1.0.1`).
2. `git commit -am "Lyre 1.0.1"`, then `git tag v1.0.1` and `git push --follow-tags`.
3. GitHub Actions builds Windows, macOS and Linux installers and publishes the release. Installed copies download the update at startup and offer a restart.

Updates are signed with `%USERPROFILE%\.tauri\lyre.key` (never commit it; back it up). Its contents are the `TAURI_SIGNING_PRIVATE_KEY` repo secret. If the key is lost, installed copies can't update anymore.

## Themes

A theme is one `.css` file with a small header (`@name`, `@mode light|dark`, `@accent`, `@text`, `@preview`). See `ui/themes/template.css`.

- **Add one in the app:** Settings > Theme > Import theme, or drop the `.css` file on the window. No rebuild needed.
- **Ship one built in:** put the file in `ui/themes/` and add its file name to `ui/themes/index.json`, then rebuild.

Built in: Glass (default), Frutiger Aero, Windows XP, Halftone Sepia, Halftone Noir. Each theme also styles lyrics mode, which takes its colours from the playing song's cover (the Halftone themes stay monochrome).

The Halftone themes turn any background image you pick into a toned halftone print, and a CD slides out of each album sleeve on hover (spinning while it plays).

They also switch Home to the **crate** layout (any theme can, with `@layout crate` in its header): album sleeves stacked like a record crate, an info box, and a "PLAY?" prompt with a gold CD.

- `↑` `↓` or the mouse wheel: browse albums · `Enter` or click the front sleeve: open
- Open: `↑` `↓` pick a song · `Enter` play · `→` track list · `←` / `Esc` / `Backspace` back
- Albums come from the album tag (year and track number are read by the Rust tag reader); songs with no album go under "Singles". Songs imported before this update have no year or track number until re-added.

## Lyrics

Lyrics light up syllable by syllable. With word-timed Enhanced LRC (`[00:12.00]<00:12.00>Hel<00:12.40>lo`) the timing is exact; plain LRC lines are split into syllables and timed by estimate. Self-check: `node ui/lyrics.test.js`.

## Where things are stored

Songs, covers, lyrics, playlists and the background image live in the app's own browser storage (IndexedDB) on each device; the original files are never changed. Online lyrics come from lrclib.net (title, artist, album, duration are sent); turn that off in the palette menu.
