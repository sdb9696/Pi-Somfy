#!/bin/bash

echo "------------------------------------"
echo "shutters.service installation script"
echo "------------------------------------"
echo

# Check if running as sudo
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run with sudo privileges."
    exit 1
fi

# Prompt for user, defaulting to 'pisomfy'
read -p "Enter the user (default: pisomfy): " user
user=${user:-pisomfy}

# Check if user exists, create if not
if ! id "$user" >/dev/null 2>&1; then
    echo "User '$user' does not exist. Creating user with home directory..."
    useradd -m -s /bin/bash "$user"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create user '$user'."
        exit 1
    fi
fi

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

# Ensure virtual environment exists for run command
run_bin_dir=$(dirname "$run_command")
if [ ! -d "$run_bin_dir" ]; then
    echo "Binary directory '$run_bin_dir' does not exist. Setting up virtual environment..."
    venv_dir=$(dirname "$run_bin_dir")
    mkdir -p "$venv_dir"
    python3 -m venv "$venv_dir" || { echo "Error: Failed to create venv with pip."; exit 1; }
    source $venv_dir/bin/activate
    pip install . || { echo "Error: Failed to install pi-somfy with pip."; exit 1; }

    # Deactivate venv
    deactivate

    # Make sure the new directory is owned by the user
    chown -R "$user:$user" "$venv_dir"
fi

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

# Get user home dir
eval home_dir="~$user"

# Check if config directory exists; if not, create it
config_dir=$(dirname "$config_file")
if [ ! -d "$config_dir" ] && [[ "$config_dir" == "$home_dir"* ]]; then
    echo "Config directory '$config_dir' does not exist. Creating it..."
    sudo -u "$user" mkdir -p "$config_dir" || { echo "Error: Failed to create config directory '$config_dir'."; exit 1; }
elif [ ! -d "$config_dir" ]; then
    echo "Error: Config directory '$config_dir' does not exist and is not in user's home directory."
    exit 1
fi


# Inline shutters.service content with dynamic values
shutters_service=$(cat <<EOF
[Unit]
Description=Pi Somfy Shutter Service
After=network-online.target mosquitto.service
Before=hass.service

[Service]
User=${user}
ExecStart=${run_command} -c ${config_file} -a -m
WorkingDirectory=${home_dir}
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
    echo "$shutters_service" | tee /etc/systemd/system/shutters.service > /dev/null
    echo "Service file created."
else
    echo "Aborted."
    exit 1
fi

# Reload systemd daemon
echo
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable and start shutters service
echo
echo "Enabling and starting shutters service..."
systemctl enable shutters
systemctl start shutters

echo
echo "Installation complete."
