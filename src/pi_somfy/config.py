#!/usr/bin/python3

import threading
import json
import logging
from tomlkit import dumps, parse, table, nl, document, comment
from pathlib import Path
from contextlib import contextmanager
from typing import Optional, Union, Any, TypeVar, Generator, NamedTuple
from configparser import RawConfigParser
from tomlkit import TOMLDocument

LOGGER = logging.getLogger(__name__)


class ConfigParam(NamedTuple):
    name: str
    type: type
    section: str
    doc: list[str]
    variable_name: str


_T = TypeVar("_T", float, int, bool, str)

CONFIG_PARAMETERS = [
    # General parameters
    ConfigParam(
        "LogLocation",
        str,
        "general",
        ["location of log files (required)"],
        "log_location",
    ),
    ConfigParam("LogToConsole", bool, "general", [], "log_to_console"),
    ConfigParam(
        "Latitude",
        float,
        "general",
        [
            "PUT YOUR OWN COORDINATES HERE",
            "Latitude of the place for computation of sunset and sunrise.",
            "check on Google Maps for instance",
        ],
        "latitude",
    ),
    ConfigParam(
        "Longitude",
        float,
        "general",
        [
            "PUT YOUR OWN COORDINATES HERE",
            "Longitude of the place for computation of sunset and sunrise.",
            "check on Google Maps for instance",
        ],
        "longitude",
    ),
    ConfigParam(
        "SendRepeat",
        int,
        "general",
        [
            "Repeat each command a certain number of times. This is to ensure it works",
            "if the remote is far away from the shutter and sometime EMI prevents a",
            "signal to go through",
            "This option only applies if a shutter is raised or lowered in full. If",
            "a shutter is only raised or lowered for a given amount of seconds, this",
            "option does not apply for obvious reasons.",
        ],
        "send_repeat",
    ),
    ConfigParam(
        "TXGPIO",
        int,
        "general",
        [
            "(Optional) This parameter specifes the GPIO connector where the 433.42 MHz",
            "emitter is connected to. The default value is 4",
        ],
        "tx_gpio",
    ),
    ConfigParam(
        "Rfm69ResetGPIO",
        int,
        "general",
        [
            "(Optional) These parameters configure the GPIO connectors for an RFM69HCW to",
            "to use where the 433.42 MHz frequency.  If using Rfm69 ensure to update the TXGPIO",
            "value above to match the DATA/DIO2 Pin for the Rfm69 module and set Rfm69Enabled to True",
        ],
        "rfm69_reset_gpio",
    ),
    ConfigParam(
        "Rfm69SPIChannel",
        int,
        "general",
        [
            "(Optional) These parameters configure the GPIO connectors for an RFM69HCW to",
            "to use where the 433.42 MHz frequency.  If using Rfm69 ensure to update the TXGPIO",
            "value above to match the DATA/DIO2 Pin for the Rfm69 module and set Rfm69Enabled to True",
        ],
        "rfm69_spi_channel",
    ),
    ConfigParam(
        "Rfm69Enabled",
        bool,
        "general",
        [
            "(Optional) These parameters configure the GPIO connectors for an RFM69HCW to",
            "to use where the 433.42 MHz frequency.  If using Rfm69 ensure to update the TXGPIO",
            "value above to match the DATA/DIO2 Pin for the Rfm69 module and set Rfm69Enabled to True",
        ],
        "rfm69_enabled",
    ),
    ConfigParam(
        "PIGPIOHost",
        str,
        "general",
        ["(Optional) These parameters configure remote GPIO access via PIOPIO"],
        "pigpio_host",
    ),
    ConfigParam(
        "PIGPIOPort",
        int,
        "general",
        ["(Optional) These parameters configure remote GPIO access via PIOPIO"],
        "pigpio_port",
    ),
    ConfigParam(
        "UseHttps",
        bool,
        "general",
        [
            "This parameter, if true will enable the use of HTTPS",
            "(secure HTTP) in the Flask web app or user name and password",
            "authentication, depending on the options below. This option is only",
            "applicable to the web app. This option requires python-openssl library",
            "to be installed",
        ],
        "use_https",
    ),
    ConfigParam(
        "HTTPPort",
        int,
        "general",
        [
            "(Optional) This parameter will allow the HTTP port to be set by the web",
            "interface. The default is 80, but this setting will override that",
            "value. This option is only applicable to the web app.",
        ],
        "http_port",
    ),
    ConfigParam(
        "HTTPSPort",
        int,
        "general",
        [
            "This parameter will override the default port for HTTPS, which is",
            "443. Uncomment and change this value to use a non-standard port for HTTPS",
        ],
        "https_port",
    ),
    ConfigParam(
        "RTS_Address",
        str,
        "general",
        [
            "Lowest identifier used by the tool to assign unique 24bit",
            "ids for new remote. This value won't change in the config file, instead",
            "the tool will look for the next available address that has not been",
            "used yet.",
            "If you are running more than one instance of PiSomfy you must ensure",
            "each instance is set to a different value to avoid possible conflicts",
        ],
        "rts_address",
    ),
    ConfigParam("Password", str, "general", [], "password"),
    # MQTT parameters
    ConfigParam(
        "MQTT_Server",
        str,
        "mqtt",
        ["Location (IP Address of DNS Name) of the MQTT Server"],
        "mqtt_server",
    ),
    ConfigParam("MQTT_Port", int, "mqtt", ["Port of the MQTT Server"], "mqtt_port"),
    ConfigParam(
        "MQTT_User", str, "mqtt", ["Username for the MQTT Server"], "mqtt_user"
    ),
    ConfigParam(
        "MQTT_Password", str, "mqtt", ["Password of the MQTT Server"], "mqtt_password"
    ),
    ConfigParam(
        "MQTT_ClientID",
        str,
        "mqtt",
        [
            "MQTT unique client identifier",
            "If you are running more than one instance of PiSomfy you must ensure",
            "each instance is set to a different value to avoid possible conflicts",
        ],
        "mqtt_client_id",
    ),
    ConfigParam(
        "EnableDiscovery",
        bool,
        "mqtt",
        [
            "If MQTT Discovery is enabled, simply add the folowing 2 lines to Home",
            "Assistant's configuration.yaml file:",
            "#",
            "mqtt:",
            "  discovery: true",
        ],
        "enable_discovery",
    ),
]


class MyConfig:
    """Configuration manager for Pi-Somfy system.

    Handles loading and saving configuration data using TOML for general/MQTT
    settings and JSON for shutters/scheduler settings.
    """

    def __init__(self, location: Optional[Union[str, Path]] = None) -> None:
        """Initialize configuration manager.

        Args:
            filename: Path to configuration file
            section: Initial section to work with
        """
        super().__init__()

        if isinstance(location, str):
            location = Path(location)
        elif isinstance(location, Path):
            location = location
        else:
            location = Path("config")

        if location.is_file():
            filename_no_ext = location.stem
            file_path = location.parent
        else:
            filename_no_ext = "operateShutters"
            file_path = location

        # File paths for new format
        self.toml_path = Path(file_path / filename_no_ext).with_suffix(".toml")
        self.json_path = Path(file_path / filename_no_ext).with_suffix(".json")
        if location.is_file() and (suffix := location.suffix) and suffix == ".conf":
            self.old_ini_path = location
        else:
            self.old_ini_path = Path(file_path / filename_no_ext).with_suffix(".conf")

        self.CriticalLock = threading.Lock()
        self.InitComplete = False

        # Default values with type hints
        self.rfm69_reset_gpio = 25
        self.rfm69_spi_channel = 0
        self.rfm69_enabled = False
        self.pigpio_host = "localhost"
        self.pigpio_port = 8888
        self.PIGPIO_Connect_Timeout = 5
        self.log_location = "."
        self.log_to_console = True
        self.LogLevel = logging.DEBUG
        self.latitude = 51.4769
        self.longitude = 0.0
        self.send_repeat = 2
        self.use_https = False
        self.http_port = 8080
        self.https_port = 443
        self.tx_gpio = 4
        self.rts_address = "0x279620"
        self.mqtt_client_id = "somfy-mqtt-bridge"
        self.mqtt_password = "xxxxxxxx"
        self.mqtt_server = "192.168.1.x"
        self.mqtt_port = 1883
        self.mqtt_user = "xxxxxxx"
        self.enable_discovery = True
        self.shutters: dict[str, dict[str, Any]] = {}
        self.shutters_by_name: dict[str, str] = {}
        self.schedule: dict[str, dict[str, Any]] = {}
        self.password = ""

        self.InitComplete = True

    def _is_old_format(self) -> bool:
        """Check if old INI format exists and new format doesn't."""
        old_ini_exists = self.old_ini_path.exists()
        new_toml_exists = self.toml_path.exists()
        return old_ini_exists and not new_toml_exists

    def _load_legacy_config(self, legacy_config_filename: str) -> bool:
        config = RawConfigParser()
        config.read(legacy_config_filename)

        for ini_section in ["General", "MQTT"]:
            params = [
                param
                for param in CONFIG_PARAMETERS
                if param.section == ini_section.lower()
            ]
            for param in params:
                try:
                    if config.has_option(ini_section, param.name):
                        val = self.read_value(
                            config, ini_section, param.name, return_type=param.type
                        )
                        setattr(self, param.variable_name, val)
                except Exception as e1:
                    LOGGER.exception(
                        f"Missing config file or config file entries in Section {ini_section} for key {param.name}: {e1}"
                    )
                    return False

        shutters = config.items("Shutters")
        for key, value in shutters:
            try:
                name, active, down_duration = value.split(",", 2)
                down_duration, _, up_duration = down_duration.partition(",")
                name, active, down_duration, up_duration = (
                    s.strip() for s in (name, active, down_duration, up_duration)
                )

                if active.lower() == "true":
                    if not down_duration:
                        down_duration = "10"
                    elif int(down_duration) <= 0 or int(down_duration) >= 100:
                        down_duration = "10"
                    param2 = self.read_value(
                        config, "ShutterRollingCodes", key, return_type=int
                    )
                    intermediate_pos: Optional[Union[str, int]] = None
                    if config.has_option("ShutterIntermediatePositions", key):
                        intermediate_pos = self.read_value(
                            config, "ShutterIntermediatePositions", key, return_type=str
                        )
                        try:
                            intermediate_pos = int(intermediate_pos)
                        except Exception:
                            intermediate_pos = None
                    if (
                        intermediate_pos is not None
                        and ((ip := int(intermediate_pos)) is not None)
                        and ((ip < 0) or (ip > 100))
                    ):
                        intermediate_pos = None
                    # If only one duration is specified, use it for both down and up durations.
                    if not up_duration:
                        up_duration = down_duration

                    shutter = {
                        "name": name,
                        "active": True,
                        "code": param2,
                        "durationDown": int(down_duration),
                        "durationUp": int(up_duration),
                        "intermediatePosition": intermediate_pos,
                    }
                    self.shutters[key] = shutter
                    self.shutters_by_name[name] = key
            except Exception as e1:
                LOGGER.exception(
                    "Missing config file or config file entries in Section Shutters for key "
                    + key
                    + ": "
                    + str(e1)
                )
                return False

        schedules = config.items("Scheduler")
        for key, value in schedules:
            try:
                schedule_param = value.split(",")
                if schedule_param[0].strip().lower() in ("active", "paused"):
                    self.schedule[key] = {
                        "active": schedule_param[0],
                        "repeatType": schedule_param[1],
                        "repeatValue": schedule_param[2].split("|"),
                        "timeType": schedule_param[3],
                        "timeValue": schedule_param[4],
                        "shutterAction": schedule_param[5],
                        "shutterIds": schedule_param[6].split("|"),
                    }
            except Exception as e1:
                LOGGER.exception(
                    "Missing config file or config file entries in Section Scheduler for key "
                    + key
                    + ": "
                    + str(e1)
                )
                return False

        return True

    def read_value(
        self, config: RawConfigParser, section: str, key: str, return_type: type[_T]
    ) -> _T:
        """Read and convert a value from config parser.

        Args:
            config: Configuration parser instance
            section: Section name in config
            key: Key name in section
            return_type: Type to convert the value to

        Returns:
            Any: Converted value according to return_type
        """
        if return_type is bool:
            return return_type(config.getboolean(section, key))
        if return_type == float:
            return return_type(config.getfloat(section, key))
        if return_type == int:
            return return_type(config.getint(section, key))
        return return_type(config.get(section, key))

    def _migrate_from_ini(self) -> None:
        """Migrate configuration from old INI format to new TOML/JSON format."""
        LOGGER.info("Migrating old INI configuration to new TOML/JSON format")

        self._load_legacy_config(str(self.old_ini_path))

        doc = self._create_new_toml()
        toml_dump = dumps(doc)

        shutters_schedule_dump = {"shutters": self.shutters, "schedule": self.schedule}

        # Write new format files
        with self.CriticalLock:
            with open(self.toml_path, "w") as f:
                f.write(toml_dump)
            with open(self.json_path, "w") as f:
                json.dump(shutters_schedule_dump, f, indent=2)

        LOGGER.info("Migrated old INI configuration to new TOML/JSON format")

    def _create_new_toml(self) -> TOMLDocument:
        """Create new TOML file."""
        doc = document()
        doc.add(comment("Pi-Somfy Configuration File."))
        doc.add(nl())

        section_params: dict[str, list[ConfigParam]] = {}
        for param in CONFIG_PARAMETERS:
            if param.section not in section_params:
                section_params[param.section] = []
            section_params[param.section].append(param)

        for section_name, params in section_params.items():
            ttable = table()
            for param in params:
                if param.doc:
                    ttable.add(nl())
                    for cmt in param.doc:
                        ttable.add(comment(cmt))
                val = param.type(getattr(self, param.variable_name))
                ttable.add(param.name, val)
            doc.add(section_name, ttable)
            doc.add(nl())
        return doc

    def _load_new_format(self) -> bool:
        """Load configuration from new TOML and JSON files."""
        # Load TOML for General and MQTT
        with open(self.toml_path, "r") as f:
            toml_string = f.read()
        toml: dict[str, Any] = parse(toml_string)

        for param in CONFIG_PARAMETERS:
            try:
                if val := toml[param.section].get(param.name):
                    setattr(self, param.variable_name, val)
            except Exception as e1:
                LOGGER.exception(
                    f"Missing config file or config file entries in Section {param.section} for key {param.name}: {e1}"
                )
                return False

        # Load Shutters from JSON
        if self.json_path.exists():
            with open(self.json_path, "r") as f:
                json_dict = json.load(f)
            self.shutters = json_dict["shutters"]
            self.shutters_by_name = {v["name"]: k for k, v in self.shutters.items()}
            self.schedule = json_dict["schedule"]

        return True

    def load_config(self) -> bool:
        """Load configuration data.

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Check for old format and migrate if necessary
            if self._is_old_format():
                self._migrate_from_ini()
            else:
                self._load_new_format()
            return True
        except Exception as e:
            LOGGER.exception(f"Error loading config: {str(e)}")
            return False

    def set_location(self, lat: float, lng: float) -> None:
        """Set location coordinates and save to config.

        Args:
            lat: Latitude value
            lng: Longitude value
        """
        with self.CriticalLock:
            with open(self.toml_path, "r") as f:
                toml_string = f.read()
            toml: dict[str, Any] = parse(toml_string)
            toml["general"]["Latitude"] = lat
            toml["general"]["Longitude"] = lng
            toml_dump = dumps(toml)
            with open(self.toml_path, "w") as f:
                f.write(toml_dump)
        self.latitude = lat
        self.longitude = lng

    def set_web(
        self, http_port: int, https_port: int, use_https: bool, password: str
    ) -> None:
        """Set web server configuration and save to config.

        Args:
            http_port: HTTP port number
            https_port: HTTPS port number
            use_https: Whether to use HTTPS
        """
        with self.CriticalLock:
            with open(self.toml_path, "r") as f:
                toml_string = f.read()
            toml: dict[str, Any] = parse(toml_string)
            toml["general"]["HTTPPort"] = http_port
            toml["general"]["HTTPSPort"] = https_port
            toml["general"]["UseHttps"] = use_https
            toml["general"]["Password"] = password
            toml_dump = dumps(toml)
            with open(self.toml_path, "w") as f:
                f.write(toml_dump)
        self.http_port = http_port
        self.https_port = https_port
        self.use_https = use_https
        self.password = password

    def set_mq(
        self,
        mqtt_server: str,
        mqtt_port: int,
        mqtt_user: str,
        mqtt_password: str,
        mqtt_client_id: str,
        enable_discovery: bool,
    ) -> None:
        """Set MQTT configuration and save to config.

        Args:
            server: MQTT server address
            port: MQTT port number
            user: MQTT username
            password: MQTT password
            client_id: MQTT client identifier
        """
        with self.CriticalLock:
            with open(self.toml_path, "r") as f:
                toml_string = f.read()
            toml: dict[str, Any] = parse(toml_string)
            toml["mqtt"]["MQTT_Server"] = mqtt_server
            toml["mqtt"]["MQTT_Port"] = mqtt_port
            toml["mqtt"]["MQTT_User"] = mqtt_user
            toml["mqtt"]["MQTT_Password"] = mqtt_password
            toml["mqtt"]["MQTT_ClientID"] = mqtt_client_id
            toml["mqtt"]["EnableDiscovery"] = enable_discovery
            toml_dump = dumps(toml)
            with open(self.toml_path, "w") as f:
                f.write(toml_dump)
        self.mqtt_server = mqtt_server
        self.mqtt_port = mqtt_port
        self.mqtt_user = mqtt_user
        self.mqtt_password = mqtt_password
        self.mqtt_client_id = mqtt_client_id
        self.enable_discovery = enable_discovery

    def set_radio(
        self,
        tx_gpio: int,
        rts_address: str,
        send_repeat: int,
        rfm69_enabled: bool,
        rfm69_reset_gpio: int,
        rfm69_spi_channel: int,
        pigpio_host: str,
        pigpio_port: int,
    ) -> None:
        """Set radio configuration and save to config.

        Args:
            tx_gpio: GPIO pin for transmission
            rts_address: RTS address in hex format
            send_repeat: Number of times to repeat transmission
        """
        with self.CriticalLock:
            with open(self.toml_path, "r") as f:
                toml_string = f.read()
            toml: dict[str, Any] = parse(toml_string)
            toml["general"]["TXGPIO"] = tx_gpio
            toml["general"]["RTS_Address"] = rts_address
            toml["general"]["SendRepeat"] = send_repeat
            toml["general"]["Rfm69Enabled"] = rfm69_enabled
            toml["general"]["Rfm69ResetGPIO"] = rfm69_reset_gpio
            toml["general"]["Rfm69SPIChannel"] = rfm69_spi_channel
            toml["general"]["PIGPIOHost"] = pigpio_host
            toml["general"]["PIGPIOPort"] = pigpio_port
            toml_dump = dumps(toml)
            with open(self.toml_path, "w") as f:
                f.write(toml_dump)
        self.tx_gpio = tx_gpio
        self.rts_address = rts_address
        self.send_repeat = send_repeat
        self.rfm69_enabled = rfm69_enabled
        self.rfm69_reset_gpio = rfm69_reset_gpio
        self.rfm69_spi_channel = rfm69_spi_channel
        self.pigpio_host = pigpio_host
        self.pigpio_port = pigpio_port

    def set_shutter_code(self, shutter_id: str, code: int) -> None:
        """Set rolling code for a shutter and save to config.

        Args:
            shutter_id: Shutter identifier
            code: New rolling code value
        """
        with self.CriticalLock:
            with open(self.json_path, "r") as f:
                json_dict = json.load(f)
            json_dict["shutters"][shutter_id]["code"] = code
            with open(self.json_path, "w") as f:
                json.dump(json_dict, f, indent=2)

    def set_shutter(self, shutter_id: str, name: str, duration: str) -> None:
        """Set shutter name and duration and save to config.

        Args:
            shutter_id: Shutter identifier
            name: Shutter name
            duration: Shutter duration
        """
        if (shutter := self.shutters.get(shutter_id)) is None:
            raise ValueError(f"Shutter {shutter_id} does not exist")
        original_name = shutter["name"]

        shutter["name"] = name
        shutter["durationUp"] = int(duration)
        shutter["durationDown"] = int(duration)

        with self.json_config() as json_dict:
            json_dict["shutters"][shutter_id] = shutter

        self.shutters_by_name.pop(original_name, None)
        self.shutters_by_name[name] = shutter_id

    def add_shutter(self, name: str, duration: str) -> None:
        """Set shutter name and duration and save to config.

        Args:
            name: Shutter name
            duration: Shutter duration
        """
        tmp_id = int(self.rts_address, 16)
        conflict = True
        while conflict == True:
            tmp_id = tmp_id + 1
            conflict = False
            for key in self.shutters:
                if tmp_id == int(key, 16):
                    conflict = True
        shutter_id = "0x%0.2X" % tmp_id

        shutter = {
            "name": name,
            "code": 1,
            "durationUp": int(duration),
            "durationDown": int(duration),
            "active": True,
            "intermediatePosition": None,
        }
        with self.json_config() as json_dict:
            if shutter_id in json_dict["shutters"]:
                raise ValueError(f"Shutter {shutter_id} already exists")
            json_dict["shutters"][shutter_id] = shutter

        self.shutters_by_name[name] = shutter_id
        self.shutters[shutter_id] = shutter

    @contextmanager
    def json_config(self) -> Generator[dict[str, Any], None, None]:
        # Code to acquire resource, e.g.:
        with self.CriticalLock:
            with open(self.json_path, "r") as f:
                json_dict = json.load(f)
        try:
            yield json_dict
        finally:
            with open(self.json_path, "w") as f:
                json.dump(json_dict, f, indent=2)

    def set_shutter_active(self, shutter_id: str, active: bool) -> None:
        """Set shutter active status and save to config.

        Args:
            shutter_id: Shutter identifier
            active: Shutter active status
        """
        with self.json_config() as json_dict:
            json_dict["shutters"][shutter_id]["active"] = active

        if not active:
            self.shutters_by_name.pop(self.shutters[shutter_id]["name"], None)
            self.shutters.pop(shutter_id, None)

    def set_schedule(
        self,
        schedule_id: str,
        active: bool,
        repeat_type: str,
        repeat_value: str,
        time_type: str,
        time_value: str,
        shutter_action: str,
        shutter_ids: str,
    ) -> None:
        """Set schedule and save to config.

        Args:
            schedule_id: Schedule identifier
            active: Schedule active status
            repeat_type: Schedule repeat type
            repeat_value: Schedule repeat value
            time_type: Schedule time type
            time_value: Schedule time value
            shutter_action: Schedule shutter action
            shutter_ids: Schedule shutter identifiers
        """
        with self.CriticalLock:
            with open(self.json_path, "r") as f:
                json_dict = json.load(f)
            json_dict["schedule"][schedule_id] = {
                "active": active,
                "repeatType": repeat_type,
                "repeatValue": repeat_value,
                "timeType": time_type,
                "timeValue": time_value,
                "shutterAction": shutter_action,
                "shutterIds": shutter_ids,
            }
            with open(self.json_path, "w") as f:
                json.dump(json_dict, f, indent=2)
        self.schedule[schedule_id] = {
            "active": active,
            "repeatType": repeat_type,
            "repeatValue": repeat_value,
            "timeType": time_type,
            "timeValue": time_value,
            "shutterAction": shutter_action,
            "shutterIds": shutter_ids,
        }
