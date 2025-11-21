document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const STORAGE_KEY = 'youtube_playlist_app_videos';

    // LOADING FILELIST FROM GOOGLE SHEET - COMMENTED OUT
    // Google Sheet URL for loading playlist
    // Format: Sheet should have 3 columns: Number, Title, YouTube URL or Local File Path
    // Examples:
    // 1    YouTube Video Title    https://www.youtube.com/watch?v=VIDEO_ID
    // 2    Local Video Title      output/s0601.mp4
    // const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eW5VxIT_wKgcxxzEYntmY3fHR1IogNkld_crnOdZfefWF1FkUP-KveexrFaANFZ8FKGEsTAwX8tt/pubhtml?gid=0&single=true';

    // Now using local API to load file list from output folder
    const PLAYLIST_API_URL = '/api/playlist';

    // Default videos to show if Google Sheet loading fails or is not configured
    const defaultVideos = [
        // { id: 'mDQ4Q6UPSzM', title: '30 MPC servers' },
        // { id: '3JZ_D3ELwOQ', title: 'training something' }

    ].map(v => ({ ...v, currentTime: 0 }));

    // --- State Variables ---
    let videos;
    let player;
    let timeUpdateInterval;
    let currentVideoId = null;
    let folderStructure = null;
    let currentFolder = null;
    let folderHistory = [];

    // Touch/swipe gesture variables
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const swipeThreshold = 50; // minimum distance for a swipe

    // --- Utility Functions ---

    function isLocalVideoPath(path) {
        // Check if it's a local video file path (supports common video extensions)
        if (!path) return false;
        const videoExtensions = /\.(mp4|webm|ogg|mkv|avi|mov|flv|wmv)$/i;
        return videoExtensions.test(path);
    }

    function getVideoType(url) {
        // Determine if the URL is a YouTube video or a local file
        if (isLocalVideoPath(url)) {
            return 'local';
        }
        if (YouTubePlayer.extractVideoId(url)) {
            return 'youtube';
        }
        return null;
    }

    // --- Element References ---
    const videoTitleElement = document.getElementById('video-title');
    const playlistElement = document.getElementById('playlist');
    const notificationElement = document.getElementById('notification');
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const startFullscreenBtn = document.getElementById('start-fullscreen-btn');
    const playlistSidebar = document.getElementById('playlist-sidebar');
    const closePlaylistBtn = document.getElementById('close-playlist-btn');
    const openPlaylistBtn = document.getElementById('open-playlist-btn');
    const reloadSheetBtn = document.getElementById('reload-sheet-btn');
    const html5Player = document.getElementById('html5-player');
    const youtubePlayerDiv = document.getElementById('video-player');
    const clickOverlay = document.getElementById('click-overlay');
    let notificationTimeout;
    let currentPlayerType = null; // 'youtube' or 'local'


    // --- Player Switching Functions ---

    function switchToYouTubePlayer() {
        if (currentPlayerType === 'youtube') return;

        // Hide HTML5 player
        html5Player.classList.add('hidden');
        html5Player.pause();
        html5Player.src = '';

        // Show YouTube player
        youtubePlayerDiv.classList.remove('hidden');
        currentPlayerType = 'youtube';
    }

    function switchToHTML5Player() {
        if (currentPlayerType === 'local') return;

        // Hide YouTube player
        youtubePlayerDiv.classList.add('hidden');
        if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
        }

        // Show HTML5 player
        html5Player.classList.remove('hidden');
        currentPlayerType = 'local';
    }

    // --- HTML5 Player Event Handlers ---

    function setupHTML5PlayerEvents() {
        html5Player.addEventListener('play', () => {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = setInterval(saveCurrentTime, 2000);
            hidePlaylist(); // Hide playlist when video plays
        });

        html5Player.addEventListener('pause', () => {
            clearInterval(timeUpdateInterval);
            saveCurrentTime();
            showPlaylist(); // Show playlist when video is paused
        });

        html5Player.addEventListener('ended', () => {
            clearInterval(timeUpdateInterval);
            saveCurrentTime();
            showPlaylist(); // Show playlist when video ends
        });

        html5Player.addEventListener('error', (e) => {
            console.error('HTML5 Player Error:', e);
            showNotification('Error loading local video file. Skipping to next...');
            setTimeout(() => {
                playNextVideo();
            }, 2000);
        });

        html5Player.addEventListener('timeupdate', () => {
            // Update time display in playlist in real-time
            if (currentVideoId) {
                const timeDisplay = playlistElement.querySelector(`div[data-video-id="${currentVideoId}"] .time-display`);
                if (timeDisplay && html5Player.currentTime) {
                    const minutes = Math.floor(html5Player.currentTime / 60).toString().padStart(2, '0');
                    const seconds = Math.floor(html5Player.currentTime % 60).toString().padStart(2, '0');
                    timeDisplay.textContent = `${minutes}:${seconds}`;
                }
            }
        });
    }

    // --- YouTube IFrame API Setup ---

    // Function to initialize the YouTube player
    function initializeYouTubePlayer() {
        console.log('=== initializeYouTubePlayer called ===');
        player = YouTubePlayer.initializePlayer('video-player', {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        });
    }

    // This global function is called by the YouTube API script when it's ready.
    window.onYouTubeIframeAPIReady = function() {
        console.log('=== onYouTubeIframeAPIReady called ===');
        initializeYouTubePlayer();
    };

    function onPlayerReady(event) {
        console.log('=== onPlayerReady called ===');
        console.log('Videos array:', videos);
        console.log('Videos count:', videos.length);

        // Load the first video if available
        if (videos.length > 0) {
            const firstVideo = videos[0];
            console.log('First video object:', firstVideo);
            console.log('First video ID:', firstVideo.id);
            console.log('First video title:', firstVideo.title);
            console.log('First video type:', firstVideo.type);

            const videoType = firstVideo.type || 'youtube';

            if (videoType === 'youtube') {
                currentVideoId = firstVideo.id;

                // Only load if it's a valid video ID
                const isValid = YouTubePlayer.isValidVideoId(firstVideo.id);
                console.log('Is first video ID valid?', isValid);

                if (isValid) {
                    console.log('Cueing video with ID:', firstVideo.id);
                    switchToYouTubePlayer();
                    YouTubePlayer.cueVideo(firstVideo.id, firstVideo.currentTime || 0);
                    videoTitleElement.textContent = firstVideo.title;
                    updateActivePlaylistItem(firstVideo.id);
                    console.log('✓ First video cued successfully');
                } else {
                    console.error('✗ First video has invalid ID:', firstVideo.id);
                    console.error('Full first video object:', firstVideo);
                    videoTitleElement.textContent = 'No valid video available';
                }
            } else if (videoType === 'local') {
                // For local videos, just set up the UI, don't auto-load
                console.log('First video is local, preparing HTML5 player');
                switchToHTML5Player();
                currentVideoId = firstVideo.id;
                videoTitleElement.textContent = firstVideo.title;
                updateActivePlaylistItem(firstVideo.id);
            }
        } else {
            console.warn('No videos in playlist');
            videoTitleElement.textContent = 'No videos in playlist';
        }

        console.log('=== onPlayerReady complete ===');
    }


    function onPlayerStateChange(event) {
        const PlayerStates = YouTubePlayer.getPlayerStates();
        clearInterval(timeUpdateInterval); // Clear any existing interval
        if (event.data === PlayerStates.PLAYING) {
            // When video is playing, update time every 2 seconds
            timeUpdateInterval = setInterval(saveCurrentTime, 2000);
            // Hide playlist when video is playing
            hidePlaylist();
        } else if (event.data === PlayerStates.PAUSED || event.data === PlayerStates.ENDED) {
            // Save one last time when paused or ended
            saveCurrentTime();
            // Show playlist when video is paused or ended
            showPlaylist();
        } else {
            // Save for other states too
            saveCurrentTime();
        }
    }

    function onPlayerError(event, errorMessage) {
        console.error(`YouTube Player Error ${event.data}: ${errorMessage}`);
        showNotification(`Error: ${errorMessage}. Skipping to next video...`);

        // Try to play next video after a short delay
        setTimeout(() => {
            playNextVideo();
        }, 2000);
    }

    function playNextVideo() {
        if (videos.length === 0) {
            showNotification('No videos in playlist');
            showPlaylist();
            return;
        }

        const currentIndex = currentVideoId ? videos.findIndex(v => v.id === currentVideoId) : -1;

        // Find the next valid video starting from current position
        for (let i = currentIndex + 1; i < videos.length; i++) {
            const video = videos[i];
            const videoType = video.type || 'youtube';

            // Check if video is valid based on its type
            const isValid = (videoType === 'local' && isLocalVideoPath(video.id)) ||
                          (videoType === 'youtube' && YouTubePlayer.isValidVideoId(video.id));

            if (isValid) {
                loadVideo(video.id, video.title);
                return;
            } else {
                console.warn(`Skipping invalid video at index ${i}: ${video.title} (ID: ${video.id})`);
            }
        }

        // No more valid videos found
        showNotification('No more valid videos in playlist');
        showPlaylist();
    }

    function showPlaylist() {
        console.log('showPlaylist called');
        console.log('playlistSidebar element:', playlistSidebar);
        console.log('Current classes:', playlistSidebar.className);
        playlistSidebar.classList.add('show');
        console.log('Classes after add:', playlistSidebar.className);
        // Hide the open button when playlist is visible
        if (openPlaylistBtn) {
            openPlaylistBtn.style.display = 'none';
        }
    }

    function hidePlaylist() {
        console.log('hidePlaylist called');
        console.log('playlistSidebar element:', playlistSidebar);
        console.log('Current classes:', playlistSidebar.className);
        playlistSidebar.classList.remove('show');
        console.log('Classes after remove:', playlistSidebar.className);
        // Show the open button when playlist is hidden
        if (openPlaylistBtn) {
            openPlaylistBtn.style.display = 'block';
        }
    }


    // --- Google Sheets Functions ---

    /**
     * Converts the public HTML URL to a CSV download URL.
     */
    function getCsvUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');

            // Find the document ID part
            const docIdIndex = pathParts.indexOf('e');
            if (docIdIndex === -1 || docIdIndex + 1 >= pathParts.length) {
                return url.replace('pubhtml?', 'pub?output=csv&').replace('pubhtml', 'pub?output=csv');
            }
            const docId = pathParts[docIdIndex + 1];

            // Get the GID from the query parameters
            const gid = urlObj.searchParams.get('gid');
            if (gid === null) {
                return url.replace('pubhtml?', 'pub?output=csv&').replace('pubhtml', 'pub?output=csv');
            }

            // Construct the CSV export URL
            return `https://docs.google.com/spreadsheets/d/e/${docId}/pub?output=csv&gid=${gid}`;

        } catch (e) {
            console.error("Failed to parse sheet URL:", e);
            return url.replace('pubhtml?', 'pub?output=csv&').replace('pubhtml', 'pub?output=csv');
        }
    }

    /**
     * Parses CSV text into video objects.
     * Expected format: Number, Title, YouTube URL or Local File Path (tab or comma separated)
     * Examples:
     *   1    YouTube Video Title    https://www.youtube.com/watch?v=VIDEO_ID
     *   2    Local Video Title      output/s0601.mp4
     */
    function parseVideosFromCSV(csvText) {
        console.log('=== parseVideosFromCSV called ===');
        console.log('CSV Text length:', csvText.length);
        console.log('First 200 chars:', csvText.substring(0, 200));

        const rows = csvText.trim().split('\n');
        console.log('Total rows:', rows.length);

        const videos = [];

        // Skip header row, start from index 1
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) {
                console.log(`Row ${i + 1}: Empty, skipping`);
                continue;
            }

            console.log(`\n--- Row ${i + 1} ---`);
            console.log('Raw row:', row);

            // Split by tab first, then fall back to comma
            let parts = row.split('\t').map(s => s.trim());
            console.log('After tab split, parts count:', parts.length);
            console.log('Parts:', parts);

            // If we only got 1 part, try splitting by comma
            if (parts.length === 1) {
                parts = row.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                console.log('After comma split, parts count:', parts.length);
                console.log('Parts:', parts);
            }

            // We expect at least 3 columns: Number, Title, URL
            if (parts.length >= 3 && parts[1] && parts[2]) {
                const number = parts[0];
                const title = parts[1];
                const url = parts[2];

                console.log(`  Number: "${number}"`);
                console.log(`  Title: "${title}"`);
                console.log(`  URL: "${url}"`);

                // Check if it's a local video file or YouTube URL
                const videoType = getVideoType(url);
                console.log(`  Video type: "${videoType}"`);

                if (videoType === 'local') {
                    // It's a local video file
                    const videoObj = {
                        id: url,  // Store the file path as ID for local files
                        title: title,
                        currentTime: 0,
                        type: 'local'
                    };
                    videos.push(videoObj);
                    console.log(`  ✓ Added local video:`, videoObj);
                } else if (videoType === 'youtube') {
                    // Extract video ID from the YouTube URL
                    const videoId = YouTubePlayer.extractVideoId(url);
                    console.log(`  Extracted video ID: "${videoId}"`);

                    const isValid = YouTubePlayer.isValidVideoId(videoId);
                    console.log(`  Is valid: ${isValid}`);

                    if (videoId && isValid) {
                        const videoObj = {
                            id: videoId,
                            title: title,
                            currentTime: 0,
                            type: 'youtube'
                        };
                        videos.push(videoObj);
                        console.log(`  ✓ Added YouTube video:`, videoObj);
                    } else {
                        console.warn(`  ✗ Skipping invalid YouTube video: "${title}" - URL: ${url} - Extracted ID: ${videoId}`);
                    }
                } else {
                    console.warn(`  ✗ Skipping unknown video type: "${title}" - URL: ${url}`);
                }
            } else {
                console.warn(`  ✗ Skipping row: Not enough columns (expected 3, got ${parts.length})`);
                console.warn(`  Parts:`, parts);
            }
        }

        console.log(`\n=== Parse complete: ${videos.length} valid videos ===`);
        console.log('Final videos array:', videos);
        return videos;
    }

    /**
     * Loads videos from local API (scans output folder).
     */
    async function loadVideosFromLocalAPI() {
        console.log('=== loadVideosFromLocalAPI called ===');
        console.log('Playlist API URL:', PLAYLIST_API_URL);

        try {
            const response = await fetch(PLAYLIST_API_URL);
            console.log('Fetch response status:', response.status);
            console.log('Fetch response ok:', response.ok);

            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }

            const structure = await response.json();
            console.log('Received folder structure:', structure);

            // Store the folder structure
            folderStructure = structure;
            currentFolder = structure;

            // Convert structure to flat list for backward compatibility
            const playlist = flattenFolderStructure(structure);

            if (playlist.length > 0) {
                console.log(`✓ Loaded ${playlist.length} videos from local API`);
                return playlist;
            } else {
                console.warn('No videos found in output folder, using defaults');
                return defaultVideos;
            }
        } catch (error) {
            console.error('✗ Error loading videos from local API:', error);
            showNotification('Failed to load playlist from server, using defaults');
            return defaultVideos;
        }
    }

    /**
     * Flatten folder structure to a simple video list
     */
    function flattenFolderStructure(folder) {
        let videos = [];

        // Add videos from current folder
        if (folder.videos) {
            videos.push(...folder.videos);
        }

        // Add videos from subfolders
        if (folder.folders) {
            folder.folders.forEach(subfolder => {
                videos.push(...flattenFolderStructure(subfolder));
            });
        }

        return videos;
    }

    // LOADING FILELIST FROM GOOGLE SHEET - COMMENTED OUT
    /**
     * Loads videos from Google Sheets.
     */
    // async function loadVideosFromSheet() {
    //     console.log('=== loadVideosFromSheet called ===');
    //     console.log('Sheet URL:', SHEET_URL);

    //     try {
    //         const csvUrl = getCsvUrl(SHEET_URL);
    //         console.log('CSV URL:', csvUrl);

    //         const response = await fetch(csvUrl);
    //         console.log('Fetch response status:', response.status);
    //         console.log('Fetch response ok:', response.ok);

    //         if (!response.ok) {
    //             throw new Error(`Failed to fetch: ${response.statusText}`);
    //         }

    //         const csvText = await response.text();
    //         console.log('CSV text received, length:', csvText.length);

    //         const sheetVideos = parseVideosFromCSV(csvText);
    //         console.log('Parsed sheet videos:', sheetVideos);

    //         if (sheetVideos.length > 0) {
    //             console.log(`✓ Loaded ${sheetVideos.length} videos from Google Sheet`);
    //             return sheetVideos;
    //         } else {
    //             console.warn('No videos found in sheet, using defaults');
    //             return defaultVideos;
    //         }
    //     } catch (error) {
    //         console.error('✗ Error loading videos from sheet:', error);
    //         showNotification('Failed to load playlist from Google Sheets, using defaults');
    //         return defaultVideos;
    //     }
    // }

    // --- Core Functions ---

    function loadAndPrepareVideos() {
        const storedVideos = JSON.parse(localStorage.getItem(STORAGE_KEY));
        // Ensure every video object has a currentTime property and type, defaulting to 0 and 'youtube'
        videos = (storedVideos || defaultVideos).map(v => ({
            id: v.id,
            title: v.title,
            currentTime: v.currentTime || 0,
            type: v.type || 'youtube'
        }));
    }

    function saveVideos() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    }

    function saveCurrentTime() {
        if (!currentVideoId) {
            return; // No video loaded
        }

        let currentTime = 0;

        // Get current time from the appropriate player
        if (currentPlayerType === 'youtube' && player && typeof player.getCurrentTime === 'function') {
            currentTime = player.getCurrentTime();
        } else if (currentPlayerType === 'local' && html5Player && !isNaN(html5Player.currentTime)) {
            currentTime = html5Player.currentTime;
        } else {
            return; // Player not ready
        }

        const videoIndex = videos.findIndex(v => v.id === currentVideoId);

        if (videoIndex > -1) {
            videos[videoIndex].currentTime = currentTime;
            saveVideos();
            // Also update the time display in the playlist in real-time
            const timeDisplay = playlistElement.querySelector(`div[data-video-id="${currentVideoId}"] .time-display`);
            if (timeDisplay) {
                const minutes = Math.floor(currentTime / 60).toString().padStart(2, '0');
                const seconds = Math.floor(currentTime % 60).toString().padStart(2, '0');
                timeDisplay.textContent = `${minutes}:${seconds}`;
            }
        }
    }

    function showNotification(message) {
        if (notificationTimeout) clearTimeout(notificationTimeout);
        notificationElement.textContent = message;
        notificationElement.classList.remove('opacity-0');
        notificationTimeout = setTimeout(() => {
            notificationElement.classList.add('opacity-0');
        }, 3000);
    }


    async function handleReloadSheet() {
        // Show loading state
        playlistElement.innerHTML = '<div class="p-8 text-center text-gray-500"><svg class="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Loading from local server...</div>';

        try {
            const localVideos = await loadVideosFromLocalAPI();
            console.warn(' localVideos ', localVideos)

            // Reset folder navigation to root
            currentFolder = folderStructure;
            folderHistory = [];

            // Preserve currentTime for existing videos
            const existingVideos = videos || [];
            videos = localVideos.map(localVideo => {
                const existing = existingVideos.find(v => v.id === localVideo.id);
                return {
                    id: localVideo.id,
                    title: localVideo.title,
                    currentTime: existing ? existing.currentTime : 0,
                    type: localVideo.type || 'local'
                };
            });

            saveVideos();
            generatePlaylist();

            // If a video is currently playing, update the title
            if (currentVideoId) {
                const currentVideo = videos.find(v => v.id === currentVideoId);
                if (currentVideo) {
                    videoTitleElement.textContent = currentVideo.title;
                }
            }

            showNotification(`Playlist reloaded: ${videos.length} videos`);
        } catch (error) {
            console.error('Error reloading from local server:', error);
            showNotification('Failed to reload playlist');
            generatePlaylist(); // Restore previous playlist
        }
    }

    function loadVideo(videoId, videoTitle) {
        const videoData = videos.find(v => v.id === videoId);
        if (!videoData) {
            console.error(`Video not found: ${videoId}`);
            return;
        }

        const videoType = videoData.type || 'youtube';
        const startTime = Math.floor(videoData.currentTime) || 0;

        if (videoType === 'local') {
            // Load local video file
            switchToHTML5Player();

            html5Player.src = videoId; // For local files, videoId is the file path
            html5Player.currentTime = startTime;

            // Don't auto-play to avoid browser restrictions
            // User can click play button on the video controls
            // Only attempt to play if it's from a user interaction (e.g., clicking a playlist item)
            // The HTML5 controls will handle play/pause

            currentVideoId = videoId;
            videoTitleElement.textContent = videoTitle;
            updateActivePlaylistItem(videoId);
            hidePlaylist();

        } else if (videoType === 'youtube') {
            // Load YouTube video
            if (!player) {
                console.error('YouTube player not initialized');
                return;
            }

            // Validate video ID before attempting to load
            if (!YouTubePlayer.isValidVideoId(videoId)) {
                console.error(`Invalid YouTube video ID: ${videoId}`);
                showNotification(`Skipping invalid video: ${videoTitle}`);
                return;
            }

            switchToYouTubePlayer();

            YouTubePlayer.loadVideo(videoId, startTime);

            currentVideoId = videoId;
            videoTitleElement.textContent = videoTitle;
            updateActivePlaylistItem(videoId);
            hidePlaylist();

        } else {
            console.error(`Unknown video type: ${videoType}`);
            showNotification(`Unknown video type for: ${videoTitle}`);
        }
    }

    function generatePlaylist() {
        playlistElement.innerHTML = '';

        // If we have a folder structure, show folder navigation
        if (currentFolder) {
            generateFolderView(currentFolder);
        } else {
            // Fallback to old flat list
            generateFlatPlaylist();
        }
    }

    function generateFolderView(folder) {
        playlistElement.innerHTML = '';

        // Add back button if not at root
        if (folderHistory.length > 0) {
            const backItem = document.createElement('div');
            backItem.className = 'playlist-item p-4 md:p-3 rounded-lg transition-colors duration-200 hover:bg-gray-200 flex items-center space-x-3 min-h-[56px] bg-gray-100';

            const backIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>`;
            const backText = `<span class="flex-1 text-3xl md:text-4xl font-semibold text-gray-700">.. Back</span>`;
            backItem.innerHTML = backIcon + backText;

            backItem.addEventListener('click', () => {
                goBackFolder();
            });

            playlistElement.appendChild(backItem);
        }

        // Add folders
        if (folder.folders && folder.folders.length > 0) {
            folder.folders.forEach(subfolder => {
                const folderItem = document.createElement('div');
                folderItem.className = 'playlist-item p-4 md:p-3 rounded-lg transition-colors duration-200 hover:bg-yellow-100 flex items-center space-x-3 min-h-[56px] border-l-4 border-yellow-500';

                const folderIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>`;
                const folderName = subfolder.name.split('/').pop(); // Get last part of path
                const videoCount = countVideosInFolder(subfolder);
                const titleSpan = `<span class="flex-1 text-3xl md:text-4xl font-semibold">${folderName}</span>`;
                const countSpan = `<span class="text-xl md:text-2xl text-gray-500">${videoCount} videos</span>`;
                folderItem.innerHTML = folderIcon + titleSpan + countSpan;

                folderItem.addEventListener('click', () => {
                    enterFolder(subfolder);
                });

                playlistElement.appendChild(folderItem);
            });
        }

        // Add videos from current folder
        if (folder.videos && folder.videos.length > 0) {
            folder.videos.forEach(video => {
                const item = document.createElement('div');
                item.className = 'playlist-item p-4 md:p-3 rounded-lg transition-colors duration-200 hover:bg-blue-100 flex items-center space-x-3 min-h-[56px]';
                item.dataset.videoId = video.id;

                const timeInSeconds = video.currentTime || 0;
                const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
                const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
                const timeString = `${minutes}:${seconds}`;

                const videoType = video.type || 'youtube';

                // Different icons for YouTube vs local files
                const playIcon = videoType === 'local'
                    ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

                const titleSpan = `<span class="flex-1 truncate text-3xl md:text-4xl">${video.title}</span>`;
                const timeSpan = `<span class="text-xl md:text-2xl text-gray-500 font-mono time-display">${timeString}</span>`;
                item.innerHTML = playIcon + titleSpan + timeSpan;

                // Touch event handling
                item.addEventListener('click', () => {
                    loadVideo(video.id, video.title);
                });

                // Prevent text selection on long press
                item.addEventListener('touchstart', () => {
                    item.style.userSelect = 'none';
                });

                playlistElement.appendChild(item);
            });
        }
    }

    function generateFlatPlaylist() {
        videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'playlist-item p-4 md:p-3 rounded-lg transition-colors duration-200 hover:bg-blue-100 flex items-center space-x-3 min-h-[56px]';
            item.dataset.videoId = video.id;

            const timeInSeconds = video.currentTime || 0;
            const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
            const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
            const timeString = `${minutes}:${seconds}`;

            const videoType = video.type || 'youtube';

            // Different icons for YouTube vs local files
            const playIcon = videoType === 'local'
                ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

            const titleSpan = `<span class="flex-1 truncate text-3xl md:text-4xl">${video.title}</span>`;
            const timeSpan = `<span class="text-xl md:text-2xl text-gray-500 font-mono time-display">${timeString}</span>`;
            item.innerHTML = playIcon + titleSpan + timeSpan;

            // Touch event handling
            item.addEventListener('click', () => {
                loadVideo(video.id, video.title);
            });

            // Prevent text selection on long press
            item.addEventListener('touchstart', () => {
                item.style.userSelect = 'none';
            });

            playlistElement.appendChild(item);
        });
    }

    function countVideosInFolder(folder) {
        let count = folder.videos ? folder.videos.length : 0;
        if (folder.folders) {
            folder.folders.forEach(subfolder => {
                count += countVideosInFolder(subfolder);
            });
        }
        return count;
    }

    function enterFolder(folder) {
        folderHistory.push(currentFolder);
        currentFolder = folder;
        generateFolderView(folder);
    }

    function goBackFolder() {
        if (folderHistory.length > 0) {
            currentFolder = folderHistory.pop();
            generateFolderView(currentFolder);
        }
    }

    function updateActivePlaylistItem(videoId) {
        const items = playlistElement.querySelectorAll('div[data-video-id]');
        items.forEach(item => {
            if (item.dataset.videoId === videoId) {
                item.classList.add('bg-blue-200', 'font-semibold');
                item.classList.remove('hover:bg-blue-100');
            } else {
                item.classList.remove('bg-blue-200', 'font-semibold');
                item.classList.add('hover:bg-blue-100');
            }
        });
    }

    // --- Swipe Gesture Functions ---

    function handleSwipe() {
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Check if horizontal swipe is more significant than vertical
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
            const currentIndex = videos.findIndex(v => v.id === currentVideoId);

            if (diffX > 0 && currentIndex > 0) {
                // Swipe right - previous video
                const prevVideo = videos[currentIndex - 1];
                loadVideo(prevVideo.id, prevVideo.title);
            } else if (diffX < 0 && currentIndex < videos.length - 1) {
                // Swipe left - next video
                const nextVideo = videos[currentIndex + 1];
                loadVideo(nextVideo.id, nextVideo.title);
            }
        }
    }

    function setupSwipeGestures() {
        const videoContainer = document.getElementById('video-player-container');

        videoContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        videoContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });
    }


function setupClickToPause() {
    // Мы вешаем ОДИН обработчик на наш новый оверлей
    clickOverlay.addEventListener('click', () => {
        // Эта функция уже существует в вашем коде и
        // правильно обрабатывает ОБА типа плееров (YouTube и local)
        togglePlayPause();
    });
}

function togglePlayPause() {
    if (currentPlayerType === 'youtube') {
        if (!player || typeof player.getPlayerState !== 'function') {
            return;
        }

        const playerState = player.getPlayerState();

        if (playerState === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else if (playerState === YT.PlayerState.PAUSED) {
            player.playVideo();
        }
    } else if (currentPlayerType === 'local') {
        if (html5Player.paused) {
            html5Player.play();
        } else {
            html5Player.pause();
        }
    }
}

    async function initializeApp() {
        console.log('=== initializeApp called ===');

        // Show loading state
        playlistElement.innerHTML = '<div class="p-8 text-center text-gray-500">Loading playlist...</div>';

        // Try to load from local API first
        const storedVideos = JSON.parse(localStorage.getItem(STORAGE_KEY));
        console.log('Stored videos from localStorage:', storedVideos);

        if (!storedVideos) {
            console.log('No stored videos, loading from local API...');
            // No stored videos, try to load from local API
            const localVideos = await loadVideosFromLocalAPI();
            console.log('Loaded from local API:', localVideos);

            videos = localVideos.map(v => ({
                id: v.id,
                title: v.title,
                currentTime: v.currentTime || 0,
                type: v.type || 'local'
            }));
            console.log('Videos array after mapping:', videos);

            // Save to localStorage for future use
            saveVideos();
        } else {
            console.log('Using stored videos from localStorage');
            // Use stored videos
            videos = storedVideos.map(v => ({
                id: v.id,
                title: v.title,
                currentTime: v.currentTime || 0,
                type: v.type || 'local'
            }));
            console.log('Videos array after mapping:', videos);
        }

        console.log('Final videos array:', videos);
        console.log('Videos count:', videos.length);

        generatePlaylist();
        setupSwipeGestures();
        setupClickToPause();
        setupHTML5PlayerEvents();

        // Disable start button until player is ready
        startFullscreenBtn.disabled = true;
        startFullscreenBtn.style.opacity = '0.5';

        console.log('=== initializeApp complete ===');
        // Player initialization is handled by onYouTubeIframeAPIReady
    }

    // --- Event Listeners ---
    console.log('Setting up event listeners...');
    console.log('closePlaylistBtn:', closePlaylistBtn);
    console.log('openPlaylistBtn:', openPlaylistBtn);

    closePlaylistBtn.addEventListener('click', () => {
        console.log('Close button clicked!');
        hidePlaylist();
    });

    if (openPlaylistBtn) {
        openPlaylistBtn.addEventListener('click', (e) => {
            console.log('Open playlist button clicked!');
            e.preventDefault();
            e.stopPropagation();
            showPlaylist();
        });
        // Ensure button is visible initially
        openPlaylistBtn.style.display = 'block';
        console.log('Open playlist button initialized');
    } else {
        console.error('Open playlist button not found!');
    }

    reloadSheetBtn.addEventListener('click', handleReloadSheet);

    // --- Initial Setup ---
    initializeApp();

    // Check if YouTube API is already loaded (e.g., from cache on soft reload)
    // If so, initialize the player immediately
    if (typeof YT !== 'undefined' && YT.Player) {
        console.log('=== YouTube API already loaded, initializing player ===');
        initializeYouTubePlayer();
    }
});
