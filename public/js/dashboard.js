// Dashboard Core Variables
const socket = io();
const statusDiv = document.getElementById('status');
const statsDiv = document.getElementById('stats');
const statsContent = document.getElementById('stats-content');

// 3D Visualization Variables
let scene, camera, renderer, phoneModel, controls;
let isThreeJSInitialized = false;
let animationId = null;
let axesHelper, isAxesVisible = true;
let isAnimationPaused = false;

// Camera Variables
let frontCameraStream = null;
let rearCameraStream = null;
let isFrontCameraActive = false;
let isRearCameraActive = false;

// Map Variables
let map, mapMarker;
let isMapInitialized = false;

// Performance Variables
let lastUpdateTime = Date.now();
let frameCount = 0;
let fps = 0;

// Orientation tracking with smoothing
let currentOrientation = { alpha: 0, beta: 0, gamma: 0 };
let previousOrientation = { alpha: 0, beta: 0, gamma: 0 };
const orientationThreshold = 30; // Degrees threshold for abrupt changes

const speakerHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
// ========================================
// SOCKET CONNECTION HANDLERS
// ========================================

socket.on('connect', () => {
    updateConnectionStatus(true);
    
    // Initialize 3D visualization and map after connection
    setTimeout(() => {
        if (!isThreeJSInitialized) {
            initialize3DVisualization();
        }
        if (!isMapInitialized) {
            initializeMap();
        }
    }, 500);
});

socket.on('disconnect', () => {
    updateConnectionStatus(false);
});

socket.on('sensorData', (data) => {
    console.log('Received data:', data);
    updateAllSensorDisplays(data);
    
    // Update 3D visualization with CORRECTED and SMOOTHED orientation data
    if (data.orientation && isThreeJSInitialized) {
        const smoothedOrientation = smoothOrientation(data.orientation);
        currentOrientation = smoothedOrientation;
        update3DOrientation(smoothedOrientation);
        updateCompass(smoothedOrientation.alpha);
    }
    
    // Update GPS map
    if (data.gps && map) {
        updateMap(data.gps);
    }
    
    // Update calculated orientation displays
    if (data.calculatedOrientation) {
        updateOrientationDisplays(data.calculatedOrientation);
    }
    
    calculateFPS();
});

function updateCameraStatus(cameraType, status) {
    const statusElement = document.getElementById(`${cameraType}-camera-status`);
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `camera-status ${status.toLowerCase().replace(' ', '-')}`;
    }
}

// ========================================
// ORIENTATION SMOOTHING FUNCTION
// ========================================

function smoothOrientation(newOrientation) {
    // Check for abrupt changes and ignore them
    // const alphaDiff = Math.abs(newOrientation.alpha - previousOrientation.alpha);
    // const betaDiff = Math.abs(newOrientation.beta - previousOrientation.beta);
    // const gammaDiff = Math.abs(newOrientation.gamma - previousOrientation.gamma);
    
    // // Handle 360° wrap-around for alpha
    // const alphaWrapDiff = Math.min(alphaDiff, 360 - alphaDiff);
    
    // // If change is too abrupt, use previous values with slight interpolation
    // const smoothedOrientation = {
    //     alpha: (alphaWrapDiff > orientationThreshold) ? 
    //         previousOrientation.alpha : 
    //         (previousOrientation.alpha * 0.2 + newOrientation.alpha * 0.8),
    //     beta: (betaDiff > orientationThreshold) ? 
    //         previousOrientation.beta : 
    //         (previousOrientation.beta * 0.2 + newOrientation.beta * 0.8),
    //     gamma: (gammaDiff > orientationThreshold) ? 
    //         previousOrientation.gamma : 
    //         (previousOrientation.gamma * 0.2 + newOrientation.gamma * 0.8)
    // };
    
    // previousOrientation = smoothedOrientation;
    // return smoothedOrientation;
    return newOrientation;
}

// ========================================
// GPS MAP SYSTEM
// ========================================

function initializeMap() {
    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.warn('Map element not found');
            return;
        }

        // Initialize map with default location
        map = L.map('map').setView([28.6139, 77.2090], 13);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Create marker for phone location
        mapMarker = L.marker([28.6139, 77.2090]).addTo(map)
            .bindPopup('Phone Location')
            .openPopup();

        isMapInitialized = true;
        console.log('✅ GPS Map initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing GPS map:', error);
    }
}

function updateMap(gpsData) {
    if (!map || !mapMarker || !gpsData.latitude || !gpsData.longitude) return;
    
    try {
        const lat = gpsData.latitude;
        const lon = gpsData.longitude;
        
        // Update marker position
        mapMarker.setLatLng([lat, lon]);
        
        // Update map view (only center if this is the first GPS reading)
        if (map.getZoom() === 13) {
            map.setView([lat, lon], 16);
        }
        
        // Update popup content with detailed GPS info
        const popupContent = `
            <div style="font-size: 12px;">
                <strong>📍 Phone Location</strong><br>
                Lat: ${lat.toFixed(6)}<br>
                Lon: ${lon.toFixed(6)}<br>
                Alt: ${(gpsData.altitude || 0).toFixed(1)}m<br>
                Accuracy: ±${(gpsData.accuracy || 0).toFixed(1)}m<br>
                Speed: ${(gpsData.speed || 0).toFixed(1)} m/s<br>
                Heading: ${(gpsData.heading || 0).toFixed(1)}°
            </div>
        `;
        mapMarker.bindPopup(popupContent);
        
        // Update GPS info display
        updateElement('map-lat', lat.toFixed(6));
        updateElement('map-lon', lon.toFixed(6));
        updateElement('map-accuracy', `±${(gpsData.accuracy || 0).toFixed(1)}m`);
        updateElement('map-altitude', (gpsData.altitude || 0).toFixed(1));
        updateElement('map-speed', (gpsData.speed || 0).toFixed(1));
        updateElement('map-heading', (gpsData.heading || 0).toFixed(1));
        
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

// ========================================
// ENHANCED 3D VISUALIZATION SYSTEM
// ========================================

function initialize3DVisualization() {
    try {
        const canvas = document.getElementById('imu-3d-canvas');
        if (!canvas) {
            console.warn('3D canvas element not found');
            return;
        }

        // Get container dimensions
        const container = canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight || 400;

        // Create Three.js scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

        // Create camera with proper aspect ratio
        camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
        camera.position.set(4, 3, 4);

        // Create renderer
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding;

        // Create detailed phone model
        createDetailedPhoneModel();
        
        // Add lighting
        setupEnhancedLighting();
        
        // Add environment elements
        addEnvironmentElements();
        
        // Setup controls
        setupOrbitControls();
        
        // Setup control buttons
        setupEnhancedControlButtons();
        
        // Start animation loop
        startAnimationLoop();
        
        // Handle window resize
        window.addEventListener('resize', handleResize);
        
        isThreeJSInitialized = true;
        console.log('✅ Enhanced 3D visualization initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing 3D visualization:', error);
    }
}
function createDetailedPhoneModel() {
    // Create main phone body
    const phoneGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.08);
    const phoneMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff41,
        transparent: true,
        opacity: 0.8,
        shininess: 100,
        specular: 0x004400
    });
    
    phoneModel = new THREE.Mesh(phoneGeometry, phoneMaterial);
    phoneModel.rotation.order = 'YXZ'; // Correct rotation order for device orientation
    phoneModel.castShadow = true;
    phoneModel.rotation.set(0,0,0);
    phoneModel.rotation.x = -Math.PI / 2; 
    phoneModel.receiveShadow = true;
    scene.add(phoneModel);

    // Define materials first to avoid reference errors
    const speakerHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const metalMaterial = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 50 });
    const glassMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x111111, 
        transparent: true, 
        opacity: 0.9,
        shininess: 100 
    });

    // Add screen overlay - FACING POSITIVE Z DIRECTION
    const screenGeometry = new THREE.PlaneGeometry(0.7, 1.4);
    const screenMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.95
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = 0.041; // Positive Z (front face)
    phoneModel.add(screen);

    // Add screen bezel - ALSO FACING POSITIVE Z
    const bezelGeometry = new THREE.PlaneGeometry(0.72, 1.42);
    const bezelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
    bezel.position.z = 0.040; // Slightly behind screen, still positive Z
    phoneModel.add(bezel);

    // Enhanced front camera - ON SCREEN SIDE (positive Z)
    const frontCameraHousingGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16);
    const frontCameraHousing = new THREE.Mesh(frontCameraHousingGeometry, metalMaterial);
    frontCameraHousing.position.set(-0.15, 0.65, 0.045); // Positive Z
    frontCameraHousing.rotation.x = Math.PI / 2;
    phoneModel.add(frontCameraHousing);

    const frontCameraLensGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.008, 16);
    const frontCameraLens = new THREE.Mesh(frontCameraLensGeometry, glassMaterial);
    frontCameraLens.position.set(-0.15, 0.65, 0.048); // Positive Z
    frontCameraLens.rotation.x = Math.PI / 2;
    phoneModel.add(frontCameraLens);

    // Face ID sensor array - ON SCREEN SIDE (positive Z)
    for (let i = 0; i < 3; i++) {
        const sensorGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.005, 8);
        const sensor = new THREE.Mesh(sensorGeometry, speakerHoleMaterial);
        sensor.position.set(-0.05 + i * 0.03, 0.65, 0.045); // Positive Z
        sensor.rotation.x = Math.PI / 2;
        phoneModel.add(sensor);
    }

    // Enhanced rear camera system - ON BACK SIDE (negative Z)
    const rearCameraModuleGeometry = new THREE.BoxGeometry(0.35, 0.35, 0.025);
    const rearCameraModule = new THREE.Mesh(rearCameraModuleGeometry, metalMaterial);
    rearCameraModule.position.set(-0.15, 0.45, -0.055); // Negative Z (back)
    phoneModel.add(rearCameraModule);

    // Main camera (largest) - ON BACK SIDE
    const mainCameraGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    const mainCamera = new THREE.Mesh(mainCameraGeometry, glassMaterial);
    mainCamera.position.set(-0.15, 0.55, -0.065); // Negative Z (back)
    mainCamera.rotation.x = Math.PI / 2;
    phoneModel.add(mainCamera);

    // Ultra-wide camera - ON BACK SIDE
    const ultraWideCameraGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 16);
    const ultraWideCamera = new THREE.Mesh(ultraWideCameraGeometry, glassMaterial);
    ultraWideCamera.position.set(-0.05, 0.45, -0.065); // Negative Z (back)
    ultraWideCamera.rotation.x = Math.PI / 2;
    phoneModel.add(ultraWideCamera);

    // Telephoto camera - ON BACK SIDE
    const telephotoCamera = new THREE.Mesh(ultraWideCameraGeometry, glassMaterial);
    telephotoCamera.position.set(-0.25, 0.45, -0.065); // Negative Z (back)
    telephotoCamera.rotation.x = Math.PI / 2;
    phoneModel.add(telephotoCamera);

    // Enhanced flash - ON BACK SIDE
    const flashHousingGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 8);
    const flashHousing = new THREE.Mesh(flashHousingGeometry, metalMaterial);
    flashHousing.position.set(-0.15, 0.35, -0.06); // Negative Z (back)
    flashHousing.rotation.x = Math.PI / 2;
    phoneModel.add(flashHousing);

    // LiDAR sensor - ON BACK SIDE
    const lidarGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 16);
    const lidarMaterial = new THREE.MeshBasicMaterial({ color: 0x330033 });
    const lidar = new THREE.Mesh(lidarGeometry, lidarMaterial);
    lidar.position.set(-0.05, 0.35, -0.06); // Negative Z (back)
    lidar.rotation.x = Math.PI / 2;
    phoneModel.add(lidar);

    // Enhanced speaker grille (top) - ON SCREEN SIDE
    const topSpeakerHousingGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.008);
    const topSpeakerHousing = new THREE.Mesh(topSpeakerHousingGeometry, metalMaterial);
    topSpeakerHousing.position.set(0, 0.72, 0.045); // Positive Z (front)
    phoneModel.add(topSpeakerHousing);

    for (let i = 0; i < 12; i++) {
        const speakerHoleGeometry = new THREE.CylinderGeometry(0.006, 0.006, 0.015, 8);
        const speakerHole = new THREE.Mesh(speakerHoleGeometry, speakerHoleMaterial);
        speakerHole.position.set(-0.165 + i * 0.03, 0.72, 0.047); // Positive Z (front)
        speakerHole.rotation.x = Math.PI / 2;
        phoneModel.add(speakerHole);
    }

    // Enhanced bottom speaker/charging area - ON SCREEN SIDE
    const bottomModuleGeometry = new THREE.BoxGeometry(0.4, 0.04, 0.01);
    const bottomModule = new THREE.Mesh(bottomModuleGeometry, metalMaterial);
    bottomModule.position.set(0, -0.75, 0.045); // Positive Z (front)
    phoneModel.add(bottomModule);

    // Bottom speaker grilles (stereo) - ON SCREEN SIDE
    for (let side = 0; side < 2; side++) {
        for (let i = 0; i < 6; i++) {
            const bottomSpeakerGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.015, 8);
            const bottomSpeaker = new THREE.Mesh(bottomSpeakerGeometry, speakerHoleMaterial);
            bottomSpeaker.position.set(-0.15 + side * 0.3 + i * 0.02, -0.75, 0.047); // Positive Z (front)
            bottomSpeaker.rotation.x = Math.PI / 2;
            phoneModel.add(bottomSpeaker);
        }
    }

    // USB-C charging port - ON SCREEN SIDE
    const chargingPortGeometry = new THREE.BoxGeometry(0.12, 0.04, 0.015);
    const chargingPort = new THREE.Mesh(chargingPortGeometry, speakerHoleMaterial);
    chargingPort.position.set(0, -0.75, 0.047); // Positive Z (front)
    phoneModel.add(chargingPort);

    // Volume buttons (side) - NEUTRAL Z
    const volumeButtonGeometry = new THREE.BoxGeometry(0.025, 0.08, 0.02);
    const volumeButtonMaterial = new THREE.MeshPhongMaterial({ color: 0x00cc33 });
    
    const volumeUp = new THREE.Mesh(volumeButtonGeometry, volumeButtonMaterial);
    volumeUp.position.set(-0.415, 0.15, 0); // Z = 0 (side)
    phoneModel.add(volumeUp);

    const volumeDown = new THREE.Mesh(volumeButtonGeometry, volumeButtonMaterial);
    volumeDown.position.set(-0.415, 0.05, 0); // Z = 0 (side)
    phoneModel.add(volumeDown);

    // Power button (opposite side) - NEUTRAL Z
    const powerButtonGeometry = new THREE.BoxGeometry(0.025, 0.06, 0.02);
    const powerButton = new THREE.Mesh(powerButtonGeometry, volumeButtonMaterial);
    powerButton.position.set(0.415, 0.1, 0); // Z = 0 (side)
    phoneModel.add(powerButton);

    // SIM card tray - NEUTRAL Z
    const simTrayGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.015);
    const simTray = new THREE.Mesh(simTrayGeometry, metalMaterial);
    simTray.position.set(0.415, -0.2, 0); // Z = 0 (side)
    phoneModel.add(simTray);

    // Home indicator - ON SCREEN SIDE
    const homeIndicatorGeometry = new THREE.BoxGeometry(0.15, 0.008, 0.002);
    const homeIndicatorMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const homeIndicator = new THREE.Mesh(homeIndicatorGeometry, homeIndicatorMaterial);
    homeIndicator.position.set(0, -0.6, 0.042); // Positive Z (on screen)
    phoneModel.add(homeIndicator);

    // Enhanced orientation arrow - ON SCREEN SIDE, pointing UP
    const arrowGeometry = new THREE.ConeGeometry(0.06, 0.25, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff41,
        transparent: true,
        opacity: 0.8
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(0, 0.4, 0.045); // Positive Z (on screen)
    arrow.rotation.z = Math.PI; // Point upward (toward positive Y)
    phoneModel.add(arrow);

    // Add "SCREEN SIDE" text indicator using simple geometry
    const textIndicatorGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.005);
    const textIndicatorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff41,
        transparent: true,
        opacity: 0.7
    });
    const textIndicator = new THREE.Mesh(textIndicatorGeometry, textIndicatorMaterial);
    textIndicator.position.set(0, 0, 0.05); // Positive Z (on screen)
    phoneModel.add(textIndicator);

    // Antenna lines (modern phone design) - NEUTRAL Z
    for (let i = 0; i < 4; i++) {
        const antennaGeometry = new THREE.BoxGeometry(0.82, 0.002, 0.002);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, -0.6 + i * 0.4, 0); // Z = 0 (on edges)
        phoneModel.add(antenna);
    }

    // Wireframe overlay (optional)
    const wireframeGeometry = new THREE.BoxGeometry(0.82, 1.62, 0.1);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff41,
        wireframe: true,
        transparent: true,
        opacity: 0.2
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    phoneModel.add(wireframe);

    // Add coordinate axes
    axesHelper = new THREE.AxesHelper(1.5);
    scene.add(axesHelper);
}



function setupEnhancedLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0x00ff41, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x0066cc, 0.3);
    fillLight.position.set(-3, 2, -3);
    scene.add(fillLight);
}

function addEnvironmentElements() {
    // Add grid
    const gridHelper = new THREE.GridHelper(4, 10, 0x00ff41, 0x333333);
    gridHelper.position.y = -1.5;
    scene.add(gridHelper);

    // Add floating particles
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 10;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0x00ff41,
        size: 0.03,
        transparent: true,
        opacity: 0.6
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

function setupOrbitControls() {
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 2;
        controls.maxDistance = 15;
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

function setupEnhancedControlButtons() {
    // Reset camera button
    const resetBtn = document.getElementById('reset-camera');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (camera && controls) {
                camera.position.set(4, 3, 4);
                controls.target.set(0, 0, 0);
                controls.update();
            }
        });
    }

    // Toggle wireframe button
    const wireframeBtn = document.getElementById('toggle-wireframe');
    if (wireframeBtn) {
        wireframeBtn.addEventListener('click', () => {
            if (phoneModel) {
                phoneModel.material.wireframe = !phoneModel.material.wireframe;
            }
        });
    }

    // Toggle axes button
    const axesBtn = document.getElementById('toggle-axes');
    if (axesBtn) {
        axesBtn.addEventListener('click', () => {
            if (axesHelper) {
                isAxesVisible = !isAxesVisible;
                axesHelper.visible = isAxesVisible;
                axesBtn.textContent = isAxesVisible ? '📏 Hide Axes' : '📏 Show Axes';
            }
        });
    }

    // Toggle animation button
    const animationBtn = document.getElementById('toggle-animation');
    if (animationBtn) {
        animationBtn.addEventListener('click', () => {
            isAnimationPaused = !isAnimationPaused;
            animationBtn.textContent = isAnimationPaused ? '▶️ Resume' : '⏸️ Pause';
        });
    }
}

function startAnimationLoop() {
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        if (controls) {
            controls.update();
        }
        
        // Add subtle floating animation
        if (phoneModel && !isAnimationPaused) {
            phoneModel.position.y = Math.sin(Date.now() * 0.001) * 0.1;
        }
        
        renderer.render(scene, camera);
    }
    animate();
}

// ========================================
// FIXED ORIENTATION UPDATE FUNCTION WITH Y-Z AXIS SWAP
// ========================================
function update3DOrientation(orientation) {
    if (!phoneModel || !orientation || isAnimationPaused) return;
    
    try {
        // Convert degrees to radians
        const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0); // Yaw
        const beta = THREE.MathUtils.degToRad(orientation.beta || 0);   // Pitch  
        const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0); // Roll

        // Since we rotated the phone model by -90° around X-axis:
        // Original Z (screen) now points to Y
        // Original Y (top) now points to -Z
        
        // Adjust the rotations for the new coordinate system
        const euler = new THREE.Euler(
            -Math.PI/2 + beta,  // Base rotation + pitch adjustment
            alpha,              // Yaw unchanged
            -gamma,             // Roll (negated)
            'YXZ'
        );
        
        // Apply rotation using quaternion for smooth interpolation
        const targetQuaternion = new THREE.Quaternion().setFromEuler(euler);
        phoneModel.quaternion.slerp(targetQuaternion, 0.15);
        
        // Update display values
        updateElement('roll-display', (orientation.gamma || 0).toFixed(1) + '°');
        updateElement('pitch-display', (orientation.beta || 0).toFixed(1) + '°');
        updateElement('yaw-display', (orientation.alpha || 0).toFixed(1) + '°');
        
        // Debug log
        if (Math.abs(orientation.beta) < 5 && Math.abs(orientation.gamma) < 5) {
            console.log('Phone is flat with screen facing Y direction ✓');
        }
        
    } catch (error) {
        console.error('Error updating 3D orientation:', error);
    }
}socket




function handleResize() {
    if (!camera || !renderer) return;
    
    const canvas = document.getElementById('imu-3d-canvas');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight || 400;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    
    // Also resize map if needed
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

function updateCompass(alpha) {
    const compassNeedle = document.getElementById('compass-needle');
    if (compassNeedle && alpha !== undefined) {
        // Apply the same 180° correction to compass
        const correctedAlpha = (alpha + 180) % 360;
        compassNeedle.style.transform = `rotate(${correctedAlpha}deg)`;
    }
}

// ========================================
// ENHANCED CAMERA SYSTEM FOR DASHBOARD
// ========================================
// ========================================
// PHONE CAMERA STREAM SYSTEM (NOT LAPTOP)
// ========================================

let phoneCameraMode = 'environment'; // 'user' for front, 'environment' for rear
let isPhoneCameraActive = false;

function setupCameraControls() {
    // Phone camera toggle
    const phoneToggle = document.getElementById('phone-camera-toggle');
    if (phoneToggle) {
        phoneToggle.addEventListener('click', togglePhoneCamera);
    }

    // Camera mode switch
    const switchMode = document.getElementById('switch-camera-mode');
    if (switchMode) {
        switchMode.addEventListener('click', switchCameraMode);
    }

    // Snapshot button
    const phoneSnapshot = document.getElementById('phone-camera-snapshot');
    if (phoneSnapshot) {
        phoneSnapshot.addEventListener('click', () => takeSnapshot('phone'));
    }
}

async function togglePhoneCamera() {
    try {
        if (isPhoneCameraActive) {
            await stopPhoneCamera();
        } else {
            await startPhoneCamera();
        }
    } catch (error) {
        console.error('Error toggling phone camera:', error);
        updatePhoneCameraStatus('Error');
    }
}

async function switchCameraMode() {
    if (!isPhoneCameraActive) return;
    
    // Switch between front and rear camera
    phoneCameraMode = phoneCameraMode === 'environment' ? 'user' : 'environment';
    
    // Restart camera with new mode
    await stopPhoneCamera();
    setTimeout(async () => {
        await startPhoneCamera();
    }, 500);
}
async function startPhoneCamera() {
    try {
        const videoElement = document.getElementById('phone-camera');
        const toggleButton = document.getElementById('phone-camera-toggle');
        const modeElement = document.getElementById('phone-camera-mode');
        
        if (!videoElement) return;

        // First, enumerate all available cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', videoDevices);
        
        // Look for phone-like camera names or use facingMode
        let stream;
        try {
            // Try to get phone camera with exact facingMode
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { exact: phoneCameraMode },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
        } catch (e) {
            console.log('Exact facingMode failed, trying ideal...');
            try {
                // Fallback to ideal facingMode
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: phoneCameraMode },
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
            } catch (e2) {
                console.log('FacingMode failed, trying device selection...');
                
                // Try to find a camera that's not the default PC camera
                const nonPCCamera = videoDevices.find(device => 
                    !device.label.toLowerCase().includes('facetime') &&
                    !device.label.toLowerCase().includes('integrated') &&
                    !device.label.toLowerCase().includes('webcam') &&
                    device.label.toLowerCase().includes('phone') ||
                    device.label.toLowerCase().includes('android') ||
                    device.label.toLowerCase().includes('mobile')
                );
                
                if (nonPCCamera) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: nonPCCamera.deviceId } }
                    });
                } else {
                    // Last resort - use any available camera
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                }
            }
        }

        videoElement.srcObject = stream;
        frontCameraStream = stream;
        isPhoneCameraActive = true;

        updatePhoneCameraStatus('Active');
        if (toggleButton) toggleButton.textContent = '⏹️ Stop Camera';
        if (modeElement) {
            modeElement.textContent = phoneCameraMode === 'environment' ? 'Rear Camera' : 'Front Camera';
        }
        
        console.log(`✅ Camera started: ${stream.getVideoTracks()[0].label}`);
        
    } catch (error) {
        console.error('Error starting camera:', error);
        updatePhoneCameraStatus('Failed - No phone camera detected');
    }
}


async function stopPhoneCamera() {
    try {
        const videoElement = document.getElementById('phone-camera');
        const toggleButton = document.getElementById('phone-camera-toggle');
        
        if (frontCameraStream) {
            frontCameraStream.getTracks().forEach(track => track.stop());
            frontCameraStream = null;
        }
        
        if (videoElement) {
            videoElement.srcObject = null;
        }
        
        isPhoneCameraActive = false;
        updatePhoneCameraStatus('Stopped');
        if (toggleButton) toggleButton.textContent = '▶️ Start Phone Camera';
        
    } catch (error) {
        console.error('Error stopping phone camera:', error);
    }
}

async function takeSnapshot(cameraType) {
    const videoElement = document.getElementById('phone-camera');
    const canvasElement = document.getElementById('phone-camera-canvas');
    
    if (!videoElement || !canvasElement || !videoElement.srcObject) {
        alert('Camera not active');
        return;
    }
    
    const context = canvasElement.getContext('2d');
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    context.drawImage(videoElement, 0, 0);
    
    // Create download link
    canvasElement.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phone-camera-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

function updatePhoneCameraStatus(status) {
    const statusElement = document.getElementById('phone-camera-status');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `camera-status ${status.toLowerCase().replace(' ', '-')}`;
    }
}

// Remove the old camera functions (toggleCamera, startCamera, stopCamera, updateCameraStatus)
// Keep only the phone camera functions above

// ========================================
// SENSOR DATA DISPLAY SYSTEM
// ========================================

function updateAllSensorDisplays(data) {
    updateTimestamp(data.timestamp);
    updateAccelerometer(data.accelerometer);
    updateGyroscope(data.gyroscope);
    updateMagnetometer(data.magnetometer);
    updateGPS(data.gps);
    updateEnvironmental(data);
    updateOrientation(data.orientation);
    updateMotionAnalysis(data.motion);
    updateCalculatedValues(data.calculatedOrientation);
    updateBattery(data.battery);
    updateNetwork(data.network);
    updateDevice(data.device, data.performance);
    updatePerformanceMetrics(data);
    
    // Update 3D visualization
    if (data.orientation && isThreeJSInitialized) {
        update3DOrientation(data.orientation);
        updateCompass(data.orientation.alpha);
    }
    
    // Update GPS map
    if (data.gps && map) {
        updateMap(data.gps);
    }
    
    // Handle camera status safely
    if (data.camera && data.camera.active) {
        // Check if function exists before calling
        if (typeof updateCameraStatus === 'function') {
            updateCameraStatus('phone', 'Active - Streaming');
        } else {
            console.log('Camera active:', data.camera);
        }
    }
}

function updateOrientationDisplays(calc) {
    if (!calc) return;
    
    updateElement('roll-display', calc.roll?.toFixed(1) + '°');
    updateElement('pitch-display', calc.pitch?.toFixed(1) + '°');
    updateElement('yaw-display', calc.yaw?.toFixed(1) + '°');
}


function updateTimestamp(timestamp) {
    if (timestamp) {
        updateElement('timestamp', new Date(timestamp).toLocaleString());
        updateElement('server-time', new Date().toLocaleString());
    }
}

function updateAccelerometer(accel) {
    if (!accel) return;
    updateElement('accel-x', accel.x?.toFixed(2));
    updateElement('accel-y', accel.y?.toFixed(2));
    updateElement('accel-z', accel.z?.toFixed(2));
    updateElement('accel-mag', accel.magnitude?.toFixed(2));
}

function updateGyroscope(gyro) {
    if (!gyro) return;
    updateElement('gyro-x', gyro.x?.toFixed(2));
    updateElement('gyro-y', gyro.y?.toFixed(2));
    updateElement('gyro-z', gyro.z?.toFixed(2));
}

function updateMagnetometer(mag) {
    if (!mag) return;
    updateElement('mag-x', mag.x?.toFixed(2));
    updateElement('mag-y', mag.y?.toFixed(2));
    updateElement('mag-z', mag.z?.toFixed(2));
}

function updateGPS(gps) {
    if (!gps) return;
    updateElement('gps-lat', gps.latitude?.toFixed(6));
    updateElement('gps-lon', gps.longitude?.toFixed(6));
    updateElement('gps-alt', gps.altitude?.toFixed(2));
    updateElement('gps-acc', gps.accuracy?.toFixed(2));
    updateElement('gps-speed', gps.speed?.toFixed(2));
}

function updateEnvironmental(data) {
    if (data.light !== undefined) {
        updateElement('light', data.light.toFixed(1));
    }
    if (data.proximity !== undefined) {
        updateElement('proximity', data.proximity.toFixed(1));
    }
    if (data.pressure !== undefined) {
        updateElement('pressure', data.pressure.toFixed(1));
    }
}

function updateOrientation(orientation) {
    if (!orientation) return;
    updateElement('orient-alpha', orientation.alpha?.toFixed(1));
    updateElement('orient-beta', orientation.beta?.toFixed(1));
    updateElement('orient-gamma', orientation.gamma?.toFixed(1));
    updateElement('orient-absolute', orientation.absolute ? 'Yes' : 'No');
}

function updateMotionAnalysis(motion) {
    if (!motion) return;
    updateElement('motion-status', motion.isMoving ? 'Moving' : 'Stationary');
    updateElement('motion-intensity', motion.intensity?.toFixed(2));
    
    const motionTypeElement = document.getElementById('motion-type');
    if (motionTypeElement && motion.type) {
        motionTypeElement.innerHTML = `<span class="motion-indicator motion-${motion.type}"></span>${motion.type}`;
    }
}

function updateCalculatedValues(calc) {
    if (!calc) return;
    updateElement('calc-roll', calc.roll?.toFixed(1));
    updateElement('calc-pitch', calc.pitch?.toFixed(1));
    updateElement('calc-yaw', calc.yaw?.toFixed(1));
    
    // Update orientation displays
    updateElement('roll-display', calc.roll?.toFixed(1) + '°');
    updateElement('pitch-display', calc.pitch?.toFixed(1) + '°');
    updateElement('yaw-display', calc.yaw?.toFixed(1) + '°');
}

function updateBattery(battery) {
    if (!battery) return;
    updateElement('battery-level', (battery.level * 100).toFixed(0));
    updateElement('battery-charging', battery.charging ? 'Yes' : 'No');
    
    const time = battery.charging ? battery.chargingTime : battery.dischargingTime;
    updateElement('battery-time', time && time !== Infinity ? Math.round(time / 60) : '--');
}

function updateNetwork(network) {
    if (!network) return;
    updateElement('network-type', network.effectiveType);
    updateElement('network-speed', network.downlink?.toFixed(1));
    updateElement('network-rtt', network.rtt);
}

function updateDevice(device, performance) {
    if (device) {
        updateElement('device-platform', device.platform);
        updateElement('device-cores', device.hardwareConcurrency);
    }
    
    if (performance?.memory) {
        updateElement('device-memory', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024));
    }
}

function updatePerformanceMetrics(data) {
    const latency = data.clientLatency || data.serverLatency;
    if (latency !== undefined) {
        updateElement('perf-latency', latency.toFixed(1));
        updateElement('header-latency', `${latency.toFixed(1)} ms`);
        
        const latencyDisplay = document.getElementById('latency-value');
        if (latencyDisplay) {
            latencyDisplay.textContent = `${latency.toFixed(1)}ms`;
        }
    }
    
    if (data.dataCount) {
        updateElement('perf-packets', data.dataCount);
        updateElement('header-data-rate', `${fps.toFixed(1)} Hz`);
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || '--';
        console.log(`Updated ${id}: ${value}`); // Debug line
    } else {
        console.warn(`Element not found: ${id}`); // Debug line
    }
}

// ========================================
// CONNECTION STATUS AND UTILITY FUNCTIONS
// ========================================

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');
    
    if (connected) {
        statusDiv.textContent = '🟢 Connected to server';
        statusDiv.className = 'stat-value connected';
        statsDiv.style.display = 'block';
        
        if (indicator) indicator.classList.add('connected');
        if (text) text.textContent = 'Connected';
    } else {
        statusDiv.textContent = '🔴 Disconnected from server';
        statusDiv.className = 'stat-value disconnected';
        statsDiv.style.display = 'none';
        
        if (indicator) indicator.classList.remove('connected');
        if (text) text.textContent = 'Disconnected';
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || '--';
    }
}

function calculateFPS() {
    frameCount++;
    const now = Date.now();
    
    if (now - lastUpdateTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastUpdateTime = now;
    }
}

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    setupCameraControls();
    
    // Set active navigation link
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
    
    // Request stats every 5 seconds
    setInterval(() => {
        fetch('/api/stats')
            .then(response => response.json())
            .then(stats => {
                if (stats && statsContent) {
                    statsContent.innerHTML = `
                        <div>📊 Total Readings: ${stats.totalReadings || 0}</div>
                        <div>⚡ Data Rate: ${stats.dataRate || 0} Hz</div>
                        <div>🎯 Motion Distribution: ${Object.entries(stats.motionClassification || {}).map(([k,v]) => `${k}: ${v}`).join(', ') || 'None'}</div>
                        <div>📈 FPS: ${fps.toFixed(1)}</div>
                    `;
                }
            })
            .catch(error => console.error('Error fetching stats:', error));
    }, 5000);
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    } else {
        if (isThreeJSInitialized) {
            startAnimationLoop();
        }
    }
});

// Add camera frame listener
socket.on('cameraFrame', (frameData) => {
    displayCameraFrame(frameData);
});

function displayCameraFrame(frameData) {
    const img = document.getElementById('phone-camera-stream');
    if (img) {
        img.src = frameData.data;
        img.style.display = 'block';
        console.log('Camera frame displayed');
    } else {
        console.warn('Camera display element not found');
    }
}


// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (frontCameraStream) {
        frontCameraStream.getTracks().forEach(track => track.stop());
    }
    if (rearCameraStream) {
        rearCameraStream.getTracks().forEach(track => track.stop());
    }
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
});

console.log('📊 Dashboard initialized with enhanced phone model, camera streaming, and corrected Y-Z orientation');
