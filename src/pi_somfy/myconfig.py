#!/usr/bin/python3

import threading
import json
import logging
from tomlkit import dumps, parse, table, nl, document, comment
from pathlib import Path
from contextlib import contextmanager
try:
    from ConfigParser import RawConfigParser
except ImportError:
    from configparser import RawConfigParser

LOGGER = logging.getLogger(__name__)

GENERAL_PARAMETERS = {
    'LogLocation': str, 
    'LogToConsole': bool, 
    'Latitude': float, 
    'Longitude': float, 
    'SendRepeat': int, 
    'TXGPIO': int, 
    'Rfm69ResetGPIO': int, 
    'Rfm69SPIChannel': int, 
    'Rfm69Enabled': bool, 
    'PIGPIOHost': str, 
    'PIGPIOPort': int,
    'UseHttps': bool, 
    'HTTPPort': int, 
    'HTTPSPort': int,     
    'RTS_Address': str, 
    "Password": str
}
MQQT_PARAMETERS = {
    'MQTT_Server': str, 
    'MQTT_Port': int, 
    'MQTT_User': str, 
    'MQTT_Password': str, 
    'MQTT_ClientID': str, 
    'EnableDiscovery': bool
}

CONFIG_COMMENTS = {
    'LogLocation': ['location of log files (required)'],
    'Latitude': [
        'PUT YOUR OWN COORDINATES HERE', 
        'Latitude of the place for computation of sunset and sunrise.', 
        'check on Google Maps for instance'
    ],
    'Longitude': [
        'PUT YOUR OWN COORDINATES HERE', 
        'Longitude of the place for computation of sunset and sunrise.', 
        'check on Google Maps for instance'
    ],
    'SendRepeat': [
        'Repeat each command a certain number of times. This is to ensure it works',
        'if the remote is far away from the shutter and sometime EMI prevents a',
        'signal to go through',
        'This option only applies if a shutter is raised or lowered in full. If', 
        'a shutter is only raised or lowered for a given amount of seconds, this',
        'option does not apply for obvious reasons.'
    ],
    'TXGPIO': [
        '(Optional) This parameter specifes the GPIO connector where the 433.42 MHz',
        'emitter is connected to. The default value is 4'
    ],
    'Rfm69ResetGPIO': [
        '(Optional) These parameters configure the GPIO connectors for an RFM69HCW to', 
        'to use where the 433.42 MHz frequency.  If using Rfm69 ensure to update the TXGPIO',
        'value above to match the DATA/DIO2 Pin for the Rfm69 module and set Rfm69Enabled to True'
    ],
    'Rfm69SPIChannel': [
        '(Optional) These parameters configure the GPIO connectors for an RFM69HCW to', 
        'to use where the 433.42 MHz frequency.  If using Rfm69 ensure to update the TXGPIO',
        'value above to match the DATA/DIO2 Pin for the Rfm69 module and set Rfm69Enabled to True'
    ],
    'Rfm69Enabled': [
        '(Optional) These parameters configure the GPIO connectors for an RFM69HCW to', 
        'to use where the 433.42 MHz frequency.  If using Rfm69 ensure to update the TXGPIO',
        'value above to match the DATA/DIO2 Pin for the Rfm69 module and set Rfm69Enabled to True'
    ],
    'PIGPIOHost': ['(Optional) These parameters configure remote GPIO access via PIOPIO'],
    'PIGPIOPort': ['(Optional) These parameters configure remote GPIO access via PIOPIO'],
    'UseHttps': [
        'This parameter, if true will enable the use of HTTPS',
        '(secure HTTP) in the Flask web app or user name and password',
        'authentication, depending on the options below. This option is only',
        'applicable to the web app. This option requires python-openssl library',
        'to be installed'
    ],
    'HTTPPort': [
        '(Optional) This parameter will allow the HTTP port to be set by the web',
        'interface. The default is 80, but this setting will override that',
        'value. This option is only applicable to the web app.'
    ],
    'HTTPSPort': [
        'This parameter will override the default port for HTTPS, which is',
        '443. Uncomment and change this value to use a non-standard port for HTTPS'
    ],
    'RTS_Address': [
        'Lowest identifier used by the tool to assign unique 24bit', 
        'ids for new remote. This value won\'t change in the config file, instead',
        'the tool will look for the next available address that has not been', 
        'used yet.',
        'If you are running more than one instance of PiSomfy you must ensure',
        'each instance is set to a different value to avoid possible conflicts'
    ],
    'MQTT_Server': ['Location (IP Address of DNS Name) of the MQTT Server'],
    'MQTT_Port': ['Port of the MQTT Server'],
    'MQTT_User': ['Username for the MQTT Server'],
    'MQTT_Password': ['Password of the MQTT Server'],
    'MQTT_ClientID': [
        'MQTT unique client identifier',
        'If you are running more than one instance of PiSomfy you must ensure',
        'each instance is set to a different value to avoid possible conflicts'
    ],
    'EnableDiscovery': [
        'If MQTT Discovery is enabled, simply add the folowing 2 lines to Home',
        'Assistant\'s configuration.yaml file:',
        '#',
        'mqtt:',
        '  discovery: true'
    ],
}



class MyConfig:
    """Configuration manager for Pi-Somfy system.

    Handles loading and saving configuration data using TOML for general/MQTT
    settings and JSON for shutters/scheduler settings.
    """
    def __init__(self, filename: str = None, section: str = None):
        """Initialize configuration manager.

        Args:
            filename: Path to configuration file
            section: Initial section to work with
        """
        super().__init__()
        self.filepath = Path(filename)
        self.CriticalLock = threading.Lock()
        self.InitComplete = False

        # Default values
        self.Rfm69ResetGPIO = 25
        self.Rfm69SPIChannel = 0
        self.Rfm69Enabled = False
        self.PIGPIOHost = "localhost"
        self.PIGPIOPort = 8888
        self.PIGPIO_Connect_Timeout = 5
        self.LogLocation = "."
        self.LogToConsole = True
        self.LogLevel = logging.DEBUG
        self.Latitude = 51.4769
        self.Longitude = 0
        self.SendRepeat = 2
        self.UseHttps = False
        self.HTTPPort = 8080
        self.HTTPSPort = 443
        self.TXGPIO = 4
        self.RTS_Address = "0x279620"
        self.MQTT_ClientID = "somfy-mqtt-bridge"
        self.MQTT_Password = "xxxxxxxx"
        self.MQTT_Server = "192.168.1.x"
        self.MQTT_Port = 1883
        self.MQTT_User = "xxxxxxx"
        self.EnableDiscovery = True
        self.Shutters = {}
        self.ShuttersByName = {}
        self.Schedule = {}
        self.Password = ""

        # File paths for new format
        self.toml_path = Path(filename).with_suffix('.toml')
        self.json_path = Path(filename).with_suffix('.json')
        if (suffix := self.filepath.suffix) and suffix not in ('.toml', '.json'):
            self.old_ini_path = self.filepath
        else:
            self.old_ini_path = self.filepath.with_suffix('.conf')

        self.InitComplete = True

    def _is_old_format(self) -> bool:
        """Check if old INI format exists and new format doesn't."""
        old_ini_exists = self.old_ini_path.exists()
        new_toml_exists = self.toml_path.exists()
        return old_ini_exists and not new_toml_exists

    def _load_legacy_config(self, legacy_config_filename: str):

        config = RawConfigParser()
        config.read(legacy_config_filename)

        for section, params in [("General", GENERAL_PARAMETERS), ("MQTT", MQQT_PARAMETERS)]:
            for key, type in params.items():
                try:
                    if config.has_option(section, key):
                        val = self.ReadValue(config, section, key, return_type=type)
                        setattr(self, key, val)
                except Exception as e1:
                    LOGGER.exception(f"Missing config file or config file entries in Section {section} for key {key}: {e1}")
                    return False

 
        shutters = config.items("Shutters");
        for key, value in shutters:
            try:
                name, active, down_duration = value.split(",",2)
                down_duration, _, up_duration = down_duration.partition(",")
                name, active, down_duration, up_duration = (s.strip() for s in (name, active, down_duration, up_duration))

                if active.lower() == 'true':
                   if not down_duration:
                       down_duration ="10";
                   elif int(down_duration) <= 0 or int(down_duration) >= 100:
                       down_duration = "10"
                   param2 = self.ReadValue(config, "ShutterRollingCodes",key, return_type=int)
                   intermediate_pos = None
                   if config.has_option("ShutterIntermediatePositions", key):
                       intermediate_pos = self.ReadValue(config, "ShutterIntermediatePositions", key, return_type=str)
                       try:
                           intermediate_pos = int(intermediate_pos)
                       except Exception:
                           intermediate_pos = None
                   if (intermediate_pos != None) and ((intermediate_pos < 0) or (intermediate_pos > 100)):
                       intermediate_pos  = None
                   # If only one duration is specified, use it for both down and up durations.
                   if not up_duration:
                      up_duration = down_duration
                   self.Shutters[key] = {'name': name, 'active': True, 'code': param2, 'durationDown': int(down_duration), 'durationUp': int(up_duration), 'intermediatePosition': intermediate_pos}
                   self.ShuttersByName[name] = key
            except Exception as e1:
                LOGGER.exception("Missing config file or config file entries in Section Shutters for key "+key+": " + str(e1))
                return False

        schedules = config.items("Scheduler");
        for key, value in schedules:
            try:
                param = value.split(",")
                if param[0].strip().lower() in ('active', 'paused'):
                   self.Schedule[key] = {'active': param[0], 'repeatType': param[1], 'repeatValue': param[2].split("|"), 'timeType': param[3], 'timeValue': param[4], 'shutterAction': param[5], 'shutterIds': param[6].split("|")}
            except Exception as e1:
                LOGGER.exception("Missing config file or config file entries in Section Scheduler for key "+key+": " + str(e1))
                return False
    
        return True

    #---------------------MyConfig::ReadValue-----------------------------------
    def ReadValue(self, config: RawConfigParser, section: str, key: str, return_type: type):

        if return_type == bool:
            return config.getboolean(section, key)
        if return_type == float:
            return config.getfloat(section, key)
        if return_type == int:
            return config.getint(section, key)
        return config.get(section, key)


    def _migrate_from_ini(self):
        """Migrate configuration from old INI format to new TOML/JSON format."""
        LOGGER.info("Migrating old INI configuration to new TOML/JSON format")

        self._load_legacy_config(self.old_ini_path)

        doc = self._create_new_toml()
        toml_dump = dumps(doc)
        
        shutters_schedule_dump = {
            "shutters": self.Shutters,
            "schedule": self.Schedule
        }

        # Write new format files
        with self.CriticalLock:
            with open(self.toml_path, 'w') as f:
                f.write(toml_dump)
            with open(self.json_path, 'w') as f:
                json.dump(shutters_schedule_dump, f, indent=2)

        LOGGER.info("Migrated old INI configuration to new TOML/JSON format")

    def _create_new_toml(self):
        """Create new TOML file."""
        doc = document()
        doc.add(comment("Pi-Somfy Configuration File."))
        doc.add(nl())

        for tablename, params in [("general", GENERAL_PARAMETERS), ("mqtt", MQQT_PARAMETERS)]:
            ttable = table()
            for key, type_ in params.items():
                if comments := CONFIG_COMMENTS.get(key):
                    ttable.add(nl())
                    for cmt in comments:
                        ttable.add(comment(cmt))
                val = type_(getattr(self, key))
                ttable.add(key, val)
            doc.add(tablename, ttable)
            doc.add(nl())
        return doc


    def _load_new_format(self):
        """Load configuration from new TOML and JSON files."""
        # Load TOML for General and MQTT
        with open(self.toml_path, 'r') as f:
            toml_string = f.read()
        toml = parse(toml_string)
        
        for section, params in [("general", GENERAL_PARAMETERS), ("mqtt", MQQT_PARAMETERS)]:
            for key in params:
                try:
                    if val := toml[section].get(key):
                        setattr(self, key, val)
                except Exception as e1:
                    LOGGER.exception(f"Missing config file or config file entries in Section {section} for key {key}: {e1}")
                    return False

        # Load Shutters from JSON
        if self.json_path.exists():
            with open(self.json_path, 'r') as f:
                json_dict =  json.load(f)
            self.Shutters = json_dict['shutters']
            self.ShuttersByName = {v['name']: k for k, v in self.Shutters.items()}
            self.Schedule = json_dict['schedule']


    def LoadConfig(self) -> bool:
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
                                   
    def setLocation(self, lat: float, lng: float):
        """Set location coordinates and save to config.

        Args:
            lat: Latitude value
            lng: Longitude value
        """
        with self.CriticalLock:
            with open(self.toml_path, 'r') as f:
                toml_string = f.read()
            toml = parse(toml_string)
            toml['general']['Latitude'] = lat
            toml['general']['Longitude'] = lng
            toml_dump = dumps(toml)
            with open(self.toml_path, 'w') as f:
                f.write(toml_dump)
        self.Latitude = lat
        self.Longitude = lng

    def setShutterCode(self, shutterId: str, code: int):
        """Set rolling code for a shutter and save to config.

        Args:
            shutterId: Shutter identifier
            code: New rolling code value
        """
        with self.CriticalLock:
            with open(self.json_path, 'r') as f:
                json_dict = json.load(f)
            json_dict['shutters'][shutterId]['code'] = code
            with open(self.json_path, 'w') as f:
                json.dump(json_dict, f, indent=2)
        
    def setShutter(self, shutterId: str, name: str, duration: str):
        """Set shutter name and duration and save to config.

        Args:
            shutterId: Shutter identifier
            name: Shutter name
            duration: Shutter duration
        """
        if (shutter := self.Shutters.get(shutterId)) is None:
            raise ValueError(f"Shutter {shutterId} does not exist")
        original_name = shutter['name']

        shutter['name'] = name
        shutter['durationUp'] = int(duration)
        shutter['durationDown'] = int(duration)

        with self.json_config() as json_dict:
            json_dict['shutters'][shutterId] = shutter

        self.ShuttersByName.pop('original_name', None)
        self.ShuttersByName[name] = shutter


    def addShutter(self, name: str, duration: str):
        """Set shutter name and duration and save to config.

        Args:
            shutterId: Shutter identifier
            name: Shutter name
            duration: Shutter duration
        """
        tmp_id = int(self.RTS_Address, 16)
        conflict = True
        while conflict == True:
            tmp_id = tmp_id+1
            conflict = False
            for key in self.Shutters:
                if tmp_id == int(key, 16):
                    conflict = True
        shutterId = "0x%0.2X" % tmp_id
        
        shutter = {
            "name": name,
            "code": 1,
            "durationUp": int(duration),
            "durationDown": int(duration),
            "active": True,
            "intermediatePosition": None
        }
        with self.json_config() as json_dict:
            if shutterId in json_dict['shutters']:
                raise ValueError(f"Shutter {shutterId} already exists")
            json_dict['shutters'][shutterId] = shutter

        self.ShuttersByName[name] = shutterId
        self.Shutters[shutterId] = shutter
    
    @contextmanager
    def json_config(self):
        # Code to acquire resource, e.g.:
        with self.CriticalLock:
            with open(self.json_path, 'r') as f:
                json_dict = json.load(f)
        try:
            yield json_dict
        finally:
            with open(self.json_path, 'w') as f:
                json.dump(json_dict, f, indent=2)
            
    def setShutterActive(self, shutterId: str, active: bool):
        """Set shutter active status and save to config.

        Args:
            shutterId: Shutter identifier
            active: Shutter active status
        """
        with self.json_config() as json_dict:
            json_dict['shutters'][shutterId]['active'] = active

        if not active:
            self.ShuttersByName.pop(self.Shutters[shutterId]['name'], None)
            self.Shutters.pop(shutterId, None)

    def setSchedule(self, scheduleId: str, active: bool, repeatType: str, repeatValue: str, timeType: str, timeValue: str, shutterAction: str, shutterIds: str):
        """Set schedule and save to config.

        Args:
            scheduleId: Schedule identifier
            active: Schedule active status
            repeatType: Schedule repeat type
            repeatValue: Schedule repeat value
            timeType: Schedule time type
            timeValue: Schedule time value
            shutterAction: Schedule shutter action
            shutterIds: Schedule shutter identifiers
        """
        with self.CriticalLock:
            with open(self.json_path, 'r') as f:
                json_dict = json.load(f)
            json_dict['schedule'][scheduleId] = {
                'active': active,
                'repeatType': repeatType,
                'repeatValue': repeatValue,
                'timeType': timeType,
                'timeValue': timeValue,
                'shutterAction': shutterAction,
                'shutterIds': shutterIds
            }
            with open(self.json_path, 'w') as f:
                json.dump(json_dict, f, indent=2)
        self.Schedule[scheduleId] = {
            'active': active,
            'repeatType': repeatType,
            'repeatValue': repeatValue,
            'timeType': timeType,
            'timeValue': timeValue,
            'shutterAction': shutterAction,
            'shutterIds': shutterIds
        }
