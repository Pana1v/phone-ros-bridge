# Phone Sensor Server v1

A real-time sensor data streaming server for mobile devices with **Green/Black UI theme**. Supports Node.js backend with Python ROS2 Humble integration for robotics perception stacks.

Further details here: https://medium.com/@praajarpit/ros-sensor-bridge-cost-effective-perception-stack-1-4-bfff3e94a65b

## Features
- 📱 Real-time sensor data streaming (accelerometer, gyroscope, GPS, orientation, camera)
- 🔌 WebSocket (`/ws`) and Socket.IO support for dual-client architecture
- 💾 Automatic data logging with analytics
- 🎯 Interactive 3D IMU visualization with Three.js
- 🗺️ Live GPS mapping with Leaflet
- 📹 MJPEG camera streaming
- 🔒 SSL/TLS encryption support
- 🤖 ROS 2 Humble integration
- 🎨 Sleek Green/Black neon theme

## Screenshots

### Dashboard
![Dashboard](/.gemini/antigravity/brain/35791ddb-b8a0-4819-8fdf-f139dc414009/dashboard_green_black_theme_1767466270349.png)

### Phone Streamer
![Phone Streamer](/.gemini/antigravity/brain/35791ddb-b8a0-4819-8fdf-f139dc414009/phone_page_green_black_theme_1767466296422.png)

### Analytics
![Analytics](/.gemini/antigravity/brain/35791ddb-b8a0-4819-8fdf-f139dc414009/analytics_page_green_black_theme_1767466308570.png)

Note: Supported ROS version is **ROS 2 Humble**. The server component runs on any platform with Node.js.

## Project Structure
```
phone-ros-bridge/
├── phone_sensor_bridge/        # Main application directory
│   ├── server.js               # Node.js HTTPS/WSS server (PRIMARY)
│   ├── cert.pem, key.pem       # SSL certificates
│   ├── listen.py               # Python ROS2 bridge
│   ├── ros_websocket_bridge.py # WebSocket-to-ROS bridge
│   ├── classes/                # DataLogger, SensorProcessor
│   ├── config/                 # SSL configuration
│   ├── public/                 # Static frontend assets
│   │   ├── css/styles.css      # Green/Black theme
│   │   └── js/                 # Frontend modules
│   ├── routes/                 # API and page routes
│   ├── views/                  # HTML templates (dashboard, phone, analytics, logs)
│   └── sensor_logs/            # JSONL data logs
└── README.md                   # This file
```

## Getting Started

### Prerequisites
- **Node.js** v14+ (v22+ recommended)
- **Python** 3.7+
- **ROS 2 Humble** (for robotics integration)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pana1v/phone-ros-bridge.git
   cd phone-ros-bridge/phone_sensor_bridge
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **(Optional) Set up ROS 2 and build the Python package:**
   ```bash
   # Source your ROS 2 installation
   source /opt/ros/humble/setup.bash
   
   # Build the package
   cd phone_sensor_bridge
   python3 setup.py install
   ```

### Running the Server

#### Node.js Server (Main)
```bash
cd phone_sensor_bridge
node server.js
```

The server will start on **https://0.0.0.0:3000** with the following endpoints:
- 📊 **Dashboard**: `https://localhost:3000/dashboard`
- 📱 **Phone Streamer**: `https://localhost:3000/phone`
- 📈 **Analytics**: `https://localhost:3000/analytics`
- 📋 **Logs**: `https://localhost:3000/logs`

#### Python ROS2 Bridge
```bash
python3 listen.py
```

### Connecting Mobile Devices

Mobile phones should connect to the **WebSocket server** at:
```
wss://YOUR_SERVER_IP:3000/ws
```

> **Note**: The `/ws` path is required to separate phone WebSocket connections from dashboard Socket.IO connections.

### SSL/TLS Configuration

The server uses self-signed certificates by default. To regenerate:

```bash
cd phone_sensor_bridge
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:YOUR_IP"
```

Replace `YOUR_IP` with your server's local IP address.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server health status |
| `/api/latest-data` | GET | Latest sensor data (JSON) |
| `/api/connections` | GET | Active connection stats |
| `/api/camera/latest` | GET | Latest camera frame (JPEG) |
| `/camera/stream.mjpg` | GET | MJPEG video stream |

## Camera Stream Preview

### In Browser
Open the dashboard at `https://localhost:3000/dashboard` or view the MJPEG stream directly at:
```
https://YOUR_SERVER_IP:3000/camera/stream.mjpg
```

### With Python (OpenCV)
```bash
pip install opencv-python requests numpy
python3 preview_mjpeg_stream.py
```

## Technology Stack
- **Backend**: Node.js (Express, WebSocket, Socket.IO)
- **Frontend**: HTML5, Three.js, Leaflet, Chart.js
- **Styling**: Pure CSS with Green/Black neon theme
- **ROS**: Python 3 with rclpy (ROS 2 Humble)

## License
MIT License

## Authors
- Panav (@Pana1v)

---
**Contributions welcome!** Open issues or submit PRs on [GitHub](https://github.com/Pana1v/phone-ros-bridge).
