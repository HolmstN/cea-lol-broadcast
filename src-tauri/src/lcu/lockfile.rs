use std::path::Path;
use sysinfo::{ProcessRefreshKind, RefreshKind, System};

/// Credentials extracted from the LCU process or lockfile.
#[derive(Debug, Clone)]
pub struct LcuCredentials {
    pub port: u16,
    pub password: String,
}

impl LcuCredentials {
    /// Parse credentials from lockfile content.
    /// Lockfile format: `processName:processId:port:password:protocol`
    pub fn from_lockfile_contents(contents: &str) -> Option<Self> {
        let parts: Vec<&str> = contents.trim().split(':').collect();
        if parts.len() < 5 {
            return None;
        }
        Some(Self {
            port: parts[2].parse().ok()?,
            password: parts[3].to_string(),
        })
    }

    /// Read credentials from a lockfile on disk.
    pub fn from_lockfile(path: &Path) -> std::io::Result<Option<Self>> {
        let contents = std::fs::read_to_string(path)?;
        Ok(Self::from_lockfile_contents(&contents))
    }

    /// Discover credentials by finding the running `LeagueClientUx` process
    /// and reading its `--app-port` and `--remoting-auth-token` CLI args.
    /// Falls back to scanning common lockfile locations (covers WSL2 + standard installs).
    pub fn discover() -> Option<Self> {
        // 1. Try process args (works natively on Windows/Linux/Mac)
        if let Some(creds) = Self::discover_from_process() {
            return Some(creds);
        }

        // 2. Fall back to lockfile scan (covers WSL2 where League runs on Windows)
        for path in Self::lockfile_candidates() {
            if let Ok(Some(creds)) = Self::from_lockfile(&path) {
                return Some(creds);
            }
        }

        None
    }

    fn discover_from_process() -> Option<Self> {
        let sys = System::new_with_specifics(
            RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
        );

        for (_pid, process) in sys.processes() {
            let name = process.name().to_string_lossy();
            if !name.contains("LeagueClientUx") {
                continue;
            }

            let mut port: Option<u16> = None;
            let mut password: Option<String> = None;

            for arg in process.cmd() {
                let arg = arg.to_string_lossy();
                if let Some(val) = arg.strip_prefix("--app-port=") {
                    port = val.parse().ok();
                } else if let Some(val) = arg.strip_prefix("--remoting-auth-token=") {
                    password = Some(val.to_string());
                }
            }

            if let (Some(port), Some(password)) = (port, password) {
                return Some(Self { port, password });
            }
        }

        None
    }

    /// Returns candidate lockfile paths to try in order.
    fn lockfile_candidates() -> Vec<std::path::PathBuf> {
        let mut candidates = vec![];

        // WSL2: read from Windows filesystem
        #[cfg(target_os = "linux")]
        {
            // Walk /mnt/c/Users/*/AppData/Local/Riot Games/League of Legends/lockfile
            if let Ok(users) = std::fs::read_dir("/mnt/c/Users") {
                for entry in users.flatten() {
                    candidates.push(
                        entry.path()
                            .join("AppData/Local/Riot Games/League of Legends/lockfile"),
                    );
                }
            }
            // Default Riot install path
            candidates.push("/mnt/c/Riot Games/League of Legends/lockfile".into());
        }

        // Native Windows
        #[cfg(target_os = "windows")]
        {
            if let Some(local) = dirs::data_local_dir() {
                candidates.push(local.join("Riot Games/League of Legends/lockfile"));
            }
            candidates.push(r"C:\Riot Games\League of Legends\lockfile".into());
        }

        candidates
    }
}
