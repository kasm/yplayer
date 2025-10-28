# YPlayer Server Setup Guide

## Overview

The YPlayer application now includes a Node.js server that properly serves local video files with full support for:
- Video streaming with range requests (seeking support)
- Proper MIME types for all video formats
- CORS support for cross-origin requests
- API endpoints for video management

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

**Option A: Using npm**
```bash
npm start
```

**Option B: Using Node directly**
```bash
node server.js
```

**Option C: Using the batch file (Windows)**
```bash
start-server.bat
```

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Server Features

### Video Serving with Range Requests

The server supports HTTP range requests, which enables:
- **Video seeking**: Jump to any point in the video
- **Efficient streaming**: Only download the portions you need
- **Better performance**: Reduces bandwidth usage

### Supported Video Formats

The server automatically handles MIME types for:
- `.mp4` - video/mp4
- `.webm` - video/webm
- `.ogg`, `.ogv` - video/ogg
- `.mkv` - video/x-matroska
- `.avi` - video/x-msvideo
- `.mov` - video/quicktime
- `.flv` - video/x-flv
- `.wmv` - video/x-ms-wmv

## API Endpoints

### Main Application
```
GET http://localhost:3000/
```
Serves the main HTML application

### Video Files
```
GET http://localhost:3000/output/{filename}
```
Streams video files with range request support

Example:
```
http://localhost:3000/output/s0601.mp4
```

### List All Videos
```
GET http://localhost:3000/api/videos
```

Returns JSON with all available videos:
```json
{
  "videos": [
    {
      "filename": "s0601.mp4",
      "path": "output/s0601.mp4",
      "url": "/output/s0601.mp4",
      "size": 253463255
    },
    {
      "filename": "s0602.mp4",
      "path": "output/s0602.mp4",
      "url": "/output/s0602.mp4",
      "size": 223780969
    }
  ]
}
```

## Directory Structure

```
yplayer/
├── server.js              # Node.js server
├── package.json           # Node.js dependencies
├── start-server.bat       # Windows quick start script
├── index.html             # Main application
├── app.js                 # Application logic
├── styles.css             # Styles
├── output/                # Video files directory
│   ├── s0601.mp4
│   └── s0602.mp4
└── node_modules/          # Dependencies (auto-generated)
```

## Adding Videos

1. Place your video files in the `output/` directory
2. Restart the server (or it will pick them up automatically)
3. Update your Google Sheets with the video paths:
   ```
   1  |  Video Title  |  output/video.mp4
   ```

## Configuration

### Change Server Port

Edit `server.js` or set environment variable:
```bash
PORT=8080 npm start
```

### CORS Settings

The server has CORS enabled by default. To restrict origins, modify the CORS configuration in `server.js`:

```javascript
app.use(cors({
    origin: 'http://yourdomain.com'
}));
```

## Troubleshooting

### Server Won't Start

**Check if port is already in use:**
```bash
netstat -ano | findstr :3000
```

**Use a different port:**
```bash
PORT=8080 npm start
```

### Videos Not Playing

1. **Check file exists**: Verify the file is in `output/` directory
2. **Check file format**: Ensure it's a supported format
3. **Check console**: Open browser DevTools (F12) for errors
4. **Check server logs**: Look at the terminal running the server

### Videos Not Seeking

Range requests might be blocked. Check:
1. Server is sending `Accept-Ranges: bytes` header
2. Browser supports range requests
3. No proxy interfering with headers

## Production Deployment

For production use, consider:

1. **Use a process manager**: PM2, Forever, etc.
   ```bash
   npm install -g pm2
   pm2 start server.js --name yplayer
   ```

2. **Enable HTTPS**: Use a reverse proxy like nginx or use built-in HTTPS
3. **Add authentication**: Protect your videos if needed
4. **Optimize**: Enable compression, caching headers, etc.

## Server Logs

The server will display on startup:
- Server URL and port
- Serving directory path
- Available endpoints
- List of detected video files

Example output:
```
╔═══════════════════════════════════════════════════════════╗
║                    YPlayer Server                         ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server is running on http://localhost:3000

📁 Serving files from: D:\m\ai_test\v1\yplayer
📹 Video directory: D:\m\ai_test\v1\yplayer\output

Available endpoints:
  • http://localhost:3000/              - Main application
  • http://localhost:3000/output/*      - Video files
  • http://localhost:3000/api/videos    - List all videos

📹 Available videos:
   • s0601.mp4
   • s0602.mp4
```

## Next Steps

1. Open http://localhost:3000 in your browser
2. Click the blue button in the bottom-right to open the playlist
3. Select a video to play
4. Use the native HTML5 controls to play/pause/seek

Enjoy your videos! 🎬
