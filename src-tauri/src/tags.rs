//! Tag reading with no Tauri dependency, so it can be tested on its own.
use base64::{engine::general_purpose::STANDARD, Engine};
use lofty::{
    file::{AudioFile, TaggedFileExt},
    picture::PictureType,
    probe::Probe,
    tag::{Accessor, ItemKey},
};
use serde::Serialize;
use std::io::Cursor;

/// What the UI needs from a music file's tags.
#[derive(Serialize, Default, Debug)]
pub struct Tags {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<u32>,
    track: Option<u32>,
    duration: f64,
    lyrics: Option<String>,
    cover: Option<String>, // base64
    cover_mime: Option<String>,
}

fn clean(s: Option<std::borrow::Cow<'_, str>>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn parse(bytes: &[u8]) -> Result<Tags, String> {
    let file = Probe::new(Cursor::new(bytes))
        .guess_file_type()
        .map_err(|e| e.to_string())?
        .read()
        .map_err(|e| e.to_string())?;
    let mut out = Tags {
        duration: file.properties().duration().as_secs_f64(),
        ..Default::default()
    };
    let Some(tag) = file.primary_tag().or_else(|| file.first_tag()) else {
        return Ok(out);
    };
    out.title = clean(tag.title());
    out.artist = clean(tag.artist());
    out.album = clean(tag.album());
    out.year = tag.year().filter(|y| *y > 0);
    out.track = tag.track().filter(|n| *n > 0);
    out.lyrics = tag
        .get_string(&ItemKey::Lyrics)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let pics = tag.pictures();
    if let Some(p) = pics
        .iter()
        .find(|p| p.pic_type() == PictureType::CoverFront)
        .or_else(|| pics.first())
    {
        out.cover = Some(STANDARD.encode(p.data()));
        out.cover_mime = p.mime_type().map(|m| m.as_str().to_string());
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::parse;

    fn wav(seconds: u32) -> Vec<u8> {
        let (rate, n) = (8000u32, 8000 * seconds);
        let mut b = Vec::new();
        b.extend(b"RIFF");
        b.extend((36 + n * 2).to_le_bytes());
        b.extend(b"WAVEfmt ");
        b.extend(16u32.to_le_bytes());
        b.extend(1u16.to_le_bytes()); // PCM
        b.extend(1u16.to_le_bytes()); // mono
        b.extend(rate.to_le_bytes());
        b.extend((rate * 2).to_le_bytes());
        b.extend(2u16.to_le_bytes());
        b.extend(16u16.to_le_bytes());
        b.extend(b"data");
        b.extend((n * 2).to_le_bytes());
        b.resize(b.len() + (n * 2) as usize, 0);
        b
    }

    #[test]
    fn reads_duration_of_untagged_wav() {
        let t = parse(&wav(2)).expect("wav parses");
        assert!((t.duration - 2.0).abs() < 0.01, "duration {}", t.duration);
        assert!(t.title.is_none() && t.cover.is_none());
    }

    #[test]
    fn reads_tags_cover_and_lyrics_from_mp3() {
        // ffmpeg can't write a real USLT lyrics frame, so add one with lofty first
        use lofty::{config::WriteOptions, file::TaggedFileExt, prelude::TagExt, probe::Probe, tag::ItemKey};
        let raw = include_bytes!("../tests/fixtures/tagged.mp3").to_vec();
        let file = Probe::new(std::io::Cursor::new(raw.clone())).guess_file_type().unwrap().read().unwrap();
        let mut tag = file.primary_tag().unwrap().clone();
        assert!(tag.insert_text(ItemKey::Lyrics, "[00:00.50]First line".into()));
        let mut buf = std::io::Cursor::new(raw);
        tag.save_to(&mut buf, WriteOptions::default()).unwrap();

        let t = parse(buf.get_ref()).expect("mp3 parses");
        assert_eq!(t.title.as_deref(), Some("Neon Rain"));
        assert_eq!(t.artist.as_deref(), Some("Test Band"));
        assert_eq!(t.album.as_deref(), Some("Glass Tests"));
        assert!((t.duration - 2.0).abs() < 0.2, "duration {}", t.duration);
        assert!(t.cover.as_deref().is_some_and(|c| c.len() > 100), "cover missing");
        assert_eq!(t.cover_mime.as_deref(), Some("image/png"));
        assert!(t.lyrics.as_deref().is_some_and(|l| l.contains("First line")), "lyrics {:?}", t.lyrics);
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse(b"definitely not audio").is_err());
    }
}
