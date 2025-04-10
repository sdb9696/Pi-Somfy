#!/bin/bash

echo "------------------------------------"
echo "shutters.service installation script"
echo "------------------------------------"
echo
# Prompt for user, defaulting to 'pisomfy'
read -p "Enter the user (default: pisomfy): " user
user=${user:-pisomfy}

# Prompt for run command with two defaults
run_default_0="/srv/${user}/bin/pi-somfy"
run_default_1="/srv/${user}/bin/python -m pi_somfy.operateShutters"
echo
echo "Run command defaults:"
echo "0: ${run_default_0}"
echo "1: ${run_default_1}"
echo
read -p "Enter a run command or enter a number to select a default: " run_command

case "$run_command" in
  0) run_command="$run_default_0" ;;
  1) run_command="$run_default_1" ;;
esac


# Prompt for config file with two defaults
config_default_0="/home/${user}/config/operateShutters.conf"
config_default_1="/home/${user}/Pi-Somfy/operateShutters.conf"
echo
echo "Config file defaults:"
echo "0: ${config_default_0}"
echo "1: ${config_default_1}"
echo
read -p "Enter a config file location or enter a number to select a default: " config_file


case "$config_file" in
  0) config_file="$config_default_0" ;;
  1) config_file="$config_default_1" ;;
esac

# Inline shutters.service content with dynamic values
shutters_service=$(cat <<EOF
[Unit]
Description=Pi Somfy Shutter Service
After=network-online.target mosquitto.service
Before=hass.service

[Service]
User=${user}
ExecStart=${run_command} -c ${config_file} -a -m
Environment=PYTHONUNBUFFERED=1
Restart=on-failure
Type=exec

[Install]
WantedBy=multi-user.target
EOF
)

# Show content to the user
echo
echo "shutters.service content:"
echo "---------------------------------"
echo "$shutters_service"
echo "---------------------------------"

# Prompt for confirmation
echo
read -p "Do you want to create /etc/systemd/system/shutters.service? [y/N]: " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "$shutters_service" | sudo tee /etc/systemd/system/shutters.service > /dev/null
    echo "Service file created."
else
    echo "Aborted."
fi

# Reload systemd daemon
echo
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable and start shutters service
echo
echo "Enabling and starting shutters service..."
sudo systemctl enable shutters
sudo systemctl start shutters

echo
echo "Installation complete."
