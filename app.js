document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const STORAGE_KEY = 'youtube_playlist_app_videos';

    // Default videos to show if localStorage is empty
    const defaultVideos = [
        { id: 'mDQ4Q6UPSzM', title: '30 MPC servers' },
        { id: '3JZ_D3ELwOQ', title: 'training something' }

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

    // --- Element References ---
    const videoTitleElement = document.getElementById('video-title');
    const playlistElement = document.getElementById('playlist');
    const videoUrlInput = document.getElementById('video-url-input');
    const videoTitleInput = document.getElementById('video-title-input');
    const addVideoButton = document.getElementById('add-video-btn');
    const clearPlaylistButton = document.getElementById('clear-playlist-btn');
    const notificationElement = document.getElementById('notification');
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const startFullscreenBtn = document.getElementById('start-fullscreen-btn');
    let notificationTimeout;


    // --- YouTube IFrame API Setup ---

    // This global function is called by the YouTube API script when it's ready.
    window.onYouTubeIframeAPIReady = function() {
        const firstVideo = videos.length > 0 ? videos[0] : null;
        currentVideoId = firstVideo ? firstVideo.id : null;

        player = new YT.Player('video-player', {
            height: '100%',
            width: '100%',
            videoId: currentVideoId,
            playerVars: {
                'playsinline': 1,
                'rel': 0,
                'start': firstVideo ? Math.floor(firstVideo.currentTime) : 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    };

    function onPlayerReady(event) {
        // Update UI for the initially loaded video.
        if (videos.length > 0) {
            const firstVideo = videos[0];
            videoTitleElement.textContent = firstVideo.title;
            updateActivePlaylistItem(firstVideo.id);
        }
    }

    function startFullscreenMode() {
        // Hide the overlay
        fullscreenOverlay.style.opacity = '0';
        setTimeout(() => {
            fullscreenOverlay.style.display = 'none';
        }, 300);

        // Start playing the video
        if (player && typeof player.playVideo === 'function') {
            player.playVideo();
        }

        // Request fullscreen mode for the player iframe
        const iframe = player.getIframe();
        if (iframe) {
            // Small delay to ensure the overlay is hidden
            setTimeout(() => {
                if (iframe.requestFullscreen) {
                    iframe.requestFullscreen().catch(err => {
                        console.log('Fullscreen request failed:', err);
                    });
                } else if (iframe.webkitRequestFullscreen) {
                    iframe.webkitRequestFullscreen();
                } else if (iframe.mozRequestFullScreen) {
                    iframe.mozRequestFullScreen();
                } else if (iframe.msRequestFullscreen) {
                    iframe.msRequestFullscreen();
                }
            }, 100);
        }
    }

    function onPlayerStateChange(event) {
        clearInterval(timeUpdateInterval); // Clear any existing interval
        if (event.data === YT.PlayerState.PLAYING) {
            // When video is playing, update time every 2 seconds
            timeUpdateInterval = setInterval(saveCurrentTime, 2000);
        } else {
            // Save one last time when paused or ended
            saveCurrentTime();
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
        if (url.length === 11 && !url.includes('.')) return url;
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    function handleAddVideo() {
        const url = videoUrlInput.value.trim();
        const title = videoTitleInput.value.trim();

        if (!url || !title) {
            showNotification('Please provide both a video URL/ID and a title.');
            return;
        }
        const videoId = extractVideoId(url);
        if (!videoId) {
            showNotification('Could not find a valid YouTube video ID in the URL.');
            return;
        }
        if (videos.some(video => video.id === videoId)) {
            showNotification('This video is already in the playlist.');
            return;
        }

        videos.push({ id: videoId, title: title, currentTime: 0 });
        saveVideos();
        generatePlaylist();
        videoUrlInput.value = '';
        videoTitleInput.value = '';
    }

    function handleClearPlaylist() {
        if (player && typeof player.stopVideo === 'function') {
            player.stopVideo();
            player.clearVideo();
        }
        currentVideoId = null;
        videos = [];
        saveVideos();
        generatePlaylist();
        videoTitleElement.textContent = 'Playlist Cleared';
    }

    function loadVideo(videoId, videoTitle) {
        if (!player) return;

        const videoData = videos.find(v => v.id === videoId);
        const startTime = videoData ? Math.floor(videoData.currentTime) : 0;

        player.loadVideoById({
            videoId: videoId,
            startSeconds: startTime
        });

        currentVideoId = videoId;
        videoTitleElement.textContent = videoTitle;
        updateActivePlaylistItem(videoId);
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

    function initializeApp() {
        loadAndPrepareVideos();
        generatePlaylist();
        setupSwipeGestures();
        // Player initialization is handled by onYouTubeIframeAPIReady
    }

    // --- Event Listeners ---
    addVideoButton.addEventListener('click', handleAddVideo);
    clearPlaylistButton.addEventListener('click', handleClearPlaylist);
    startFullscreenBtn.addEventListener('click', startFullscreenMode);

    // --- Initial Setup ---
    initializeApp();
});
