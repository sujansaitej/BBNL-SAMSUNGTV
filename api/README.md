# BBNL API Integration Layer

Complete API integration module for BBNL IPTV streaming platform. This directory contains all API communication logic, configuration, and helper functions for authentication, channel management, and advertisements.

## 📁 File Structure

```
api/
├── config.js      # Central API configuration (URLs, headers, endpoints, proxy)
├── auth.js        # Authentication & session management (login, OTP, logout)
├── channels.js    # Channel data & categories (fetch, filter, organize)
└── ads.js         # Advertisement management (banners, IPTV ads)
```

## 📋 Table of Contents

- [Configuration](#-configuration-configjs)
- [Authentication API](#-authentication-api-authjs)
- [Channels API](#-channels-api-channelsjs)
- [Advertisement API](#-advertisement-api-adsjs)
- [Error Handling](#-error-handling)
- [Usage Examples](#-usage-examples)
- [Best Practices](#-best-practices)

## 🔧 Configuration (config.js)

Central configuration file for all API settings, endpoints, and CORS proxy management.

### Configuration Object

```javascript
var API_CONFIG = {
    // API Base URLs
    AUTH_BASE_URL: 'http://124.40.244.211/netmon/cabletvapis',
    ADS_BASE_URL: 'https://bbnlnetmon.bbnl.in/prod/cabletvapis',
    
    // Authentication Header (Base64 encoded)
    AUTH_HEADER: 'Basic Zm9maWxhYkBnbWFpbC5jb206MTIzNDUtNTQzMjE=',
    
    // Device Identifiers
    DEVICE_SERIAL: 'FOFI20191129000336',
    DEVICE_MAC: '68:1D:EF:14:6C:21',
    
    // CORS Proxy Settings
    USE_PROXY: true,  // Set to false for production (Samsung TV)
    PROXY_URL: 'http://localhost:3000/api',
    
    // API Endpoints
    ENDPOINTS: {
        LOGIN: '/login',
        VERIFY_OTP: '/loginOtp',
        CATEGORIES: '/chnl_categlist',
        CHANNELS: '/chnl_data',
        ADS: '/ads',
        IPTV_ADS: '/iptvads'
    }
};
```

### Helper Methods

#### `getUrl(endpoint)`
Get complete URL for API endpoint.

```javascript
var loginUrl = API_CONFIG.getUrl(API_CONFIG.ENDPOINTS.LOGIN);
// Returns: 'http://localhost:3000/api/login' (if proxy enabled)
// Or: 'http://124.40.244.211/netmon/cabletvapis/login' (if proxy disabled)
```

#### `getAuthHeaders()`
Get authentication headers for API requests.

```javascript
var headers = API_CONFIG.getAuthHeaders();
// Returns:
// {
//     'Authorization': 'Basic Zm9maWxhYkBnbWFpbC5jb206MTIzNDUtNTQzMjE=',
//     'devslno': 'FOFI20191129000336',
//     'Content-Type': 'application/json'
// }
```

#### `getAdsHeaders()`
Get headers for advertisement API requests.

```javascript
var headers = API_CONFIG.getAdsHeaders();
// Includes devmac in addition to auth headers
```

### Environment Configuration

**Development (Browser):**
```javascript
USE_PROXY: true
// Enables CORS proxy for browser testing
```

**Production (Samsung TV):**
```javascript
USE_PROXY: false
// Direct API calls (no CORS issues on native app)
```

## 🔐 Authentication API (auth.js)

Handles user authentication, session management, and device verification.

### Core Functions

#### `requestOTP(userid, mobile)`
Send OTP to user's mobile number for login.

**Parameters:**
- `userid` (string): User ID for login
- `mobile` (string): 10-digit mobile number

**Returns:** Promise with result object

**Example:**
```javascript
AuthAPI.requestOTP('testuser1', '9876543210')
    .then(function(result) {
        if (result.success) {
            console.log('OTP sent successfully');
            // Redirect to OTP verification page
            window.location.href = 'verify.html';
        } else {
            console.error('Error:', result.message);
            alert('Failed to send OTP: ' + result.message);
        }
    })
    .catch(function(error) {
        console.error('Network error:', error);
    });
```

**API Request:**
```javascript
POST /login
Headers: {
    Authorization: "Basic ...",
    devslno: "FOFI20191129000336",
    Content-Type: "application/json"
}
Body: {
    userid: "testuser1",
    mobile: "9876543210"
}
```

---

#### `verifyOTP(userid, mobile, otpcode)`
Verify OTP code and complete login.

**Parameters:**
- `userid` (string): User ID
- `mobile` (string): Mobile number
- `otpcode` (string): OTP code received

**Returns:** Promise with result object

**Example:**
```javascript
AuthAPI.verifyOTP('testuser1', '9876543210', '1234')
    .then(function(result) {
        if (result.success) {
            console.log('Login successful');
            // User data automatically stored in localStorage
            // Auto-redirect to homepage
        } else {
            console.error('Invalid OTP:', result.message);
            alert('Invalid OTP. Please try again.');
        }
    });
```

**API Request:**
```javascript
POST /loginOtp
Body: {
    userid: "testuser1",
    mobile: "9876543210",
    otpcode: "1234",
    mac_address: "26:F2:AE:D8:3F:99",
    device_name: "rk3368_box",
    ip_address: "124.40.244.233",
    device_type: "FOFI"
}
```

**Success Response:**
```json
{
    "status": "success",
    "message": "Login successful"
}
```

**On Success:**
- Stores user data in localStorage
- Marks user as authenticated
- Redirects to homepage.html

---

#### `getUserData()`
Retrieve current logged-in user data.

**Returns:** Object with user information or null

**Example:**
```javascript
var userData = AuthAPI.getUserData();
if (userData) {
    console.log('User ID:', userData.userId);
    console.log('Phone:', userData.userPhone);
    console.log('Login Time:', userData.loginTime);
} else {
    console.log('No user logged in');
}
```

**Returned Object:**
```javascript
{
    userId: "testuser1",
    userPhone: "9876543210",
    loginTime: "2026-01-14T10:30:00",
    deviceMac: "26:F2:AE:D8:3F:99"
}
```

---

#### `isAuthenticated()`
Check if user is currently logged in.

**Returns:** Boolean

**Example:**
```javascript
if (AuthAPI.isAuthenticated()) {
    // User is logged in
    loadUserContent();
} else {
    // Redirect to login
    window.location.href = 'index.html';
}
```

**Usage in Page Protection:**
```javascript
// Add to all protected pages
window.addEventListener('DOMContentLoaded', function() {
    if (!AuthAPI.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    // Load page content
});
```

---

#### `logout()`
Clear user session and logout.

**Example:**
```javascript
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        AuthAPI.logout();
        // Automatically redirects to index.html
    }
}
```

**Actions Performed:**
- Clears localStorage data
- Removes authentication flags
- Redirects to login page (index.html)

---

#### `getDeviceInfo()`
Get device information for API requests.

**Returns:** Object with device data

**Example:**
```javascript
var deviceInfo = AuthAPI.getDeviceInfo();
console.log(deviceInfo);
// {
//     mac_address: "26:F2:AE:D8:3F:99",
//     device_name: "rk3368_box",
//     ip_address: "124.40.244.233",
//     device_type: "FOFI"
// }
```

### Session Data Structure

**Stored in localStorage:**
```javascript
{
    userId: "testuser1",
    userPhone: "9876543210",
    bbnl_authenticated: "true",
    bbnl_login_time: "2026-01-14T10:30:00Z",
    device_mac: "26:F2:AE:D8:3F:99"
}
```

### Error Handling

All authentication functions return standardized error objects:

```javascript
{
    success: false,
    error: "Error message",
    message: "User-friendly message"
}
```

**Common Errors:**
- `NETWORK_ERROR`: Cannot connect to server
- `INVALID_CREDENTIALS`: Wrong userid/mobile
- `INVALID_OTP`: Incorrect OTP code
- `DEVICE_NOT_VERIFIED`: Device verification failed

## 📺 Channels API (channels.js)

Manages channel data, categories, and filtering for IPTV content.

### Core Functions

#### `getCategories(userid)`
Fetch all available channel categories.

**Parameters:**
- `userid` (string): User ID

**Returns:** Promise with categories array

**Example:**
```javascript
var userData = AuthAPI.getUserData();
ChannelsAPI.getCategories(userData.userId)
    .then(function(result) {
        if (result.success) {
            console.log('Categories:', result.categories);
            displayCategories(result.categories);
        } else {
            console.error('Error:', result.message);
        }
    });
```

**API Request:**
```javascript
POST /chnl_categlist
Headers: {
    Authorization: "Basic ...",
    devslno: "FOFI20191129000336"
}
Body: {
    userid: "testuser1"
}
```

**Response Format:**
```json
{
    "status": "success",
    "categories": [
        {
            "id": "1",
            "name": "Entertainment",
            "icon": "entertainment.png"
        },
        {
            "id": "2",
            "name": "News",
            "icon": "news.png"
        },
        {
            "id": "3",
            "name": "Sports",
            "icon": "sports.png"
        }
    ]
}
```

---

#### `getChannels(userid, userphone)`
Fetch all channels for logged-in user.

**Parameters:**
- `userid` (string): User ID
- `userphone` (string): User's mobile number

**Returns:** Promise with channels array

**Example:**
```javascript
var userData = AuthAPI.getUserData();
ChannelsAPI.getChannels(userData.userId, userData.userPhone)
    .then(function(result) {
        if (result.success) {
            console.log('Total channels:', result.channels.length);
            displayChannels(result.channels);
        }
    });
```

**API Request:**
```javascript
POST /chnl_data
Body: {
    userid: "testuser1",
    userphone: "9876543210"
}
```

**Channel Object Structure:**
```json
{
    "chnl_id": "123",
    "chnl_name": "Sony TV",
    "chnl_logo": "https://example.com/sony.png",
    "chnl_url": "https://stream.example.com/sony/index.m3u8",
    "chnl_category": "Entertainment",
    "is_subscribed": "1",
    "chnl_number": "101",
    "chnl_description": "Entertainment channel"
}
```

---

#### `getSubscribedChannels(userid, userphone)`
Get only subscribed channels.

**Parameters:**
- `userid` (string): User ID
- `userphone` (string): User's mobile number

**Returns:** Promise with filtered channels

**Example:**
```javascript
ChannelsAPI.getSubscribedChannels(userData.userId, userData.userPhone)
    .then(function(result) {
        if (result.success) {
            var subscribed = result.channels.filter(function(ch) {
                return ch.is_subscribed === '1';
            });
            console.log('Subscribed channels:', subscribed.length);
        }
    });
```

---

#### `getChannelsByCategory(userid, userphone, category)`
Filter channels by category.

**Parameters:**
- `userid` (string): User ID
- `userphone` (string): User's mobile number
- `category` (string): Category name

**Returns:** Promise with filtered channels

**Example:**
```javascript
ChannelsAPI.getChannelsByCategory(
    userData.userId,
    userData.userPhone,
    'Sports'
).then(function(result) {
    if (result.success) {
        var sportsChannels = result.channels.filter(function(ch) {
            return ch.chnl_category === 'Sports';
        });
        displayChannels(sportsChannels);
    }
});
```

---

#### `searchChannels(userid, userphone, query)`
Search channels by name.

**Parameters:**
- `userid` (string): User ID
- `userphone` (string): User's mobile number
- `query` (string): Search term

**Returns:** Promise with matching channels

**Example:**
```javascript
ChannelsAPI.searchChannels(userData.userId, userData.userPhone, 'sony')
    .then(function(result) {
        if (result.success) {
            var matches = result.channels.filter(function(ch) {
                return ch.chnl_name.toLowerCase().includes('sony');
            });
            displaySearchResults(matches);
        }
    });
```

### Helper Functions

#### `filterSubscribed(channels)`
Filter array to show only subscribed channels.

```javascript
var allChannels = [...];
var subscribed = ChannelsAPI.filterSubscribed(allChannels);
```

#### `groupByCategory(channels)`
Group channels by category.

```javascript
var grouped = ChannelsAPI.groupByCategory(allChannels);
// Returns:
// {
//     "Entertainment": [...],
//     "News": [...],
//     "Sports": [...]
// }
```

### Usage Example (Complete Flow)

```javascript
// On page load
window.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!AuthAPI.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    
    // Get user data
    var userData = AuthAPI.getUserData();
    
    // Load categories
    ChannelsAPI.getCategories(userData.userId)
        .then(function(result) {
            if (result.success) {
                renderCategories(result.categories);
            }
        });
    
    // Load channels
    ChannelsAPI.getChannels(userData.userId, userData.userPhone)
        .then(function(result) {
            if (result.success) {
                var subscribed = result.channels.filter(function(ch) {
                    return ch.is_subscribed === '1';
                });
                renderChannelGrid(subscribed);
            }
        });
});
```

#### `ChannelsAPI.getChannelsByCategory(channels, grid)`
Filter channels by category.
```javascript
var newsChannels = ChannelsAPI.getChannelsByCategory(allChannels, '12');
```

## 📢 Ads API (ads.js)

### Methods:

#### `AdsAPI.getIPTVAds(options)`
Get ads for homepage slider.
```javascript
AdsAPI.getIPTVAds({
    srctype: 'image',
    displayarea: 'homepage',
    displaytype: 'multiple'
})
.then(function(result) {
    if (result.success) {
        console.log(result.ads); // Array of ad URLs
    }
});
```

## 🚀 Usage in HTML Files

### Include API files in your HTML:

```html
<!-- API Configuration -->
<script src="api/config.js"></script>

<!-- Include specific API modules you need -->
<script src="api/auth.js"></script>
<script src="api/channels.js"></script>
<script src="api/ads.js"></script>
```

### Example Usage:

```javascript
// Login
AuthAPI.requestOTP('testiser1', '9876543210')
    .then(function(result) {
        if (result.success) {
            // Show OTP input screen
        } else {
            alert(result.message);
        }
    });

// Get Channels (after login)
ChannelsAPI.getChannels()
    .then(function(result) {
        if (result.success) {
            result.channels.forEach(function(channel) {
                console.log(channel.chtitle, channel.streamlink);
            });
        }
    });
```

## 📝 API Response Format

All APIs return a consistent format:

### Success Response:
```javascript
{
    success: true,
    message: "Success message",
    data: { /* API response data */ }
}
```

### Error Response:
```javascript
{
    success: false,
    message: "Error message",
    error_code: 9
}
```

## � Advertisement API (ads.js)

Manages advertisement banners and promotional content.

### Core Functions

#### `getAds(appid)`
Fetch general advertisements.

**Parameters:**
- `appid` (string): Application identifier (default: "FOFI")

**Returns:** Promise with ads array

**Example:**
```javascript
AdsAPI.getAds('FOFI')
    .then(function(result) {
        if (result.success) {
            console.log('Ads:', result.ads);
            displayAds(result.ads);
        }
    });
```

#### `getIPTVAds(appid)`
Fetch IPTV-specific advertisements (homepage banners).

**Parameters:**
- `appid` (string): Application identifier

**Returns:** Promise with IPTV ads

**Example:**
```javascript
AdsAPI.getIPTVAds('FOFI')
    .then(function(result) {
        if (result.success) {
            createBannerSlider(result.ads);
        }
    });
```

## ⚠️ Error Handling

All API functions return standardized error objects:

```javascript
{
    success: false,
    error: "ERROR_CODE",
    message: "User-friendly message"
}
```

**Common Error Codes:**
- `NETWORK_ERROR` - Cannot connect to server
- `AUTHENTICATION_FAILED` - Invalid credentials
- `SESSION_EXPIRED` - User session expired
- `DEVICE_NOT_VERIFIED` - Device verification failed

## 💡 Best Practices

### 1. Always Check Authentication
```javascript
if (!AuthAPI.isAuthenticated()) {
    window.location.href = 'index.html';
    return;
}
```

### 2. Handle Errors Gracefully
```javascript
.catch(function(error) {
    showError('Something went wrong. Please try again.');
});
```

### 3. Use Loading States
```javascript
showLoading();
ChannelsAPI.getChannels(...)
    .finally(function() { hideLoading(); });
```

## 🔗 Related Files

- **Implementation**: [../index.html](../index.html), [../verify.html](../verify.html)
- **Utilities**: [../js/script.js](../js/script.js)
- **Proxy Server**: [../bbnl-proxy/server.js](../bbnl-proxy/server.js)

---

**For complete project documentation, see [../README.md](../README.md)**
