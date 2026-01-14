// ========================================================
// BBNL ADS API - PRODUCTION (ES5 Compatible for Tizen)
// Per API Documentation: api-documentation (5).md
// Requires: api/config.js and api/auth.js to be loaded first
// ========================================================
/* global API_CONFIG, apiCall, AuthAPI, mapBBNLError */
/* exported AdsAPI */

var AdsAPI = {
    /**
     * Get IPTV ads for homepage slider
     * Per docs: POST /iptvads to https://bbnlnetmon.bbnl.in/prod/cabletvapis
     * Request: {"userid":"testiser1","mobile":"9876543210","adclient":"fofi","srctype":"image","displayarea":"homepage","displaytype":"multiple"}
     * Response: {"body":[{"adpath":"https://.../banner1.jpg"},{"adpath":"https://.../banner2.jpg"}]}
     * @param {object} options - Optional overrides for ad request
     * @returns {Promise}
     */
    getIPTVAds: function(options) {
        options = options || {};
        var userData = AuthAPI.getUserData();
        
        if (!userData.userPhone) {
            console.warn('Mobile number required for ads');
            return Promise.resolve({
                success: false,
                message: 'Mobile number required',
                ads: []
            });
        }

        var adsConfig = API_CONFIG.ADS_CONFIG || {};
        
        return apiCall('iptvads', {
            userid: userData.userId || API_CONFIG.USER_CREDENTIALS.userid,
            mobile: userData.userPhone,
            adclient: options.adclient || adsConfig.adclient || 'fofi',
            srctype: options.srctype || adsConfig.srctype || 'image',
            displayarea: options.displayarea || adsConfig.displayarea || 'homepage',
            displaytype: options.displaytype || adsConfig.displaytype || 'multiple'
        }).then(function(data) {
            // Extract adpath array from body
            var body = data.body || [];
            var ads = [];
            for (var i = 0; i < body.length; i++) {
                if (body[i].adpath) {
                    ads.push(body[i].adpath);
                }
            }
            
            console.log('Ads loaded:', ads.length);

            return {
                success: true,
                ads: ads,
                rawData: data.body,
                data: data
            };
        }, function(error) {
            console.error('Failed to load ads:', error);
            return {
                success: false,
                message: mapBBNLError(error.message),
                ads: [],
                error: error
            };
        });
    },

    /**
     * Get video ads
     * @returns {Promise}
     */
    getVideoAds: function() {
        return AdsAPI.getIPTVAds({ srctype: 'video' });
    },

    /**
     * Get ads for channel list page
     * Per docs: displayarea can be "homepage" or "chnllist"
     * @param {object} options - Optional overrides
     * @returns {Promise}
     */
    getChannelListAds: function(options) {
        options = options || {};
        var mergedOptions = {
            displayarea: 'chnllist',
            adclient: options.adclient,
            srctype: options.srctype,
            displaytype: options.displaytype
        };
        return AdsAPI.getIPTVAds(mergedOptions);
    },

    /**
     * Get ads for specific display area
     * @param {string} displayarea - Display area: 'homepage' or 'chnllist'
     * @param {string} srctype - Source type: 'image' or 'video'
     * @param {boolean} multiple - Whether to get multiple ads
     * @returns {Promise}
     */
    getAdsByArea: function(displayarea, srctype, multiple) {
        srctype = srctype || 'image';
        multiple = multiple || false;
        return AdsAPI.getIPTVAds({
            displayarea: displayarea,
            srctype: srctype,
            displaytype: multiple ? 'multiple' : ''
        });
    },

    /**
     * Create auto-rotating slider from ads
     * @param {string} containerId - ID of container element
     * @param {Array} ads - Array of ad URLs
     * @param {number} interval - Rotation interval in ms (default 5000)
     */
    createSlider: function(containerId, ads, interval) {
        interval = interval || 5000;
        var container = document.getElementById(containerId);
        if (!container || !ads || ads.length === 0) {
            console.warn('Cannot create slider: missing container or ads');
            return null;
        }

        var currentIndex = 0;
        
        // Create dots HTML
        var dotsHtml = '';
        for (var i = 0; i < ads.length; i++) {
            dotsHtml += '<span class="ads-dot ' + (i === 0 ? 'active' : '') + '" data-index="' + i + '"></span>';
        }
        
        // Create slider HTML
        container.innerHTML = '<div class="ads-slider">' +
            '<img src="' + ads[0] + '" alt="Advertisement" class="ads-slide active">' +
            '<div class="ads-dots">' + dotsHtml + '</div>' +
            '</div>';

        var slideImg = container.querySelector('.ads-slide');
        var dots = container.querySelectorAll('.ads-dot');

        // Rotation function
        var rotate = function() {
            currentIndex = (currentIndex + 1) % ads.length;
            slideImg.src = ads[currentIndex];
            for (var j = 0; j < dots.length; j++) {
                if (j === currentIndex) {
                    dots[j].classList.add('active');
                } else {
                    dots[j].classList.remove('active');
                }
            }
        };

        // Start auto-rotation
        var timer = setInterval(rotate, interval);

        // Click handler function (defined outside loop for ES5 compatibility)
        function createDotClickHandler(dotElement, index) {
            dotElement.addEventListener('click', function() {
                currentIndex = index;
                slideImg.src = ads[currentIndex];
                for (var m = 0; m < dots.length; m++) {
                    if (m === currentIndex) {
                        dots[m].classList.add('active');
                    } else {
                        dots[m].classList.remove('active');
                    }
                }
            });
        }

        // Click handlers for dots
        for (var k = 0; k < dots.length; k++) {
            createDotClickHandler(dots[k], k);
        }

        return { timer: timer, rotate: rotate };
    }
};
