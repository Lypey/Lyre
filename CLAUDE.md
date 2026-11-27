# Lyre

- This folder (Downloads\MusicPlayer) is the real copy of Lyre. The copy in the OneDrive vault is old; don't edit it.
- After changes, build with `.\build.ps1`. It updates `release\` here with `Lyre.exe` and the installers.
- Keep the Tauri identifier `app.glassplayer.desktop`, the IndexedDB name `glass-player` and the `gp.*` localStorage keys. They still use the old name on purpose: changing them would make the saved library and settings disappear.
