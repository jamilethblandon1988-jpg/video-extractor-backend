import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { URL } from 'url';
import https from 'https';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logger utility
const log = (level, msg, data = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${msg} ${data}`);
};

// Ensure yt-dlp binary exists and is executable
const ensureYtDlp = async () => {
  const binDir = join(__dirname, 'bin');
  const ytDlpPath = join(binDir, 'yt-dlp');

  if (existsSync(ytDlpPath)) {
    log('INFO', 'yt-dlp binary found at', ytDlpPath);
    return ytDlpPath;
  }

  log('INFO', 'yt-dlp not found, downloading from GitHub releases...');
  mkdirSync(binDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    const file = createWriteStream(ytDlpPath);
    let downloadAttempts = 0;
    const maxAttempts = 3;

    const downloadFile = (downloadUrl) => {
      downloadAttempts++;
      if (downloadAttempts > maxAttempts) {
        reject(new Error(`Failed to download yt-dlp after ${maxAttempts} attempts`));
        return;
      }

      https
        .get(downloadUrl, { maxRedirects: 5, timeout: 30000 }, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            file.destroy();
            downloadFile(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            file.destroy();
            reject(new Error(`Failed to download yt-dlp: HTTP ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            try {
              chmodSync(ytDlpPath, 0o755);
              log('INFO', 'yt-dlp downloaded and made executable successfully');
              resolve(ytDlpPath);
            } catch (err) {
              reject(new Error(`Failed to make yt-dlp executable: ${err.message}`));
            }
          });
        })
        .on('error', (err) => {
          file.destroy();
          reject(new Error(`Download error: ${err.message}`));
        });
    };

    downloadFile(url);
  });
};

// Validate URL format
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

// Check if URL is from a supported platform
const isSupportedPlatform = (urlString) => {
  const supported = [
    'youtube.com',
    'youtu.be',
    'tiktok.com',
    'instagram.com',
    'facebook.com',
    'fb.watch',
    'twitter.com',
    'x.com',
  ];
  return supported.some((platform) => urlString.toLowerCase().includes(platform));
};

// Extract video info using yt-dlp with JSON output
const extractVideoInfo = async (ytDlpPath, url) => {
  try {
    const { stdout } = await execAsync(
      `${ytDlpPath} -J --no-warnings --socket-timeout 30 "${url}"`,
      {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    const data = JSON.parse(stdout);
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`yt-dlp extraction failed: ${errorMsg}`);
  }
};

// Map yt-dlp JSON output to standardized response format
const mapToResponse = (data) => {
  const platformMap = {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'X/Twitter',
    x: 'X/Twitter',
  };

  const extractor = data.extractor || 'unknown';
  const platform = platformMap[extractor.toLowerCase()] || extractor;

  // Get the best download URL
  let downloadUrl = null;
  if (data.url) {
    downloadUrl = data.url;
  } else if (data.formats && data.formats.length > 0) {
    // Find the best format
    const bestFormat = data.formats.reduce((best, current) => {
      const currentScore = (current.height || 0) * (current.fps || 1);
      const bestScore = (best.height || 0) * (best.fps || 1);
      return currentScore > bestScore ? current : best;
    });
    downloadUrl = bestFormat.url || null;
  }

  return {
    title: data.title || 'Unknown',
    thumbnail: data.thumbnail || null,
    duration: data.duration || 0,
    upload_date: data.upload_date
      ? `${data.upload_date.slice(0, 4)}-${data.upload_date.slice(4, 6)}-${data.upload_date.slice(6, 8)}`
      : null,
    platform: platform,
    download_url: downloadUrl,
    id: data.id || null,
    url: data.webpage_url || null,
  };
};

// Health check endpoint
app.get('/api/healthz', (req, res) => {
  log('INFO', 'Health check request');
  res.json({ ok: true });
});

// Extract video metadata endpoint
app.get('/api/extract', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      log('WARN', 'Missing URL parameter in request');
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!isValidUrl(url)) {
      log('WARN', 'Invalid URL format:', url);
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (!isSupportedPlatform(url)) {
      log('WARN', 'Unsupported platform:', url);
      return res.status(400).json({
        error: 'Unsupported platform. Supported: YouTube, TikTok, Instagram, Facebook, X/Twitter',
      });
    }

    log('INFO', 'Extracting video metadata from:', url);

    const ytDlpPath = await ensureYtDlp();
    const videoData = await extractVideoInfo(ytDlpPath, url);
    const response = mapToResponse(videoData);

    log('INFO', 'Successfully extracted metadata for:', response.title);
    res.json(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log('ERROR', 'Extraction failed:', errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  log('ERROR', 'Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  log('INFO', `Server running on port ${PORT}`);
  log('INFO', 'Health check: GET /api/healthz');
  log('INFO', 'Extract video: GET /api/extract?url=<VIDEO_URL>');
  log('INFO', 'Supported platforms: YouTube, TikTok, Instagram, Facebook, X/Twitter');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('INFO', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('INFO', 'SIGINT received, shutting down gracefully');
  process.exit(0);
});

