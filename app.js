document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const STORAGE_KEY = 'youtube_playlist_app_videos';

    // Google Sheet URL for loading playlist
    // Format: Sheet should have 3 columns: Number, Title, YouTube URL
    // Example:
    // 1    Video Title    https://www.youtube.com/watch?v=VIDEO_ID
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eW5VxIT_wKgcxxzEYntmY3fHR1IogNkld_crnOdZfefWF1FkUP-KveexrFaANFZ8FKGEsTAwX8tt/pubhtml?gid=0&single=true';

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

    // Touch/swipe gesture variables
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const swipeThreshold = 50; // minimum distance for a swipe

    // --- Utility Functions ---

    function isValidVideoId(videoId) {
        // YouTube video IDs are exactly 11 characters: letters, numbers, underscore, hyphen
        return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
    }

    // --- Element References ---
    const videoTitleElement = document.getElementById('video-title');
    const playlistElement = document.getElementById('playlist');
    const notificationElement = document.getElementById('notification');
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const startFullscreenBtn = document.getElementById('start-fullscreen-btn');
    const playlistSidebar = document.getElementById('playlist-sidebar');
    const closePlaylistBtn = document.getElementById('close-playlist-btn');
    const reloadSheetBtn = document.getElementById('reload-sheet-btn');
    let notificationTimeout;


    // --- YouTube IFrame API Setup ---

    // Function to initialize the YouTube player
    function initializeYouTubePlayer() {
        console.log('=== initializeYouTubePlayer called ===');
        // Don't load a video ID initially, wait for user to start
        // This prevents errors when videos array is empty or not yet loaded
        player = new YT.Player('video-player', {
            height: '100%',
            width: '100%',
            playerVars: {
                'playsinline': 1,
                'rel': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
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

            currentVideoId = firstVideo.id;

            // Only load if it's a valid video ID
            const isValid = isValidVideoId(firstVideo.id);
            console.log('Is first video ID valid?', isValid);

            if (isValid) {
                console.log('Cueing video with ID:', firstVideo.id);
                player.cueVideoById({
                    videoId: firstVideo.id,
                    startSeconds: Math.floor(firstVideo.currentTime || 0)
                });
                videoTitleElement.textContent = firstVideo.title;
                updateActivePlaylistItem(firstVideo.id);
                console.log('✓ First video cued successfully');
            } else {
                console.error('✗ First video has invalid ID:', firstVideo.id);
                console.error('Full first video object:', firstVideo);
                videoTitleElement.textContent = 'No valid video available';
            }
        } else {
            console.warn('No videos in playlist');
            videoTitleElement.textContent = 'No videos in playlist';
        }

        console.log('=== onPlayerReady complete ===');
    }


    function onPlayerStateChange(event) {
        clearInterval(timeUpdateInterval); // Clear any existing interval
        if (event.data === YT.PlayerState.PLAYING) {
            // When video is playing, update time every 2 seconds
            timeUpdateInterval = setInterval(saveCurrentTime, 2000);
            // Hide playlist when video is playing
            hidePlaylist();
        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
            // Save one last time when paused or ended
            saveCurrentTime();
            // Show playlist when video is paused or ended
            showPlaylist();
        } else {
            // Save for other states too
            saveCurrentTime();
        }
    }

    function onPlayerError(event) {
        // YouTube player error codes:
        // 2 – Invalid parameter (usually bad video ID)
        // 5 – HTML5 player error
        // 100 – Video not found or removed
        // 101 – Video not allowed to be played in embedded players
        // 150 – Same as 101

        const errorMessages = {
            2: 'Invalid video ID',
            5: 'Player error occurred',
            100: 'Video not found or has been removed',
            101: 'Video cannot be played in embedded player',
            150: 'Video cannot be played in embedded player'
        };

        const errorCode = event.data;
        const errorMessage = errorMessages[errorCode] || 'Unknown error';

        console.error(`YouTube Player Error ${errorCode}: ${errorMessage}`);
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
            if (isValidVideoId(video.id)) {
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
        playlistSidebar.classList.add('show');
    }

    function hidePlaylist() {
        console.log('hidePlaylist called');
        console.log('playlistSidebar element:', playlistSidebar);
        console.log('Current classes:', playlistSidebar.className);
        playlistSidebar.classList.remove('show');
        console.log('Classes after remove:', playlistSidebar.className);
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
     * Expected format: Number, Title, YouTube URL (tab or comma separated)
     * Example: 1    Video Title    https://www.youtube.com/watch?v=VIDEO_ID
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

                // Extract video ID from the URL
                const videoId = extractVideoId(url);
                console.log(`  Extracted video ID: "${videoId}"`);

                const isValid = isValidVideoId(videoId);
                console.log(`  Is valid: ${isValid}`);

                if (videoId && isValid) {
                    const videoObj = {
                        id: videoId,
                        title: title,
                        currentTime: 0
                    };
                    videos.push(videoObj);
                    console.log(`  ✓ Added video:`, videoObj);
                } else {
                    console.warn(`  ✗ Skipping invalid video: "${title}" - URL: ${url} - Extracted ID: ${videoId}`);
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
     * Loads videos from Google Sheets.
     */
    async function loadVideosFromSheet() {
        console.log('=== loadVideosFromSheet called ===');
        console.log('Sheet URL:', SHEET_URL);

        try {
            const csvUrl = getCsvUrl(SHEET_URL);
            console.log('CSV URL:', csvUrl);

            const response = await fetch(csvUrl);
            console.log('Fetch response status:', response.status);
            console.log('Fetch response ok:', response.ok);

            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.statusText}`);
            }

            const csvText = await response.text();
            console.log('CSV text received, length:', csvText.length);

            const sheetVideos = parseVideosFromCSV(csvText);
            console.log('Parsed sheet videos:', sheetVideos);

            if (sheetVideos.length > 0) {
                console.log(`✓ Loaded ${sheetVideos.length} videos from Google Sheet`);
                return sheetVideos;
            } else {
                console.warn('No videos found in sheet, using defaults');
                return defaultVideos;
            }
        } catch (error) {
            console.error('✗ Error loading videos from sheet:', error);
            showNotification('Failed to load playlist from Google Sheets, using defaults');
            return defaultVideos;
        }
    }

    // --- Core Functions ---

    function loadAndPrepareVideos() {
        const storedVideos = JSON.parse(localStorage.getItem(STORAGE_KEY));
        // Ensure every video object has a currentTime property, defaulting to 0
        videos = (storedVideos || defaultVideos).map(v => ({
            id: v.id,
            title: v.title,
            currentTime: v.currentTime || 0
        }));
    }

    function saveVideos() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
    }

    function saveCurrentTime() {
        if (!player || typeof player.getCurrentTime !== 'function' || !currentVideoId) {
            return; // Player not ready or no video loaded
        }
        const currentTime = player.getCurrentTime();
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

    function extractVideoId(url) {
        if (!url) return null;
        // Check if it's already a video ID (11 characters, alphanumeric, underscore, hyphen)
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

        // Extract from URL
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }


    async function handleReloadSheet() {
        // Show loading state
        playlistElement.innerHTML = '<div class="p-8 text-center text-gray-500"><svg class="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Loading from Google Sheets...</div>';

        try {
            const sheetVideos = await loadVideosFromSheet();
            console.warn(' sheetVideos ', sheetVideos)

            // Preserve currentTime for existing videos
            const existingVideos = videos || [];
            videos = sheetVideos.map(sheetVideo => {
                const existing = existingVideos.find(v => v.id === sheetVideo.id);
                return {
                    id: sheetVideo.id,
                    title: sheetVideo.title,
                    currentTime: existing ? existing.currentTime : 0
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
            console.error('Error reloading from sheet:', error);
            showNotification('Failed to reload playlist');
            generatePlaylist(); // Restore previous playlist
        }
    }

    function loadVideo(videoId, videoTitle) {
        if (!player) return;

        // Validate video ID before attempting to load
        if (!isValidVideoId(videoId)) {
            console.error(`Invalid video ID: ${videoId}`);
            showNotification(`Skipping invalid video: ${videoTitle}`);
            // Don't call playNextVideo here to avoid infinite loop
            // Let the error handler manage it instead
            return;
        }

        const videoData = videos.find(v => v.id === videoId);
        const startTime = videoData ? Math.floor(videoData.currentTime) : 0;

        player.loadVideoById({
            videoId: videoId,
            startSeconds: startTime
        });

        currentVideoId = videoId;
        videoTitleElement.textContent = videoTitle;
        updateActivePlaylistItem(videoId);

        // Hide playlist when a new video is selected
        hidePlaylist();
    }

    function generatePlaylist() {
        playlistElement.innerHTML = '';
        videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'playlist-item p-4 md:p-3 rounded-lg transition-colors duration-200 hover:bg-blue-100 flex items-center space-x-3 min-h-[56px]';
            item.dataset.videoId = video.id;

            const timeInSeconds = video.currentTime || 0;
            const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
            const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
            const timeString = `${minutes}:${seconds}`;

            const playIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 md:h-6 md:w-6 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
            const titleSpan = `<span class="flex-1 truncate text-sm md:text-base">${video.title}</span>`;
            const timeSpan = `<span class="text-xs md:text-xs text-gray-500 font-mono time-display">${timeString}</span>`;
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

    // --- Click to Pause/Play Functions ---

    function setupClickToPause() {
        const videoContainer = document.getElementById('video-player-container');

        // Handle both mouse clicks and touch taps
        videoContainer.addEventListener('click', handleVideoContainerClick);
        videoContainer.addEventListener('touchend', handleVideoContainerTouch);
    }

    function handleVideoContainerClick(e) {
        const clickX = e.clientX;
        const screenWidth = window.innerWidth;
        const leftThirdBoundary = screenWidth / 3;

        // Check if click is in the left 1/3 of screen
        if (clickX <= leftThirdBoundary) {
            togglePlayPause();
        }
    }

    function handleVideoContainerTouch(e) {
        // Only process if it's a tap (not a swipe)
        const moveDistance = Math.abs(touchEndX - touchStartX) + Math.abs(touchEndY - touchStartY);

        // If movement is very small, consider it a tap
        if (moveDistance < 10) {
            const touchX = e.changedTouches[0].clientX;
            const screenWidth = window.innerWidth;
            const leftThirdBoundary = screenWidth / 3;

            // Check if tap is in the left 1/3 of screen
            if (touchX <= leftThirdBoundary) {
                togglePlayPause();
            }
        }
    }

    function togglePlayPause() {
        if (!player || typeof player.getPlayerState !== 'function') {
            return;
        }

        const playerState = player.getPlayerState();

        if (playerState === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else if (playerState === YT.PlayerState.PAUSED) {
            player.playVideo();
        }
    }

    async function initializeApp() {
        console.log('=== initializeApp called ===');

        // Show loading state
        playlistElement.innerHTML = '<div class="p-8 text-center text-gray-500">Loading playlist...</div>';

        // Try to load from Google Sheets first
        const storedVideos = JSON.parse(localStorage.getItem(STORAGE_KEY));
        console.log('Stored videos from localStorage:', storedVideos);

        if (!storedVideos) {
            console.log('No stored videos, loading from Google Sheet...');
            // No stored videos, try to load from Google Sheet
            const sheetVideos = await loadVideosFromSheet();
            console.log('Loaded from sheet:', sheetVideos);

            videos = sheetVideos.map(v => ({
                id: v.id,
                title: v.title,
                currentTime: v.currentTime || 0
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
                currentTime: v.currentTime || 0
            }));
            console.log('Videos array after mapping:', videos);
        }

        console.log('Final videos array:', videos);
        console.log('Videos count:', videos.length);

        generatePlaylist();
        setupSwipeGestures();
        setupClickToPause();

        // Disable start button until player is ready
        startFullscreenBtn.disabled = true;
        startFullscreenBtn.style.opacity = '0.5';

        console.log('=== initializeApp complete ===');
        // Player initialization is handled by onYouTubeIframeAPIReady
    }

    // --- Event Listeners ---
    console.log('Setting up event listeners...');
    console.log('closePlaylistBtn:', closePlaylistBtn);

    closePlaylistBtn.addEventListener('click', () => {
        console.log('Close button clicked!');
        hidePlaylist();
    });
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
