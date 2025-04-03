import pytest
from click.testing import CliRunner
from operateShutters import main, Shutter
from unittest.mock import patch, Mock


def test_cli_services():
    runner = CliRunner()

    def _mock_loop_until_complete(self):
        pass

    with runner.isolated_filesystem():
        with patch('operateShutters.operateShutters.LoopUntilComplete', return_value=None) as mock_loop_until_complete:
            res = runner.invoke(
                main, ["--auto", "--echo", "--mqtt"], catch_exceptions=False,
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

    with patch("pigpio.pi", return_value=Mock(connected=False)) as mock_pigpio:
        res = runner.invoke(
            main, ["TestShutter", "--press", "up", "--press", "down", "--config", "test_config.conf"], catch_exceptions=False,
        )

    web_server_msg = "Starting WebServer on Port 8080"
    mqtt_msg = "Entering MQTT polling loop"
    alexa_msg = "Entering fauxmo polling loop"

    button_val = Shutter.buttonUp | Shutter.buttonDown
    button_msg = f"(TestShutter)\nButton  :       0x{button_val:02X}"


    assert web_server_msg not in res.output
    assert mqtt_msg not in res.output
    assert alexa_msg not in res.output
    assert button_msg in res.output
