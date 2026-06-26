import express from "express";
import cors from "cors";
import { exec } from "child_process";

const app = express();
app.use(cors());
app.use(express.json());

const YTDLP = "/usr/local/bin/yt-dlp";

function run(cmd) {
  return new Promise((res, rej) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout) => {
      if (err) return rej(err);
      try { res(JSON.parse(stdout)); }
      catch { res(stdout); }
    });
  });
}

app.get("/api/healthz", (req, res) => res.json({ ok: true }));

app.get("/api/extract", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Falta url" });
  try {
    const data = await run(${YTDLP} -j --no-playlist --extractor-args "youtube:player_client=android" "");
    res.json({ titulo: data.title, miniatura: data.thumbnail, duracion: data.duration, plataforma: data.extractor, downloadUrl: data.url || data.formats?.slice(-1)[0]?.url, id: data.id });
  } catch (e) {
    res.status(500).json({ error: "Fallo", detalle: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend en puerto", PORT));
