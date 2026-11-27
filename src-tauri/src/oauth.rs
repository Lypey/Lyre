//! Sign-in for playlist import: open the service's login page in the browser, then catch its redirect
//! to http://127.0.0.1:43117/callback (register exactly that redirect URI with Spotify / Google).
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicU64, Ordering::SeqCst};
use std::time::{Duration, Instant};

const PORT: u16 = 43117;
/// Bumped by every new sign-in and by Cancel; a waiting sign-in stops when it no longer matches.
static ATTEMPT: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub fn oauth_cancel() {
    ATTEMPT.fetch_add(1, SeqCst);
}

fn open_browser(url: &str) -> std::io::Result<std::process::Child> {
    #[cfg(windows)]
    return std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn();
    #[cfg(target_os = "macos")]
    return std::process::Command::new("open").arg(url).spawn();
    #[cfg(not(any(windows, target_os = "macos")))]
    return std::process::Command::new("xdg-open").arg(url).spawn();
}

/// Opens an https page in the user's browser (the developer dashboards for sign-in setup).
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("only https pages".into());
    }
    open_browser(&url).map(|_| ()).map_err(|e| e.to_string())
}

/// Returns the callback's query string (`code=...&state=...` or `error=...`).
#[tauri::command]
pub async fn oauth(url: String) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("sign-in pages must be https".into());
    }
    let me = ATTEMPT.fetch_add(1, SeqCst) + 1; // also stops an older sign-in that is still waiting
    tauri::async_runtime::spawn_blocking(move || {
        // the older sign-in lets go of the port within a poll (150 ms)
        let l = (0..20)
            .find_map(|_| TcpListener::bind(("127.0.0.1", PORT)).map_err(|_| std::thread::sleep(Duration::from_millis(100))).ok())
            .ok_or("port 43117 is in use by another program")?;
        l.set_nonblocking(true).map_err(|e| e.to_string())?;
        open_browser(&url).map_err(|e| format!("couldn't open the browser: {e}"))?;
        let end = Instant::now() + Duration::from_secs(300);
        while Instant::now() < end {
            if ATTEMPT.load(SeqCst) != me {
                return Err("sign-in cancelled".into());
            }
            match l.accept() {
                Ok((mut s, _)) => {
                    s.set_nonblocking(false).ok(); // accepted sockets inherit non-blocking on Windows
                    s.set_read_timeout(Some(Duration::from_secs(5))).ok();
                    let mut buf = [0u8; 8192];
                    let n = s.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let Some(q) = req.split_whitespace().nth(1).and_then(|p| p.strip_prefix("/callback?")) else {
                        let _ = s.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                        continue;
                    };
                    let body = "<!doctype html><meta charset=utf-8><title>Lyre</title><body style='font:18px system-ui;background:#111;color:#eee;display:grid;place-items:center;height:90vh'>Done. You can close this tab and go back to Lyre.";
                    let _ = write!(s, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
                    return Ok(q.to_string());
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(150)),
                Err(e) => return Err(e.to_string()),
            }
        }
        Err("sign-in timed out".into())
    })
    .await
    .map_err(|e| e.to_string())?
}
