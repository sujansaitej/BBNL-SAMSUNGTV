// ========================================================
// BBNL AVPlay Video Player - Samsung Tizen TV Compatible
// ES5 Syntax for Tizen WebEngine Compatibility
// ========================================================
/* global Hls, webapis, tizen */
/* exported AVPlayer */

var AVPlayer = (function() {
    'use strict';

    // Player state
    var state = {
        videoUrl: '',
        hlsPlayer: null,
        avplayObject: null,
        isPlaying: false,
        isPaused: false,
        isMuted: false,
        volume: 100,
        currentTime: 0,
        duration: 0,
        buffering: false,
        error: null
    };

    // Configuration
    var config = {
        containerId: 'video-wrapper',
        videoElementId: 'video-player',
        avplayObjectId: 'av-player',
        debug: true,
    };

    // Environment detection
    var environment = {
        isEmulator: false,
        isRealTV: false,
        avplaySupported: false,
        detected: false
    };

    // Callbacks
    var callbacks = {
        onPlay: null,
        onPause: null,
        onStop: null,
        onBufferingStart: null,
        onBufferingComplete: null,
        onBufferingProgress: null,
        onTimeUpdate: null,
        onError: null,
        onStreamComplete: null
    };

    // -------------------- UTILITY FUNCTIONS --------------------

    /**
     * Get HTML5 video element
     * @returns {HTMLVideoElement|null}
     */
    function getVideoElement() {
        return document.getElementById(config.videoElementId);
    }

    function log(message, data) {
        if (config.debug) {
            if (data !== undefined) {
                console.log('[AVPlayer] ' + message, data);
            } else {
                console.log('[AVPlayer] ' + message);
            }
        }
    }

    function error(message, data) {
        if (data !== undefined) {
            console.error('[AVPlayer] ' + message, data);
        } else {
            console.error('[AVPlayer] ' + message);
        }
    }

    // -------------------- TIZEN DETECTION --------------------

    function isTizenTV() {
        return typeof webapis !== 'undefined' && typeof webapis.avplay !== 'undefined';
    }

    function getTizenVersion() {
        if (typeof tizen !== 'undefined' && tizen.systeminfo) {
            try {
                var version = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
                return version;
            } catch (e) {
                return 'unknown';
            }
        }
        return null;
    }

    /**
     * Detect if running in Tizen Emulator
     * Emulator has limited AVPlay support
     */
    function isEmulator() {
        if (environment.detected) {
            return environment.isEmulator;
        }

        try {
            if (typeof tizen !== 'undefined' && tizen.systeminfo) {
                // Check for emulator-specific characteristics
                var modelName = tizen.systeminfo.getCapability('http://tizen.org/system/model_name');
                var buildType = tizen.systeminfo.getCapability('http://tizen.org/system/build.type');
                
                // Emulator typically has 'Emulator' in model name or 'eng' build type
                environment.isEmulator = (
                    (modelName && modelName.toLowerCase().indexOf('emulator') !== -1) ||
                    (buildType && buildType.toLowerCase() === 'eng')
                );
                
                log('Model Name:', modelName);
                log('Build Type:', buildType);
            }
        } catch (e) {
            log('Emulator detection error (likely emulator):', e.message);
            // If we can't detect, assume emulator for safety
            environment.isEmulator = true;
        }

        environment.isRealTV = !environment.isEmulator;
        environment.detected = true;
        
        log('Environment - Emulator:', environment.isEmulator, 'Real TV:', environment.isRealTV);
        return environment.isEmulator;
    }

    /**
     * Check if AVPlay is fully supported and functional
     * @returns {boolean} true if AVPlay can be used safely
     */
    function checkAVPlayCapability() {
        if (!isTizenTV()) {
            log('AVPlay not available - not a Tizen TV');
            environment.avplaySupported = false;
            return false;
        }

        try {
            // Check if webapis.avplay exists and has required methods
            if (typeof webapis.avplay.open !== 'function' ||
                typeof webapis.avplay.close !== 'function' ||
                typeof webapis.avplay.prepareAsync !== 'function' ||
                typeof webapis.avplay.play !== 'function') {
                log('AVPlay API incomplete');
                environment.avplaySupported = false;
                return false;
            }

            // Check current state - should be NONE or IDLE initially
            try {
                var currentState = webapis.avplay.getState();
                log('AVPlay initial state:', currentState);
            } catch (stateErr) {
                log('Could not get AVPlay state:', stateErr.message);
                // Continue anyway - state check is not critical
            }

            // In emulator, AVPlay may not work properly
            if (isEmulator()) {
                log('⚠️ Running in Emulator - AVPlay may have limited functionality');
                // Still mark as supported, but we'll handle errors gracefully
            }

            environment.avplaySupported = true;
            return true;

        } catch (e) {
            error('AVPlay capability check failed:', e.message);
            environment.avplaySupported = false;
            return false;
        }
    }

    /**
     * Safely close AVPlay if it's open
     * Must be called before opening a new stream
     */
    function safeCloseAVPlay() {
        try {
            if (typeof webapis === 'undefined' || typeof webapis.avplay === 'undefined') {
                return true;
            }

            var currentState = webapis.avplay.getState();
            log('Current AVPlay state before close:', currentState);

            // State machine: NONE -> IDLE -> READY -> PLAYING/PAUSED
            // We need to transition back to IDLE or NONE before opening new stream
            if (currentState === 'PLAYING' || currentState === 'PAUSED') {
                try {
                    webapis.avplay.stop();
                    log('AVPlay stopped');
                } catch (stopErr) {
                    log('Stop warning:', stopErr.message);
                }
            }

            if (currentState !== 'NONE') {
                try {
                    webapis.avplay.close();
                    log('AVPlay closed');
                } catch (closeErr) {
                    log('Close warning:', closeErr.message);
                }
            }

            return true;
        } catch (e) {
            // If close fails, it might already be closed
            log('Safe close note:', e.message);
            return true;
        }
    }

    // -------------------- TIZEN AVPLAY IMPLEMENTATION --------------------

    function initTizenAVPlay() {
        log('=== Starting AVPlay Initialization ===' );
        
        // Step 1: Check AVPlay capability
        if (!checkAVPlayCapability()) {
            error('AVPlay not supported, falling back to HLS.js');
            return initHLSPlayer();
        }

        // Step 2: Detect emulator environment
        var runningInEmulator = isEmulator();
        if (runningInEmulator) {
            log('⚠️ EMULATOR DETECTED: AVPlay has limited support');
            log('⚠️ For full testing, please use a real Samsung TV');
        }

        try {
            // Step 3: Hide HTML5 video element
            var videoEl = getVideoElement();
            if (videoEl) {
                videoEl.style.display = 'none';
            }

            var container = document.getElementById(config.containerId) || 
                           document.querySelector('.video-wrapper');
            
            if (!container) {
                error('Video container not found');
                return false;
            }

            // Step 4: CLOSE any existing AVPlay session first (CRITICAL!)
            // Proper sequence: close() → open() → setDisplayRect() → prepareAsync() → play()
            safeCloseAVPlay();

            // Step 5: Remove existing AVPlay object if any
            var existingObject = document.getElementById(config.avplayObjectId);
            if (existingObject && existingObject.parentNode) {
                existingObject.parentNode.removeChild(existingObject);
                log('Removed existing AVPlay object');
            }

            // Step 6: Create new AVPlay object element
            var avplayObject = document.createElement('object');
            avplayObject.id = config.avplayObjectId;
            avplayObject.type = 'application/avplayer';
            
            // CRITICAL: Set explicit fullscreen dimensions for all channels
            avplayObject.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;background:#000;';
            
            container.insertBefore(avplayObject, container.firstChild);

            state.avplayObject = avplayObject;
            log('AVPlay object element created');

            // Step 7: OPEN the stream URL
            var streamUrl = state.videoUrl;
            
            // Use test stream for emulator if URL seems problematic
            if (runningInEmulator && config.testStreamUrl) {
                log('Using test stream for emulator validation');
                // Keep original URL, just log the test option
            }

            // Validate URL before opening
            if (!streamUrl || streamUrl.trim() === '') {
                error('Invalid stream URL');
                handleAVPlayError('invalid_url', 'Stream URL is empty or invalid');
                return false;
            }

            try {
                webapis.avplay.open(streamUrl);
                log('✅ AVPlay opened with URL:', streamUrl);
            } catch (openErr) {
                // This is EXPECTED in emulator - AVPlay has limited support
                log('⚠️ AVPlay open failed (expected in emulator):', openErr.message || openErr);
                log('⚠️ Switching to HLS.js player for compatibility...');
                // Try to fallback to HLS.js on open failure
                return fallbackToHLS('open_failed');
            }

            // Step 8: Set display rect AFTER open
            // Use setTimeout to ensure DOM is ready
            setTimeout(function() {
                try {
                    // Verify AVPlay state before proceeding
                    var currentState = webapis.avplay.getState();
                    if (currentState === 'NONE') {
                        error('AVPlay not properly opened, state is NONE');
                        fallbackToHLS('state_error');
                        return;
                    }

                    // ALWAYS use full screen dimensions for TV (1920x1080)
                    // This ensures ALL channels play in fullscreen regardless of container size
                    var screenWidth = window.innerWidth || 1920;
                    var screenHeight = window.innerHeight || 1080;
                    
                    // Use 0,0 position for fullscreen - top-left corner
                    var displayX = 0;
                    var displayY = 0;
                    var displayWidth = screenWidth;
                    var displayHeight = screenHeight;

                    try {
                        // Set display mode to FULL first for consistent fullscreen
                        try {
                            webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
                            log('Display mode set to FULL_SCREEN');
                        } catch (modeErr) {
                            log('SetDisplayMethod note:', modeErr.message);
                        }
                        
                        webapis.avplay.setDisplayRect(displayX, displayY, displayWidth, displayHeight);
                        log('Display rect set to FULLSCREEN:', displayX, displayY, displayWidth, displayHeight);
                    } catch (displayErr) {
                        log('SetDisplayRect warning (continuing):', displayErr.message);
                        // Continue even if setDisplayRect fails - some streams work without it
                    }

                    // Step 9: Set up listeners BEFORE prepare
                    setupAVPlayListeners();

                    // Step 10: PREPARE ASYNC (not sync!) then play
                    log('Calling prepareAsync...');
                    webapis.avplay.prepareAsync(
                        function onPrepareSuccess() {
                            log('✅ AVPlay prepared successfully');
                            try {
                                state.duration = webapis.avplay.getDuration();
                                log('Stream duration:', state.duration);

                                // Step 11: PLAY
                                webapis.avplay.play();
                                state.isPlaying = true;
                                state.isPaused = false;
                                log('✅ AVPlay playback started');
                                
                                if (callbacks.onPlay) {
                                    callbacks.onPlay();
                                }
                            } catch (playErr) {
                                error('Play after prepare failed:', playErr);
                                fallbackToHLS('play_failed');
                            }
                        },
                        function onPrepareError(err) {
                            error('AVPlay prepareAsync failed:', err);
                            fallbackToHLS('prepare_failed');
                        }
                    );

                } catch (rectErr) {
                    error('SetDisplayRect or prepare failed:', rectErr);
                    fallbackToHLS('init_failed');
                }
            }, 150); // Slightly increased delay for DOM stability

            return true;

        } catch (err) {
            error('AVPlay initialization error:', err);
            // Fallback to HLS.js instead of showing error
            return fallbackToHLS('init_error');
        }
    }

    /**
     * Fallback to HLS.js player when AVPlay fails
     * @param {string} reason - Reason for fallback
     * @returns {boolean} Success status
     */
    function fallbackToHLS(reason) {
        log('🔄 Falling back to HLS.js player. Reason:', reason);
        log('📺 This is normal for emulator/browser - HLS.js provides full playback support');
        
        // Clean up failed AVPlay
        try {
            safeCloseAVPlay();
        } catch (e) {
            log('Cleanup note:', e.message);
        }

        // Remove AVPlay object
        if (state.avplayObject && state.avplayObject.parentNode) {
            state.avplayObject.parentNode.removeChild(state.avplayObject);
            state.avplayObject = null;
        }

        // Show video element again
        var videoEl = getVideoElement();
        if (videoEl) {
            videoEl.style.display = 'block';
            videoEl.style.visibility = 'visible';
        }

        // Initialize HLS.js
        return initHLSPlayer();
    }

    /**
     * Handle AVPlay errors gracefully
     * Always attempts fallback to HLS.js
     */
    function handleAVPlayError(errorType, errorData) {
        error('AVPlay Error [' + errorType + ']:', errorData);
        state.error = errorData;

        log('⚠️ AVPlay error occurred, attempting HLS.js fallback...');
        
        // Clean up failed AVPlay
        try {
            safeCloseAVPlay();
        } catch (e) {
            // Ignore cleanup errors
        }

        // Remove AVPlay object
        if (state.avplayObject && state.avplayObject.parentNode) {
            state.avplayObject.parentNode.removeChild(state.avplayObject);
            state.avplayObject = null;
        }

        // Show video element again
        var videoEl = getVideoElement();
        if (videoEl) {
            videoEl.style.display = 'block';
        }

        // Fallback to HLS.js
        log('Falling back to HLS.js player...');
        var hlsSuccess = initHLSPlayer();
        
        // Only report error to callback if HLS.js also fails
        if (!hlsSuccess && callbacks.onError) {
            callbacks.onError(errorType, errorData);
        }
    }

    function setupAVPlayListeners() {
        var listener = {
            onbufferingstart: function() {
                log('Buffering started');
                state.buffering = true;
                
                if (callbacks.onBufferingStart) {
                    callbacks.onBufferingStart();
                }
            },
            onbufferingprogress: function(percent) {
                log('Buffering progress:', percent + '%');
                
                if (callbacks.onBufferingProgress) {
                    callbacks.onBufferingProgress(percent);
                }
            },
            onbufferingcomplete: function() {
                log('Buffering complete');
                state.buffering = false;
                
                if (callbacks.onBufferingComplete) {
                    callbacks.onBufferingComplete();
                }
            },
            oncurrentplaytime: function(currentTime) {
                state.currentTime = currentTime;
                
                if (callbacks.onTimeUpdate) {
                    callbacks.onTimeUpdate(currentTime, state.duration);
                }
            },
            onevent: function(eventType, eventData) {
                log('AVPlay event:', eventType, eventData);
            },
            onerror: function(eventType) {
                error('AVPlay error:', eventType);
                state.error = eventType;
                
                if (callbacks.onError) {
                    callbacks.onError('playback_error', eventType);
                }
            },
            onsubtitlechange: function(duration, text) {
                // Note: data3 and data4 parameters available but not used
                log('Subtitle:', text, 'duration:', duration);
            },
            ondrmevent: function(drmEvent, drmData) {
                log('DRM event:', drmEvent, drmData);
            },
            onstreamcompleted: function() {
                log('Stream completed');
                state.isPlaying = false;
                
                if (callbacks.onStreamComplete) {
                    callbacks.onStreamComplete();
                }
            }
        };

        webapis.avplay.setListener(listener);
    }

    // -------------------- HLS.JS IMPLEMENTATION --------------------

    function initHLSPlayer() {
        var videoEl = getVideoElement();
        
        if (!videoEl) {
            error('Video element not found');
            return false;
        }

        if (!state.videoUrl) {
            error('No stream URL available');
            return false;
        }

        // Get playback URL (proxied for browser, direct for TV)
        var playbackUrl = getPlaybackUrl(state.videoUrl);
        log('Playback URL:', playbackUrl);

        // Check HLS.js support
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            log('HLS.js supported, initializing...');
            
            // Ensure video element is fullscreen
            videoEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:1;';
            
            state.hlsPlayer = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: true,
                maxBufferLength: 30,
                maxMaxBufferLength: 60
            });

            state.hlsPlayer.loadSource(playbackUrl);
            state.hlsPlayer.attachMedia(videoEl);

            state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
                log('HLS manifest parsed, levels:', data.levels.length);
                videoEl.play().then(function() {
                    state.isPlaying = true;
                    state.isPaused = false;
                    
                    if (callbacks.onPlay) {
                        callbacks.onPlay();
                    }
                }, function(err) {
                    log('Autoplay prevented:', err);
                });
            });

            state.hlsPlayer.on(Hls.Events.ERROR, function(event, data) {
                error('HLS.js error:', data);
                
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            // Check if it's a manifest load error (stream doesn't exist)
                            if (data.details === 'manifestLoadError' || 
                                data.details === 'manifestLoadTimeOut' ||
                                data.details === 'manifestParsingError') {
                                error('Failed to load stream - manifest error');
                                state.hlsPlayer.destroy();
                                state.error = data;
                                
                                if (callbacks.onError) {
                                    callbacks.onError('stream_load_failed', 'Unable to load channel stream. The stream may be offline or unavailable.');
                                }
                            } else {
                                log('Network error, attempting recovery...');
                                state.hlsPlayer.startLoad();
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            log('Media error, attempting recovery...');
                            state.hlsPlayer.recoverMediaError();
                            break;
                        default:
                            error('Fatal error, cannot recover');
                            state.hlsPlayer.destroy();
                            state.error = data;
                            
                            if (callbacks.onError) {
                                callbacks.onError('fatal_error', 'Stream playback failed. Please try again.');
                            }
                            break;
                    }
                }
            });

            state.hlsPlayer.on(Hls.Events.FRAG_BUFFERED, function() {
                if (state.buffering) {
                    state.buffering = false;
                    
                    if (callbacks.onBufferingComplete) {
                        callbacks.onBufferingComplete();
                    }
                }
            });

            // Video element event listeners
            setupVideoElementListeners(videoEl);

            return true;
        }
        // Native HLS support (Safari)
        else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            log('Using native HLS support');
            
            // Ensure video element is fullscreen
            videoEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:1;';
            
            videoEl.src = playbackUrl;
            
            videoEl.addEventListener('loadedmetadata', function() {
                videoEl.play().then(function() {
                    state.isPlaying = true;
                    
                    if (callbacks.onPlay) {
                        callbacks.onPlay();
                    }
                }, function(err) {
                    log('Autoplay prevented:', err);
                });
            });

            setupVideoElementListeners(videoEl);
            return true;
        }
        else {
            error('HLS not supported in this browser');
            return false;
        }
    }

    function setupVideoElementListeners(videoElement) {
        videoElement.addEventListener('timeupdate', function() {
            state.currentTime = videoElement.currentTime * 1000; // Convert to ms
            state.duration = videoElement.duration * 1000;
            
            if (callbacks.onTimeUpdate) {
                callbacks.onTimeUpdate(state.currentTime, state.duration);
            }
        });

        videoElement.addEventListener('waiting', function() {
            state.buffering = true;
            
            if (callbacks.onBufferingStart) {
                callbacks.onBufferingStart();
            }
        });

        videoElement.addEventListener('playing', function() {
            state.buffering = false;
            state.isPlaying = true;
            state.isPaused = false;
            
            if (callbacks.onBufferingComplete) {
                callbacks.onBufferingComplete();
            }
        });

        videoElement.addEventListener('pause', function() {
            state.isPaused = true;
            state.isPlaying = false;
            
            if (callbacks.onPause) {
                callbacks.onPause();
            }
        });

        videoElement.addEventListener('ended', function() {
            state.isPlaying = false;
            
            if (callbacks.onStreamComplete) {
                callbacks.onStreamComplete();
            }
        });

        videoElement.addEventListener('error', function(e) {
            error('Video element error:', e);
            state.error = e;
            
            if (callbacks.onError) {
                callbacks.onError('video_error', e);
            }
        });
    }

    // -------------------- PUBLIC API --------------------

    /**
     * Get stream URL with proxy for browser playback
     * On Tizen TV: use original URL
     * On Chrome/Browser: use proxy URL to avoid CORS
     * @param {string} url - Original stream URL
     * @returns {string} URL to use for playback
     */
    function getPlaybackUrl(url) {
        if (!url) return url;
        
        // On Tizen TV, use direct URLs
        if (isTizenTV()) {
            return url;
        }
        
        // In browser, proxy HLS streams to avoid CORS
        if (url.indexOf('.m3u8') !== -1 && url.indexOf('/stream?') === -1) {
            // Determine proxy base URL
            var proxyBase = '';
            if (typeof window !== 'undefined' && window.location) {
                var hostname = window.location.hostname;
                var port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
                
                // If running from proxy server (port 3000), use same host
                if (port === '3000' || hostname === 'localhost' || hostname === '127.0.0.1') {
                    proxyBase = window.location.protocol + '//' + hostname + ':3000';
                } else {
                    // Fallback to localhost
                    proxyBase = 'http://localhost:3000';
                }
            } else {
                proxyBase = 'http://localhost:3000';
            }
            
            var proxiedUrl = proxyBase + '/stream?url=' + encodeURIComponent(url);
            log('Using proxied stream URL:', proxiedUrl);
            return proxiedUrl;
        }
        
        return url;
    }

    return {
        /**
         * Initialize the player
         * @param {Object} options - Configuration options
         * @param {string} options.url - Stream URL
         * @param {string} options.containerId - Container element ID
         * @param {string} options.videoElementId - Video element ID
         * @param {boolean} options.debug - Enable debug logging
         */
        init: function(options) {
            options = options || {};

            if (options.url) {
                state.videoUrl = options.url;
            }
            if (options.containerId) {
                config.containerId = options.containerId;
            }
            if (options.videoElementId) {
                config.videoElementId = options.videoElementId;
            }
            if (options.debug !== undefined) {
                config.debug = options.debug;
            }

            log('Initializing AVPlayer');
            log('Tizen TV:', isTizenTV());
            log('Stream URL:', state.videoUrl);

            if (!state.videoUrl) {
                error('No stream URL provided');
                return false;
            }

            if (isTizenTV()) {
                log('Using Samsung AVPlay');
                return initTizenAVPlay();
            } else {
                log('Using HLS.js player');
                return initHLSPlayer();
            }
        },

        /**
         * Set the stream URL
         * @param {string} url - Stream URL
         */
        setUrl: function(url) {
            state.videoUrl = url;
        },

        /**
         * Start playback
         */
        play: function() {
            try {
                if (isTizenTV()) {
                    webapis.avplay.play();
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.play();
                    }
                }
                state.isPlaying = true;
                state.isPaused = false;
                
                if (callbacks.onPlay) {
                    callbacks.onPlay();
                }
            } catch (err) {
                error('Play error:', err);
            }
        },

        /**
         * Pause playback
         */
        pause: function() {
            try {
                if (isTizenTV()) {
                    webapis.avplay.pause();
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.pause();
                    }
                }
                state.isPaused = true;
                state.isPlaying = false;
                
                if (callbacks.onPause) {
                    callbacks.onPause();
                }
            } catch (err) {
                error('Pause error:', err);
            }
        },

        /**
         * Stop playback
         */
        stop: function() {
            try {
                if (isTizenTV()) {
                    webapis.avplay.stop();
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.pause();
                        videoEl.currentTime = 0;
                    }
                }
                state.isPlaying = false;
                state.isPaused = false;
                
                if (callbacks.onStop) {
                    callbacks.onStop();
                }
            } catch (err) {
                error('Stop error:', err);
            }
        },

        /**
         * Seek to position
         * @param {number} position - Position in milliseconds
         */
        seekTo: function(position) {
            try {
                if (isTizenTV()) {
                    webapis.avplay.seekTo(position);
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.currentTime = position / 1000;
                    }
                }
            } catch (err) {
                error('Seek error:', err);
            }
        },

        /**
         * Jump forward
         * @param {number} ms - Milliseconds to jump (default 10000)
         */
        jumpForward: function(ms) {
            ms = ms || 10000;
            try {
                if (isTizenTV()) {
                    webapis.avplay.jumpForward(ms);
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.currentTime += ms / 1000;
                    }
                }
            } catch (err) {
                error('Jump forward error:', err);
            }
        },

        /**
         * Jump backward
         * @param {number} ms - Milliseconds to jump (default 10000)
         */
        jumpBackward: function(ms) {
            ms = ms || 10000;
            try {
                if (isTizenTV()) {
                    webapis.avplay.jumpBackward(ms);
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.currentTime -= ms / 1000;
                    }
                }
            } catch (err) {
                error('Jump backward error:', err);
            }
        },

        /**
         * Set volume
         * @param {number} level - Volume level (0-100)
         */
        setVolume: function(level) {
            level = Math.max(0, Math.min(100, level));
            try {
                if (isTizenTV()) {
                    webapis.avplay.setVolume(level);
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.volume = level / 100;
                    }
                }
                state.volume = level;
            } catch (err) {
                error('Set volume error:', err);
            }
        },

        /**
         * Get current volume
         * @returns {number} Volume level (0-100)
         */
        getVolume: function() {
            return state.volume;
        },

        /**
         * Mute/unmute
         * @param {boolean} mute - Mute state
         */
        setMute: function(mute) {
            try {
                if (isTizenTV()) {
                    if (mute) {
                        webapis.avplay.setVolume(0);
                    } else {
                        webapis.avplay.setVolume(state.volume);
                    }
                } else {
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.muted = mute;
                    }
                }
                state.isMuted = mute;
            } catch (err) {
                error('Mute error:', err);
            }
        },

        /**
         * Toggle mute
         */
        toggleMute: function() {
            this.setMute(!state.isMuted);
        },

        /**
         * Get current playback time
         * @returns {number} Current time in milliseconds
         */
        getCurrentTime: function() {
            if (isTizenTV()) {
                try {
                    return webapis.avplay.getCurrentTime();
                } catch (err) {
                    return state.currentTime;
                }
            } else {
                var videoEl = getVideoElement();
                return videoEl ? videoEl.currentTime * 1000 : 0;
            }
        },

        /**
         * Get total duration
         * @returns {number} Duration in milliseconds
         */
        getDuration: function() {
            if (isTizenTV()) {
                try {
                    return webapis.avplay.getDuration();
                } catch (err) {
                    return state.duration;
                }
            } else {
                var videoEl = getVideoElement();
                return videoEl ? videoEl.duration * 1000 : 0;
            }
        },

        /**
         * Get player state
         * @returns {Object} Current state
         */
        getState: function() {
            return {
                isPlaying: state.isPlaying,
                isPaused: state.isPaused,
                isMuted: state.isMuted,
                buffering: state.buffering,
                currentTime: state.currentTime,
                duration: state.duration,
                volume: state.volume,
                error: state.error
            };
        },

        /**
         * Check if player is Tizen AVPlay
         * @returns {boolean}
         */
        isTizen: function() {
            return isTizenTV();
        },

        /**
         * Check if running in Tizen Emulator
         * @returns {boolean}
         */
        isEmulator: function() {
            return isEmulator();
        },

        /**
         * Check if AVPlay is supported
         * @returns {boolean}
         */
        isAVPlaySupported: function() {
            return checkAVPlayCapability();
        },

        /**
         * Get environment information
         * @returns {Object} Environment details
         */
        getEnvironment: function() {
            isEmulator(); // Ensure detection is done
            return {
                isTizen: isTizenTV(),
                isEmulator: environment.isEmulator,
                isRealTV: environment.isRealTV,
                avplaySupported: environment.avplaySupported,
                tizenVersion: getTizenVersion()
            };
        },

        /**
         * Test playback with public HLS stream (for emulator testing)
         * @returns {boolean}
         */
        testWithPublicStream: function() {
            log('Testing with public HLS stream');
            this.destroy();
            state.videoUrl = config.testStreamUrl;
            return this.init({ url: config.testStreamUrl });
        },

        /**
         * Set event callbacks
         * @param {Object} cbs - Callback functions
         */
        setCallbacks: function(cbs) {
            if (cbs.onPlay) { callbacks.onPlay = cbs.onPlay; }
            if (cbs.onPause) { callbacks.onPause = cbs.onPause; }
            if (cbs.onStop) { callbacks.onStop = cbs.onStop; }
            if (cbs.onBufferingStart) { callbacks.onBufferingStart = cbs.onBufferingStart; }
            if (cbs.onBufferingComplete) { callbacks.onBufferingComplete = cbs.onBufferingComplete; }
            if (cbs.onBufferingProgress) { callbacks.onBufferingProgress = cbs.onBufferingProgress; }
            if (cbs.onTimeUpdate) { callbacks.onTimeUpdate = cbs.onTimeUpdate; }
            if (cbs.onError) { callbacks.onError = cbs.onError; }
            if (cbs.onStreamComplete) { callbacks.onStreamComplete = cbs.onStreamComplete; }
        },

        /**
         * Clean up and destroy player
         */
        destroy: function() {
            log('Destroying player');
            try {
                if (state.hlsPlayer) {
                    state.hlsPlayer.destroy();
                    state.hlsPlayer = null;
                }
                
                if (isTizenTV()) {
                    safeCloseAVPlay();
                }

                // Remove AVPlay object if created
                if (state.avplayObject && state.avplayObject.parentNode) {
                    state.avplayObject.parentNode.removeChild(state.avplayObject);
                    state.avplayObject = null;
                }

                // Reset state
                state.isPlaying = false;
                state.isPaused = false;
                state.currentTime = 0;
                state.duration = 0;
                state.buffering = false;
                state.error = null;

            } catch (err) {
                error('Destroy error:', err);
            }
        },

        /**
         * Change stream URL and restart playback
         * @param {string} url - New stream URL
         */
        changeStream: function(url) {
            log('Changing stream to:', url);
            this.destroy();
            state.videoUrl = url;
            
            // Restore video element visibility
            var videoEl = getVideoElement();
            if (videoEl) {
                videoEl.style.display = 'block';
            }
            
            // Re-initialize
            this.init({ url: url });
        },
        
        /**
         * Force fullscreen display for AVPlay
         * Call this if video is not displaying in fullscreen
         */
        setFullScreen: function() {
            log('Setting fullscreen display');
            try {
                if (isTizenTV()) {
                    var screenWidth = window.innerWidth || 1920;
                    var screenHeight = window.innerHeight || 1080;
                    
                    // Set display mode to fullscreen
                    try {
                        webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
                    } catch (e) {
                        log('SetDisplayMethod note:', e.message);
                    }
                    
                    // Set display rect to full screen
                    webapis.avplay.setDisplayRect(0, 0, screenWidth, screenHeight);
                    log('Fullscreen set:', screenWidth, 'x', screenHeight);
                    
                    // Also update the AVPlay object element
                    if (state.avplayObject) {
                        state.avplayObject.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;background:#000;';
                    }
                } else {
                    // For HLS.js / HTML5 video
                    var videoEl = getVideoElement();
                    if (videoEl) {
                        videoEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:1;';
                    }
                }
                return true;
            } catch (err) {
                error('SetFullScreen error:', err);
                return false;
            }
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AVPlayer;
}
