fn main() {
    // the .exe icon is embedded here; without this a new icon set is ignored until something else changes
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
