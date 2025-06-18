const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Import custom modules
const sslConfig = require('./config/ssl');
const SensorProcessor = require('./classes/SensorProcessor');
const DataLogger = require('./classes/DataLogger');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

const app = express();
const server = http.createServer(sslConfig.options, app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    compression: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = 3000;

// Enhanced error handling for WebSocket frame errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    if (error.message.includes('Invalid WebSocket frame') || 
        error.message.includes('invalid UTF-8 sequence') ||
        error.message.includes('invalid status code') ||
        error.message.includes('data is not defined') ||
        error.code === 'WS_ERR_INVALID_CLOSE_CODE' ||
        error.code === 'WS_ERR_INVALID_UTF8') {
        console.log('WebSocket protocol error handled, continuing...');
        return; // Don't crash the server
    }
    console.error('Critical error, shutting down...');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced latency tracking
const latencyTracker = {
    measurements: [],
    addMeasurement: function(latency) {
        this.measurements.push({
            timestamp: Date.now(),
            latency: latency
        });
        if (this.measurements.length > 100) {
            this.measurements.shift();
        }
    },
    getAverageLatency: function() {
        if (this.measurements.length === 0) return 0;
        const sum = this.measurements.reduce((acc, m) => acc + m.latency, 0);
        return (sum / this.measurements.length).toFixed(2);
    },
    getStats: function() {
        if (this.measurements.length === 0) return { avg: 0, min: 0, max: 0 };
        const latencies = this.measurements.map(m => m.latency);
        return {
            avg: this.getAverageLatency(),
            min: Math.min(...latencies).toFixed(2),
            max: Math.max(...latencies).toFixed(2),
            count: latencies.length
        };
    }
};

// Initialize processors
const sensorProcessor = new SensorProcessor();
const dataLogger = new DataLogger();

// Store connected clients
const clients = new Set();
let latestSensorData = {};

// UTF-8 validation functions
function isStrictUTF8(str) {
    try {
        // Method 1: TextEncoder/TextDecoder validation
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const encoded = encoder.encode(str);
        const decoded = decoder.decode(encoded);
        
        if (decoded !== str) return false;
        
        // Method 2: Buffer validation
        const buffer = Buffer.from(str, 'utf8');
        const backToString = buffer.toString('utf8');
        
        return backToString === str;
    } catch (error) {
        return false;
    }
}

function deepSanitizeUTF8(obj) {
    if (typeof obj === 'string') {
        // Remove invalid UTF-8 sequences and control characters
        return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
                  .replace(/[\uFFFE\uFFFF]/g, '') // Remove invalid Unicode
                  .replace(/[\uD800-\uDFFF]/g, '') // Remove unpaired surrogates
                  .substring(0, 1000); // Limit length
    } else if (typeof obj === 'number') {
        return isFinite(obj) ? Number(obj.toFixed(6)) : 0;
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanKey = typeof key === 'string' ? deepSanitizeUTF8(key) : key;
            sanitized[cleanKey] = deepSanitizeUTF8(value);
        }
        return sanitized;
    }
    return obj;
}

// Enhanced validation functions
function isValidUTF8(str) {
    try {
        // Multiple validation methods
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const encoded = encoder.encode(str);
        const decoded = decoder.decode(encoded);
        
        if (decoded !== str) return false;
        
        // Check for problematic characters
        const problematicChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF\uD800-\uDFFF]/;
        if (problematicChars.test(str)) return false;
        
        return true;
    } catch (error) {
        return false;
    }
}

function deepSanitizeData(obj) {
    if (typeof obj === 'string') {
        // Remove all problematic characters
        return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF\uD800-\uDFFF]/g, '')
                  .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '')
                  .substring(0, 500);
    } else if (typeof obj === 'number') {
        return isFinite(obj) ? Number(obj.toFixed(6)) : 0;
    } else if (typeof obj === 'object' && obj !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanKey = typeof key === 'string' ? deepSanitizeData(key) : key;
            sanitized[cleanKey] = deepSanitizeData(value);
        }
        return sanitized;
    }
    return obj;
}

// WebSocket Server Setup with enhanced error handling
const ws = new WebSocket.Server({ 
    server: server,
    perMessageDeflate: false, // Disable compression completely
    clientTracking: true,
    maxPayload: 32 * 1024, // 32KB limit
    skipUTF8Validation: false,
    handshakeTimeout: 10000
});

// Connection tracking
const activeConnections = new Map();
let connectionId = 0;

ws.on('connection', (ws, req) => {
    const connId = ++connectionId;
    console.log(`Phone connected via ws from ${req.socket.remoteAddress} (ID: ${connId})`);
    
    // Store connection info
    activeConnections.set(connId, {
        ws: ws,
        ip: req.socket.remoteAddress,
        connected: Date.now()
    });
    
    // Immediate error handling setup
    ws.on('error', (error) => {
        console.error(`WebSocket connection error (ID: ${connId}):`, error.message);
        
        // Clean up connection
        try {
            activeConnections.delete(connId);
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Server error');
            }
        } catch (closeError) {
            console.log('Connection cleanup completed');
        }
    });
    
    // Set connection timeout
    const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            console.log(`Connection timeout for ID: ${connId}`);
            ws.close(1000, 'Timeout');
        }
    }, 300000); // 5 minutes
    
    // FIXED Message handler with enhanced validation and proper scope
    ws.on('message', (message) => {
        let data; // Declare data variable in proper scope
        
        try {
            clearTimeout(connectionTimeout);
            
            // Validate message size first
            if (message.length > 16384) { // 16KB limit
                console.warn(`Message too large from ID: ${connId}, closing connection`);
                ws.close(1009, 'Message too large');
                return;
            }
            
            // Enhanced UTF-8 validation
            let messageString;
            try {
                if (Buffer.isBuffer(message)) {
                    messageString = message.toString('utf8');
                    
                    // Verify UTF-8 integrity
                    const reEncoded = Buffer.from(messageString, 'utf8');
                    if (!message.equals(reEncoded)) {
                        console.warn(`UTF-8 corruption detected from ID: ${connId}`);
                        return;
                    }
                } else {
                    messageString = message.toString();
                }
                
                // Additional UTF-8 validation
                if (!isValidUTF8(messageString)) {
                    console.warn(`Invalid UTF-8 from ID: ${connId}`);
                    return;
                }
                
            } catch (utf8Error) {
                console.warn(`UTF-8 processing error from ID: ${connId}:`, utf8Error.message);
                return;
            }
            
            // Parse JSON with validation
            try {
                data = JSON.parse(messageString); // Now data is properly defined in scope
            } catch (parseError) {
                console.warn(`JSON parse error from ID: ${connId}:`, parseError.message);
                return;
            }
            
            // Validate data structure
            if (!data || typeof data !== 'object') {
                console.warn(`Invalid data structure from ID: ${connId}`);
                return;
            }
            
            // Handle ping/pong
            if (data.type === 'ping') {
                if (ws.readyState === WebSocket.OPEN) {
                    const response = JSON.stringify({
                        type: 'pong',
                        timestamp: data.timestamp,
                        serverTime: Date.now()
                    });
                    
                    if (isValidUTF8(response)) {
                        ws.send(response);
                    }
                }
                return;
            }
            
            // Handle camera frames (FIXED - NOW PROPERLY INSIDE MESSAGE HANDLER)
            if (data.type === 'cameraFrame') {
                // console.log('Camera frame received:');
                // Broadcast camera frame to all dashboard clients
                io.emit('cameraFrame', {
                    data: data.data,
                    timestamp: data.timestamp,
                    facingMode: data.facingMode,
                    width: data.width,
                    height: data.height
                });
                return;
            }
            
            
            // Handle latency measurement
            if (data.type === 'latency') {
                latencyTracker.addMeasurement(data.latency);
                return;
            }
            
            // Process sensor data with deep sanitization
            const sanitizedData = deepSanitizeData(data);
            const processedData = sensorProcessor.processSensorData(sanitizedData);
            
            latestSensorData = {
                ...processedData,
                timestamp: new Date().toISOString(),
                serverLatency: latencyTracker.getAverageLatency(),
                connectionId: connId
            };
            
            dataLogger.logSensorData(latestSensorData);
            io.emit('sensorData', latestSensorData);
            
        } catch (error) {
            console.error(`Message processing error from ID: ${connId}:`, error.message);
        }
    });
    
    ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        activeConnections.delete(connId);
        console.log(`Phone disconnected (ID: ${connId}): ${code} - ${reason || 'No reason'}`);
    });
    
    // Send welcome message with validation
    try {
        if (ws.readyState === WebSocket.OPEN) {
            const welcomeMessage = JSON.stringify({
                type: 'welcome',
                message: 'Connected to sensor server',
                connectionId: connId,
                maxMessageSize: 16384,
                serverTime: Date.now()
            });
            
            if (isValidUTF8(welcomeMessage)) {
                ws.send(welcomeMessage);
            }
        }
    } catch (error) {
        console.error('Failed to send welcome message:', error);
    }
});

// Add this to your server.js
let latestCameraFrame = null;

// Store latest camera frame from phone
ws.on('connection', (ws, req) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString('utf8'));
            
            // Store camera frames
            if (data.type === 'cameraFrame') {
                latestCameraFrame = {
                    data: data.data,
                    timestamp: data.timestamp,
                    width: data.width,
                    height: data.height
                };
                
                // Also broadcast to dashboard clients
                io.emit('cameraFrame', latestCameraFrame);
                return;
            }
            
            // ... rest of message handling
        } catch (error) {
            console.error('Message processing error:', error);
        }
    });
});

// MJPEG Stream Endpoint
app.get('/camera/stream.mjpg', (req, res) => {
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const sendFrame = () => {
        if (latestCameraFrame && latestCameraFrame.data) {
            try {
                // Convert base64 to buffer
                const frameBuffer = Buffer.from(latestCameraFrame.data.split(',')[1], 'base64');
                
                res.write(`--frame\r\n`);
                res.write(`Content-Type: image/jpeg\r\n`);
                res.write(`Content-Length: ${frameBuffer.length}\r\n\r\n`);
                res.write(frameBuffer);
                res.write('\r\n');
            } catch (error) {
                console.error('Error sending frame:', error);
            }
        }
    };
    
    // Send frames at 1 FPS (matching phone's rate)
    const interval = setInterval(sendFrame, 1000);
    
    req.on('close', () => {
        clearInterval(interval);
        console.log('MJPEG client disconnected');
    });
    
    req.on('error', (error) => {
        clearInterval(interval);
        console.error('MJPEG client error:', error);
    });
});

// Single frame endpoint
app.get('/camera/latest', (req, res) => {
    if (latestCameraFrame && latestCameraFrame.data) {
        try {
            const frameBuffer = Buffer.from(latestCameraFrame.data.split(',')[1], 'base64');
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(frameBuffer);
        } catch (error) {
            res.status(500).send('Error processing frame');
        }
    } else {
        res.status(404).send('No camera frame available');
    }
});


// Connection monitoring
setInterval(() => {
    console.log(`Active connections: ${activeConnections.size}`);
    
    // Clean up stale connections
    activeConnections.forEach((conn, id) => {
        if (conn.ws.readyState === WebSocket.CLOSED) {
            activeConnections.delete(id);
        }
    });
}, 30000);

// Handle WebSocket server errors
ws.on('error', (error) => {
    console.error('WebSocket Server error:', error.message);
});

// Socket.IO with enhanced latency measurement
io.on('connection', (socket) => {
    console.log('Web client connected');
    clients.add(socket);
    
    // Enhanced latency measurement for Socket.IO
    socket.on('ping', (timestamp) => {
        socket.emit('pong', {
            clientTimestamp: timestamp,
            serverTimestamp: Date.now()
        });
    });
    
    // Send latest data to newly connected client
    if (Object.keys(latestSensorData).length > 0) {
        socket.emit('sensorData', latestSensorData);
    }
    
    // Send server stats
    socket.emit('serverStats', {
        connectedClients: clients.size,
        wsConnections: ws.clients.size,
        latencyStats: latencyTracker.getStats(),
        uptime: process.uptime()
    });
    
    socket.on('disconnect', () => {
        console.log('Web client disconnected');
        clients.delete(socket);
    });
});

// Periodic server stats broadcast
setInterval(() => {
    if (clients.size > 0) {
        const stats = {
            connectedClients: clients.size,
            wsConnections: ws.clients.size,
            latencyStats: latencyTracker.getStats(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
        
        io.emit('serverStats', stats);
    }
}, 30000); // Every 30 seconds

// Routes
app.use('/api', apiRoutes(sensorProcessor, dataLogger, latencyTracker));
app.use('/', pageRoutes);

// Camera streaming endpoints
app.get('/camera/stream.mjpg', (req, res) => {
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send frames from latest camera data
    const sendFrame = () => {
        if (latestSensorData.camera && latestSensorData.camera.lastFrame) {
            const frameBuffer = Buffer.from(latestSensorData.camera.lastFrame.split(',')[1], 'base64');
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: ${frameBuffer.length}\r\n\r\n`);
            res.write(frameBuffer);
            res.write('\r\n');
        }
    };
    
    const interval = setInterval(sendFrame, 200); // 5 FPS
    
    req.on('close', () => {
        clearInterval(interval);
    });
});

// Static camera frame endpoint
app.get('/api/camera/latest', (req, res) => {
    if (latestSensorData.camera && latestSensorData.camera.lastFrame) {
        const frameBuffer = Buffer.from(latestSensorData.camera.lastFrame.split(',')[1], 'base64');
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(frameBuffer);
    } else {
        res.status(404).send('No camera frame available');
    }
});

// API endpoint for latest sensor data
app.get('/api/latest-data', (req, res) => {
    res.json(latestSensorData);
});

// API endpoint for connection stats
app.get('/api/connections', (req, res) => {
    const connectionStats = Array.from(activeConnections.entries()).map(([id, conn]) => ({
        id: id,
        ip: conn.ip,
        connected: new Date(conn.connected).toISOString(),
        state: conn.ws.readyState
    }));
    
    res.json({
        totalConnections: activeConnections.size,
        connections: connectionStats,
        timestamp: new Date().toISOString()
    });
});

// API endpoint for server health
app.get('/api/health', (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024),
            total: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        },
        connections: {
            websocket: ws.clients.size,
            socketio: clients.size
        },
        latency: latencyTracker.getStats(),
        timestamp: new Date().toISOString()
    });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('Express server error:', err.message);
    res.status(500).json({ 
        error: 'Server Error', 
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown with cleanup
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    
    // Flush any pending log data
    dataLogger.flushBuffer();
    
    // Close all WebSocket connections properly
    ws.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close(1000, 'Server shutdown');
        }
    });
    
    // Close Socket.IO connections
    io.close(() => {
        console.log('Socket.IO server closed');
    });
    
    // Close http server
    server.close(() => {
        console.log('http server closed');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.log('Force exit after timeout');
        process.exit(1);
    }, 1000);
});

// Handle SIGTERM for Docker/PM2
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    process.emit('SIGINT');
});

// Start server with enhanced logging
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 http Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔒 ws Server running on ws://0.0.0.0:${PORT}`);
    console.log(`📱 Phone: http://192.168.1.11:${PORT}/phone`);
    console.log(`📊 Dashboard: http://192.168.1.11:${PORT}/dashboard`);
    console.log(`📈 Analytics: http://192.168.1.11:${PORT}/analytics`);
    console.log(`📋 Logs: http://192.168.1.11:${PORT}/logs`);
    console.log(`⚡ Server started at: ${new Date().toISOString()}`);
    console.log(`🔧 Process ID: ${process.pid}`);
    console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
    console.log(`🌐 API Endpoints:`);
    console.log(`   - GET /api/health - Server health status`);
    console.log(`   - GET /api/latest-data - Latest sensor data`);
    console.log(`   - GET /api/connections - Connection statistics`);
    console.log(`   - GET /api/camera/latest - Latest camera frame`);
    console.log(`   - GET /camera/stream.mjpg - MJPEG camera stream`);
});

// Export for testing
module.exports = { app, server, ws, io };
