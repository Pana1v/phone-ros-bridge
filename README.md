# Phone Sensor Server v1

A server for collecting, processing, and visualizing sensor data from mobile phones. This project supports both Node.js and Python backends, provides a web dashboard, and includes SSL support for secure connections.

## Features
- Real-time sensor data collection from mobile devices
- WebSocket and REST API support
- Data logging and analytics
- 3D dashboard visualization
- SSL/TLS support
- ROS (Robot Operating System) integration

Note: Supported Version is ROS Humble, The server component can run on any platform that supports node.js and dependencies

## Project Structure
```
cert.pem, key.pem           # SSL certificates
listen.py                   # Python server for ROS bridge
ros_websocket_bridge.py     # Python WebSocket bridge for ROS
server.js                   # Node.js server
setup.sh                    # Setup script
requirements.txt            # Python dependencies
package.json                # Node.js dependencies

classes/                    # Node.js classes (DataLogger, SensorProcessor)
config/                     # Configuration files (SSL, etc.)
phone_sensor_bridge/        # Python ROS package
public/                     # Frontend (HTML, JS, CSS)
    client.js, index.html, phone.html
    css/                    # Stylesheets
    js/                     # Frontend JS modules
routes/                     # Node.js route handlers
sensor_logs/                # Logged sensor data (JSONL)
views/                      # HTML views for dashboard, analytics, logs
```

## Getting Started

### Prerequisites
- Node.js (v14+ recommended)
- Python 3.7+
- ROS (for ROS integration)

### Installation
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd phone-sensor-server v1
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. (Optional) Set up ROS and build the Python package:
   ```bash
   cd phone_sensor_bridge
   python3 setup.py install
   ```

### Running the Server
- To start the Node.js server:
  ```bash
  node server.js
  ```
- To start the Python ROS bridge:
  ```bash
  python3 listen.py
  ```

### Accessing the Dashboard
Open your browser and go to `https://localhost:PORT/` (replace PORT with your configured port).

## Camera Stream Preview (MJPEG)

You can view the phone camera stream in your browser or with a Python script:

### In Browser
- Open the dashboard: `https://<your-server-host>:<port>/dashboard`
- Or view the MJPEG stream directly: `https://<your-server-host>:<port>/camera/stream.mjpg`

### With Python (OpenCV Preview)
A script `preview_mjpeg_stream.py` is included to preview the MJPEG stream, even with self-signed certificates.

Install dependencies:
```bash
pip install opencv-python requests numpy
```
Run the script:
```bash
python3 preview_mjpeg_stream.py
```

### Regenerating SSL Certificates
To create new self-signed certificates (with proper SAN):
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```
Replace `localhost` and `127.0.0.1` as needed. Restart the server after replacing the certs.

## License
MIT License

## Authors
- Panav (repo owner)

---
Feel free to contribute or open issues!
