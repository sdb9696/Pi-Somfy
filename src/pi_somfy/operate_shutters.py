#!/usr/bin/python3

import sys
import fcntl
import os
import time
import pigpio
import logging
import logging.handlers
import threading
import click
import subprocess
from typing import Optional, List, Tuple
from pathlib import Path

try:
    from .config import MyConfig
    from .myscheduler import Schedule
    from .myscheduler import Scheduler
    from .web_server import FlaskAppWrapper
    from .alexa import Alexa
    from .mqtt import MQTT
    from .rfm69_transmitter import SomfyRfm69Tx
    from .rts_wave_form import create_wave_form
    from time import sleep
    from .pigpio_helper import create_pigpio_connection
except Exception as e:
    print(
        f"\n\nThis program requires the modules located from the same github repository that are not present.\nError: {e}"
    )
    sys.exit(2)

LOGGER = logging.getLogger(__name__)


# Create a simple args object to mimic argparse's behavior
class Args:
    def __init__(
        self,
        shutter_name: Optional[str] = None,
        config_file: Optional[str] = None,
        up: bool = False,
        down: bool = False,
        stop: bool = False,
        program: bool = False,
        press: Optional[List[str]] = None,
        long: bool = False,
        demo: bool = False,
        duskdawn: Optional[Tuple[int, int]] = None,
        auto: bool = False,
        echo: bool = False,
        mqtt: bool = False,
    ):
        self.shutter_name = shutter_name
        self.config_file = config_file
        self.up = up
        self.down = down
        self.stop = stop
        self.program = program
        self.press = press if press else None
        self.long = long
        self.demo = demo
        self.duskdawn = duskdawn
        self.auto = auto
        self.echo = echo
        self.mqtt = mqtt


class Shutter:
    # Button values - constants should be in UPPERCASE
    BUTTON_UP = 0x2
    BUTTON_STOP = 0x1
    BUTTON_DOWN = 0x4
    BUTTON_PROG = 0x8

    class ShutterState:  # Definition of one shutter state
        position = None  # as percentage: 0 = closed (down), 100 = open (up)
        last_command_time = None  # get using time.monotonic()
        last_command_direction = None  # 'up' or 'down' or None

        def __init__(self, init_position=None):
            self.position = init_position
            self.last_command_time = time.monotonic()

        def register_command(self, command_direction):
            self.last_command_direction = command_direction
            self.last_command_time = time.monotonic()

    def __init__(self, config=None):
        super().__init__()
        self.lock = threading.Lock()

        if config != None:
            self.config = config

        if self.config.TXGPIO != None:
            self.TXGPIO = self.config.TXGPIO  # 433.42 MHz emitter
        else:
            self.TXGPIO = 4  # 433.42 MHz emitter on GPIO 4

        self.callback = []
        self.shutter_state_list = {}
        self.shutter_state_lock = threading.Lock()

    def get_shutter_state(self, shutter_id, initial_position=None):
        with self.shutter_state_lock:
            if shutter_id not in self.shutter_state_list:
                self.shutter_state_list[shutter_id] = self.ShutterState(
                    initial_position
                )
            return self.shutter_state_list[shutter_id]

    def get_position(self, shutter_id):
        state = self.get_shutter_state(shutter_id, 0)
        return state.position

    def set_position(self, shutter_id, new_position):
        state = self.get_shutter_state(shutter_id)
        with self.shutter_state_lock:
            state.position = new_position
        for function in self.callback:
            function(shutter_id, new_position)

    def wait_and_set_final_position(self, shutter_id, time_to_wait, new_position):
        state = self.get_shutter_state(shutter_id)
        old_last_command_time = state.last_command_time

        LOGGER.debug(
            "["
            + self.config.shutters[shutter_id]["name"]
            + "] Waiting for operation to complete for "
            + str(time_to_wait)
            + " seconds"
        )
        time.sleep(time_to_wait)

        # Only set new position if registerCommand has not been called in between
        if state.last_command_time == old_last_command_time:
            LOGGER.debug(
                "["
                + self.config.shutters[shutter_id]["name"]
                + "] Set new final position: "
                + str(new_position)
            )
            self.set_position(shutter_id, new_position)
        else:
            LOGGER.debug(
                "["
                + self.config.shutters[shutter_id]["name"]
                + "] Discard final position. Position is now: "
                + str(state.position)
            )

    def lower(self, shutter_id):
        state = self.get_shutter_state(shutter_id, 100)

        LOGGER.info("[" + self.config.shutters[shutter_id]["name"] + "] Going down")
        self.send_command(shutter_id, self.BUTTON_DOWN, self.config.SendRepeat)
        state.register_command("down")

        # wait and set final position only if not interrupted in between
        time_to_wait = (
            state.position / 100 * self.config.shutters[shutter_id]["durationDown"]
        )
        t = threading.Thread(
            target=self.wait_and_set_final_position, args=(shutter_id, time_to_wait, 0)
        )
        t.start()

    def lower_partial(self, shutter_id, percentage):
        state = self.get_shutter_state(shutter_id, 100)

        LOGGER.info("[" + self.config.shutters[shutter_id]["name"] + "] Going down")
        self.send_command(shutter_id, self.BUTTON_DOWN, self.config.SendRepeat)
        state.register_command("down")
        time.sleep(
            (state.position - percentage)
            / 100
            * self.config.shutters[shutter_id]["durationDown"]
        )
        LOGGER.info(
            "["
            + self.config.shutters[shutter_id]["name"]
            + "] Stop at partial position requested"
        )
        self.send_command(shutter_id, self.BUTTON_STOP, self.config.SendRepeat)

        self.set_position(shutter_id, percentage)

    def rise(self, shutter_id):
        state = self.get_shutter_state(shutter_id, 0)

        LOGGER.info("[" + self.config.shutters[shutter_id]["name"] + "] Going up")
        self.send_command(shutter_id, self.BUTTON_UP, self.config.SendRepeat)
        state.register_command("up")

        # wait and set final position only if not interrupted in between
        time_to_wait = (
            (100 - state.position)
            / 100
            * self.config.shutters[shutter_id]["durationUp"]
        )
        t = threading.Thread(
            target=self.wait_and_set_final_position,
            args=(shutter_id, time_to_wait, 100),
        )
        t.start()

    def rise_partial(self, shutter_id, percentage):
        state = self.get_shutter_state(shutter_id, 0)

        LOGGER.info("[" + self.config.shutters[shutter_id]["name"] + "] Going up")
        self.send_command(shutter_id, self.BUTTON_UP, self.config.SendRepeat)
        state.register_command("up")
        time.sleep(
            (percentage - state.position)
            / 100
            * self.config.shutters[shutter_id]["durationUp"]
        )
        LOGGER.info(
            "["
            + self.config.shutters[shutter_id]["name"]
            + "] Stop at partial position requested"
        )
        self.send_command(shutter_id, self.BUTTON_STOP, self.config.SendRepeat)

        self.set_position(shutter_id, percentage)

    def stop(self, shutter_id):
        state = self.get_shutter_state(shutter_id, 50)

        LOGGER.info("[" + self.config.shutters[shutter_id]["name"] + "] Stopping")
        self.send_command(shutter_id, self.BUTTON_STOP, self.config.SendRepeat)

        LOGGER.debug("[" + shutter_id + "] Previous position: " + str(state.position))
        seconds_since_last_command = int(
            round(time.monotonic() - state.last_command_time)
        )
        LOGGER.debug(
            "["
            + shutter_id
            + "] Seconds since last command: "
            + str(seconds_since_last_command)
        )

        # Compute position based on time elapsed since last command & command direction
        setup_duration_down = self.config.shutters[shutter_id]["durationDown"]
        setup_duration_up = self.config.shutters[shutter_id]["durationUp"]

        fallback = False
        if state.last_command_direction == "up":
            if (
                seconds_since_last_command > 0
                and seconds_since_last_command < setup_duration_up
            ):
                duration_percentage = int(
                    round(seconds_since_last_command / setup_duration_up * 100)
                )
                LOGGER.debug(
                    "["
                    + shutter_id
                    + "] Up duration percentage: "
                    + str(duration_percentage)
                    + ", State position: "
                    + str(state.position)
                )
                if state.position > 0:  # after rise from previous position
                    new_position = min(100, state.position + duration_percentage)
                else:  # after rise from fully closed
                    new_position = duration_percentage
            else:  # fallback
                LOGGER.warning("[" + shutter_id + "] Too much time since up command.")
                fallback = True
        elif state.last_command_direction == "down":
            if (
                seconds_since_last_command > 0
                and seconds_since_last_command < setup_duration_down
            ):
                duration_percentage = int(
                    round(seconds_since_last_command / setup_duration_down * 100)
                )
                LOGGER.debug(
                    "["
                    + shutter_id
                    + "] Down duration percentage: "
                    + str(duration_percentage)
                    + ", State position: "
                    + str(state.position)
                )
                if state.position < 100:  # after lower from previous position
                    new_position = max(0, state.position - duration_percentage)
                else:  # after down from fully opened
                    new_position = 100 - duration_percentage
            else:  # fallback
                LOGGER.warning("[" + shutter_id + "] Too much time since down command.")
                fallback = True
        else:  # consecutive stops
            LOGGER.warning("[" + shutter_id + "] Stop pressed while stationary.")
            fallback = True

        if (
            fallback == True
        ):  # Let's assume it will end on the intermediate position ! If it exists !
            intermediate_position = self.config.shutters[shutter_id][
                "intermediatePosition"
            ]
            if (intermediate_position == None) or (
                intermediate_position == state.position
            ):
                LOGGER.info("[" + shutter_id + "] Stay stationary.")
                new_position = state.position
            else:
                LOGGER.info(
                    "["
                    + shutter_id
                    + "] Motor expected to move to intermediate position "
                    + str(intermediate_position)
                )
                if state.position > intermediate_position:
                    state.register_command("down")
                    time_to_wait = (
                        abs(state.position - intermediate_position)
                        / 100
                        * self.config.shutters[shutter_id]["durationDown"]
                    )
                else:
                    state.register_command("up")
                    time_to_wait = (
                        abs(state.position - intermediate_position)
                        / 100
                        * self.config.shutters[shutter_id]["durationUp"]
                    )
                # wait and set final intermediate position only if not interrupted in between
                t = threading.Thread(
                    target=self.wait_and_set_final_position,
                    args=(shutter_id, time_to_wait, intermediate_position),
                )
                t.start()
                return

        # Save computed position
        self.set_position(shutter_id, new_position)

        # Register command at the end to not impact the lastCommand timer
        state.register_command(None)

    # Push a set of buttons for a short or long press.
    def press_buttons(self, shutter_id, buttons, long_press):
        self.send_command(shutter_id, buttons, 35 if long_press else 1)

    def program(self, shutter_id):
        self.send_command(shutter_id, self.BUTTON_PROG, 1)

    def register_callback(self, callback_function):
        self.callback.append(callback_function)

    def send_command(
        self, shutter_id: str, button: int, repetition: int
    ):  # Sending a frame
        # Sending more than two repetitions after the original frame means a button kept pressed and moves the blind in steps
        # to adjust the tilt. Sending the original frame and three repetitions is the smallest adjustment, sending the original
        # frame and more repetitions moves the blinds up/down for a longer time.
        # To activate the program mode (to register or de-register additional remotes) of your Somfy blinds, long press the
        # prog button (at least thirteen times after the original frame to activate the registration.
        LOGGER.debug("send_command: Waiting for Lock")
        self.lock.acquire()
        try:
            LOGGER.debug("send_command: Lock aquired")
            checksum = 0

            teleco = int(shutter_id, 16)
            code = int(self.config.shutters[shutter_id]["code"])

            # print (codecs.encode(shutterId, 'hex_codec'))
            self.config.set_shutter_code(shutter_id, code + 1)

            LOGGER.info(
                f"Remote  :       0x{teleco:02X} ({self.config.shutters[shutter_id]['name']})"
            )
            LOGGER.info(f"Button  :       0x{button:02X}")
            LOGGER.info(f"Rolling code : {code}")
            LOGGER.info("")

            wf = create_wave_form(self.TXGPIO, teleco, button, code, repetition)

            if not (self.config.Rfm69Enabled):
                start_time = time.time()
                LOGGER.debug("Connecting to PIGPIO")
                pi = create_pigpio_connection(
                    self.config.PIGPIOHost,
                    self.config.PIGPIOPort,
                    timeout=self.config.PIGPIO_Connect_Timeout,
                )
                end_time = time.time()
                LOGGER.debug(
                    f"PIGPIO connection duration: {end_time - start_time:.3f} seconds"
                )

                if not pi.connected:
                    sys.exit(1)

                pi.wave_add_new()
                pi.set_mode(self.TXGPIO, pigpio.OUTPUT)

                pi.wave_add_generic(wf)
                wid = pi.wave_create()

                pi.wave_send_once(wid)

                while pi.wave_tx_busy():
                    sleep(0.1)

                pi.wave_delete(wid)

                pi.stop()
            else:
                with SomfyRfm69Tx(
                    self.config.Rfm69ResetGPIO,
                    self.TXGPIO,
                    spichannel=self.config.Rfm69SPIChannel,
                    pigpiohost=self.config.PIGPIOHost,
                    pigpioport=self.config.PIGPIOPort,
                    pigpio_connect_timeout=self.config.PIGPIO_Connect_Timeout,
                ) as somfy_rfm69_tx:
                    somfy_rfm69_tx.send_wave_form(wf)

        finally:
            self.lock.release()
            LOGGER.debug("send_command: Lock released")


class OperateShutters:
    def __init__(self, config: MyConfig, args: Args = None):
        # read config file
        self.config = config

        self.program_name = "operate Somfy Shutters"
        self.version = "Unknown"
        self.is_stopping = False
        self.program_complete = False

        if os.geteuid() != 0 and self.config.HTTPPort < 1024:
            LOGGER.info(
                "You are not running as sudo, you will need to ensure you have appropriate permissions for your config (i.e. ports less than 1024) or run this script as sudo"
            )

        if self.is_loaded():
            LOGGER.warning("operateShutters.py is already loaded.")
            sys.exit(1)

        self.shutter = Shutter(config=self.config)

        # atexit.register(self.Close)
        # signal.signal(signal.SIGTERM, self.Close)
        # signal.signal(signal.SIGINT, self.Close)

        self.schedule = Schedule(config=self.config)
        self.scheduler = None
        self.web_server = None
        self.pigpio_checked = False

        if args.echo == True:
            self.alexa = Alexa(kwargs={"shutter": self.shutter, "config": self.config})

        if args.mqtt == True:
            self.mqtt = MQTT(kwargs={"shutter": self.shutter, "config": self.config})

        self.process_command(args)

    # ------------------------ operateShutters::is_loaded -----------------------------
    # return true if program is already loaded
    def is_loaded(self):
        file_path = "/var/lock/" + os.path.basename(__file__).replace(".", "") + ".lock"
        global file_handle

        create_file = not os.path.exists(file_path)
        try:
            file_handle = open(file_path, "w" if create_file else "r")
            if create_file:
                # Define the new file permissions
                new_permissions = 0o644
                # Change the file permissions
                os.chmod(file_path, new_permissions)
            fcntl.flock(file_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return False
        except OSError:
            return True

    # --------------------- operateShutters::check_pigpio ------------------------------

    def check_pigpio(self):
        """Check if pigpiod is running and start it if it is not."""
        connected = False
        try:
            pi = create_pigpio_connection(
                self.config.PIGPIOHost,
                self.config.PIGPIOPort,
                timeout=self.config.PIGPIO_Connect_Timeout,
            )
            connected = pi.connected
            if connected:
                pi.stop()
        except TimeoutError:
            LOGGER.error(
                "Could not connect to pigpiod on %s:%s",
                self.config.PIGPIOHost,
                self.config.PIGPIOPort,
            )
        except Exception:
            LOGGER.exception(
                "Could not connect to pigpiod on %s:%s",
                self.config.PIGPIOHost,
                self.config.PIGPIOPort,
            )

        if connected:
            LOGGER.info(
                "Successfully connected to pigpiod on %s:%s",
                self.config.PIGPIOHost,
                self.config.PIGPIOPort,
            )
            return

        if self.config.PIGPIOHost != "localhost":
            LOGGER.warning(
                "Cannot connect to pigpiod on %s:%s, pigpiod is not running on localhost, skipping local start",
                self.config.PIGPIOHost,
                self.config.PIGPIOPort,
            )
            return

        status, process = subprocess.getstatusoutput("pidof pigpiod")
        if status:  #  it wasn't running, so start it
            if os.geteuid() == 0:
                LOGGER.info("pigpiod was not running, trying to start it")
                subprocess.getstatusoutput("sudo pigpiod -l -m")  # try to  start it
                time.sleep(0.5)
                # check it again
                status, process = subprocess.getstatusoutput("pidof pigpiod")
            else:
                LOGGER.warning(
                    "pigpiod was not running and you are not running as sudo, try to start it from a command prompt with the following command: sudo pigpiod -l -m"
                )
                return

        if not status:  # if it was started successfully (or was already running)...
            pigpiod_process = process
            LOGGER.info(
                "pigpiod has been started, process ID is {} ".format(pigpiod_process)
            )

            try:
                pi = create_pigpio_connection(
                    self.config.PIGPIOHost,
                    self.config.PIGPIOPort,
                    timeout=self.config.PIGPIO_Connect_Timeout,
                )
                if not pi.connected:
                    LOGGER.error(
                        "pigpio connection could not be established. Check logs to get more details."
                    )
                    return False
                else:
                    LOGGER.info("pigpio's connection test succesful.")
                    pi.stop()
            except Exception:
                LOGGER.exception("problem connecting to local pigpio")
        else:
            LOGGER.error("Local start of pigpiod was unsuccessful.")

    # --------------------- operateShutters::process_command -----------------------------------------------
    def process_command(self, args):
        """Process command-line arguments to control shutters or start services."""
        # Check if pigpiod is running
        if not self.pigpio_checked:
            self.check_pigpio()
            self.pigpio_checked = True

        # Validate long press option
        if args.long and not args.press:
            raise click.UsageError("The --long option requires the -press option.")
        if args.auto and args.shutter_name:
            raise click.UsageError(
                "The --auto option can not be provided with a shutter name."
            )

        # Handle shutter-specific commands
        if args.shutter_name:
            shutter_id = self.config.shutters_by_name.get(args.shutter_name)
            if not shutter_id:
                raise click.ClickException(
                    f"Shutter '{args.shutter_name}' not found in config."
                )

            if args.down:
                self.shutter.lower(shutter_id)
            elif args.up:
                self.shutter.rise(shutter_id)
            elif args.stop:
                self.shutter.stop(shutter_id)
            elif args.program:
                self.shutter.program(shutter_id)
            elif args.demo:
                self._run_demo(shutter_id)
            elif args.duskdawn:
                self._schedule_dusk_dawn(args, shutter_id, args.duskdawn)
            elif args.press:
                self._press_buttons(shutter_id, args.press, args.long)
            return  # Exit after handling shutter command

        # Handle auto mode
        if args.auto:
            self._start_auto_mode(args)
            return

        # If no valid arguments provided
        raise click.UsageError("No valid arguments passed to operateShutters")

    def _run_demo(self, shutter_id):
        """Run a demo sequence for the shutter."""
        LOGGER.info("Lowering shutter for 7 seconds")
        self.shutter.lower_partial(shutter_id, 7)
        time.sleep(7)
        LOGGER.info("Raising shutter for 7 seconds")
        self.shutter.rise_partial(shutter_id, 7)

    def _schedule_dusk_dawn(self, args, shutter_id, dusk_dawn_offsets):
        """Schedule dusk and dawn events for the shutter."""
        weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        self.schedule.add_repeat_event_by_sunrise(
            [shutter_id], "up", dusk_dawn_offsets[1], weekdays
        )
        self.schedule.add_repeat_event_by_sunset(
            [shutter_id], "down", dusk_dawn_offsets[0], weekdays
        )
        self._start_scheduler()
        self._start_optional_services(args)

    def _press_buttons(self, shutter_id, buttons, long_press):
        """Press specified buttons on the shutter."""
        button_map = {
            "up": self.shutter.BUTTON_UP,
            "down": self.shutter.BUTTON_DOWN,
            "stop": self.shutter.BUTTON_STOP,
            "my": self.shutter.BUTTON_STOP,
            "program": self.shutter.BUTTON_PROG,
        }
        combined_buttons = 0
        for btn in buttons:
            combined_buttons |= button_map[btn]
        self.shutter.press_buttons(shutter_id, combined_buttons, long_press)

    def _start_scheduler(self):
        """Initialize and start the scheduler."""
        self.scheduler = Scheduler(
            kwargs={
                "schedule": self.schedule,
                "shutter": self.shutter,
                "config": self.config,
            }
        )
        self.scheduler.daemon = True
        self.scheduler.start()

    def _start_optional_services(self, args):
        """Start optional services (Alexa, MQTT) if enabled."""
        if args.echo:
            self.alexa.daemon = True
            self.alexa.start()
        if args.mqtt:
            self.mqtt.daemon = True
            self.mqtt.start()

    def _start_auto_mode(self, args):
        """Start the system in auto mode with all services."""
        self.schedule.load_schedule_from_config()
        self._start_scheduler()
        self._start_optional_services(args)
        self.web_server = FlaskAppWrapper(
            name="WebServer",
            static_url_path=Path(__file__).parent.parent.parent / "html",
            shutter=self.shutter,
            schedule=self.schedule,
            config=self.config,
        )
        self.web_server.daemon = True
        self.web_server.start()

    # ---------------------operateShutters::Close----------------------------------------
    def close(self, signum=None, frame=None):
        # we dont really care about the errors that may be generated on shutdown
        try:
            self.is_stopping = True
        except Exception as e1:
            LOGGER.exception("Error Closing Monitor: " + str(e1))

        LOGGER.error("operateShutters Shutdown")

        try:
            self.program_complete = True
            if not self.scheduler == None:
                LOGGER.error("Stopping Scheduler. This can take up to 1 second...")
                self.scheduler.shutdown_flag.set()
                self.scheduler.join()
                LOGGER.error("Scheduler stopped. Now exiting.")
            if not self.alexa == None:
                LOGGER.error("Stopping Alexa Listener. This can take up to 1 second...")
                self.alexa.shutdown_flag.set()
                self.alexa.join()
                LOGGER.error("Alexa Listener stopped. Now exiting.")
            if not self.mqtt == None:
                LOGGER.error("Stopping MQTT Listener. This can take up to 1 second...")
                self.mqtt.shutdown_flag.set()
                self.mqtt.join()
                LOGGER.error("MQTT Listener stopped. Now exiting.")
            if not self.web_server == None:
                LOGGER.error("Stopping WebServer. This can take up to 1 second...")
                self.web_server.shutdown_server()
                LOGGER.error("WebServer stopped. Now exiting.")
            sys.exit(0)
        except:
            pass

    def loop_until_complete(self):
        while not self.program_complete:
            time.sleep(0.01)
