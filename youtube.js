/**
 * YouTube Player Module
 * Handles all YouTube-related functionality including player initialization,
 * video ID validation, and extraction.
 */

const YouTubePlayer = (function() {
    'use strict';

    // Private variables
    let player = null;
    let onReadyCallback = null;
    let onStateChangeCallback = null;
    let onErrorCallback = null;

    /**
     * Validates if a string is a valid YouTube video ID
     * YouTube video IDs are exactly 11 characters: letters, numbers, underscore, hyphen
     */
    function isValidVideoId(videoId) {
        return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId);
    }

    /**
     * Extracts YouTube video ID from various URL formats
     * Supports:
     * - https://www.youtube.com/watch?v=VIDEO_ID
     * - https://youtu.be/VIDEO_ID
     * - https://www.youtube.com/embed/VIDEO_ID
     * - https://www.youtube.com/v/VIDEO_ID
     * - https://www.youtube.com/shorts/VIDEO_ID
     * - Plain VIDEO_ID (11 characters)
     */
    function extractVideoId(url) {
        if (!url) return null;

        // Check if it's already a video ID (11 characters, alphanumeric, underscore, hyphen)
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;

        // Extract from URL
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Initialize YouTube player
     * @param {string} elementId - ID of the DOM element to replace with player
     * @param {object} callbacks - Object containing onReady, onStateChange, onError callbacks
     */
    function initializePlayer(elementId, callbacks = {}) {
        console.log('=== YouTubePlayer.initializePlayer called ===');
        console.log('Element ID:', elementId);

        onReadyCallback = callbacks.onReady;
        onStateChangeCallback = callbacks.onStateChange;
        onErrorCallback = callbacks.onError;

        player = new YT.Player(elementId, {
            height: '100%',
            width: '100%',
            playerVars: {
                'playsinline': 1,
                'rel': 0
            },
            events: {
                'onReady': handlePlayerReady,
                'onStateChange': handlePlayerStateChange,
                'onError': handlePlayerError
            }
        });

        return player;
    }

    /**
     * Internal handler for player ready event
     */
    function handlePlayerReady(event) {
        console.log('=== YouTubePlayer ready ===');
        if (onReadyCallback) {
            onReadyCallback(event);
        }
    }

    /**
     * Internal handler for player state change
     */
    function handlePlayerStateChange(event) {
        if (onStateChangeCallback) {
            onStateChangeCallback(event);
        }
    }

    /**
     * Internal handler for player errors
     */
    function handlePlayerError(event) {
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

        if (onErrorCallback) {
            onErrorCallback(event, errorMessage);
        }
    }

    /**
     * Get the player instance
     */
    function getPlayer() {
        return player;
    }

    /**
     * Load a video by ID
     */
    function loadVideo(videoId, startSeconds = 0) {
        if (!player) {
            console.error('YouTube player not initialized');
            return false;
        }

        if (!isValidVideoId(videoId)) {
            console.error(`Invalid YouTube video ID: ${videoId}`);
            return false;
        }

        player.loadVideoById({
            videoId: videoId,
            startSeconds: Math.floor(startSeconds)
        });

        return true;
    }

    /**
     * Cue a video by ID (load but don't play)
     */
    function cueVideo(videoId, startSeconds = 0) {
        if (!player) {
            console.error('YouTube player not initialized');
            return false;
        }

        if (!isValidVideoId(videoId)) {
            console.error(`Invalid YouTube video ID: ${videoId}`);
            return false;
        }

        player.cueVideoById({
            videoId: videoId,
            startSeconds: Math.floor(startSeconds)
        });

        return true;
    }

    /**
     * Play the current video
     */
    function playVideo() {
        if (player && typeof player.playVideo === 'function') {
            player.playVideo();
        }
    }

    /**
     * Pause the current video
     */
    function pauseVideo() {
        if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
        }
    }

    /**
     * Get current playback time
     */
    function getCurrentTime() {
        if (player && typeof player.getCurrentTime === 'function') {
            return player.getCurrentTime();
        }
        return 0;
    }

    /**
     * Get player state
     */
    function getPlayerState() {
        if (player && typeof player.getPlayerState === 'function') {
            return player.getPlayerState();
        }
        return null;
    }

    /**
     * Toggle play/pause
     */
    function togglePlayPause() {
        if (!player || typeof player.getPlayerState !== 'function') {
            return;
        }

        const playerState = player.getPlayerState();

        if (playerState === YT.PlayerState.PLAYING) {
            pauseVideo();
        } else if (playerState === YT.PlayerState.PAUSED) {
            playVideo();
        }
    }

    /**
     * Check if YouTube API is loaded
     */
    function isAPILoaded() {
        return typeof YT !== 'undefined' && typeof YT.Player !== 'undefined';
    }

    /**
     * Get YouTube player states enum
     */
    function getPlayerStates() {
        if (isAPILoaded()) {
            return {
                UNSTARTED: YT.PlayerState.UNSTARTED,
                ENDED: YT.PlayerState.ENDED,
                PLAYING: YT.PlayerState.PLAYING,
                PAUSED: YT.PlayerState.PAUSED,
                BUFFERING: YT.PlayerState.BUFFERING,
                CUED: YT.PlayerState.CUED
            };
        }
        return null;
    }

    // Public API
    return {
        isValidVideoId,
        extractVideoId,
        initializePlayer,
        getPlayer,
        loadVideo,
        cueVideo,
        playVideo,
        pauseVideo,
        getCurrentTime,
        getPlayerState,
        togglePlayPause,
        isAPILoaded,
        getPlayerStates
    };
})();

// Make it available globally
window.YouTubePlayer = YouTubePlayer;
