from click.testing import CliRunner
from pi_somfy.cli import cli
from pi_somfy.operate_shutters import Shutter
from unittest.mock import patch, Mock
from pathlib import Path


def test_cli_services():
    runner = CliRunner()

    def _mock_loop_until_complete(self):
        pass

    with runner.isolated_filesystem():
        with patch(
            "pi_somfy.operate_shutters.OperateShutters.loop_until_complete",
            return_value=None,
        ) as mock_loop_until_complete:
            res = runner.invoke(
                cli,
                ["--auto", "--echo", "--mqtt"],
                catch_exceptions=False,
            )

        web_server_msg = "Starting WebServer on Port 8080"
        mqtt_msg = "Entering MQTT polling loop"
        alexa_msg = "Entering fauxmo polling loop"

        assert res.exit_code == 0
        assert web_server_msg in res.output
        assert mqtt_msg in res.output
        assert alexa_msg in res.output


def test_cli_press():
    runner = CliRunner()

    toml_path = Path("tests/config/operateShutters.toml")
    json_path = Path("tests/config/operateShutters.json")
    toml_config = toml_path.read_text()
    json_config = json_path.read_text()

    with runner.isolated_filesystem():
        toml_path.parent.mkdir(parents=True)
        toml_path.write_text(toml_config)
        json_path.write_text(json_config)

        with patch("pigpio.pi", return_value=Mock(connected=False)) as mock_pigpio:
            res = runner.invoke(
                cli,
                [
                    "TestShutter",
                    "--press",
                    "up",
                    "--press",
                    "down",
                    "--config",
                    "tests/config",
                ],
                catch_exceptions=False,
            )

    web_server_msg = "Starting WebServer on Port 8080"
    mqtt_msg = "Entering MQTT polling loop"
    alexa_msg = "Entering fauxmo polling loop"

    button_val = Shutter.BUTTON_UP | Shutter.BUTTON_DOWN
    button_msg = f"(TestShutter)\nButton  :       0x{button_val:02X}"

    assert web_server_msg not in res.output
    assert mqtt_msg not in res.output
    assert alexa_msg not in res.output
    assert button_msg in res.output


def test_cli_config_migration():
    """Test that config migration works correctly with a cleaned config file."""
    runner = CliRunner()

    # Minimal cleaned config content from testconfig_cleaned.conf
    cleaned_config = """[General]
LogLocation=.
LogToConsole=True
Latitude=51.4769
Longitude=0
SendRepeat=2
TXGPIO=4
Rfm69ResetGPIO=25
Rfm69SPIChannel=0
Rfm69Enabled=False
PIGPIOHost=localhost
PIGPIOPort=8888
UseHttps=False
HTTPPort=8080
HTTPSPort=443
RTS_Address=0x279620
[MQTT]
MQTT_Server=192.168.1.x
MQTT_Port=1883
MQTT_User=xxxxxxx
MQTT_Password=xxxxxxx
MQTT_ClientID=somfy-mqtt-bridge
EnableDiscovery=true
[Shutters]
0x279621=TestShutter,True,5
[ShutterRollingCodes]
0x279621=46
[ShutterIntermediatePositions]
0x279621=None
[Scheduler]
"""

    with runner.isolated_filesystem():
        with patch("pigpio.pi", return_value=Mock(connected=False)) as mock_pigpio:
            # Write the cleaned config to a file
            with open("test_cleaned.conf", "w") as f:
                f.write(cleaned_config)

            # Run the CLI with the cleaned config
            res = runner.invoke(
                cli,
                [
                    "TestShutter",
                    "--press",
                    "up",
                    "--press",
                    "down",
                    "--config",
                    "test_cleaned.conf",
                ],
                catch_exceptions=False,
            )

            # Check that new format files were created
            assert Path("test_cleaned.toml").exists()
            assert Path("test_cleaned.json").exists()

            # Check the contents of the migrated files
            with open("test_cleaned.toml", "r") as f:
                toml_content = f.read()

            with open("test_cleaned.json", "r") as f:
                json_content = f.read()

    assert "general" in toml_content
    assert "mqtt" in toml_content
    assert "Latitude=51.4769" in toml_content.replace(" ", "")
    assert "shutters" in json_content
    assert "schedule" in json_content
    assert "TestShutter" in json_content
