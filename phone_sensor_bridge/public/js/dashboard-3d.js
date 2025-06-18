// ========================================
// 3D VISUALIZATION SYSTEM
// ========================================

// 3D Visualization Variables
let scene, camera, renderer, phoneModel, controls;
let animationId = null;
let axesHelper, isAxesVisible = true;
let isAnimationPaused = false;

// Make variables globally accessible
window.isThreeJSInitialized = false;
window.animationId = animationId;

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
        
        window.isThreeJSInitialized = true;
        console.log('✅ Enhanced 3D visualization initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing 3D visualization:', error);
    }
}

function createDetailedPhoneModel() {
    // Define materials first to avoid reference errors
    const speakerHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const metalMaterial = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 50 });
    const glassMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x111111, 
        transparent: true, 
        opacity: 0.9,
        shininess: 100 
    });

    // Create main phone body
    const phoneGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.08);
    const phoneMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff41,
        transparent: true,
        opacity: 0.9,
        shininess: 100,
        specular: 0x004400
    });
    
    phoneModel = new THREE.Mesh(phoneGeometry, phoneMaterial);
    phoneModel.rotation.order = 'YXZ';
    phoneModel.castShadow = true;
    phoneModel.rotation.set(0, 0, 0);
    phoneModel.rotation.x = -Math.PI / 2;
    phoneModel.receiveShadow = true;
    scene.add(phoneModel);

    // Add screen overlay - FACING POSITIVE Z DIRECTION
    const screenGeometry = new THREE.PlaneGeometry(0.7, 1.4);
    const screenMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.95
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = 0.041;
    phoneModel.add(screen);

    // Add screen bezel
    const bezelGeometry = new THREE.PlaneGeometry(0.72, 1.42);
    const bezelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const bezel = new THREE.Mesh(bezelGeometry, bezelMaterial);
    bezel.position.z = 0.040;
    phoneModel.add(bezel);

    // Enhanced front camera
    const frontCameraHousingGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 16);
    const frontCameraHousing = new THREE.Mesh(frontCameraHousingGeometry, metalMaterial);
    frontCameraHousing.position.set(-0.15, 0.65, 0.045);
    frontCameraHousing.rotation.x = Math.PI / 2;
    phoneModel.add(frontCameraHousing);

    const frontCameraLensGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.008, 16);
    const frontCameraLens = new THREE.Mesh(frontCameraLensGeometry, glassMaterial);
    frontCameraLens.position.set(-0.15, 0.65, 0.048);
    frontCameraLens.rotation.x = Math.PI / 2;
    phoneModel.add(frontCameraLens);

    // Face ID sensor array
    for (let i = 0; i < 3; i++) {
        const sensorGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.005, 8);
        const sensor = new THREE.Mesh(sensorGeometry, speakerHoleMaterial);
        sensor.position.set(-0.05 + i * 0.03, 0.65, 0.045);
        sensor.rotation.x = Math.PI / 2;
        phoneModel.add(sensor);
    }

    // Enhanced rear camera system
    const rearCameraModuleGeometry = new THREE.BoxGeometry(0.35, 0.35, 0.025);
    const rearCameraModule = new THREE.Mesh(rearCameraModuleGeometry, metalMaterial);
    rearCameraModule.position.set(-0.15, 0.45, -0.055);
    phoneModel.add(rearCameraModule);

    // Main camera
    const mainCameraGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
    const mainCamera = new THREE.Mesh(mainCameraGeometry, glassMaterial);
    mainCamera.position.set(-0.15, 0.55, -0.065);
    mainCamera.rotation.x = Math.PI / 2;
    phoneModel.add(mainCamera);

    // Ultra-wide camera
    const ultraWideCameraGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 16);
    const ultraWideCamera = new THREE.Mesh(ultraWideCameraGeometry, glassMaterial);
    ultraWideCamera.position.set(-0.05, 0.45, -0.065);
    ultraWideCamera.rotation.x = Math.PI / 2;
    phoneModel.add(ultraWideCamera);

    // Telephoto camera
    const telephotoCamera = new THREE.Mesh(ultraWideCameraGeometry, glassMaterial);
    telephotoCamera.position.set(-0.25, 0.45, -0.065);
    telephotoCamera.rotation.x = Math.PI / 2;
    phoneModel.add(telephotoCamera);

    // Enhanced flash
    const flashHousingGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 8);
    const flashHousing = new THREE.Mesh(flashHousingGeometry, metalMaterial);
    flashHousing.position.set(-0.15, 0.35, -0.06);
    flashHousing.rotation.x = Math.PI / 2;
    phoneModel.add(flashHousing);

    // LiDAR sensor
    const lidarGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 16);
    const lidarMaterial = new THREE.MeshBasicMaterial({ color: 0x330033 });
    const lidar = new THREE.Mesh(lidarGeometry, lidarMaterial);
    lidar.position.set(-0.05, 0.35, -0.06);
    lidar.rotation.x = Math.PI / 2;
    phoneModel.add(lidar);

    // Enhanced speaker grille (top)
    const topSpeakerHousingGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.008);
    const topSpeakerHousing = new THREE.Mesh(topSpeakerHousingGeometry, metalMaterial);
    topSpeakerHousing.position.set(0, 0.72, 0.045);
    phoneModel.add(topSpeakerHousing);

    for (let i = 0; i < 12; i++) {
        const speakerHoleGeometry = new THREE.CylinderGeometry(0.006, 0.006, 0.015, 8);
        const speakerHole = new THREE.Mesh(speakerHoleGeometry, speakerHoleMaterial);
        speakerHole.position.set(-0.165 + i * 0.03, 0.72, 0.047);
        speakerHole.rotation.x = Math.PI / 2;
        phoneModel.add(speakerHole);
    }

    // Enhanced bottom speaker/charging area
    const bottomModuleGeometry = new THREE.BoxGeometry(0.4, 0.04, 0.01);
    const bottomModule = new THREE.Mesh(bottomModuleGeometry, metalMaterial);
    bottomModule.position.set(0, -0.75, 0.045);
    phoneModel.add(bottomModule);

    // Bottom speaker grilles (stereo)
    for (let side = 0; side < 2; side++) {
        for (let i = 0; i < 6; i++) {
            const bottomSpeakerGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.015, 8);
            const bottomSpeaker = new THREE.Mesh(bottomSpeakerGeometry, speakerHoleMaterial);
            bottomSpeaker.position.set(-0.15 + side * 0.3 + i * 0.02, -0.75, 0.047);
            bottomSpeaker.rotation.x = Math.PI / 2;
            phoneModel.add(bottomSpeaker);
        }
    }

    // USB-C charging port
    const chargingPortGeometry = new THREE.BoxGeometry(0.12, 0.04, 0.015);
    const chargingPort = new THREE.Mesh(chargingPortGeometry, speakerHoleMaterial);
    chargingPort.position.set(0, -0.75, 0.047);
    phoneModel.add(chargingPort);

    // Volume buttons
    const volumeButtonGeometry = new THREE.BoxGeometry(0.025, 0.08, 0.02);
    const volumeButtonMaterial = new THREE.MeshPhongMaterial({ color: 0x00cc33 });
    
    const volumeUp = new THREE.Mesh(volumeButtonGeometry, volumeButtonMaterial);
    volumeUp.position.set(-0.415, 0.15, 0);
    phoneModel.add(volumeUp);

    const volumeDown = new THREE.Mesh(volumeButtonGeometry, volumeButtonMaterial);
    volumeDown.position.set(-0.415, 0.05, 0);
    phoneModel.add(volumeDown);

    // Power button
    const powerButtonGeometry = new THREE.BoxGeometry(0.025, 0.06, 0.02);
    const powerButton = new THREE.Mesh(powerButtonGeometry, volumeButtonMaterial);
    powerButton.position.set(0.415, 0.1, 0);
    phoneModel.add(powerButton);

    // SIM card tray
    const simTrayGeometry = new THREE.BoxGeometry(0.02, 0.08, 0.015);
    const simTray = new THREE.Mesh(simTrayGeometry, metalMaterial);
    simTray.position.set(0.415, -0.2, 0);
    phoneModel.add(simTray);

    // Home indicator
    const homeIndicatorGeometry = new THREE.BoxGeometry(0.15, 0.008, 0.002);
    const homeIndicatorMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const homeIndicator = new THREE.Mesh(homeIndicatorGeometry, homeIndicatorMaterial);
    homeIndicator.position.set(0, -0.6, 0.042);
    phoneModel.add(homeIndicator);

    // Enhanced orientation arrow
    const arrowGeometry = new THREE.ConeGeometry(0.06, 0.25, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff41,
        transparent: true,
        opacity: 0.8
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(0, 0.4, 0.045);
    arrow.rotation.z = Math.PI;
    phoneModel.add(arrow);

    // Add "SCREEN SIDE" text indicator
    const textIndicatorGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.005);
    const textIndicatorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff41,
        transparent: true,
        opacity: 0.7
    });
    const textIndicator = new THREE.Mesh(textIndicatorGeometry, textIndicatorMaterial);
    textIndicator.position.set(0, 0, 0.05);
    phoneModel.add(textIndicator);

    // Antenna lines
    for (let i = 0; i < 4; i++) {
        const antennaGeometry = new THREE.BoxGeometry(0.82, 0.002, 0.002);
        const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, -0.6 + i * 0.4, 0);
        phoneModel.add(antenna);
    }

    // Wireframe overlay
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
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x00ff41, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x0066cc, 0.3);
    fillLight.position.set(-3, 2, -3);
    scene.add(fillLight);
}

function addEnvironmentElements() {
    const gridHelper = new THREE.GridHelper(4, 10, 0x00ff41, 0x333333);
    gridHelper.position.y = -1.5;
    scene.add(gridHelper);

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

    const wireframeBtn = document.getElementById('toggle-wireframe');
    if (wireframeBtn) {
        wireframeBtn.addEventListener('click', () => {
            if (phoneModel) {
                phoneModel.material.wireframe = !phoneModel.material.wireframe;
            }
        });
    }

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
        window.animationId = animationId;
        
        if (controls) {
            controls.update();
        }
        
        if (phoneModel && !isAnimationPaused) {
            phoneModel.position.y = Math.sin(Date.now() * 0.001) * 0.1;
        }
        
        renderer.render(scene, camera);
    }
    animate();
}

function update3DOrientation(orientation) {
    if (!phoneModel || !orientation || isAnimationPaused) return;
    
    try {
        const alpha = THREE.MathUtils.degToRad(orientation.alpha || 0);
        const beta = THREE.MathUtils.degToRad(orientation.beta || 0);
        const gamma = THREE.MathUtils.degToRad(orientation.gamma || 0);

        const euler = new THREE.Euler(
            -Math.PI/2 + beta,
            alpha,
            -gamma,
            'YXZ'
        );
        
        const targetQuaternion = new THREE.Quaternion().setFromEuler(euler);
        phoneModel.quaternion.slerp(targetQuaternion, 0.15);
        
        if (typeof window.updateElement === 'function') {
            window.updateElement('roll-display', (orientation.gamma || 0).toFixed(1) + '°');
            window.updateElement('pitch-display', (orientation.beta || 0).toFixed(1) + '°');
            window.updateElement('yaw-display', (orientation.alpha || 0).toFixed(1) + '°');
        }
        
        if (Math.abs(orientation.beta) < 5 && Math.abs(orientation.gamma) < 5) {
            console.log('Phone is flat with screen facing Y direction ✓');
        }
        
    } catch (error) {
        console.error('Error updating 3D orientation:', error);
    }
}

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
}

function updateCompass(alpha) {
    const compassNeedle = document.getElementById('compass-needle');
    if (compassNeedle && alpha !== undefined) {
        const correctedAlpha = (alpha + 180) % 360;
        compassNeedle.style.transform = `rotate(${correctedAlpha}deg)`;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
});

console.log('📱 3D Visualization module loaded');

// Export functions
window.initialize3DVisualization = initialize3DVisualization;
window.update3DOrientation = update3DOrientation;
window.updateCompass = updateCompass;
window.startAnimationLoop = startAnimationLoop;
