const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const YTDLP_PATH = "/bin/yt-dlp";

function ensureYtDlp(callback) {
  if (fs.existsSync(YTDLP_PATH)) return callback();

  exec(
    `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${YTDLP_PATH} && chmod +x ${YTDLP_PATH}`,
    (err) => callback(err)
  );
}

app.get("/api/healthz", (req, res) => res.json({ ok: true }));

function getPlatform(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "YouTube";
  if (/tiktok\.com/.test(url)) return "TikTok";
  if (/instagram\.com/.test(url)) return "Instagram";
  if (/facebook\.com/.test(url)) return "Facebook";
  if (/twitter\.com|x\.com/.test(url)) return "X/Twitter";
  return null;
}

app.get("/api/extract", (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Falta parámetro url" });

  const platform = getPlatform(url);
  if (!platform) return res.status(400).json({ error: "Plataforma no soportada" });

  ensureYtDlp((err) => {
    if (err) return res.status(500).json({ error: "Error preparando yt-dlp" });

    exec(`${YTDLP_PATH} -J "${url}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) return res.status(500).json({ error: "Error al extraer video" });

      try {
        const data = JSON.parse(stdout);
        const best = data.formats?.slice(-1)[0];

        res.json({
          titulo: data.title || null,
          miniatura: data.thumbnail || null,
          duracion: data.duration || null,
          fecha: data.upload_date || null,
          plataforma: platform,
          downloadUrl: best?.url || null,
          id: data.id || null
        });
      } catch {
        res.status(500).json({ error: "Error procesando JSON" });
      }
    });
  });
});

app.listen(PORT, () => console.log("Servidor en puerto", PORT));
