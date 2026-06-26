# Video Extractor Backend

Production-ready Node.js + Express backend service for extracting video metadata from multiple platforms.

## Supported Platforms

- YouTube
- TikTok
- Instagram
- Facebook
- X/Twitter

## API Endpoints

### GET /api/healthz
Health check endpoint.

**Response:**
```json
{
  "ok": true
}
```

### GET /api/extract?url=<VIDEO_URL>
Extract video metadata from a URL.

**Parameters:**
- `url` (required): Video URL from supported platform

**Success Response (200):**
```json
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": 120,
  "upload_date": "2024-06-26",
  "platform": "YouTube",
  "download_url": "https://...",
  "id": "video_id",
  "url": "https://..."
}
```

**Error Response (400/500):**
```json
{
  "error": "Error message"
}
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

Server listens on port specified by `PORT` environment variable (default: 3000).

## Docker

Build and run with Docker:

```bash
docker build -t video-extractor .
docker run -p 3000:3000 video-extractor
```

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Railway will automatically detect the Dockerfile
3. Build and deploy automatically
4. Access via public URL

## Features

- ✅ Express.js server with CORS enabled
- ✅ Automatic yt-dlp binary download from GitHub releases
- ✅ JSON output from yt-dlp (-J flag)
- ✅ 10MB buffer for large responses
- ✅ URL validation and platform detection
- ✅ Comprehensive error handling
- ✅ Structured logging with timestamps
- ✅ Health check endpoint
- ✅ Graceful shutdown handling
- ✅ Production-ready Docker image
- ✅ Railway compatible

## Requirements

- Node.js 20+
- Docker (for containerized deployment)
- Internet connection (for yt-dlp download)

## Environment Variables

- `PORT` - Server port (default: 3000)

## License

MIT

