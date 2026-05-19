use std::path::PathBuf;
use std::sync::OnceLock;
use regex::Regex;

// ── Lazy regexes ──────────────────────────────────────────────────────────────

fn re_kda() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    // Match N/N/N not immediately surrounded by other digits or slashes
    R.get_or_init(|| Regex::new(r"(?<![/\d])(\d{1,2})/(\d{1,2})/(\d{1,2})(?![/\d])").unwrap())
}
fn re_level() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^\s*\d{1,2}\s+").unwrap())
}
fn re_junk() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    // Two or more consecutive chars that can't appear in a summoner name
    R.get_or_init(|| Regex::new(r"[^\w #'\.\-]{2,}").unwrap())
}
fn re_ws() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r" {2,}").unwrap())
}
fn re_cs_after_kda() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^\s+(\d{1,4})\b").unwrap())
}

// ── Public result types ───────────────────────────────────────────────────────

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OcrPlayerRow {
    pub name_raw: String,
    pub kills:    u32,
    pub deaths:   u32,
    pub assists:  u32,
    pub cs:       Option<u32>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrScoreboard {
    pub team1:    Vec<OcrPlayerRow>,
    pub team2:    Vec<OcrPlayerRow>,
    pub raw_text: String,
}

// ── Tesseract detection ───────────────────────────────────────────────────────

fn find_tesseract() -> Result<PathBuf, String> {
    // 1. In PATH
    if std::process::Command::new("tesseract")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Ok(PathBuf::from("tesseract"));
    }
    // 2. Default Windows install location
    let win = PathBuf::from(r"C:\Program Files\Tesseract-OCR\tesseract.exe");
    if win.exists() {
        return Ok(win);
    }
    Err(
        "Tesseract OCR not found. \
         Install it from https://github.com/UB-Mannheim/tesseract/wiki \
         then restart the app."
            .into(),
    )
}

// ── Main entry point (async) ──────────────────────────────────────────────────

pub async fn process_url(url: &str) -> Result<OcrScoreboard, String> {
    let tess = find_tesseract()?;

    // Download the image
    let resp = reqwest::get(url)
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();

    // Run Tesseract on a blocking thread (it's a subprocess)
    let raw = tokio::task::spawn_blocking(move || run_tesseract(&tess, &bytes))
        .await
        .map_err(|e| e.to_string())??;

    eprintln!("[OCR] Raw text:\n{raw}");
    parse(&raw)
}

// ── Tesseract subprocess ──────────────────────────────────────────────────────

fn run_tesseract(tess: &PathBuf, image: &[u8]) -> Result<String, String> {
    let dir    = std::env::temp_dir();
    let input  = dir.join("cea_ocr_input.png");
    let output = dir.join("cea_ocr_output"); // tesseract appends .txt

    std::fs::write(&input, image)
        .map_err(|e| format!("Failed to write temp image: {e}"))?;

    let result = std::process::Command::new(tess)
        .args([
            input.to_str().unwrap(),
            output.to_str().unwrap(),
            "--psm", "6",   // uniform block of text
            "--oem", "3",   // LSTM + legacy
            "-l", "eng",
        ])
        .output()
        .map_err(|e| format!("Failed to launch Tesseract: {e}"))?;

    let _ = std::fs::remove_file(&input);

    if !result.status.success() {
        let msg = String::from_utf8_lossy(&result.stderr);
        return Err(format!("Tesseract error: {msg}"));
    }

    let txt_path = dir.join("cea_ocr_output.txt");
    let text = std::fs::read_to_string(&txt_path)
        .map_err(|e| format!("Failed to read Tesseract output: {e}"))?;
    let _ = std::fs::remove_file(txt_path);
    Ok(text)
}

// ── Parsing ───────────────────────────────────────────────────────────────────

pub fn parse(text: &str) -> Result<OcrScoreboard, String> {
    // Split on "TEAM 2" to separate the two halves of the scoreboard
    let lower    = text.to_lowercase();
    let split_at = lower.find("team 2")
        .or_else(|| lower.find("team2"))
        .ok_or_else(|| format!("Could not find 'TEAM 2' in OCR output:\n{text}"))?;

    let team1 = extract_rows(&text[..split_at]);
    let team2 = extract_rows(&text[split_at..]);

    Ok(OcrScoreboard { team1, team2, raw_text: text.to_string() })
}

fn extract_rows(block: &str) -> Vec<OcrPlayerRow> {
    let mut rows = Vec::new();
    for line in block.lines() {
        if let Some(row) = parse_line(line) {
            // Skip team-total rows: their K+D+A is the sum of all 5 players
            if row.kills + row.deaths + row.assists <= 80 {
                rows.push(row);
            }
        }
        if rows.len() == 5 {
            break;
        }
    }
    rows
}

fn parse_line(line: &str) -> Option<OcrPlayerRow> {
    let kda_m    = re_kda().find(line)?;
    let kda_caps = re_kda().captures(line)?;

    let kills:   u32 = kda_caps[1].parse().ok()?;
    let deaths:  u32 = kda_caps[2].parse().ok()?;
    let assists: u32 = kda_caps[3].parse().ok()?;

    let before = &line[..kda_m.start()];
    let after  = &line[kda_m.end()..];

    let name_raw = clean_name(before);
    if name_raw.is_empty() {
        return None;
    }

    let cs = re_cs_after_kda()
        .captures(after)
        .and_then(|c| c[1].parse::<u32>().ok());

    Some(OcrPlayerRow { name_raw, kills, deaths, assists, cs })
}

// Strip the level number prefix then remove icon-garbage characters.
fn clean_name(prefix: &str) -> String {
    let s = re_level().replace(prefix.trim(), "");
    let s = re_junk().replace_all(&s, " ");
    let s = re_ws().replace_all(s.trim(), " ");
    s.trim().to_string()
}
