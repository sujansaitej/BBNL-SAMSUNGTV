// ========================================================
// BBNL STREAMING PLATFORM - GLOBAL JAVASCRIPT (ES5 TIZEN SAFE)
// ========================================================
/* global AuthAPI, API_CONFIG, RemoteControl */

// -------------------- THEME MANAGER --------------------
function initializeTheme() {
    var savedTheme = localStorage.getItem('bbnl-theme') || 'dark';
    var body = document.body;

    if (savedTheme === 'light') {
        body.classList.add('light-mode');
        body.classList.remove('dark-mode');
    } else {
        body.classList.add('dark-mode');
        body.classList.remove('light-mode');
    }

    var toggles = document.querySelectorAll('.theme-toggle-input');
    Array.prototype.forEach.call(toggles, function (t) {
        t.checked = (savedTheme === 'dark');
    });
}

function setupThemeToggle() {
    var toggles = document.querySelectorAll('.theme-toggle-input');

    Array.prototype.forEach.call(toggles, function (toggle) {
        toggle.addEventListener('change', function (e) {
            var isDark = e.target.checked;
            var body = document.body;
            var theme = isDark ? 'dark' : 'light';

            if (isDark) {
                body.classList.add('dark-mode');
                body.classList.remove('light-mode');
            } else {
                body.classList.add('light-mode');
                body.classList.remove('dark-mode');
            }

            localStorage.setItem('bbnl-theme', theme);

            Array.prototype.forEach.call(toggles, function (t) {
                if (t !== e.target) {
                    t.checked = isDark;
                }
            });
        });
    });
}


// -------------------- FAVORITES MANAGER --------------------
var FavoritesManager = {
    STORAGE_KEY: 'bbnl-favorites',

    getFavorites: function () {
        var stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    addFavorite: function (item) {
        var list = this.getFavorites();
        var exists = false;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === item.id) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            list.push(item);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
            this.updateUI();
            return true;
        }
        return false;
    },

    removeFavorite: function (id) {
        var list = this.getFavorites();
        var newList = [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].id !== id) {
                newList.push(list[i]);
            }
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newList));
        this.updateUI();
    },

    isFavorite: function (id) {
        var list = this.getFavorites();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) {
                return true;
            }
        }
        return false;
    },

    toggleFavorite: function (item) {
        if (this.isFavorite(item.id)) {
            this.removeFavorite(item.id);
            return false;
        } else {
            this.addFavorite(item);
            return true;
        }
    },

    updateUI: function () {
        var self = this;
        var buttons = document.querySelectorAll('.favorite-btn, .favorite-icon-overlay');

        Array.prototype.forEach.call(buttons, function (btn) {
            var id = btn.getAttribute('data-id');
            if (!id) {
                return;
            }

            var icon = btn.querySelector('i');
            var active = self.isFavorite(id);

            if (active) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            if (icon) {
                if (active) {
                    icon.className = 'fas fa-heart';
                    icon.style.color = '#ff0000';
                } else {
                    icon.className = 'far fa-heart';
                    icon.style.color = '';
                }
            }
        });

        if (window.location.pathname.indexOf('favorites.html') !== -1) {
            renderFavoritesPage();
        }
    }
};


// -------------------- RENDER FAVORITES PAGE --------------------
function renderFavoritesPage() {
    var grid = document.getElementById('favorites-grid');
    if (!grid) {
        return;
    }

    var list = FavoritesManager.getFavorites();
    grid.innerHTML = '';

    if (!list.length) {
        grid.innerHTML = '' +
            '<div style="text-align:center; padding:40px; color:#888;">' +
            '<i class="far fa-heart" style="font-size:48px; opacity:.5;"></i>' +
            '<h3>No Favorites Yet</h3>' +
            '<p>Click the heart icon to add favorites.</p>' +
            '</div>';
        return;
    }

    for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var div = document.createElement('div');
        div.className = 'channel-card';

        div.innerHTML =
            '<div class="channel-logo-box">' +
                '<img src="' + item.image + '" alt="' + (item.title || '') + '">' +
                '<div class="favorite-icon-overlay" data-id="' + item.id + '" onclick="FavoritesManager.removeFavorite(\'' + item.id + '\')">' +
                    '<i class="fas fa-heart"></i>' +
                '</div>' +
            '</div>' +
            '<div class="channel-info">' +
                '<h3>' + item.title + '</h3>' +
                '<p>' + (item.subtitle || 'Live Channel') + '</p>' +
            '</div>';

        grid.appendChild(div);
    }
}


// -------------------- CONNECTIVITY MANAGER --------------------
var ConnectivityManager = {
    init: function () {
        this.injectPopup();
        this.bindEvents();
        // Don't check status on load - only show when connection changes
        // this.checkStatus();
    },

    injectPopup: function () {
        if (document.getElementById('network-popup')) {
            return;
        }

        var html =
            '<div id="network-popup" class="network-popup-overlay">' +
                '<div class="network-popup-card">' +
                    '<div class="network-popup-image-container">' +
                        '<img src="images/network-error-1.svg" id="network-popup-img" alt="Network Error">' +
                    '</div>' +
                    '<div class="network-popup-content">' +
                        '<h2 id="network-popup-title">No Internet Connection</h2>' +
                        '<p id="network-popup-msg">Please check your network and try again</p>' +
                        '<div class="network-popup-actions">' +
                            '<button class="btn-popup-primary" onclick="ConnectivityManager.tryAgain()">Try Again</button>' +
                            '<button class="btn-popup-secondary" id="popup-secondary-btn">Network Settings</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.insertAdjacentHTML('beforeend', html);
    },

    bindEvents: function () {
        var self = this;

        window.addEventListener('online', function () {
            self.hidePopup();
        });

        window.addEventListener('offline', function () {
            self.showPopup();
        });
    },

    checkStatus: function () {
        if (!navigator.onLine) {
            this.showPopup();
        }
    },

    showPopup: function () {
        var popup = document.getElementById('network-popup');
        if (!popup) {
            return;
        }

        var img = document.getElementById('network-popup-img');
        var title = document.getElementById('network-popup-title');
        var msg = document.getElementById('network-popup-msg');
        var btn = document.getElementById('popup-secondary-btn');

        var variant = Math.random() > 0.5;

        if (variant) {
            img.src = 'images/network-error-2.svg';
            title.innerText = "You don't seem connected";
            msg.innerText = "Something went wrong while launching the channel";
            btn.innerText = "Go Back Home";
            btn.onclick = function () {
                window.location.href = 'homepage.html';
            };
        } else {
            img.src = 'images/network-error-1.svg';
            title.innerText = "No Internet Connection";
            msg.innerText = "Please check your network and try again";
            btn.innerText = "Network Settings";
            btn.onclick = function () {
                ConnectivityManager.openSettings();
            };
        }

        popup.style.display = 'flex';
    },

    hidePopup: function () {
        var popup = document.getElementById('network-popup');
        if (popup) {
            popup.style.display = 'none';
        }
    },

    tryAgain: function () {
        if (navigator.onLine) {
            this.hidePopup();
            return;
        }

        var card = document.querySelector('.network-popup-card');
        if (!card) {
            return;
        }

        card.style.transition = 'transform 0.1s';
        card.style.transform = 'translateX(10px)';

        setTimeout(function () {
            card.style.transform = 'translateX(-10px)';
        }, 100);

        setTimeout(function () {
            card.style.transform = 'translateX(0)';
        }, 200);
    },

    openSettings: function () {
        window.location.href = 'settings.html#network';
    }
};


// -------------------- PROFILE MANAGER --------------------
var ProfileManager = {
    init: function () {
        this.loadProfile();
        this.bindEvents();
    },

    loadProfile: function () {
        var name = localStorage.getItem('bbnl-current-profile') || 'alex';
        var avatar = localStorage.getItem('bbnl-current-avatar') || 'https://i.pravatar.cc/150?u=alex';

        var img = document.getElementById('current-profile-avatar');
        if (img) {
            img.src = avatar;
        }

        this.updateActiveProfileUI(name);
    },

    updateActiveProfileUI: function (name) {
        var items = document.querySelectorAll('.profile-dropdown-item');

        Array.prototype.forEach.call(items, function (item) {
            var isActive = item.getAttribute('data-profile') === name;
            var badge = item.querySelector('.profile-dropdown-badge');
            var check = item.querySelector('.profile-check');

            if (isActive) {
                if (!badge) {
                    var info = item.querySelector('.profile-dropdown-info');
                    var b = document.createElement('span');
                    b.className = 'profile-dropdown-badge';
                    b.innerHTML = 'Active';
                    if (info) {
                        info.appendChild(b);
                    }
                }
                if (check) {
                    check.style.display = 'block';
                }
            } else {
                if (badge && badge.parentNode) {
                    badge.parentNode.removeChild(badge);
                }
                if (check) {
                    check.style.display = 'none';
                }
            }
        });
    },

    bindEvents: function () {
        var self = this;
        var menu = document.querySelector('.profile-menu');
        var dropdown = document.getElementById('profile-dropdown');

        if (menu && dropdown) {
            menu.addEventListener('click', function (e) {
                e.stopPropagation();
                var isVisible = dropdown.style.display === 'block';
                dropdown.style.display = isVisible ? 'none' : 'block';
            });
        }

        var profileItems = document.querySelectorAll('.profile-dropdown-item');

        Array.prototype.forEach.call(profileItems, function (item) {
            item.addEventListener('click', function (e) {
                e.stopPropagation();

                var name = item.getAttribute('data-profile');
                var avatar = item.getAttribute('data-avatar');

                localStorage.setItem('bbnl-current-profile', name);
                localStorage.setItem('bbnl-current-avatar', avatar);

                var img = document.getElementById('current-profile-avatar');
                if (img) {
                    img.src = avatar;
                }

                self.updateActiveProfileUI(name);

                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            });
        });

        document.addEventListener('click', function (e) {
            if (dropdown && dropdown.style.display === 'block') {
                var clickInsideDropdown = dropdown.contains(e.target);
                var clickInsideMenu = menu && menu.contains(e.target);

                if (!clickInsideDropdown && !clickInsideMenu) {
                    dropdown.style.display = 'none';
                }
            }
        });
    }
};


// -------------------- INIT ALL MANAGERS --------------------
document.addEventListener('DOMContentLoaded', function () {
    initializeTheme();
    setupThemeToggle();
    FavoritesManager.updateUI();
    // ConnectivityManager.init(); // Disabled - API is working
    ProfileManager.init();
});

// ========================================================
// SAMSUNG TIZEN TV REMOTE CONTROL MANAGER (ES5 COMPATIBLE)
// ========================================================

// Global variable to store registered TV key codes
var tvKeyCodes = {};

// -------------------- LOGIN API INTEGRATION --------------------

/**
 * Login API integration - Request OTP
 * Per API docs: userid and mobile are SEPARATE values
 * The userid from config is used, mobile is entered by user
 * @param {string} mobile - The mobile number entered by user
 */
function callLoginApi(mobile) {
    console.log('=== callLoginApi called ===');
    console.log('Mobile:', mobile);
    
    // Validate input
    if (!mobile || mobile.length !== 10) {
        showErrorOnScreen('Please enter a valid 10-digit mobile number');
        return;
    }
    
    // Show loading state
    var btn = document.querySelector('.btn-primary');
    var spinner = document.getElementById('loading-spinner');
    
    if (btn) { btn.disabled = true; }
    if (spinner) { spinner.style.display = 'block'; }
    
    // Check if AuthAPI is available
    if (typeof AuthAPI !== 'undefined' && typeof AuthAPI.requestOTP === 'function') {
        console.log('Calling AuthAPI.requestOTP...');
        // Per API docs: userid from config, mobile from user input
        var userid = API_CONFIG.USER_CREDENTIALS.userid;
        AuthAPI.requestOTP(userid, mobile).then(function(result) {
            if (btn) { btn.disabled = false; }
            if (spinner) { spinner.style.display = 'none'; }
            
            if (result.success) {
                console.log('OTP sent successfully');
                // Navigate to verify page
                window.location.href = 'verify.html';
            } else {
                console.error('OTP request failed:', result.message);
                showErrorOnScreen(result.message || 'Failed to send OTP. Please try again.');
            }
        }, function(error) {
            console.error('Login error:', error);
            if (btn) { btn.disabled = false; }
            if (spinner) { spinner.style.display = 'none'; }
            showErrorOnScreen(error.message || 'Network error. Please check your connection.');
        });
    } else {
        // Fallback if AuthAPI not loaded
        console.error('AuthAPI not available');
        if (btn) { btn.disabled = false; }
        if (spinner) { spinner.style.display = 'none'; }
        showErrorOnScreen('API not loaded. Please refresh the page.');
    }
}

// -------------------- FOCUS NAVIGATION FUNCTIONS --------------------

/**
 * Moves focus to the left (previous focusable element)
 */
function moveFocusLeft() {
    console.log('moveFocusLeft called');
    var currentElement = document.activeElement;
    var focusableElements = document.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var currentIndex = Array.prototype.indexOf.call(focusableElements, currentElement);
    
    if (currentIndex > 0) {
        focusableElements[currentIndex - 1].focus();
        console.log('Focused previous element');
    } else {
        console.log('Already at first element');
    }
}

/**
 * Moves focus upward (implement grid/vertical navigation as needed)
 */
function moveFocusUp() {
    console.log('moveFocusUp called');
    // Implement custom vertical navigation based on your UI layout
    // For now, move to previous element
    var currentElement = document.activeElement;
    var focusableElements = document.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var currentIndex = Array.prototype.indexOf.call(focusableElements, currentElement);
    
    if (currentIndex > 0) {
        focusableElements[currentIndex - 1].focus();
        console.log('Focused element above');
    }
}

/**
 * Moves focus to the right (next focusable element)
 */
function moveFocusRight() {
    console.log('moveFocusRight called');
    var currentElement = document.activeElement;
    var focusableElements = document.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var currentIndex = Array.prototype.indexOf.call(focusableElements, currentElement);
    
    if (currentIndex < focusableElements.length - 1) {
        focusableElements[currentIndex + 1].focus();
        console.log('Focused next element');
    } else {
        console.log('Already at last element');
    }
}

/**
 * Moves focus downward (implement grid/vertical navigation as needed)
 */
function moveFocusDown() {
    console.log('moveFocusDown called');
    // Implement custom vertical navigation based on your UI layout
    // For now, move to next element
    var currentElement = document.activeElement;
    var focusableElements = document.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var currentIndex = Array.prototype.indexOf.call(focusableElements, currentElement);
    
    if (currentIndex < focusableElements.length - 1) {
        focusableElements[currentIndex + 1].focus();
        console.log('Focused element below');
    }
}

// -------------------- HELPER FUNCTIONS --------------------

/**
 * Handles number key press (0-9)
 * @param {string} num - The digit pressed
 */
function onNumberPressed(num) {
    console.log('onNumberPressed called with:', num);
    var phoneInput = document.getElementById('phoneNumberInput');
    
    if (phoneInput) {
        phoneInput.value = (phoneInput.value || '') + num;
        console.log('Number appended:', num, '| Current value:', phoneInput.value);
    } else {
        console.log('Warning: phoneNumberInput element not found');
    }
}

/**
 * Handles OK/Enter button press
 * Validates input and calls login API
 */
function onOkPressed() {
    console.log('onOkPressed called');
    
    var phoneInput = document.getElementById('phoneNumberInput');
    
    if (!phoneInput) {
        console.log('phoneNumberInput not found - trying to click primary button');
        var btn = document.querySelector('#getOtpButton, button[type="submit"], .btn-primary');
        if (btn) {
            btn.click();
            console.log('Clicked button:', btn.id || btn.className);
        }
        return;
    }
    
    var value = phoneInput.value || '';
    value = value.trim();
    
    // Check if input is empty
    if (value === '') {
        console.log('Input is empty - showing error');
        showErrorOnScreen('Enter number');
        return;
    }
    
    console.log('Valid input detected:', value);
    
    // Call login API if function exists
    if (typeof callLoginApi === 'function') {
        console.log('Calling callLoginApi with value:', value);
        callLoginApi(value);
    } else {
        console.log('callLoginApi function not defined - trying to click submit button');
        var submitBtn = document.querySelector('#getOtpButton, button[type="submit"], .btn-primary');
        if (submitBtn) {
            submitBtn.click();
            console.log('Clicked submit button');
        } else {
            console.log('No submit button found - login may need manual implementation');
        }
    }
}

/**
 * Handles Back button press
 * Navigates to previous screen
 */
function onBackPressed() {
    console.log('onBackPressed called - Back pressed');
    
    if (window.history.length > 1) {
        console.log('Navigating back in history');
        window.history.back();
    } else {
        console.log('No history available - redirecting to homepage');
        window.location.href = 'homepage.html';
    }
}

/**
 * Shows error message on screen
 * @param {string} msg - The error message to display
 */
function showErrorOnScreen(msg) {
    console.log('showErrorOnScreen called with message:', msg);
    
    // Try to find errorMessage element
    var errorMessage = document.getElementById('errorMessage');
    
    if (errorMessage) {
        errorMessage.innerText = msg;
        errorMessage.style.display = 'block';
        console.log('Error displayed in errorMessage element');
        
        // Auto-hide after 3 seconds
        setTimeout(function () {
            errorMessage.style.display = 'none';
        }, 3000);
    } else {
        console.log('errorMessage element not found - creating temporary error display');
        
        // Create temporary error display
        var errorDiv = document.createElement('div');
        errorDiv.id = 'tempErrorDisplay';
        errorDiv.style.cssText = 
            'position: fixed;' +
            'top: 20px;' +
            'left: 50%;' +
            'transform: translateX(-50%);' +
            'background: rgba(255, 0, 0, 0.9);' +
            'color: #fff;' +
            'padding: 15px 30px;' +
            'border-radius: 8px;' +
            'font-size: 18px;' +
            'font-weight: bold;' +
            'z-index: 10000;' +
            'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);' +
            'text-align: center;';
        errorDiv.innerText = msg;
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(function () {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }
}

// -------------------- REGISTER REMOTE KEYS --------------------

/**
 * Registers Samsung Tizen TV remote keys
 * Only registers number keys 0-9 and color keys (Red, Green, Yellow, Blue)
 */
function registerRemoteKeys() {
    console.log('=== Starting Samsung Tizen TV remote key registration ===');
    
    // Check if tizen object exists
    if (typeof tizen === 'undefined' || !tizen.tvinputdevice) {
        console.log('Warning: tizen.tvinputdevice not available (may be running in browser/emulator)');
        console.log('Remote key registration skipped');
        return;
    }
    
    try {
        // Get all supported keys from the TV
        var supported = tizen.tvinputdevice.getSupportedKeys();
        console.log('Total supported TV keys:', supported.length);
        
        // Store key codes for reference
        for (var i = 0; i < supported.length; i++) {
            tvKeyCodes[supported[i].name] = supported[i].code;
        }
        console.log('TV key codes stored:', Object.keys(tvKeyCodes).length);

        // Register ONLY necessary keys to avoid registration errors
        var keysToRegister = [
            // Color keys (Red, Green, Yellow, Blue) - REQUIRED
            'ColorF0Red', 
            'ColorF1Green', 
            'ColorF2Yellow', 
            'ColorF3Blue'
        ];
        
        // Note: Number keys 0-9 do NOT need registration (they work by default)
        console.log('Registering', keysToRegister.length, 'special keys...');

        var successCount = 0;
        var failCount = 0;

        // Attempt to register each key
        for (var j = 0; j < keysToRegister.length; j++) {
            var keyName = keysToRegister[j];
            
            if (tvKeyCodes.hasOwnProperty(keyName)) {
                try {
                    tizen.tvinputdevice.registerKey(keyName);
                    console.log('✓ Successfully registered:', keyName, '| Code:', tvKeyCodes[keyName]);
                    successCount++;
                } catch (err) {
                    console.log('✗ Failed to register:', keyName, '| Error:', err.message || err);
                    failCount++;
                }
            } else {
                console.log('⚠ Key not supported on this device:', keyName);
            }
        }
        
        console.log('=== Registration complete ===');
        console.log('Success:', successCount, '| Failed:', failCount);
        console.log('Number keys 0-9 work by default (no registration needed)');
        
    } catch (error) {
        console.log('ERROR in registerRemoteKeys:', error.message || error);
        console.log('This may happen in emulator or browser - keys may still work');
    }
}

// -------------------- ADD REMOTE LISTENER --------------------

/**
 * Adds keydown event listener for Samsung TV remote control
 * Handles arrow keys, OK button, Back button, number keys, and color keys
 */
function addRemoteListener() {
    console.log('=== Adding remote control event listener ===');
    
    window.addEventListener('keydown', function (e) {
        var keyCode = e.keyCode;
        console.log('KEY pressed:', keyCode);

        switch (keyCode) {
            // ========== ARROW KEYS - Focus Navigation ==========
            case 37: // LEFT
                console.log('← LEFT arrow');
                moveFocusLeft();
                e.preventDefault();
                break;
                
            case 38: // UP
                console.log('↑ UP arrow');
                moveFocusUp();
                e.preventDefault();
                break;
                
            case 39: // RIGHT
                console.log('→ RIGHT arrow');
                moveFocusRight();
                e.preventDefault();
                break;
                
            case 40: // DOWN
                console.log('↓ DOWN arrow');
                moveFocusDown();
                e.preventDefault();
                break;

            // ========== OK/ENTER - Submit ==========
            case 13:
                console.log('OK/ENTER');
                onOkPressed();
                e.preventDefault();
                break;

            // ========== BACK/RETURN - Go Back ==========
            case 10009:
                console.log('BACK/RETURN (10009)');
                onBackPressed();
                e.preventDefault();
                break;

            // ========== NUMBER KEYS 0-9 (Key Codes 48-57) ==========
            case 48: // 0
                console.log('Number: 0');
                onNumberPressed('0');
                break;
            case 49: // 1
                console.log('Number: 1');
                onNumberPressed('1');
                break;
            case 50: // 2
                console.log('Number: 2');
                onNumberPressed('2');
                break;
            case 51: // 3
                console.log('Number: 3');
                onNumberPressed('3');
                break;
            case 52: // 4
                console.log('Number: 4');
                onNumberPressed('4');
                break;
            case 53: // 5
                console.log('Number: 5');
                onNumberPressed('5');
                break;
            case 54: // 6
                console.log('Number: 6');
                onNumberPressed('6');
                break;
            case 55: // 7
                console.log('Number: 7');
                onNumberPressed('7');
                break;
            case 56: // 8
                console.log('Number: 8');
                onNumberPressed('8');
                break;
            case 57: // 9
                console.log('Number: 9');
                onNumberPressed('9');
                break;

            // ========== NUMBER PAD KEYS 0-9 (Alternative codes 96-105) ==========
            case 96:  // Numpad 0
                console.log('Numpad: 0');
                onNumberPressed('0');
                break;
            case 97:  // Numpad 1
                console.log('Numpad: 1');
                onNumberPressed('1');
                break;
            case 98:  // Numpad 2
                console.log('Numpad: 2');
                onNumberPressed('2');
                break;
            case 99:  // Numpad 3
                console.log('Numpad: 3');
                onNumberPressed('3');
                break;
            case 100: // Numpad 4
                console.log('Numpad: 4');
                onNumberPressed('4');
                break;
            case 101: // Numpad 5
                console.log('Numpad: 5');
                onNumberPressed('5');
                break;
            case 102: // Numpad 6
                console.log('Numpad: 6');
                onNumberPressed('6');
                break;
            case 103: // Numpad 7
                console.log('Numpad: 7');
                onNumberPressed('7');
                break;
            case 104: // Numpad 8
                console.log('Numpad: 8');
                onNumberPressed('8');
                break;
            case 105: // Numpad 9
                console.log('Numpad: 9');
                onNumberPressed('9');
                break;

            // ========== COLOR KEYS ==========
            case 403: // RED
                console.log('🔴 RED button (403)');
                if (tvKeyCodes.ColorF0Red && keyCode === tvKeyCodes.ColorF0Red) {
                    console.log('Confirmed ColorF0Red');
                }
                // Add custom red button functionality here
                break;
                
            case 404: // GREEN
                console.log('🟢 GREEN button (404)');
                if (tvKeyCodes.ColorF1Green && keyCode === tvKeyCodes.ColorF1Green) {
                    console.log('Confirmed ColorF1Green');
                }
                // Add custom green button functionality here
                break;
                
            case 405: // YELLOW
                console.log('🟡 YELLOW button (405)');
                if (tvKeyCodes.ColorF2Yellow && keyCode === tvKeyCodes.ColorF2Yellow) {
                    console.log('Confirmed ColorF2Yellow');
                }
                // Add custom yellow button functionality here
                break;
                
            case 406: // BLUE
                console.log('🔵 BLUE button (406)');
                if (tvKeyCodes.ColorF3Blue && keyCode === tvKeyCodes.ColorF3Blue) {
                    console.log('Confirmed ColorF3Blue');
                }
                // Add custom blue button functionality here
                break;

            // ========== MEDIA CONTROL KEYS (Optional - for reference) ==========
            case 415: // PLAY
                console.log('▶ PLAY (415)');
                break;
            case 19: // PAUSE
                console.log('⏸ PAUSE (19)');
                break;
            case 412: // STOP
                console.log('⏹ STOP (412)');
                break;
            case 413: // REWIND
                console.log('⏪ REWIND (413)');
                break;
            case 417: // FAST FORWARD
                console.log('⏩ FAST FORWARD (417)');
                break;

            // ========== CHANNEL KEYS (Optional - for reference) ==========
            case 427: // CHANNEL UP
                console.log('CH ▲ CHANNEL UP (427)');
                break;
            case 428: // CHANNEL DOWN
                console.log('CH ▼ CHANNEL DOWN (428)');
                break;

            // ========== VOLUME KEYS (Optional - for reference) ==========
            case 447: // VOLUME UP
                console.log('VOL + (447)');
                break;
            case 448: // VOLUME DOWN
                console.log('VOL - (448)');
                break;
            case 449: // MUTE
                console.log('🔇 MUTE (449)');
                break;

            // ========== OTHER TV KEYS (Optional - for reference) ==========
            case 10182: // EXIT
                console.log('EXIT (10182)');
                break;
            case 10131: // INFO
                console.log('ℹ INFO (10131)');
                break;
            case 10129: // MENU
                console.log('☰ MENU (10129)');
                break;

            default:
                console.log('Unhandled key code:', keyCode);
                break;
        }
    });
    
    console.log('✓ Remote control listener attached');
}

// ========================================================
// INITIALIZE ON WINDOW LOAD
// ========================================================
window.onload = function () {
    console.log('');
    console.log('========================================');
    console.log('BBNL Samsung Tizen TV App - Loading...');
    console.log('========================================');
    
    // Initialize existing managers
    initializeTheme();
    setupThemeToggle();
    FavoritesManager.updateUI();
    // ConnectivityManager.init(); // Disabled - API is working
    ProfileManager.init();
    
    console.log('✓ Core managers initialized');
    
    // Initialize Samsung TV remote control
    console.log('');
    console.log('--- Samsung TV Remote Control Setup ---');
    registerRemoteKeys();
    addRemoteListener();
    console.log('✓ Remote control initialization complete');
    
    console.log('');
    console.log('========================================');
    console.log('✓ App fully loaded and ready!');
    console.log('========================================');
    console.log('');
};
