//! Discord Rich Presence over Discord's local IPC pipe (the desktop Discord app must be running).
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::sync::Mutex;

/// Application ID from https://discord.com/developers/applications (your app's name is what Discord shows).
/// Upload the app icon there under Rich Presence > Art Assets with the key "lyre".
const CLIENT_ID: &str = "1575640275991138365";

#[cfg(windows)]
type Pipe = std::fs::File;
#[cfg(unix)]
type Pipe = std::os::unix::net::UnixStream;

#[derive(Default)]
pub struct Discord(Mutex<Option<Pipe>>);

fn open(i: u8) -> std::io::Result<Pipe> {
    #[cfg(windows)]
    return std::fs::OpenOptions::new().read(true).write(true).open(format!(r"\\.\pipe\discord-ipc-{i}"));
    // shortcut: Flatpak/Snap Discord keep the socket in a sub-folder; add those paths if Linux users ask
    #[cfg(unix)]
    {
        let dir = ["XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"].iter().find_map(|k| std::env::var(k).ok()).unwrap_or("/tmp".into());
        Pipe::connect(format!("{dir}/discord-ipc-{i}"))
    }
}

/// One frame each way: 4-byte opcode, 4-byte length (little endian), JSON.
fn send(p: &mut Pipe, op: u32, v: &Value) -> std::io::Result<(u32, Value)> {
    let body = v.to_string();
    let mut buf = Vec::with_capacity(8 + body.len());
    buf.extend(op.to_le_bytes());
    buf.extend((body.len() as u32).to_le_bytes());
    buf.extend(body.as_bytes());
    p.write_all(&buf)?;
    let mut head = [0u8; 8];
    p.read_exact(&mut head)?;
    let mut b = vec![0; u32::from_le_bytes(head[4..].try_into().unwrap()) as usize];
    p.read_exact(&mut b)?;
    Ok((u32::from_le_bytes(head[..4].try_into().unwrap()), serde_json::from_slice(&b).unwrap_or(Value::Null)))
}

fn connect() -> Result<Pipe, String> {
    let mut p = (0..10).find_map(|i| open(i).ok()).ok_or("Discord isn't running")?;
    match send(&mut p, 0, &json!({ "v": 1, "client_id": CLIENT_ID })) {
        Ok((1, _)) => Ok(p),
        Ok((_, v)) => Err(v["message"].as_str().unwrap_or("Discord refused the connection").into()),
        Err(e) => Err(e.to_string()),
    }
}

/// `activity` null clears the status.
#[tauri::command]
pub async fn discord_activity(state: tauri::State<'_, Discord>, activity: Value) -> Result<(), String> {
    if CLIENT_ID.is_empty() {
        return Err("no Discord application ID set in src-tauri/src/discord.rs".into());
    }
    let mut pipe = state.0.lock().unwrap();
    let msg = json!({ "cmd": "SET_ACTIVITY", "args": { "pid": std::process::id(), "activity": activity }, "nonce": format!("{:?}", std::time::Instant::now()) });
    // second try reconnects, in case Discord was restarted since the last update
    for _ in 0..2 {
        if pipe.is_none() {
            *pipe = Some(connect()?);
        }
        match send(pipe.as_mut().unwrap(), 1, &msg) {
            Ok((_, r)) if r["evt"] == "ERROR" => return Err(r["data"]["message"].as_str().unwrap_or("Discord error").into()),
            Ok(_) => return Ok(()),
            Err(_) => *pipe = None,
        }
    }
    Err("lost the connection to Discord".into())
}
