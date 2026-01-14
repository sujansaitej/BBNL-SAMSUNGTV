// ========================================================
// BBNL CHANNELS API - PRODUCTION (ES5 Compatible for Tizen)
// Per API Documentation: api-documentation (5).md
// Requires: api/config.js and api/auth.js to be loaded first
// ========================================================
/* global API_CONFIG, apiCall, mapBBNLError, AuthAPI */
/* exported ChannelsAPI */

var ChannelsAPI = {
    /**
     * Get channel categories
     * Per docs: POST /chnl_categlist
     * Response: {"body":[{"categories":[{"grtitle":"All Channels","grid":"0"},{"grtitle":"News","grid":"12"}]}]}
     * @returns {Promise}
     */
    getCategories: function() {
        var userData = AuthAPI.getUserData();
        
        if (!userData.isAuthenticated) {
            console.warn('User not logged in');
            return Promise.resolve({
                success: false,
                message: 'Login Required',
                categories: [],
                errorType: 'login-required'
            });
        }

        var deviceInfo = API_CONFIG.DEVICE_INFO;
        
        return apiCall('chnl_categlist', {
            userid: userData.userId,
            mobile: userData.userPhone,
            ip_address: deviceInfo.ip_address,
            mac_address: deviceInfo.mac_address
        }).then(function(data) {
            // Per docs: categories are in body[0].categories
            var categories = [];
            if (data.body && data.body[0] && data.body[0].categories) {
                categories = data.body[0].categories;
            }
            
            console.log('Categories loaded:', categories.length);

            return {
                success: true,
                categories: categories,
                data: data
            };
        }, function(error) {
            console.error('Failed to load categories:', error);
            
            // Determine error type
            var errorType = 'load-failed';
            var errorMsg = error.message || 'Failed to load categories';
            
            if (error.isNetworkError || 
                errorMsg.toLowerCase().indexOf('no internet') !== -1 ||
                errorMsg.toLowerCase().indexOf('network') !== -1 ||
                errorMsg.toLowerCase().indexOf('connection') !== -1) {
                errorType = 'no-internet';
            } else if (errorMsg.toLowerCase().indexOf('login') !== -1) {
                errorType = 'login-required';
            }
            
            return {
                success: false,
                message: mapBBNLError(errorMsg),
                categories: [],
                error: error,
                errorType: errorType
            };
        });
    },

    /**
     * Get channel list/data
     * Per docs: POST /chnl_data
     * Response: {"body":[{"chtitle":"Star Sports","chlogo":"...","subscribed":"yes","grid":"12","streamlink":"..."}]}
     * @returns {Promise}
     */
    getChannelData: function() {
        var userData = AuthAPI.getUserData();
        
        if (!userData.isAuthenticated) {
            console.warn('User not logged in');
            return Promise.resolve({
                success: false,
                message: 'Login Required',
                channels: [],
                errorType: 'login-required'
            });
        }

        var deviceInfo = API_CONFIG.DEVICE_INFO;
        
        return apiCall('chnl_data', {
            userid: userData.userId,
            mobile: userData.userPhone,
            ip_address: deviceInfo.ip_address,
            mac_address: deviceInfo.mac_address
        }).then(function(data) {
            var channels = data.body || [];
            
            console.log('Channels loaded:', channels.length);

            return {
                success: true,
                channels: channels,
                data: data
            };
        }, function(error) {
            console.error('Failed to load channels:', error);
            
            // Determine error type
            var errorType = 'load-failed';
            var errorMsg = error.message || 'Failed to load channels';
            
            if (error.isNetworkError || 
                errorMsg.toLowerCase().indexOf('no internet') !== -1 ||
                errorMsg.toLowerCase().indexOf('network') !== -1 ||
                errorMsg.toLowerCase().indexOf('connection') !== -1 ||
                errorMsg.toLowerCase().indexOf('timeout') !== -1) {
                errorType = 'no-internet';
            } else if (errorMsg.toLowerCase().indexOf('login') !== -1) {
                errorType = 'login-required';
            }
            
            return {
                success: false,
                message: mapBBNLError(errorMsg),
                channels: [],
                error: error,
                errorType: errorType
            };
        });
    },

    /**
     * Filter channels by subscription status
     * Per docs: Filter by subscribed === "yes"
     * @param {Array} channels - Full channel list
     * @returns {Array} Subscribed channels only
     */
    getSubscribedChannels: function(channels) {
        return channels.filter(function(ch) {
            return ch.subscribed === 'yes' || ch.subscribed === '1' || ch.subscribed === true;
        });
    },

    /**
     * Filter channels by category/grid
     * Per docs: Use grid value to filter (e.g., "0" for All, "12" for News)
     * @param {Array} channels - Full channel list
     * @param {string} grid - Grid ID (category ID)
     * @returns {Array} Filtered channels
     */
    getChannelsByGrid: function(channels, grid) {
        if (!grid || grid === '0') {
            return channels; // "0" = All Channels
        }
        return channels.filter(function(ch) {
            return ch.grid === grid;
        });
    },

    /**
     * Get stream URL from channel object
     * Per docs: Channel has streamlink property - validate before playback
     * @param {object} channel - Channel object
     * @returns {string|null} Stream URL or null if not available
     */
    getStreamUrl: function(channel) {
        if (!channel || !channel.streamlink) {
            console.warn('No stream URL available for channel');
            return null;
        }
        return channel.streamlink;
    },

    /**
     * Play channel - open player with stream
     * @param {object} channel - Channel object with chtitle and streamlink
     */
    playChannel: function(channel) {
        var streamUrl = ChannelsAPI.getStreamUrl(channel);
        
        if (!streamUrl) {
            console.error('Cannot play: No stream URL');
            return { success: false, message: 'Stream not available for this channel' };
        }
        
        // Store channel info for player
        localStorage.setItem('currentChannel', JSON.stringify({
            title: channel.chtitle,
            logo: channel.chlogo,
            streamUrl: streamUrl
        }));
        
        // Navigate to player
        window.location.href = 'player.html?stream=' + encodeURIComponent(streamUrl) + '&title=' + encodeURIComponent(channel.chtitle);
        
        return { success: true };
    }
};
