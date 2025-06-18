import cv2
import requests
import numpy as np

# MJPEG stream URL
url = 'https://192.168.1.11:3000/camera/stream.mjpg'

# Disable SSL verification (like --no-check-certificate)
stream = requests.get(url, stream=True, verify=False)

bytes_data = b''
window_name = 'Camera Stream Preview'
cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

try:
    for chunk in stream.iter_content(chunk_size=1024):
        bytes_data += chunk
        a = bytes_data.find(b'\xff\xd8')  # JPEG start
        b = bytes_data.find(b'\xff\xd9')  # JPEG end
        if a != -1 and b != -1 and b > a:
            jpg = bytes_data[a:b+2]
            bytes_data = bytes_data[b+2:]
            img = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
            if img is not None:
                cv2.imshow(window_name, img)
                if cv2.waitKey(1) == 27:  # ESC to exit
                    break
finally:
    cv2.destroyAllWindows()
    stream.close()
