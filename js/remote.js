// ========================================================
// BBNL REMOTE CONTROL HANDLER - Samsung Tizen TV Compatible
// ES5 Syntax for Tizen WebEngine Compatibility
// ========================================================
//* global tizen, webapis *//
/* exported RemoteControl */

var RemoteControl = (function() {
    'use strict';

    // -------------------- KEY CODES --------------------
    // Samsung Tizen TV Remote Key Codes
    var KEY_CODES = {
        // Navigation
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        ENTER: 13,
        BACK: 10009,
        EXIT: 10182,
        
        // Media Controls
        PLAY: 415,
        PAUSE: 19,
        STOP: 413,
        FORWARD: 417,
        REWIND: 412,
        
        // Color Buttons
        RED: 403,
        GREEN: 404,
        YELLOW: 405,
        BLUE: 406,
        
        // Number Keys
        NUM_0: 48,
        NUM_1: 49,
        NUM_2: 50,
        NUM_3: 51,
        NUM_4: 52,
        NUM_5: 53,
        NUM_6: 54,
        NUM_7: 55,
        NUM_8: 56,
        NUM_9: 57,
        
        // Additional Keys
        INFO: 457,
        MENU: 10133,
        CHANNEL_UP: 427,
        CHANNEL_DOWN: 428,
        VOLUME_UP: 447,
        VOLUME_DOWN: 448,
        MUTE: 449,
        
        // 123 Button (Virtual Keyboard / Numeric Mode)
        EXTRA: 10253,
        EXTRA_123: 10190,
        SOURCE: 10072,
        GUIDE: 458,
        TOOLS: 10135,
        PRECH: 10190
    };

    // -------------------- STATE --------------------
    var state = {
        focusableElements: [],
        currentFocusIndex: -1,
        isInitialized: false,
        debug: true,
        navigationMode: 'spatial', // 'spatial' or 'linear'
        gridColumns: 1, // for grid navigation
        hasNavigated: false // Track if user has started navigating
    };

    // -------------------- CONFIGURATION --------------------
    var config = {
        focusableSelector: 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), .focusable, .media-item, .channel-card, .app-tile, .sidebar-menu-item, .otp-input',
        focusClass: 'remote-focused',
        containerSelector: null,
        wrapNavigation: false,
        autoFocus: true
    };

    // -------------------- UTILITY FUNCTIONS --------------------

    function log(message, data) {
        if (state.debug) {
            if (data !== undefined) {
                console.log('[Remote] ' + message, data);
            } else {
                console.log('[Remote] ' + message);
            }
        }
    }

   // function isElement(obj)// 
        //return obj && obj.nodeType === 1;//
    

    function isVisible(element) {
        if (!element) {
            return false;
        }
        var style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetParent !== null;
    }

    function getElementCenter(element) {
        var rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    function getDistance(elem1, elem2) {
        var center1 = getElementCenter(elem1);
        var center2 = getElementCenter(elem2);
        var dx = center2.x - center1.x;
        var dy = center2.y - center1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // -------------------- FOCUS MANAGEMENT --------------------

    function updateFocusableElements() {
        var container = config.containerSelector ? 
            document.querySelector(config.containerSelector) : document;
        
        if (!container) {
            container = document;
        }
        
        var elements = container.querySelectorAll(config.focusableSelector);
        state.focusableElements = [];
        
        for (var i = 0; i < elements.length; i++) {
            if (isVisible(elements[i])) {
                state.focusableElements.push(elements[i]);
            }
        }
        
        log('Found focusable elements:', state.focusableElements.length);
        return state.focusableElements;
    }

    function setFocus(element, scroll) {
        if (!element) {
            return false;
        }
        
        // Only show visual focus if user has started navigating with remote
        if (!state.hasNavigated) {
            return true;
        }
        
        // Remove focus from all elements
        var allFocused = document.querySelectorAll('.' + config.focusClass);
        for (var i = 0; i < allFocused.length; i++) {
            allFocused[i].classList.remove(config.focusClass);
        }
        
        // Add focus to new element
        element.classList.add(config.focusClass);
        
        // Update focus index
        for (var j = 0; j < state.focusableElements.length; j++) {
            if (state.focusableElements[j] === element) {
                state.currentFocusIndex = j;
                break;
            }
        }
        
        // Try native focus
        if (typeof element.focus === 'function') {
            element.focus();
        }
        
        // Scroll into view if needed
        if (scroll !== false && typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
        
        log('Focus set to:', element.tagName, element.className);
        return true;
    }

    function getCurrentFocusedElement() {
        var focused = document.querySelector('.' + config.focusClass);
        if (focused) {
            return focused;
        }
        
        // Try document.activeElement
        if (document.activeElement && document.activeElement !== document.body) {
            return document.activeElement;
        }
        
        return null;
    }

    function focusFirst() {
        updateFocusableElements();
        if (state.focusableElements.length > 0) {
            return setFocus(state.focusableElements[0]);
        }
        return false;
    }

    function focusLast() {
        updateFocusableElements();
        if (state.focusableElements.length > 0) {
            return setFocus(state.focusableElements[state.focusableElements.length - 1]);
        }
        return false;
    }

    function focusNext() {
        updateFocusableElements();
        if (state.focusableElements.length === 0) {
            return false;
        }
        
        var nextIndex = state.currentFocusIndex + 1;
        if (nextIndex >= state.focusableElements.length) {
            nextIndex = config.wrapNavigation ? 0 : state.focusableElements.length - 1;
        }
        
        return setFocus(state.focusableElements[nextIndex]);
    }

    function focusPrev() {
        updateFocusableElements();
        if (state.focusableElements.length === 0) {
            return false;
        }
        
        var prevIndex = state.currentFocusIndex - 1;
        if (prevIndex < 0) {
            prevIndex = config.wrapNavigation ? state.focusableElements.length - 1 : 0;
        }
        
        return setFocus(state.focusableElements[prevIndex]);
    }

    // -------------------- SPATIAL NAVIGATION --------------------

    function findElementInDirection(direction) {
        updateFocusableElements();
        var current = getCurrentFocusedElement();
        
        if (!current || state.focusableElements.length === 0) {
            return state.focusableElements[0] || null;
        }
        
        var currentRect = current.getBoundingClientRect();
        var currentCenter = getElementCenter(current);
        
        var candidates = [];
        
        for (var i = 0; i < state.focusableElements.length; i++) {
            var elem = state.focusableElements[i];
            if (elem === current) {
                continue;
            }
            
            var elemCenter = getElementCenter(elem);
            
            var isCandidate = false;
            var priority = 0;
            
            switch (direction) {
                case 'left':
                    if (elemCenter.x < currentCenter.x) {
                        isCandidate = true;
                        // Prioritize elements on same row
                        if (Math.abs(elemCenter.y - currentCenter.y) < currentRect.height / 2) {
                            priority = 100;
                        }
                    }
                    break;
                case 'right':
                    if (elemCenter.x > currentCenter.x) {
                        isCandidate = true;
                        if (Math.abs(elemCenter.y - currentCenter.y) < currentRect.height / 2) {
                            priority = 100;
                        }
                    }
                    break;
                case 'up':
                    if (elemCenter.y < currentCenter.y) {
                        isCandidate = true;
                        // Prioritize elements in same column
                        if (Math.abs(elemCenter.x - currentCenter.x) < currentRect.width / 2) {
                            priority = 100;
                        }
                    }
                    break;
                case 'down':
                    if (elemCenter.y > currentCenter.y) {
                        isCandidate = true;
                        if (Math.abs(elemCenter.x - currentCenter.x) < currentRect.width / 2) {
                            priority = 100;
                        }
                    }
                    break;
            }
            
            if (isCandidate) {
                var distance = getDistance(current, elem);
                candidates.push({
                    element: elem,
                    distance: distance,
                    priority: priority
                });
            }
        }
        
        if (candidates.length === 0) {
            return null;
        }
        
        // Sort by priority (high first), then by distance (low first)
        candidates.sort(function(a, b) {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return a.distance - b.distance;
        });
        
        return candidates[0].element;
    }

    function navigate(direction) {
        // Mark that user has started navigating
        if (!state.hasNavigated) {
            state.hasNavigated = true;
            // Show focus on current element first
            var current = getCurrentFocusedElement();
            if (!current && state.focusableElements.length > 0) {
                current = state.focusableElements[0];
            }
            if (current) {
                current.classList.add(config.focusClass);
                state.currentFocusIndex = state.focusableElements.indexOf(current);
            }
        }
        
        var target = findElementInDirection(direction);
        if (target) {
            return setFocus(target);
        }
        return false;
    }

    // -------------------- ACTION HANDLERS --------------------

    function handleEnter() {
        // If not navigating yet, start navigation and focus first element
        if (!state.hasNavigated) {
            state.hasNavigated = true;
            updateFocusableElements();
            if (state.focusableElements.length > 0) {
                var first = state.focusableElements[0];
                first.classList.add(config.focusClass);
                state.currentFocusIndex = 0;
                if (typeof first.focus === 'function') {
                    first.focus();
                }
            }
            return true;
        }
        
        var focused = getCurrentFocusedElement();
        if (!focused) {
            return false;
        }
        
        log('Enter pressed on:', focused.tagName);
        
        // Handle different element types
        if (focused.tagName === 'A') {
            focused.click();
            return true;
        }
        
        if (focused.tagName === 'BUTTON') {
            focused.click();
            return true;
        }
        
        if (focused.tagName === 'INPUT') {
            if (focused.type === 'checkbox' || focused.type === 'radio') {
                focused.checked = !focused.checked;
                var event = document.createEvent('Event');
                event.initEvent('change', true, true);
                focused.dispatchEvent(event);
            }
            return true;
        }
        
        if (focused.classList.contains('media-item') || 
            focused.classList.contains('channel-card') ||
            focused.classList.contains('app-tile')) {
            focused.click();
            return true;
        }
        
        // Generic click
        focused.click();
        return true;
    }

    function handleBack() {
        log('Back button pressed');
        
        // Check for open modals/popups first
        var modal = document.querySelector('.modal.show, .popup.show, .sidebar-menu.active');
        if (modal) {
            var closeBtn = modal.querySelector('.close-modal, .close-sidebar, .close-btn');
            if (closeBtn) {
                closeBtn.click();
                return true;
            }
        }
        
        // Navigate back in history
        if (window.history.length > 1) {
            window.history.back();
            return true;
        }
        
        return false;
    }

    function handleExit() {
        log('Exit button pressed');
        
        // Try Tizen application exit
        if (typeof tizen !== 'undefined' && tizen.application) {
            try {
                tizen.application.getCurrentApplication().exit();
                return true;
            } catch (e) {
                log('Tizen exit failed:', e);
            }
        }
        
        // Fallback: go to login page
        window.location.href = 'index.html';
        return true;
    }

    function handleNumberKey(num) {
        log('Number key pressed:', num);
        
        // Check if channel search overlay is visible - don't handle numbers here
        var channelOverlay = document.getElementById('channel-search-overlay');
        if (channelOverlay && channelOverlay.classList.contains('show')) {
            log('Channel overlay visible, skipping remote number handler');
            return false; // Let the player handle it
        }
        
        var focused = getCurrentFocusedElement();
        
        // If focused on channel-input, don't handle here (player.html handles it)
        if (focused && focused.classList.contains('channel-input')) {
            log('Channel input focused, skipping remote number handler');
            return false;
        }
        
        // If focused on input, handle number entry
        if (focused && (focused.tagName === 'INPUT' || focused.classList.contains('otp-input'))) {
            // For OTP inputs (maxLength=1), replace the value
            if (focused.maxLength === 1) {
                focused.value = num;
                var inputEvent = document.createEvent('Event');
                inputEvent.initEvent('input', true, true);
                focused.dispatchEvent(inputEvent);
                return true;
            }
            
            // For other inputs, append if not at max length
            if (!focused.maxLength || focused.value.length < focused.maxLength) {
                focused.value += num;
                var appendEvent = document.createEvent('Event');
                appendEvent.initEvent('input', true, true);
                focused.dispatchEvent(appendEvent);
            }
            return true;
        }
        
        return false;
    }

    // Handle 123 button - Show virtual numeric keyboard or focus on input
    function handle123Button() {
        log('123 button pressed - Activating numeric input mode');
        
        // Find any input field on the page
        var inputs = document.querySelectorAll('input[type="tel"], input[type="number"], input[type="text"], .otp-input, .phone-input, .channel-input');
        
        if (inputs.length > 0) {
            // Focus on the first visible input
            for (var i = 0; i < inputs.length; i++) {
                if (isVisible(inputs[i])) {
                    setFocus(inputs[i], true);
                    inputs[i].focus();
                    log('Focused on input:', inputs[i].className || inputs[i].id);
                    return true;
                }
            }
        }
        
        // If on TV Channels or Player page, show channel number input overlay
        var channelOverlay = document.getElementById('channel-search-overlay');
        if (channelOverlay) {
            channelOverlay.classList.add('show');
            var channelInput = document.getElementById('channel-number-input');
            if (channelInput) {
                channelInput.focus();
                channelInput.value = '';
            }
            log('Channel overlay shown');
            return true;
        }
        
        // Check for search input
        var searchInput = document.getElementById('search-input');
        if (searchInput && isVisible(searchInput)) {
            searchInput.focus();
            setFocus(searchInput, true);
            log('Focused on search input');
            return true;
        }
        
        log('No input field found for 123 button');
        return false;
    }

    // -------------------- KEY EVENT HANDLER --------------------

    function handleKeyDown(e) {
        var keyCode = e.keyCode;
        var keyName = e.key || '';
        var handled = false;
        
        log('Key pressed: code=' + keyCode + ', key=' + keyName);
        
        // Handle digit keys using e.key for better emulator compatibility
        if (keyName >= '0' && keyName <= '9') {
            handled = handleNumberKey(keyName);
            if (handled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
        
        switch (keyCode) {
            // Navigation
            case KEY_CODES.LEFT:
                handled = navigate('left');
                break;
            case KEY_CODES.UP:
                handled = navigate('up');
                break;
            case KEY_CODES.RIGHT:
                handled = navigate('right');
                break;
            case KEY_CODES.DOWN:
                handled = navigate('down');
                break;
            case KEY_CODES.ENTER:
                handled = handleEnter();
                break;
            case KEY_CODES.BACK:
                handled = handleBack();
                break;
            case KEY_CODES.EXIT:
                handled = handleExit();
                break;
                
            // Number keys (fallback by keyCode)
            case KEY_CODES.NUM_0:
                handled = handleNumberKey('0');
                break;
            case KEY_CODES.NUM_1:
                handled = handleNumberKey('1');
                break;
            case KEY_CODES.NUM_2:
                handled = handleNumberKey('2');
                break;
            case KEY_CODES.NUM_3:
                handled = handleNumberKey('3');
                break;
            case KEY_CODES.NUM_4:
                handled = handleNumberKey('4');
                break;
            case KEY_CODES.NUM_5:
                handled = handleNumberKey('5');
                break;
            case KEY_CODES.NUM_6:
                handled = handleNumberKey('6');
                break;
            case KEY_CODES.NUM_7:
                handled = handleNumberKey('7');
                break;
            case KEY_CODES.NUM_8:
                handled = handleNumberKey('8');
                break;
            case KEY_CODES.NUM_9:
                handled = handleNumberKey('9');
                break;
                
            // 123 Button / Extra Button (Virtual Keyboard)
            case KEY_CODES.EXTRA:
            case KEY_CODES.EXTRA_123:
            case KEY_CODES.PRECH:
            case 10190: // Alternative 123 key code
            case 10253: // Another 123 key code variant
                handled = handle123Button();
                break;
                
            // Channel Up/Down
            case KEY_CODES.CHANNEL_UP:
                handled = handleChannelChange(1);
                break;
            case KEY_CODES.CHANNEL_DOWN:
                handled = handleChannelChange(-1);
                break;
        }
        
        // Log unhandled keys for debugging
        if (!handled && state.debug) {
            log('Unhandled key code:', keyCode);
        }
        
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    
    // Handle channel up/down
    function handleChannelChange(direction) {
        log('Channel change:', direction > 0 ? 'UP' : 'DOWN');
        
        // Find channel cards
        var channelCards = document.querySelectorAll('.channel-card');
        if (channelCards.length === 0) {
            return false;
        }
        
        var current = getCurrentFocusedElement();
        var currentIndex = -1;
        
        for (var i = 0; i < channelCards.length; i++) {
            if (channelCards[i] === current) {
                currentIndex = i;
                break;
            }
        }
        
        var newIndex = currentIndex + direction;
        if (newIndex < 0) {
            newIndex = channelCards.length - 1;
        }
        if (newIndex >= channelCards.length) {
            newIndex = 0;
        }
        
        setFocus(channelCards[newIndex], true);
        return true;
    }

    // -------------------- INITIALIZATION --------------------

    function registerTizenKeys() {
        // Register TV remote keys (required for TV apps)
        var keys = [
            "Enter", "Exit", "Return",
            "MediaPlayPause", "MediaPlay", "MediaStop", "MediaPause", 
            "MediaRewind", "MediaFastForward",
            "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
            "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
            "ChannelUp", "ChannelDown", "ChannelList",
            "Info", "Menu", "Guide", "Tools", "Source",
            "VolumeUp", "VolumeDown", "VolumeMute",
            "Extra", "PreviousChannel", "Caption"
        ];
        
        function doRegisterKeys() {
            log('Registering Tizen TV remote keys...');
            for (var i = 0; i < keys.length; i++) {
                try {
                    tizen.tvinputdevice.registerKey(keys[i]);
                    log('✅ Registered key: ' + keys[i]);
                } catch (e) {
                    // Key may already be registered or not available on this device
                    log('⚠️ Could not register key: ' + keys[i]);
                }
            }
            log('Tizen keys registration complete');
        }
        
        // Check if Tizen API is immediately available
        if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
            doRegisterKeys();
        } else {
            // Wait for Tizen APIs to be ready (for emulator/late loading)
            log('Tizen API not immediately available - waiting...');
            var attempts = 0;
            var maxAttempts = 50; // 5 seconds max wait
            var checkTizen = setInterval(function() {
                attempts++;
                if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
                    clearInterval(checkTizen);
                    doRegisterKeys();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkTizen);
                    log('Tizen API not available after ' + (maxAttempts / 10) + 's - running in browser mode');
                }
            }, 100);
        }
    }

    function init(options) {
        if (state.isInitialized) {
            log('Already initialized, updating config');
        }
        
        // Merge options
        if (options) {
            if (options.focusableSelector) {
                config.focusableSelector = options.focusableSelector;
            }
            if (options.focusClass) {
                config.focusClass = options.focusClass;
            }
            if (options.containerSelector) {
                config.containerSelector = options.containerSelector;
            }
            if (options.wrapNavigation !== undefined) {
                config.wrapNavigation = options.wrapNavigation;
            }
            if (options.autoFocus !== undefined) {
                config.autoFocus = options.autoFocus;
            }
            if (options.debug !== undefined) {
                state.debug = options.debug;
            }
        }
        
        // Register Tizen keys
        registerTizenKeys();
        
        // Add event listener
        document.removeEventListener('keydown', handleKeyDown);
        document.addEventListener('keydown', handleKeyDown);
        
        // Update focusable elements
        updateFocusableElements();
        
        // Auto focus first element
        if (config.autoFocus && state.focusableElements.length > 0) {
            // Delay to ensure DOM is ready
            setTimeout(function() {
                focusFirst();
            }, 100);
        }
        
        state.isInitialized = true;
        log('Remote control initialized');
        
        return true;
    }

    function destroy() {
        document.removeEventListener('keydown', handleKeyDown);
        state.isInitialized = false;
        log('Remote control destroyed');
    }

    // -------------------- PUBLIC API --------------------

    return {
        init: init,
        destroy: destroy,
        
        // Focus management
        setFocus: setFocus,
        focusFirst: focusFirst,
        focusLast: focusLast,
        focusNext: focusNext,
        focusPrev: focusPrev,
        getCurrentFocused: getCurrentFocusedElement,
        updateFocusable: updateFocusableElements,
        
        // Navigation
        navigate: navigate,
        
        // Actions
        handleEnter: handleEnter,
        handleBack: handleBack,
        
        // Key codes reference
        KEY_CODES: KEY_CODES,
        
        // Focus by selector
        focusBySelector: function(selector) {
            var element = document.querySelector(selector);
            if (element) {
                return setFocus(element);
            }
            return false;
        },
        
        // Focus by index
        focusByIndex: function(index) {
            updateFocusableElements();
            if (index >= 0 && index < state.focusableElements.length) {
                return setFocus(state.focusableElements[index]);
            }
            return false;
        },
        
        // Set container for focus scope
        setContainer: function(selector) {
            config.containerSelector = selector;
            updateFocusableElements();
        },
        
        // Clear container scope
        clearContainer: function() {
            config.containerSelector = null;
            updateFocusableElements();
        }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        RemoteControl.init();
    });
} else {
    RemoteControl.init();
}
