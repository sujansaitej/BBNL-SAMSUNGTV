const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// =============================
// SERVE STATIC FILES (for Chrome preview)
// =============================
const staticPath = path.join(__dirname, '..', '..');
app.use(express.static(staticPath));
console.log('📁 Serving static files from:', staticPath);

// =============================
// SERVE VIDEO FILES (BBNL Logo Video)
// This endpoint serves the intro video before phone number login
// =============================
const videoPath = path.join(__dirname, '..', '..', 'video');
app.use('/video', express.static(videoPath));
console.log('🎬 Serving video files from:', videoPath);

// Specific endpoint for BBNL intro video
app.get('/intro-video', (req, res) => {
  const introVideoPath = path.join(videoPath, 'BBNL LOGO 3.mp4');
  res.sendFile(introVideoPath, (err) => {
    if (err) {
      console.error('❌ Error serving intro video:', err.message);
      res.status(404).json({ error: 'Intro video not found' });
    }
  });
});

// Video info endpoint
app.get('/api/video-info', (req, res) => {
  res.json({
    status: 'success',
    video: {
      name: 'BBNL Logo Intro',
      url: '/video/BBNL LOGO 3.mp4',
      directUrl: '/intro-video',
      description: 'BBNL intro video displayed before phone number login'
    }
  });
});

// =============================
// BBNL API CONFIG (Per Documentation)
// =============================
// Auth/Channel APIs use this base URL
const AUTH_BASE_URL = 'http://124.40.244.211/netmon/cabletvapis';
// Ads API uses this base URL
const ADS_BASE_URL = 'https://bbnlnetmon.bbnl.in/prod/cabletvapis';

// Common headers for ALL APIs (auth, channel, ads)
const AUTH_HEADERS = {
  'Authorization': 'Basic Zm9maWxhYkBnbWFpbC5jb206MTIzNDUtNTQzMjE=',
  'Content-Type': 'application/json',
  'devslno': 'FOFI20191129000336',
  'devmac': '68:1D:EF:14:6C:21'
};

// Headers for ads API (same as AUTH_HEADERS)
const ADS_HEADERS = {
  'Authorization': 'Basic Zm9maWxhYkBnbWFpbC5jb206MTIzNDUtNTQzMjE=',
  'Content-Type': 'application/json',
  'devslno': 'FOFI20191129000336',
  'devmac': '68:1D:EF:14:6C:21'
};

// Ads endpoints that use the ADS_BASE_URL
const ADS_ENDPOINTS = ['iptvads', 'ads'];

// =============================
// STREAM PROXY (for Chrome/Browser playback)
// Proxies HLS streams to avoid CORS issues
// Usage: /stream?url=https://livestream.bbnl.in/ddnational/index.m3u8
// =============================
app.get('/stream', async (req, res) => {
  // Get the stream URL from query parameter
  const streamUrl = req.query.url;
  
  if (!streamUrl || !streamUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid stream URL. Use ?url=https://...' });
  }

  try {
    console.log(`📺 Stream Proxy Request: ${streamUrl}`);
    
    const response = await axios.get(streamUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://livestream.bbnl.in/',
        'Origin': 'https://livestream.bbnl.in',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      validateStatus: function (status) {
        return status < 500; // Resolve on any status < 500
      }
    });

    // Check for successful response
    if (response.status >= 400) {
      console.error(`❌ Stream API Error: Status ${response.status}`);
      console.error('Response:', response.data.toString('utf8').substring(0, 200));
      return res.status(response.status).json({ 
        error: `Stream server returned error ${response.status}`,
        details: 'The stream may be restricted or unavailable'
      });
    }

    // Set appropriate content type
    const contentType = response.headers['content-type'] || 'application/vnd.apple.mpegurl';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // For m3u8 playlists, rewrite URLs to go through proxy
    if (streamUrl.endsWith('.m3u8')) {
      let content = response.data.toString('utf8');
      
      // Get base URL for relative paths
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
      
      // Rewrite relative URLs to go through our proxy
      content = content.replace(/^(?!#)(?!http)(.+\.ts)$/gm, (match, p1) => {
        return `/stream?url=${encodeURIComponent(baseUrl + p1)}`;
      });
      content = content.replace(/^(?!#)(?!http)(.+\.m3u8)$/gm, (match, p1) => {
        return `/stream?url=${encodeURIComponent(baseUrl + p1)}`;
      });
      
      console.log(`✅ Stream Playlist loaded successfully`);
      res.send(content);
    } else {
      // For .ts segments, send as-is
      console.log(`✅ Stream segment delivered`);
      res.send(response.data);
    }
    
  } catch (err) {
    console.error(`❌ Stream Proxy Error: ${err.message}`);
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Headers:`, err.response.headers);
    }
    res.status(500).json({ 
      error: 'Stream fetch failed', 
      message: err.message,
      hint: 'The stream may require authentication or be geographically restricted'
    });
  }
});

// =============================
// HEALTH CHECK
// =============================
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: '✅ BBNL Production Proxy Server',
    auth_api: AUTH_BASE_URL,
    ads_api: ADS_BASE_URL,
    endpoints: 'POST /api/:endpoint (supports all BBNL APIs)',
    stream_proxy: 'GET /stream/{url} (proxy HLS streams for Chrome)'
  });
});

// =============================
// UNIVERSAL PROXY (ALL APIs)
// =============================
app.post('/api/:endpoint', async (req, res) => {
  const endpoint = req.params.endpoint;

  // Get client IP address
  const clientIp = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   'unknown';
  
  // Determine which base URL and headers to use
  const isAdsEndpoint = ADS_ENDPOINTS.includes(endpoint);
  const baseUrl = isAdsEndpoint ? ADS_BASE_URL : AUTH_BASE_URL;
  const headers = isAdsEndpoint ? ADS_HEADERS : AUTH_HEADERS;

  try {
    console.log(`\n📥 ${endpoint.toUpperCase()} Request:`);
    console.log('   Client IP:', clientIp);
    console.log('   Payload:', JSON.stringify(req.body, null, 2));
    console.log(`   🔗 Target URL: ${baseUrl}/${endpoint}`);
    console.log('   Headers:', JSON.stringify(headers, null, 2));

    const response = await axios.post(
      `${baseUrl}/${endpoint}`,
      req.body,
      {
        headers: headers,
        timeout: 15000
      }
    );

    console.log(`✅ ${endpoint.toUpperCase()} Response Status:`, response.status);
    console.log('   Response Data:', JSON.stringify(response.data, null, 2));
    
    // Add client IP to response for device info
    const responseData = {
      ...response.data,
      _clientInfo: {
        ip: clientIp.replace('::ffff:', '') // Remove IPv6 prefix if present
      }
    };
    
    res.json(responseData);

  } catch (err) {
    console.error(`\n❌ ${endpoint.toUpperCase()} Error:`);
    console.error('   Error Message:', err.message);

    // Log full error for debugging
    if (err.response) {
      console.error('   Response Status:', err.response.status);
      console.error('   Response Data:', JSON.stringify(err.response.data, null, 2));
      console.error('   Response Headers:', JSON.stringify(err.response.headers, null, 2));
    } else if (err.request) {
      console.error('   No response received from server');
      console.error('   Request was made but no response');
    } else {
      console.error('   Error setting up request:', err.message);
    }

    res.status(500).json({
      body: [],
      status: {
        err_code: 1,
        err_msg: err.response?.data?.status?.err_msg || err.message || 'BBNL API error'
      }
    });
  }
});

// =============================
// START SERVER
// =============================
const PORT = 3000;

const server = app.listen(PORT, () => {
  console.log(`\n✅ BBNL Production Proxy Server Running`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🌐 Preview app in Chrome: http://localhost:${PORT}/index.html`);
  console.log(`🔗 Auth/Channel API: ${AUTH_BASE_URL}`);
  console.log(`🔗 Ads API: ${ADS_BASE_URL}`);
  console.log(`\n📋 Universal Endpoint:`);
  console.log(`   POST /api/:endpoint`);
  console.log(`\n🎬 Video Endpoints:`);
  console.log(`   GET /intro-video - BBNL intro video (before login)`);
  console.log(`   GET /video/BBNL LOGO 3.mp4 - Direct video access`);
  console.log(`   GET /api/video-info - Video metadata`);
  console.log(`\n📝 Supported APIs:`);
  console.log(`   Auth: login, logout`);
  console.log(`   Channels: chnl_categlist, chnl_list, chnl_data, stream`);
  console.log(`   Ads: ads, iptvads`);
  console.log(`   Other: applock, allowedapps, profilelist, profileselect`);
  console.log(`\n🚀 Ready to handle all BBNL API requests!\n`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️ SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
