# Local Playlist Setup - YPlayer

## Overview

The YPlayer app has been modified to load playlists from the local `output` folder instead of Google Sheets. The Node.js server automatically scans the `output` directory and creates a playlist from all video files found.

## How It Works

### Server-Side (server.js)

The server provides an API endpoint at `/api/playlist` that:

1. **Scans the `output` folder** for files and directories
2. **Finds all video files** (mp4, webm, ogg, mkv, avi, mov, flv, wmv)
3. **Recursively searches subdirectories** for more videos
4. **Returns a JSON playlist** with video metadata

#### Folder Structure Support

The server supports two layouts:

**Flat Structure:**
```
output/
├── video1.mp4
├── video2.mp4
└── video3.mp4
```

**Hierarchical Structure:**
```
output/
├── series1/
│   ├── episode1.mp4
│   └── episode2.mp4
├── series2/
│   ├── episode1.mp4
│   └── episode2.mp4
└── standalone.mp4
```

### Client-Side (app.js)

The frontend has been updated to:

1. **Fetch playlist from `/api/playlist`** instead of Google Sheets
2. **Load videos on startup** from the local API
3. **Reload button** now fetches fresh data from the server
4. **All Google Sheets code commented out** with marker: `LOADING FILELIST FROM GOOGLE SHEET - COMMENTED OUT`

## API Endpoints

### `/api/playlist`
Returns playlist data in the format expected by the app.

**Response Format:**
```json
[
  {
    "id": "output/video1.mp4",
    "title": "video1",
    "currentTime": 0,
    "type": "local"
  },
  {
    "id": "output/series1/episode1.mp4",
    "title": "series1 - episode1",
    "currentTime": 0,
    "type": "local"
  }
]
```

### `/api/videos`
Returns simple video list with file metadata.

**Response Format:**
```json
{
  "videos": [
    {
      "filename": "video1.mp4",
      "path": "output/video1.mp4",
      "url": "/output/video1.mp4",
      "size": 253463255
    }
  ]
}
```

## Video File Naming

### For Files in Root `output/` Folder
- **Filename:** `my-video.mp4`
- **Displayed Title:** `my-video`
- **Path in Playlist:** `output/my-video.mp4`

### For Files in Subdirectories
- **Filename:** `output/season01/episode01.mp4`
- **Displayed Title:** `season01 - episode01`
- **Path in Playlist:** `output/season01/episode01.mp4`

The title is automatically generated from:
- Directory name (if in subdirectory)
- Filename without extension

## Adding New Videos

### Method 1: Add Files Directly
1. Place video files in the `output/` folder
2. Optionally create subdirectories for organization
3. Open the app and click **"Reload from Server"** button
4. Videos will appear in the playlist

### Method 2: Auto-Reload on Startup
1. Clear localStorage in your browser (or clear app data)
2. Refresh the page
3. App will automatically fetch the latest file list

## Code Changes Summary

### Modified Files

#### 1. `app.js`
- ✅ Commented out Google Sheets URL configuration
- ✅ Added new `PLAYLIST_API_URL = '/api/playlist'`
- ✅ Created `loadVideosFromLocalAPI()` function
- ✅ Commented out old `loadVideosFromSheet()` function
- ✅ Updated `handleReloadSheet()` to use local API
- ✅ Updated `initializeApp()` to use local API

#### 2. `server.js`
- ✅ Added `/api/playlist` endpoint
- ✅ Recursive directory scanning
- ✅ Automatic title generation from filenames
- ✅ Support for subdirectories

#### 3. `index.html`
- ✅ Changed button text from "Reload from Google Sheets" to "Reload from Server"

## Supported Video Formats

The server automatically detects and adds videos with these extensions:
- `.mp4` - MPEG-4 video
- `.webm` - WebM video
- `.ogg`, `.ogv` - Ogg video
- `.mkv` - Matroska video
- `.avi` - AVI video
- `.mov` - QuickTime video
- `.flv` - Flash video
- `.wmv` - Windows Media video

## Testing the Setup

### 1. Check Server is Running
The server should display:
```
📹 Available videos:
   • s0601.mp4
   • s0602.mp4
```

### 2. Test the API Endpoint
```bash
curl http://localhost:3007/api/playlist
```

Expected output:
```json
[
  {
    "id": "output/s0601.mp4",
    "title": "s0601",
    "currentTime": 0,
    "type": "local"
  },
  {
    "id": "output/s0602.mp4",
    "title": "s0602",
    "currentTime": 0,
    "type": "local"
  }
]
```

### 3. Open the App
1. Navigate to `http://localhost:3007`
2. Check browser console for log messages
3. Look for: `✓ Loaded 2 videos from local API`
4. Playlist should show all videos from `output/` folder

### 4. Test Reload Function
1. Add a new video to `output/` folder
2. Click the blue playlist button (bottom-right)
3. Click "Reload from Server" button
4. New video should appear in the list

## Troubleshooting

### No Videos Appearing
1. **Check output folder exists:**
   ```bash
   ls -la output/
   ```

2. **Check file extensions:**
   - Must be one of the supported formats
   - Extension must be lowercase or will be matched case-insensitively

3. **Check browser console:**
   - Look for errors in fetch request
   - Verify API response contains data

### Videos Found But Not Playing
1. **Check file permissions:**
   - Server must have read access to video files

2. **Check file paths:**
   - Paths are relative to server root
   - Must start with `output/`

3. **Check MIME types:**
   - Server automatically sets correct MIME types
   - Some browsers may not support certain formats

### Server Not Starting
1. **Check port availability:**
   ```bash
   netstat -ano | findstr :3007
   ```

2. **Change port if needed:**
   ```bash
   PORT=8080 npm start
   ```

## Reverting to Google Sheets (If Needed)

To switch back to Google Sheets:

1. Uncomment the Google Sheets configuration in `app.js`:
   ```javascript
   const SHEET_URL = 'https://docs.google.com/...';
   ```

2. Uncomment `loadVideosFromSheet()` function

3. Update `initializeApp()` and `handleReloadSheet()` to call `loadVideosFromSheet()`

4. Update button text back to "Reload from Google Sheets"

## Benefits of Local Playlist

✅ **No external dependencies** - Works offline
✅ **Automatic discovery** - Just drop files in `output/`
✅ **Organized structure** - Support for subdirectories
✅ **Fast loading** - No network latency
✅ **Simple management** - File system is the database

## Example Directory Setup

```
yplayer/
├── output/
│   ├── movies/
│   │   ├── action/
│   │   │   ├── movie1.mp4
│   │   │   └── movie2.mp4
│   │   └── comedy/
│   │       ├── movie3.mp4
│   │       └── movie4.mp4
│   ├── series/
│   │   ├── season01/
│   │   │   ├── s01e01.mp4
│   │   │   └── s01e02.mp4
│   │   └── season02/
│   │       ├── s02e01.mp4
│   │       └── s02e02.mp4
│   └── standalone-video.mp4
├── server.js
├── app.js
├── index.html
└── package.json
```

All videos will be automatically discovered and added to the playlist!
