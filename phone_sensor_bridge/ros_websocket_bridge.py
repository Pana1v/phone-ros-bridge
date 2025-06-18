#!/usr/bin/env python3

import rclpy
from rclpy.node import Node
import json
import websocket
import threading
import ssl
from sensor_msgs.msg import Imu, NavSatFix, BatteryState
from geometry_msgs.msg import TransformStamped
from std_msgs.msg import String
import math
from tf2_ros import TransformBroadcaster

class WebSocketToROS(Node):
    def __init__(self):
        super().__init__('websocket_to_ros_bridge')
        
        # Create ROS publishers
        self.imu_pub = self.create_publisher(Imu, '/phone/imu', 10)
        self.gps_pub = self.create_publisher(NavSatFix, '/phone/gps', 10)
        self.battery_pub = self.create_publisher(BatteryState, '/phone/battery', 10)
        self.raw_data_pub = self.create_publisher(String, '/phone/raw_data', 10)
        
        # Create TF broadcaster for orientation
        self.tf_broadcaster = TransformBroadcaster(self)
        
        # WebSocket connection parameters
        self.declare_parameter('websocket_url', 'ws://192.168.1.11:3000')
        self.ws_url = self.get_parameter('websocket_url').value
        self.ws = None
        self.connected = False
        
        # Debug counter
        self.message_count = 0
        
        # Start WebSocket connection in a separate thread
        self.ws_thread = threading.Thread(target=self.connect_websocket)
        self.ws_thread.daemon = True
        self.ws_thread.start()
        
        self.get_logger().info(f'Node initialized and connecting to WebSocket at {self.ws_url}...')

    def connect_websocket(self):
        websocket.enableTrace(True)
        self.get_logger().info(f'Attempting to connect to WebSocket at {self.ws_url}')
        self.ws = websocket.WebSocketApp(self.ws_url,
                                       on_message=self.on_message,
                                       on_error=self.on_error,
                                       on_close=self.on_close,
                                       on_open=self.on_open)
        # Run without SSL verification
        self.ws.run_forever()

    def on_message(self, ws, message):
        try:
            self.message_count += 1
            self.get_logger().info(f'Received message #{self.message_count}')
            
            data = json.loads(message)
            self.get_logger().info(f'Parsed JSON data: {json.dumps(data, indent=2)}')
            
            # Publish raw data
            raw_msg = String()
            raw_msg.data = message
            self.raw_data_pub.publish(raw_msg)
            self.get_logger().info('Published raw data')
            
            # Skip welcome message
            if data.get('type') == 'welcome':
                self.get_logger().info('Received welcome message, waiting for sensor data...')
                return
            
            # Process IMU data
            if 'accelerometer' in data and 'gyroscope' in data:
                imu_msg = Imu()
                imu_msg.header.stamp = self.get_clock().now().to_msg()
                imu_msg.header.frame_id = 'phone'
                
                # Accelerometer data
                imu_msg.linear_acceleration.x = float(data['accelerometer']['x'])
                imu_msg.linear_acceleration.y = float(data['accelerometer']['y'])
                imu_msg.linear_acceleration.z = float(data['accelerometer']['z'])
                
                # Gyroscope data
                imu_msg.angular_velocity.x = float(data['gyroscope']['x'])
                imu_msg.angular_velocity.y = float(data['gyroscope']['y'])
                imu_msg.angular_velocity.z = float(data['gyroscope']['z'])
                
                # Set covariance matrices
                imu_msg.linear_acceleration_covariance = [0.04, 0.0, 0.0,
                                                        0.0, 0.04, 0.0,
                                                        0.0, 0.0, 0.04]
                imu_msg.angular_velocity_covariance = [0.02, 0.0, 0.0,
                                                     0.0, 0.02, 0.0,
                                                     0.0, 0.0, 0.02]
                
                self.imu_pub.publish(imu_msg)
                self.get_logger().info('Published IMU data')
            
            # Process orientation data as TransformStamped
            if 'orientation' in data:
                transform = TransformStamped()
                transform.header.stamp = self.get_clock().now().to_msg()
                transform.header.frame_id = 'map'
                transform.child_frame_id = 'phone'
                
                # Convert Euler angles to quaternion
                alpha = math.radians(float(data['orientation']['alpha']))
                beta = math.radians(float(data['orientation']['beta']))
                gamma = math.radians(float(data['orientation']['gamma']))
                
                # Calculate quaternion
                transform.transform.rotation.x = math.sin(alpha/2) * math.cos(beta/2) * math.cos(gamma/2) - math.cos(alpha/2) * math.sin(beta/2) * math.sin(gamma/2)
                transform.transform.rotation.y = math.cos(alpha/2) * math.sin(beta/2) * math.cos(gamma/2) + math.sin(alpha/2) * math.cos(beta/2) * math.sin(gamma/2)
                transform.transform.rotation.z = math.cos(alpha/2) * math.cos(beta/2) * math.sin(gamma/2) - math.sin(alpha/2) * math.sin(beta/2) * math.cos(gamma/2)
                transform.transform.rotation.w = math.cos(alpha/2) * math.cos(beta/2) * math.cos(gamma/2) + math.sin(alpha/2) * math.sin(beta/2) * math.sin(gamma/2)
                
                # Set a small translation to make the transform visible
                transform.transform.translation.x = 0.0
                transform.transform.translation.y = 0.0
                transform.transform.translation.z = 0.0
                
                # Broadcast the transform
                self.tf_broadcaster.sendTransform(transform)
                self.get_logger().info('Published orientation transform')
            
            # Process GPS data
            if 'gps' in data:
                gps_msg = NavSatFix()
                gps_msg.header.stamp = self.get_clock().now().to_msg()
                gps_msg.header.frame_id = 'phone'
                gps_msg.latitude = float(data['gps']['latitude'])
                gps_msg.longitude = float(data['gps']['longitude'])
                gps_msg.altitude = float(data['gps'].get('altitude', 0.0))
                
                # Set position covariance
                gps_msg.position_covariance = [0.1, 0.0, 0.0,
                                             0.0, 0.1, 0.0,
                                             0.0, 0.0, 0.1]
                gps_msg.position_covariance_type = NavSatFix.COVARIANCE_TYPE_DIAGONAL
                
                self.gps_pub.publish(gps_msg)
                self.get_logger().info('Published GPS data')
            
            # Process battery data
            if 'battery' in data:
                battery_msg = BatteryState()
                battery_msg.header.stamp = self.get_clock().now().to_msg()
                battery_msg.header.frame_id = 'phone'
                battery_msg.percentage = float(data['battery'].get('level', 0.0))
                battery_msg.power_supply_status = BatteryState.POWER_SUPPLY_STATUS_UNKNOWN
                self.battery_pub.publish(battery_msg)
                self.get_logger().info('Published battery data')
                
        except json.JSONDecodeError as e:
            self.get_logger().error(f"Failed to parse JSON message: {e}")
        except Exception as e:
            self.get_logger().error(f"Error processing message: {e}")
            self.get_logger().error(f"Message content: {message}")

    def on_error(self, ws, error):
        self.get_logger().error(f"WebSocket error: {error}")
        self.connected = False

    def on_close(self, ws, close_status_code, close_msg):
        self.get_logger().info(f"WebSocket connection closed: {close_status_code} - {close_msg}")
        self.connected = False

    def on_open(self, ws):
        self.get_logger().info("WebSocket connection established")
        self.connected = True

def main(args=None):
    rclpy.init(args=args)
    bridge = WebSocketToROS()
    rclpy.spin(bridge)
    bridge.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main() 