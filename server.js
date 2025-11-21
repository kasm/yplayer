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
app.get('/output/*', (req, res) => {
    const filename = req.params[0];
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

// Route to list all available videos (simple format)
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

// Recursive function to scan directories for video files (flat list)
function scanDirectoryRecursive(dir, baseDir, relativePath = '') {
    console.log(`\n🔍 Scanning directory: ${dir}`);
    console.log(`   Relative path: ${relativePath || '(root)'}`);

    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mkv', '.avi', '.mov', '.flv', '.wmv'];
    const playlist = [];

    const items = fs.readdirSync(dir, { withFileTypes: true });
    console.log(`   Found ${items.length} items`);

    items.forEach(item => {
        const itemPath = path.join(dir, item.name);
        const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;

        if (item.isDirectory()) {
            console.log(`   📁 Directory: ${item.name}`);
            // Recursively scan subdirectory
            const subPlaylist = scanDirectoryRecursive(itemPath, baseDir, itemRelativePath);
            console.log(`   ✓ Found ${subPlaylist.length} videos in ${item.name}`);
            playlist.push(...subPlaylist);
        } else if (item.isFile()) {
            // Check if it's a video file
            const ext = path.extname(item.name).toLowerCase();
            if (videoExtensions.includes(ext)) {
                const fileName = path.parse(item.name).name;
                const folderName = relativePath || 'output';

                const videoEntry = {
                    id: `output/${itemRelativePath}`,
                    title: relativePath ? `${relativePath} - ${fileName}` : fileName,
                    currentTime: 0,
                    type: 'local'
                };

                console.log(`   🎬 Video found: ${item.name}`);
                console.log(`      ID: ${videoEntry.id}`);
                console.log(`      Title: ${videoEntry.title}`);

                playlist.push(videoEntry);
            } else {
                console.log(`   ⊘ Skipping non-video: ${item.name}`);
            }
        }
    });

    console.log(`   → Returning ${playlist.length} videos from this directory`);
    return playlist;
}

// Build hierarchical folder structure
function buildFolderStructure(dir, baseDir, relativePath = '') {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mkv', '.avi', '.mov', '.flv', '.wmv'];
    const structure = {
        name: relativePath || 'Root',
        path: relativePath,
        type: 'folder',
        folders: [],
        videos: []
    };

    const items = fs.readdirSync(dir, { withFileTypes: true });

    items.forEach(item => {
        const itemPath = path.join(dir, item.name);
        const itemRelativePath = relativePath ? `${relativePath}/${item.name}` : item.name;

        if (item.isDirectory()) {
            // Recursively build subfolder structure
            const subStructure = buildFolderStructure(itemPath, baseDir, itemRelativePath);
            structure.folders.push(subStructure);
        } else if (item.isFile()) {
            // Check if it's a video file
            const ext = path.extname(item.name).toLowerCase();
            if (videoExtensions.includes(ext)) {
                const fileName = path.parse(item.name).name;

                const videoEntry = {
                    id: `output/${itemRelativePath}`,
                    title: fileName,
                    filename: item.name,
                    currentTime: 0,
                    type: 'local',
                    path: itemRelativePath
                };

                structure.videos.push(videoEntry);
            }
        }
    });

    return structure;
}

// Route to get folder structure (hierarchical)
app.get('/api/playlist', (req, res) => {
    console.log('\n========================================');
    console.log('📋 GET /api/playlist - Generating folder structure');
    console.log('========================================');

    const outputDir = path.join(__dirname, 'output');

    if (!fs.existsSync(outputDir)) {
        console.log('⚠️  Output directory does not exist!');
        return res.json({ name: 'Root', path: '', type: 'folder', folders: [], videos: [] });
    }

    const structure = buildFolderStructure(outputDir, outputDir);

    console.log('\n========================================');
    console.log(`✅ Folder structure generation complete`);
    console.log(`   Folders: ${structure.folders.length}`);
    console.log(`   Videos in root: ${structure.videos.length}`);
    console.log('========================================\n');

    res.json(structure);
});

// Route to get playlist data (flat list - compatible with app.js format)
app.get('/output', (req, res) => {
    console.log('\n========================================');
    console.log('📋 GET /output - Generating playlist');
    console.log('========================================');

    const outputDir = path.join(__dirname, 'output');

    if (!fs.existsSync(outputDir)) {
        console.log('⚠️  Output directory does not exist!');
        return res.json([]);
    }

    const playlist = scanDirectoryRecursive(outputDir, outputDir);

    console.log('\n========================================');
    console.log(`✅ Playlist generation complete: ${playlist.length} videos total`);
    console.log('========================================');
    console.log('Full playlist:');
    playlist.forEach((video, index) => {
        console.log(`${index + 1}. ${video.title} (${video.id})`);
    });
    console.log('========================================\n');

    res.json(playlist);
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

    // List available videos on startup (recursively)
    const outputDir = path.join(__dirname, 'output');
    if (fs.existsSync(outputDir)) {
        const playlist = scanDirectoryRecursive(outputDir, outputDir);

        if (playlist.length > 0) {
            console.log('\n📹 Available videos (recursive scan):');
            playlist.forEach(video => {
                console.log(`   • ${video.title} (${video.id})`);
            });
            console.log('');
        } else {
            console.log('\n⚠️  No video files found in output directory\n');
        }
    } else {
        console.log('\n⚠️  Output directory not found. Please create it and add video files.\n');
    }
});
