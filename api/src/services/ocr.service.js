// api/src/services/ocr.service.js
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { ocrEnabled, pythonBin } = require("../config/env");

/**
 * Resolve a Python executable with this priority:
 * 1) PYTHON_BIN from .env (if exists)
 * 2) worker/.venv/Scripts/python.exe (Windows)
 * 3) worker/.venv/bin/python (Unix)
 * 4) system "python" (Windows) or "python3" (Unix)
 */
function resolvePythonBin() {
  if (pythonBin && fs.existsSync(pythonBin)) return pythonBin;

  const workerDir = path.resolve(process.cwd(), "worker");
  const win = path.join(workerDir, ".venv", "Scripts", "python.exe");
  const nix = path.join(workerDir, ".venv", "bin", "python");

  if (process.platform === "win32" && fs.existsSync(win)) return win;
  if (fs.existsSync(nix)) return nix;

  return process.platform === "win32" ? "python" : "python3";
}

/**
 * Run OCR via the Python worker script.
 * @param {string} absPath Absolute file path to the uploaded asset
 * @param {object} options Optional tuning: { timeoutMs?: number }
 * @returns {Promise<{ source: string, ocr_text: string, error?: string }>}
 */
async function runOCR(absPath, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 60_000); // 60s default
  const workerDir = path.resolve(process.cwd(), "worker");
  const ocrScript = path.join(workerDir, "ocr_demo.py");

  // If OCR is disabled or script is missing, return empty text gracefully.
  if (!ocrEnabled) {
    return { source: absPath, ocr_text: "" };
  }
  if (!fs.existsSync(workerDir) || !fs.existsSync(ocrScript)) {
    return { source: absPath, ocr_text: "", error: "OCR script not found" };
  }

  const PYTHON = resolvePythonBin();

  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let finished = false;

    const child = spawn(PYTHON, [ocrScript, absPath], { cwd: workerDir });

    // Safety timeout to avoid hanging processes
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { child.kill("SIGKILL"); } catch {}
      return resolve({
        source: absPath,
        ocr_text: "",
        error: `OCR timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.on("error", (e) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      return resolve({ source: absPath, ocr_text: "", error: e.message });
    });

    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (code !== 0) {
        return resolve({
          source: absPath,
          ocr_text: "",
          error: err || `OCR process exited with code ${code}`,
        });
      }

      // Try JSON first (ocr_demo.py prints JSON); fallback to raw text
      try {
        const parsed = JSON.parse(out);
        // Prefer parsed.ocr_text when available
        return resolve({
          source: parsed.source || absPath,
          ocr_text: parsed.ocr_text || "",
        });
      } catch {
        // Raw output — may contain just text
        return resolve({ source: absPath, ocr_text: String(out || "").trim() });
      }
    });
  });
}

module.exports = { runOCR, resolvePythonBin };
