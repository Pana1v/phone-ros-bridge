#!/bin/bash

# Set the base directory
BASE_DIR="phone-sensor-server"

# Function to check if a file or directory exists and create it if it doesn't
create_if_not_exists() {
  local item="$1"
  if [ ! -e "$item" ]; then
    if [[ "$item" == */ ]]; then
      mkdir -p "$item"
      echo "Created directory: $item"
    else
      touch "$item"
      echo "Created file: $item"
    fi
  else
    echo "Exists: $item"
  fi
}

# Create the base directory if it doesn't exist
create_if_not_exists "$BASE_DIR/"

# Define the files and directories to check and create
FILES_AND_DIRS=(
  "$BASE_DIR/server.js"
  "$BASE_DIR/package.json"
  "$BASE_DIR/config/"
  "$BASE_DIR/config/ssl.js"
  "$BASE_DIR/classes/"
  "$BASE_DIR/classes/SensorProcessor.js"
  "$BASE_DIR/classes/DataLogger.js"
  "$BASE_DIR/routes/"
  "$BASE_DIR/routes/api.js"
  "$BASE_DIR/routes/pages.js"
  "$BASE_DIR/public/"
  "$BASE_DIR/public/js/"
  "$BASE_DIR/public/js/dashboard.js"
  "$BASE_DIR/public/js/phone.js"
  "$BASE_DIR/public/js/analytics.js"
  "$BASE_DIR/public/css/"
  "$BASE_DIR/public/css/styles.css"
  "$BASE_DIR/views/"
  "$BASE_DIR/views/dashboard.html"
  "$BASE_DIR/views/phone.html"
  "$BASE_DIR/views/analytics.html"
  "$BASE_DIR/views/logs.html"
)

# Loop through the files and directories and create them if they don't exist
for item in "${FILES_AND_DIRS[@]}"; do
  create_if_not_exists "$item"
done

echo "All files and directories checked and created (if missing)."
