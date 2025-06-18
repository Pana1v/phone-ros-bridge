#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy

# ROS 2 message types
from sensor_msgs.msg import Imu, NavSatFix, BatteryState, Image, CompressedImage
from geometry_msgs.msg import TwistStamped, Vector3Stamped, QuaternionStamped
from std_msgs.msg import Float32, String, Header
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue

import socketio
import time
import json
import math
from builtin_interfaces.msg import Time as ROSTime
import base64
import cv2
import numpy as np

class PhoneSensorBridge(Node):
    """
    ROS 2 node that connects to Socket.IO server and publishes phone sensor data
    to visualizable ROS topics for analysis and debugging
    """
    
    def __init__(self):
        super().__init__('phone_sensor_bridge')
        
        # Declare parameters
        self.declare_parameter('websocket_url', 'https://localhost:3000')
        self.declare_parameter('reconnect_attempts', 5)
        self.declare_parameter('base_frame', 'phone_base_link')
        
        # Get parameters
        self.websocket_url = self.get_parameter('websocket_url').get_parameter_value().string_value
        self.base_frame = self.get_parameter('base_frame').get_parameter_value().string_value
        
        # QoS profile for sensor data[15]
        sensor_qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
            depth=10
        )
        
        # Create publishers for different sensor types[22][26]
        self.imu_publisher = self.create_publisher(Imu, 'phone/imu', sensor_qos)
        self.gps_publisher = self.create_publisher(NavSatFix, 'phone/gps', sensor_qos)
        self.battery_publisher = self.create_publisher(BatteryState, 'phone/battery', sensor_qos)
        self.camera_publisher = self.create_publisher(CompressedImage, 'phone/camera/compressed', sensor_qos)
        self.motion_publisher = self.create_publisher(TwistStamped, 'phone/motion', sensor_qos)
        self.orientation_publisher = self.create_publisher(QuaternionStamped, 'phone/orientation', sensor_qos)
        self.diagnostics_publisher = self.create_publisher(DiagnosticArray, 'phone/diagnostics', sensor_qos)
        
        # Initialize Socket.IO client[19]
        self.sio = socketio.Client(ssl_verify=False, logger=False, engineio_logger=False)
        self.setup_socketio_handlers()
        
        # Connection state
        self.connected = False
        self.last_data_time = time.time()
        
        # Create timer for diagnostics publishing
        self.diagnostics_timer = self.create_timer(5.0, self.publish_diagnostics)
        
        self.get_logger().info(f"Phone sensor bridge initialized, connecting to {self.websocket_url}")
        self.connect_to_server()
    
    def setup_socketio_handlers(self):
        """Setup Socket.IO event handlers for sensor data reception"""
        
        @self.sio.event
        def connect():
            self.connected = True
            self.get_logger().info("Connected to Socket.IO server")
        
        @self.sio.event
        def connect_error(data):
            self.get_logger().error(f"Connection failed: {data}")
            self.connected = False
        
        @self.sio.event
        def disconnect():
            self.connected = False
            self.get_logger().warn("Disconnected from Socket.IO server")
        
        @self.sio.on('sensorData')
        def on_sensor_data(data):
            """Handle incoming sensor data and publish to ROS topics"""
            try:
                self.last_data_time = time.time()
                self.process_sensor_data(data)
            except Exception as e:
                self.get_logger().error(f"Error processing sensor data: {e}")
        
        @self.sio.on('cameraFrame')
        def on_camera_frame(data):
            """Handle camera frame data"""
            try:
                self.process_camera_data(data)
            except Exception as e:
                self.get_logger().error(f"Error processing camera data: {e}")
    
    def connect_to_server(self):
        """Attempt connection to Socket.IO server with fallback transports"""
        transports = ['websocket', 'polling']
        
        for transport in transports:
            try:
                self.get_logger().info(f"Attempting connection with {transport} transport")
                self.sio.connect(self.websocket_url, transports=[transport])
                if self.sio.connected:
                    self.get_logger().info(f"Successfully connected using {transport}")
                    break
            except Exception as e:
                self.get_logger().warn(f"Failed to connect with {transport}: {e}")
                if transport == transports[-1]:
                    self.get_logger().error("All connection attempts failed")
    
    def process_sensor_data(self, data):
        """Process and publish sensor data to appropriate ROS topics[26]"""
        
        # Create timestamp
        now = self.get_clock().now()
        header = Header()
        header.stamp = now.to_msg()
        header.frame_id = self.base_frame
        
        # Publish IMU data if available
        if all(key in data for key in ['accelerometer', 'gyroscope']):
            self.publish_imu_data(data, header)
        
        # Publish GPS data if available
        if 'gps' in data and data['gps'].get('latitude') is not None:
            self.publish_gps_data(data['gps'], header)
        
        # Publish battery data if available
        if 'battery' in data:
            self.publish_battery_data(data['battery'], header)
        
        # Publish motion data if available
        if 'deviceMotion' in data:
            self.publish_motion_data(data['deviceMotion'], header)
        
        # Publish orientation data if available
        if 'orientation' in data:
            self.publish_orientation_data(data['orientation'], header)
    
    def publish_imu_data(self, data, header):
        """Publish IMU data using sensor_msgs/Imu[26]"""
        imu_msg = Imu()
        imu_msg.header = header
        
        # Linear acceleration (convert from g to m/s²)
        accel = data['accelerometer']
        imu_msg.linear_acceleration.x = float(accel.get('x', 0.0)) * 9.81
        imu_msg.linear_acceleration.y = float(accel.get('y', 0.0)) * 9.81
        imu_msg.linear_acceleration.z = float(accel.get('z', 0.0)) * 9.81
        
        # Angular velocity (convert from deg/s to rad/s)
        gyro = data['gyroscope']
        imu_msg.angular_velocity.x = math.radians(float(gyro.get('x', 0.0)))
        imu_msg.angular_velocity.y = math.radians(float(gyro.get('y', 0.0)))
        imu_msg.angular_velocity.z = math.radians(float(gyro.get('z', 0.0)))
        
        # Orientation quaternion if available
        if 'orientation' in data:
            orient = data['orientation']
            # Convert Euler angles to quaternion
            roll = math.radians(float(orient.get('beta', 0.0)))
            pitch = math.radians(float(orient.get('gamma', 0.0)))
            yaw = math.radians(float(orient.get('alpha', 0.0)))
            
            # Simple Euler to quaternion conversion
            cy = math.cos(yaw * 0.5)
            sy = math.sin(yaw * 0.5)
            cp = math.cos(pitch * 0.5)
            sp = math.sin(pitch * 0.5)
            cr = math.cos(roll * 0.5)
            sr = math.sin(roll * 0.5)
            
            imu_msg.orientation.w = cy * cp * cr + sy * sp * sr
            imu_msg.orientation.x = cy * cp * sr - sy * sp * cr
            imu_msg.orientation.y = sy * cp * sr + cy * sp * cr
            imu_msg.orientation.z = sy * cp * cr - cy * sp * sr
        
        # Set covariance (unknown = -1 for first element)[26]
        imu_msg.orientation_covariance[0] = -1.0
        imu_msg.angular_velocity_covariance[0] = 0.01
        imu_msg.linear_acceleration_covariance[0] = 0.01
        
        self.imu_publisher.publish(imu_msg)
    
    def publish_gps_data(self, gps_data, header):
        """Publish GPS data using sensor_msgs/NavSatFix[30]"""
        gps_msg = NavSatFix()
        gps_msg.header = header
        
        gps_msg.latitude = float(gps_data.get('latitude', 0.0))
        gps_msg.longitude = float(gps_data.get('longitude', 0.0))
        gps_msg.altitude = float(gps_data.get('altitude', 0.0))
        
        # Set status
        gps_msg.status.status = 0  # STATUS_FIX
        gps_msg.status.service = 1  # SERVICE_GPS
        
        # Set covariance
        accuracy = float(gps_data.get('accuracy', 10.0))
        gps_msg.position_covariance[0] = accuracy * accuracy
        gps_msg.position_covariance[4] = accuracy * accuracy
        gps_msg.position_covariance[8] = accuracy * accuracy
        gps_msg.position_covariance_type = 2  # COVARIANCE_TYPE_DIAGONAL_KNOWN
        
        self.gps_publisher.publish(gps_msg)
    
    def publish_battery_data(self, battery_data, header):
        """Publish battery data using sensor_msgs/BatteryState[30]"""
        battery_msg = BatteryState()
        battery_msg.header = header
        
        battery_msg.percentage = float(battery_data.get('level', 0.0))
        battery_msg.voltage = float(battery_data.get('voltage', 0.0))
        battery_msg.present = True
        
        # Set power supply status based on charging state
        if battery_data.get('charging', False):
            battery_msg.power_supply_status = BatteryState.POWER_SUPPLY_STATUS_CHARGING
        else:
            battery_msg.power_supply_status = BatteryState.POWER_SUPPLY_STATUS_NOT_CHARGING
        
        self.battery_publisher.publish(battery_msg)
    
    def publish_motion_data(self, motion_data, header):
        """Publish device motion as TwistStamped[31]"""
        twist_msg = TwistStamped()
        twist_msg.header = header
        
        # Linear velocity (if available)
        if 'userAcceleration' in motion_data:
            accel = motion_data['userAcceleration']
            twist_msg.twist.linear.x = float(accel.get('x', 0.0))
            twist_msg.twist.linear.y = float(accel.get('y', 0.0))
            twist_msg.twist.linear.z = float(accel.get('z', 0.0))
        
        # Angular velocity from rotation rate
        if 'rotationRate' in motion_data:
            rotation = motion_data['rotationRate']
            twist_msg.twist.angular.x = math.radians(float(rotation.get('x', 0.0)))
            twist_msg.twist.angular.y = math.radians(float(rotation.get('y', 0.0)))
            twist_msg.twist.angular.z = math.radians(float(rotation.get('z', 0.0)))
        
        self.motion_publisher.publish(twist_msg)
    
    def publish_orientation_data(self, orientation_data, header):
        """Publish device orientation as QuaternionStamped"""
        quat_msg = QuaternionStamped()
        quat_msg.header = header
        
        # Convert Euler angles to quaternion
        alpha = math.radians(float(orientation_data.get('alpha', 0.0)))
        beta = math.radians(float(orientation_data.get('beta', 0.0)))
        gamma = math.radians(float(orientation_data.get('gamma', 0.0)))
        
        # Euler to quaternion conversion
        cy = math.cos(alpha * 0.5)
        sy = math.sin(alpha * 0.5)
        cp = math.cos(beta * 0.5)
        sp = math.sin(beta * 0.5)
        cr = math.cos(gamma * 0.5)
        sr = math.sin(gamma * 0.5)
        
        quat_msg.quaternion.w = cy * cp * cr + sy * sp * sr
        quat_msg.quaternion.x = cy * cp * sr - sy * sp * cr
        quat_msg.quaternion.y = sy * cp * sr + cy * sp * cr
        quat_msg.quaternion.z = sy * cp * cr - cy * sp * sr
        
        self.orientation_publisher.publish(quat_msg)
    
    def process_camera_data(self, camera_data):
        """Process and publish camera frame data[32]"""
        try:
            # Extract base64 image data
            if 'data' in camera_data:
                image_data = camera_data['data']
                if ',' in image_data:
                    # Remove data URL prefix
                    image_data = image_data.split(',')[1]
                
                # Decode base64 to bytes
                image_bytes = base64.b64decode(image_data)
                
                # Create compressed image message
                compressed_msg = CompressedImage()
                compressed_msg.header.stamp = self.get_clock().now().to_msg()
                compressed_msg.header.frame_id = f"{self.base_frame}_camera"
                compressed_msg.format = "jpeg"
                compressed_msg.data = image_bytes
                
                self.camera_publisher.publish(compressed_msg)
                
        except Exception as e:
            self.get_logger().error(f"Error processing camera data: {e}")
    
    def publish_diagnostics(self):
        """Publish diagnostic information about the bridge status"""
        diag_array = DiagnosticArray()
        diag_array.header.stamp = self.get_clock().now().to_msg()
        
        # Connection status
        conn_status = DiagnosticStatus()
        conn_status.name = "phone_sensor_bridge/connection"
        conn_status.hardware_id = "phone_socket_connection"
        
        if self.connected:
            conn_status.level = DiagnosticStatus.OK
            conn_status.message = "Connected to phone sensor server"
        else:
            conn_status.level = DiagnosticStatus.ERROR
            conn_status.message = "Disconnected from phone sensor server"
        
        # Data freshness
        data_age = time.time() - self.last_data_time
        if data_age < 5.0:
            conn_status.values.append(KeyValue(key="data_age", value=f"{data_age:.1f}s"))
        else:
            conn_status.level = DiagnosticStatus.WARN
            conn_status.message += f" (No data for {data_age:.1f}s)"
        
        diag_array.status.append(conn_status)
        self.diagnostics_publisher.publish(diag_array)
    
    def destroy_node(self):
        """Clean shutdown of Socket.IO connection"""
        if self.sio.connected:
            self.sio.disconnect()
        super().destroy_node()

def main(args=None):
    """Main entry point for the ROS 2 node[15]"""
    rclpy.init(args=args)
    
    try:
        bridge = PhoneSensorBridge()
        rclpy.spin(bridge)
    except KeyboardInterrupt:
        pass
    finally:
        if 'bridge' in locals():
            bridge.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
