const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3007;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        // Set proper MIME types for video files
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.ogv': 'video/ogg',
            '.mkv': 'video/x-matroska',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.flv': 'video/x-flv',
            '.wmv': 'video/x-ms-wmv'
        };

        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
            // Enable range requests for video seeking
            res.setHeader('Accept-Ranges', 'bytes');
        }
    }
}));

// Special route for video files with range request support (for seeking)
app.get('/output/:filename', (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(__dirname, 'output', filename);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Video file not found');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set proper MIME type based on extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.ogv': 'video/ogg',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.flv': 'video/x-flv',
        '.wmv': 'video/x-ms-wmv'
    };
    const contentType = mimeTypes[ext] || 'video/mp4';

    if (range) {
        // Parse range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        // No range request, send entire file
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes'
        };

        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Route to list all available videos
app.get('/api/videos', (req, res) => {
    const outputDir = path.join(__dirname, 'output');

    if (!fs.existsSync(outputDir)) {
        return res.json({ videos: [] });
    }

    const files = fs.readdirSync(outputDir);
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mkv', '.avi', '.mov', '.flv', '.wmv'];

    const videos = files
        .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return videoExtensions.includes(ext);
        })
        .map(file => ({
            filename: file,
            path: `output/${file}`,
            url: `/output/${file}`,
            size: fs.statSync(path.join(outputDir, file)).size
        }));

    res.json({ videos });
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    YPlayer Server                         ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server is running on http://localhost:${PORT}

📁 Serving files from: ${__dirname}
📹 Video directory: ${path.join(__dirname, 'output')}

Available endpoints:
  • http://localhost:${PORT}/              - Main application
  • http://localhost:${PORT}/output/*      - Video files
  • http://localhost:${PORT}/api/videos    - List all videos

Press Ctrl+C to stop the server
`);

    // List available videos on startup
    const outputDir = path.join(__dirname, 'output');
    if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mkv', '.avi', '.mov', '.flv', '.wmv'];
        const videos = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return videoExtensions.includes(ext);
        });

        if (videos.length > 0) {
            console.log('\n📹 Available videos:');
            videos.forEach(video => {
                console.log(`   • ${video}`);
            });
            console.log('');
        } else {
            console.log('\n⚠️  No video files found in output directory\n');
        }
    } else {
        console.log('\n⚠️  Output directory not found. Please create it and add video files.\n');
    }
});
