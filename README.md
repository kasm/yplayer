# yplayer
YouTube videos player and organizer with local file support

## Features

- Play YouTube videos from a Google Sheets playlist
- Play local video files stored on the server
- Track playback position for each video
- Swipe gestures for navigation (tablet-optimized)
- PWA support for offline use
- Automatic playlist synchronization from Google Sheets

## Supported Video Types

### YouTube Videos
The app supports YouTube videos via their video IDs or URLs. Supported formats:
- Full URL: `https://www.youtube.com/watch?v=VIDEO_ID`
- Short URL: `https://youtu.be/VIDEO_ID`
- Shorts: `https://www.youtube.com/shorts/VIDEO_ID`
- Direct video ID: `VIDEO_ID` (11 characters)

### Local Video Files
The app now supports local video files stored on the server. Supported formats:
- MP4 (`.mp4`)
- WebM (`.webm`)
- OGG (`.ogg`)
- MKV (`.mkv`)
- AVI (`.avi`)
- MOV (`.mov`)
- FLV (`.flv`)
- WMV (`.wmv`)

To use local files, simply provide the relative or absolute path to the video file in your Google Sheet.

## Google Sheets Format

Your Google Sheet should have 3 columns:

| Number | Title | URL/Path |
|--------|-------|----------|
| 1 | My YouTube Video | https://www.youtube.com/watch?v=dQw4w9WgXcQ |
| 2 | Local Video Sample | output/s0601.mp4 |
| 3 | Another Local Video | /videos/sample.mp4 |

The app automatically detects whether each entry is a YouTube video or a local file based on the URL/Path column.

## Visual Indicators

- **Red play icon**: YouTube video
- **Green file icon**: Local video file

## Setup

1. Update the `SHEET_URL` in [app.js](d:\m\ai_test\v1\yplayer\app.js) with your Google Sheets public URL
2. Ensure your Google Sheet is published to the web
3. Place local video files in accessible directories (e.g., `output/` folder)
4. Open [index.html](d:\m\ai_test\v1\yplayer\index.html) in a browser

## Local File Paths

Local video files should be accessible from the application's directory. You can use:
- Relative paths: `output/video.mp4`, `videos/sample.mp4`
- Absolute paths: `/var/www/videos/sample.mp4`

Make sure the web server has permission to serve these files.
