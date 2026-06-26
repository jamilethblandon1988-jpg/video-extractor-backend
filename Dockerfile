FROM node:20-alpine

WORKDIR /app

# Install system dependencies for yt-dlp and ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    openssl

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY index.js .

# Create bin directory for yt-dlp binary
RUN mkdir -p bin

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/healthz || exit 1

# Start application
CMD ["npm", "start"]

