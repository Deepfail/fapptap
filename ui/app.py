import os
import sys
import json
import threading
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

ROOT = Path(__file__).resolve().parents[1]  # project root
PYTHON = sys.executable  # uses your current interpreter (venv if launched from it)

# Default paths (you can change in the UI)
DEFAULT_SONG = ROOT / "media_samples" / "song.mp3"
DEFAULT_MEDIA_DIR = ROOT / "media_samples"
CUTLIST_JSON = ROOT / "render" / "cutlist.json"
BEATS_JSON = ROOT / "cache" / "beats.json"
SHOTS_JSON = ROOT / "cache" / "shots.json"
PROXY_MP4 = ROOT / "render" / "proxy_preview.mp4"

def run_cmd(argv, log_fn):
    """Run a subprocess and stream stdout/stderr to log_fn."""
    log_fn(f"$ {' '.join(str(a) for a in argv)}")
    proc = subprocess.Popen(
        argv,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,  # safer across Python builds
        cwd=str(ROOT)
    )
    if proc.stdout is None:
        raise RuntimeError("No stdout stream from subprocess")

    for line in iter(proc.stdout.readline, ""):
        if line:
            log_fn(line.rstrip("\n"))
    proc.stdout.close()
    code = proc.wait()
    if code != 0:
        raise RuntimeError(f"Command failed (exit {code})")
    return code

def open_file(path: Path):
    try:
        if os.name == "nt":
            os.startfile(str(path))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=False)
        else:
            subprocess.run(["xdg-open", str(path)], check=False)
    except Exception as e:
        messagebox.showwarning("Open file", f"Could not open file:\n{e}")

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("AutoEdit — MVP UI")
        self.geometry("820x600")

        self.song_var = tk.StringVar(value=str(DEFAULT_SONG))
        self.media_dir_var = tk.StringVar(value=str(DEFAULT_MEDIA_DIR))
        self.status_var = tk.StringVar(value="idle")

        # Top controls
        frm = ttk.Frame(self, padding=10)
        frm.pack(fill="x")

        ttk.Label(frm, text="Song:").grid(row=0, column=0, sticky="w")
        ttk.Entry(frm, textvariable=self.song_var, width=70).grid(row=0, column=1, sticky="we", padx=6)
        ttk.Button(frm, text="Browse…", command=self.pick_song).grid(row=0, column=2)

        ttk.Label(frm, text="Clips Folder:").grid(row=1, column=0, sticky="w", pady=(6,0))
        ttk.Entry(frm, textvariable=self.media_dir_var, width=70).grid(row=1, column=1, sticky="we", padx=6, pady=(6,0))
        ttk.Button(frm, text="Browse…", command=self.pick_folder).grid(row=1, column=2, pady=(6,0))

        frm.columnconfigure(1, weight=1)

        # Action buttons
        btns = ttk.Frame(self, padding=(10,4))
        btns.pack(fill="x")
        self.run_btn = ttk.Button(btns, text="Run Auto-Edit (Cutlist → Proxy)", command=self.on_run)
        self.run_btn.pack(side="left")
        ttk.Button(btns, text="Open Proxy", command=lambda: open_file(PROXY_MP4)).pack(side="left", padx=8)

        ttk.Label(btns, textvariable=self.status_var).pack(side="right")

        # Log area
        self.log = tk.Text(self, height=24, wrap="none", font=("Consolas", 10))
        self.log.pack(fill="both", expand=True, padx=10, pady=(0,10))
        self.log.configure(state="disabled")

    def logln(self, msg: str):
        self.log.configure(state="normal")
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")
        self.update_idletasks()

    def pick_song(self):
        f = filedialog.askopenfilename(
            title="Select song",
            initialdir=self.media_dir_var.get(),
            filetypes=[("Audio", "*.mp3;*.wav;*.m4a;*.flac"), ("All", "*.*")]
        )
        if f:
            self.song_var.set(f)

    def pick_folder(self):
        d = filedialog.askdirectory(
            title="Select clips folder",
            initialdir=self.media_dir_var.get()
        )
        if d:
            self.media_dir_var.set(d)

    def on_run(self):
        # run in background thread
        self.run_btn.configure(state="disabled")
        self.status_var.set("running…")
        t = threading.Thread(target=self._run_pipeline_safe, daemon=True)
        t.start()

    def _run_pipeline_safe(self):
        try:
            self._run_pipeline()
            self.status_var.set("done")
            self.logln("✅ Done. Click 'Open Proxy' to play.")
        except Exception as e:
            self.status_var.set("error")
            self.logln(f"❌ Error: {e}")
            messagebox.showerror("Auto-Edit failed", str(e))
        finally:
            self.run_btn.configure(state="normal")

    def _run_pipeline(self):
        song = Path(self.song_var.get())
        media_dir = Path(self.media_dir_var.get())

        # Preflight
        if not song.exists():
            raise FileNotFoundError(f"Song not found: {song}")
        if not media_dir.exists():
            raise FileNotFoundError(f"Clips folder not found: {media_dir}")
        if not BEATS_JSON.exists():
            self.logln("⚠️ beats.json not found. Run your beats step first.")
        if not SHOTS_JSON.exists():
            self.logln("⚠️ shots.json not found. Run your shots step first.")

        # Ensure output dirs
        (ROOT / "analysis").mkdir(exist_ok=True)
        (ROOT / "render").mkdir(exist_ok=True)

        # 1) Build cutlist
        self.logln("➡️ Building cutlist…")
        run_cmd(
            [
                PYTHON,
                str(ROOT / "analysis" / "build_cutlist.py"),
                str(BEATS_JSON),
                str(SHOTS_JSON),
                str(song),
                str(CUTLIST_JSON),
                self.media_dir_var.get(),   # ← pass the selected clips folder
            ],
            self.logln,
        )

        # 2) Proxy render @ 960x540 (NVENC). The runner handles SAR + -shortest.
        self.logln("➡️ Rendering proxy (960x540@60)…")
        run_cmd(
            [
                PYTHON,
                str(ROOT / "render" / "run_ffmpeg_from_cutlist.py"),
                str(CUTLIST_JSON),
                str(PROXY_MP4),
                "960",
                "540",
            ],
            self.logln,
        )

# ------------- end of class App  -------------

if __name__ == "__main__":
    App().mainloop()
