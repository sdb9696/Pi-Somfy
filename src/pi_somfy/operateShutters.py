#!/usr/bin/python3

import sys
import re
import argparse
import fcntl
import os
import locale
import time
import datetime
import ephem
import pigpio
import socket
import signal
import atexit
import traceback
import logging
import logging.handlers
import threading
import getpass
import click
import subprocess
from typing import Optional
from pathlib import Path

try:
    from .myconfig import MyConfig
    from .mylog import SetupLogger
    from .mylog import MyLog
    from .myscheduler import Event
    from .myscheduler import Schedule
    from .myscheduler import Scheduler
    from .mywebserver import FlaskAppWrapper
    from .myalexa import Alexa
    from .mymqtt import MQTT
    from shutil import copyfile
    from .somfyRfm69Transmitter import SomfyRfm69Tx
    from .somfyRtsWaveForm import createWaveForm
    from time import sleep
except Exception as e:
    print(f"\n\nThis program requires the modules located from the same github repository that are not present.\nError: {e}")
    sys.exit(2)

class Shutter(MyLog):
    #Button values
    buttonUp = 0x2
    buttonStop = 0x1
    buttonDown = 0x4
    buttonProg = 0x8

    class ShutterState: # Definition of one shutter state
        position = None # as percentage: 0 = closed (down), 100 = open (up)
        lastCommandTime = None # get using time.monotonic()
        lastCommandDirection = None # 'up' or 'down' or None

        def __init__(self, initPosition = None):
            self.position = initPosition
            self.lastCommandTime = time.monotonic()

        def registerCommand(self, commandDirection):
            self.lastCommandDirection = commandDirection
            self.lastCommandTime = time.monotonic()

    def __init__(self, log = None, config = None):
        super().__init__()
        self.lock = threading.Lock()
        if log != None:
            self.log = log
        if config != None:
            self.config = config

        if self.config.TXGPIO != None:
            self.TXGPIO=self.config.TXGPIO # 433.42 MHz emitter
        else:
            self.TXGPIO=4 # 433.42 MHz emitter on GPIO 4

        self.callback = []
        self.shutterStateList = {}
        self.sutterStateLock = threading.Lock()

    def getShutterState(self, shutterId, initialPosition = None):
        with self.sutterStateLock:
            if shutterId not in self.shutterStateList:
                self.shutterStateList[shutterId] = self.ShutterState(initialPosition)
            return self.shutterStateList[shutterId]

    def getPosition(self, shutterId):
        state = self.getShutterState(shutterId, 0)
        return state.position

    def setPosition(self, shutterId, newPosition):
        state = self.getShutterState(shutterId)
        with self.sutterStateLock:
            state.position = newPosition
        for function in self.callback:
            function(shutterId, newPosition)

    def waitAndSetFinalPosition(self, shutterId, timeToWait, newPosition):
        state = self.getShutterState(shutterId)
        oldLastCommandTime = state.lastCommandTime

        self.LogDebug("["+self.config.Shutters[shutterId]['name']+"] Waiting for operation to complete for " + str(timeToWait) + " seconds")
        time.sleep(timeToWait)

        # Only set new position if registerCommand has not been called in between
        if state.lastCommandTime == oldLastCommandTime:
            self.LogDebug("["+self.config.Shutters[shutterId]['name']+"] Set new final position: " + str(newPosition))
            self.setPosition(shutterId, newPosition)
        else:
            self.LogDebug("["+self.config.Shutters[shutterId]['name']+"] Discard final position. Position is now: " + str(state.position))

    def lower(self, shutterId):
        state = self.getShutterState(shutterId, 100)

        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Going down")
        self.sendCommand(shutterId, self.buttonDown, self.config.SendRepeat)
        state.registerCommand('down')

        # wait and set final position only if not interrupted in between
        timeToWait = state.position/100*self.config.Shutters[shutterId]['durationDown']
        t = threading.Thread(target = self.waitAndSetFinalPosition, args = (shutterId, timeToWait, 0))
        t.start()

    def lowerPartial(self, shutterId, percentage):
        state = self.getShutterState(shutterId, 100)

        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Going down") 
        self.sendCommand(shutterId, self.buttonDown, self.config.SendRepeat)
        state.registerCommand('down')
        time.sleep((state.position-percentage)/100*self.config.Shutters[shutterId]['durationDown'])
        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Stop at partial position requested")
        self.sendCommand(shutterId, self.buttonStop, self.config.SendRepeat)

        self.setPosition(shutterId, percentage)

    def rise(self, shutterId):
        state = self.getShutterState(shutterId, 0)

        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Going up")
        self.sendCommand(shutterId, self.buttonUp, self.config.SendRepeat)
        state.registerCommand('up')

        # wait and set final position only if not interrupted in between
        timeToWait = (100-state.position)/100*self.config.Shutters[shutterId]['durationUp']
        t = threading.Thread(target = self.waitAndSetFinalPosition, args = (shutterId, timeToWait, 100))
        t.start()

    def risePartial(self, shutterId, percentage):
        state = self.getShutterState(shutterId, 0)

        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Going up")
        self.sendCommand(shutterId, self.buttonUp, self.config.SendRepeat)
        state.registerCommand('up')
        time.sleep((percentage-state.position)/100*self.config.Shutters[shutterId]['durationUp'])
        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Stop at partial position requested")
        self.sendCommand(shutterId, self.buttonStop, self.config.SendRepeat)

        self.setPosition(shutterId, percentage)

    def stop(self, shutterId):
        state = self.getShutterState(shutterId, 50)

        self.LogInfo("["+self.config.Shutters[shutterId]['name']+"] Stopping")
        self.sendCommand(shutterId, self.buttonStop, self.config.SendRepeat)

        self.LogDebug("["+shutterId+"] Previous position: " + str(state.position))
        secondsSinceLastCommand = int(round(time.monotonic() - state.lastCommandTime))
        self.LogDebug("["+shutterId+"] Seconds since last command: " + str(secondsSinceLastCommand))

        # Compute position based on time elapsed since last command & command direction
        setupDurationDown = self.config.Shutters[shutterId]['durationDown']
        setupDurationUp = self.config.Shutters[shutterId]['durationUp']

        fallback = False
        if state.lastCommandDirection == 'up':
            if secondsSinceLastCommand > 0 and secondsSinceLastCommand < setupDurationUp:
                durationPercentage = int(round(secondsSinceLastCommand/setupDurationUp * 100))
                self.LogDebug("["+shutterId+"] Up duration percentage: " + str(durationPercentage) + ", State position: "+ str(state.position))
                if state.position > 0: # after rise from previous position
                    newPosition = min (100 , state.position + durationPercentage)
                else: # after rise from fully closed
                    newPosition = durationPercentage
            else:  #fallback
                self.LogWarn("["+shutterId+"] Too much time since up command.")
                fallback = True
        elif state.lastCommandDirection == 'down':
            if secondsSinceLastCommand > 0 and secondsSinceLastCommand < setupDurationDown:
                durationPercentage = int(round(secondsSinceLastCommand/setupDurationDown * 100))
                self.LogDebug("["+shutterId+"] Down duration percentage: " + str(durationPercentage) + ", State position: "+ str(state.position))
                if state.position < 100: # after lower from previous position
                    newPosition = max (0 , state.position - durationPercentage)
                else: # after down from fully opened
                    newPosition = 100 - durationPercentage
            else:  #fallback
                self.LogWarn("["+shutterId+"] Too much time since down command.")
                fallback = True
        else: # consecutive stops
            self.LogWarn("["+shutterId+"] Stop pressed while stationary.")
            fallback = True

        if fallback == True: # Let's assume it will end on the intermediate position ! If it exists !
            intermediatePosition = self.config.Shutters[shutterId]['intermediatePosition']
            if (intermediatePosition == None) or (intermediatePosition == state.position):
                self.LogInfo("["+shutterId+"] Stay stationary.")
                newPosition = state.position
            else:
                self.LogInfo("["+shutterId+"] Motor expected to move to intermediate position "+str(intermediatePosition))
                if state.position > intermediatePosition:
                    state.registerCommand('down')
                    timeToWait = abs(state.position - intermediatePosition) / 100*self.config.Shutters[shutterId]['durationDown']
                else:
                    state.registerCommand('up')
                    timeToWait = abs(state.position - intermediatePosition) / 100*self.config.Shutters[shutterId]['durationUp']
                # wait and set final intermediate position only if not interrupted in between
                t = threading.Thread(target = self.waitAndSetFinalPosition, args = (shutterId, timeToWait, intermediatePosition))
                t.start()
                return

        # Save computed position
        self.setPosition(shutterId, newPosition)

        # Register command at the end to not impact the lastCommand timer
        state.registerCommand(None)

    # Push a set of buttons for a short or long press.
    def pressButtons(self, shutterId, buttons, longPress):
        self.sendCommand(shutterId, buttons, 35 if longPress else 1)

    def program(self, shutterId):
        self.sendCommand(shutterId, self.buttonProg, 1)

    def registerCallBack(self, callbackFunction):
        self.callback.append(callbackFunction)

    def sendCommand(self, shutterId: str, button: int, repetition: int): #Sending a frame
    # Sending more than two repetitions after the original frame means a button kept pressed and moves the blind in steps 
    # to adjust the tilt. Sending the original frame and three repetitions is the smallest adjustment, sending the original
    # frame and more repetitions moves the blinds up/down for a longer time.
    # To activate the program mode (to register or de-register additional remotes) of your Somfy blinds, long press the 
    # prog button (at least thirteen times after the original frame to activate the registration.
        self.LogDebug("sendCommand: Waiting for Lock")
        self.lock.acquire()
        try:
            
            self.LogDebug("sendCommand: Lock aquired")
            checksum = 0

            teleco = int(shutterId, 16)
            code = int(self.config.Shutters[shutterId]['code'])

            # print (codecs.encode(shutterId, 'hex_codec'))
            self.config.setCode(shutterId, code+1)

            self.LogInfo(f"Remote  :       0x{teleco:02X} ({self.config.Shutters[shutterId]['name']})")
            self.LogInfo(f"Button  :       0x{button:02X}")
            self.LogInfo(f"Rolling code : {code}")
            self.LogInfo("")

            wf = createWaveForm(self.TXGPIO, teleco, button, code, repetition, self.log)

            if not (self.config.Rfm69Enabled):

                pi = pigpio.pi(host=self.config.PIGPIOHost, port=self.config.PIGPIOPort) 

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
                with SomfyRfm69Tx(self.config.Rfm69ResetGPIO, self.TXGPIO, spichannel=self.config.Rfm69SPIChannel, pigpiohost=self.config.PIGPIOHost, pigpioport=self.config.PIGPIOPort) as s69Tx:

                    s69Tx.sendWaveForm(wf)


        finally:
            self.lock.release()
            self.LogDebug("sendCommand: Lock released")

    


class operateShutters(MyLog):

    def __init__(self, args = None):
        super().__init__()
        self.ProgramName = "operate Somfy Shutters"
        self.Version = "Unknown"
        self.log = None
        self.IsStopping = False
        self.ProgramComplete = False

        if args.ConfigFile == None:
            self.ConfigFile = "/etc/operateShutters.conf"
        else:
            self.ConfigFile = args.ConfigFile

        self.console = SetupLogger("shutters_console", log_file = "", stream = True)

        if os.geteuid() != 0:
            self.LogConsole("You are not running as sudo, you will need to ensure you have appropriate permissions for your config (i.e. ports less than 1024) or run this script as sudo")

        if not os.path.isfile(self.ConfigFile):
            self.LogConsole("Creating new config file : " + self.ConfigFile)
            defaultConfigFile = os.path.dirname(os.path.realpath(__file__))+'/config/defaultConfig.conf'
            print(defaultConfigFile);
            if not os.path.isfile(defaultConfigFile):
                self.LogConsole("Failure to create new config file: "+defaultConfigFile)
                sys.exit(1)
            else: 
                copyfile(defaultConfigFile, self.ConfigFile)

        # read config file
        self.config = MyConfig(filename = self.ConfigFile, log = self.console)
        result = self.config.LoadConfig();
        if not result:
            self.LogConsole("Failure to load configuration parameters")
            sys.exit(1)


        # log errors in this module to a file
        self.log = SetupLogger("shutters", self.config.LogLocation + "operateShutters-" + getpass.getuser() + ".log", stream=self.config.LogToConsole)
        self.config.log = self.log

        if self.IsLoaded():
            self.LogWarn("operateShutters.py is already loaded.")
            sys.exit(1)

        if self.config.PIGPIOHost == "localhost" and not self.startPIGPIO():
            self.LogConsole("Not able to start PIGPIO")
            sys.exit(1)

        self.shutter = Shutter(log = self.log, config = self.config)

        # atexit.register(self.Close)
        # signal.signal(signal.SIGTERM, self.Close)
        # signal.signal(signal.SIGINT, self.Close)

        self.schedule = Schedule(log = self.log, config = self.config)
        self.scheduler = None
        self.webServer = None

        if (args.echo == True):
            self.alexa = Alexa(kwargs={'log':self.log, 'shutter': self.shutter, 'config': self.config})

        if (args.mqtt == True):
            self.mqtt = MQTT(kwargs={'log':self.log, 'shutter': self.shutter, 'config': self.config})

        self.ProcessCommand(args);

    #------------------------ operateShutters::IsLoaded -----------------------------
    #return true if program is already loaded
    def IsLoaded(self):

        file_path = '/var/lock/'+os.path.basename(__file__).replace('.','') + ".lock"
        global file_handle

        create_file = not os.path.exists(file_path)
        try:
            file_handle = open(file_path, 'w' if create_file else 'r')
            if create_file:
                # Define the new file permissions
                new_permissions = 0o644
                # Change the file permissions
                os.chmod(file_path, new_permissions)
            fcntl.flock(file_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return False
        except OSError as err:
            return True

    #--------------------- operateShutters::startPIGPIO ------------------------------

    def startPIGPIO(self):
        
        status, process = subprocess.getstatusoutput('pidof pigpiod')
        if status:  #  it wasn't running, so start it
            
            if os.geteuid() == 0:
                self.LogInfo ("pigpiod was not running, trying to start it")
                subprocess.getstatusoutput('sudo pigpiod -l -m')  # try to  start it
                time.sleep(0.5)
                # check it again
                status, process = subprocess.getstatusoutput('pidof pigpiod')
            else:
                self.LogInfo ("pigpiod was not running and you are not running as sudo, try to start it from a command prompt with the following command: sudo pigpiod -l -m")
                return True

        if not status:  # if it was started successfully (or was already running)...
            pigpiod_process = process
            self.LogInfo ("pigpiod is running, process ID is {} ".format(pigpiod_process))

            try:
                pi = pigpio.pi()  # local GPIO only
                if not pi.connected:
                    self.LogError("pigpio connection could not be established. Check logs to get more details.")
                    return False
                else:
                    self.LogInfo("pigpio's pi instantiated.")
            except Exception as e:
                start_pigpiod_exception = str(e)
                self.LogError("problem instantiating pi: {}".format(start_pigpiod_exception))
        else:
            self.LogError("start pigpiod was unsuccessful.")
            return False
        return True

    #--------------------- operateShutters::ProcessCommand -----------------------------------------------
    def ProcessCommand(self, args):
        """Process command-line arguments to control shutters or start services."""
        # Validate long press option
        if args.long and not args.press:
            raise click.UsageError("The --long option requires the -press option.")
        if args.auto and args.shutterName:
            raise click.UsageError("The --auto option can not be provided with a shutter name.")        

        # Handle shutter-specific commands
        if args.shutterName:
            shutter_id = self.config.ShuttersByName.get(args.shutterName)
            if not shutter_id:
                raise click.ClickException(f"Shutter '{args.shutterName}' not found in config.")

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
                self._schedule_dusk_dawn(args,shutter_id, args.duskdawn)
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
        self.LogInfo("Lowering shutter for 7 seconds")
        self.shutter.lowerPartial(shutter_id, 7)
        time.sleep(7)
        self.LogInfo("Raising shutter for 7 seconds")
        self.shutter.risePartial(shutter_id, 7)

    def _schedule_dusk_dawn(self, args, shutter_id, dusk_dawn_offsets):
        """Schedule dusk and dawn events for the shutter."""
        weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        self.schedule.addRepeatEventBySunrise([shutter_id], 'up', dusk_dawn_offsets[1], weekdays)
        self.schedule.addRepeatEventBySunset([shutter_id], 'down', dusk_dawn_offsets[0], weekdays)
        self._start_scheduler()
        self._start_optional_services(args)

    def _press_buttons(self, shutter_id, buttons, long_press):
        """Press specified buttons on the shutter."""
        button_map = {
            'up': self.shutter.buttonUp,
            'down': self.shutter.buttonDown,
            'stop': self.shutter.buttonStop,
            'my': self.shutter.buttonStop,
            'program': self.shutter.buttonProg
        }
        combined_buttons = 0
        for btn in buttons:
            combined_buttons |= button_map[btn]
        self.shutter.pressButtons(shutter_id, combined_buttons, long_press)

    def _start_scheduler(self):
        """Initialize and start the scheduler."""
        self.scheduler = Scheduler(kwargs={
            'log': self.log,
            'schedule': self.schedule,
            'shutter': self.shutter,
            'config': self.config
        })
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
        self.schedule.loadScheudleFromConfig()
        self._start_scheduler()
        self._start_optional_services(args)
        self.webServer = FlaskAppWrapper(
            name='WebServer',
            static_url_path=Path(__file__).parent.parent.parent / 'html',
            log=self.log,
            shutter=self.shutter,
            schedule=self.schedule,
            config=self.config
        )
        self.webServer.daemon = True
        self.webServer.start()


    #---------------------operateShutters::Close----------------------------------------
    def Close(self, signum = None, frame = None):

        # we dont really care about the errors that may be generated on shutdown
        try:
            self.IsStopping = True
        except Exception as e1:
            self.LogErrorLine("Error Closing Monitor: " + str(e1))

        self.LogError("operateShutters Shutdown")

        try:
            self.ProgramComplete = True
            if (not self.scheduler == None):
                self.LogError("Stopping Scheduler. This can take up to 1 second...")
                self.scheduler.shutdown_flag.set()
                self.scheduler.join()
                self.LogError("Scheduler stopped. Now exiting.")
            if (not self.alexa == None):
                self.LogError("Stopping Alexa Listener. This can take up to 1 second...")
                self.alexa.shutdown_flag.set()
                self.alexa.join()
                self.LogError("Alexa Listener stopped. Now exiting.")
            if (not self.mqtt == None):
                self.LogError("Stopping MQTT Listener. This can take up to 1 second...")
                self.mqtt.shutdown_flag.set()
                self.mqtt.join()
                self.LogError("MQTT Listener stopped. Now exiting.")
            if (not self.webServer == None):
                self.LogError("Stopping WebServer. This can take up to 1 second...")
                self.webServer.shutdown_server()
                self.LogError("WebServer stopped. Now exiting.")
            sys.exit(0)
        except:
            pass

    def LoopUntilComplete(self):
        while not self.ProgramComplete:
            time.sleep(0.01)

#------------------- Command-line interface for monitor ------------------------

@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("shutter_name", required=False)
# -config option needs to preceed other config_file option or will overwite the default
@click.option("-config", "config_file", hidden=True)
@click.option(
    "-c",
    "--config",
    "config_file",
    default=f"{os.getcwd()}/config/operateShutters.conf",
    help="Name of the Config File (incl full Path)",
    type=click.Path(exists=True),
)
@click.option("-u", "--up", is_flag=True, help="Raise the Shutter")
@click.option("-up", hidden=True, is_flag=True)
@click.option("-d", "--down", is_flag=True, help="Lower the Shutter")
@click.option("-down", hidden=True, is_flag=True)
@click.option("-s", "--stop", is_flag=True, help="Stop the Shutter")
@click.option("-stop", hidden=True, is_flag=True)
@click.option("-p", "--program", is_flag=True, help="Program a new Shutter")
@click.option("-program", hidden=True, is_flag=True)
@click.option(
    "--press",
    multiple=True,
    type=str,
    help="Simulate a press of the specified remote buttons ('up', 'down', 'stop'/'my', and 'program'). "
    "You can specify multiple buttons to activate setup operations. "
    "This does not update the known state of the blinds, so should not be used for ordinary raise and lower operations.",
)
@click.option("-press", hidden=True, multiple=True, type=str)
@click.option(
    "--long",
    is_flag=True,
    help="When used with the --press option, simulates a long press, instead of a short press.",
)
@click.option("-long", hidden=True, is_flag=True)
@click.option(
    "--demo",
    is_flag=True,
    help="Lower the Shutter, Stop after 7 seconds, then raise the Shutter",
)
@click.option("-demo", hidden=True, is_flag=True)
@click.option(
    "--duskdawn",
    "-dd",
    nargs=2,
    type=int,
    help="Automatically lower the shutter at sunset and rise the shutter at sunrise, "
    "provide the evening delay and morning delay in minutes each",
)
@click.option("-duskdawn", hidden=True, nargs=2, type=int)
@click.option(
    "-a",
    "--auto",
    is_flag=True,
    help=f"Run schedule based on config. Also will start up the web-server which can be used to setup the schedule. "
    f"Try: https://{socket.gethostname()}",
)
@click.option("-auto", hidden=True, is_flag=True)
@click.option("-e", "--echo", is_flag=True, help="Enable Amazon Alexa (Echo) integration")
@click.option("-echo", hidden=True, is_flag=True)
@click.option("-m", "--mqtt", is_flag=True, help="Enable MQTT integration")
@click.option("-mqtt", hidden=True, is_flag=True)
def main(
    shutter_name: Optional[str],
    config_file: str,
    up: bool,
    down: bool,
    stop: bool,
    program: bool,
    press: tuple[str, ...],
    long: bool,
    demo: bool,
    duskdawn: Optional[tuple[int, int]],
    auto: bool,
    echo: bool,
    mqtt: bool,
) -> None:
    """
    Operate Somfy Shutters via command-line interface.

    This command-line tool allows control and automation of Somfy Shutters with various options
    for manual control, scheduling, and integration with external services like Alexa and MQTT.
    """
    # Create a simple args object to mimic argparse's behavior
    class Args:
        def __init__(self):
            self.shutterName = shutter_name
            self.ConfigFile = config_file
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

    # Start things up
    my_shutter = operateShutters(args=Args())

    try:
        my_shutter.LoopUntilComplete()

        my_shutter.Close();

    except Exception:
        sys.exit(1)
    
    sys.exit(0)

if __name__ == "__main__":
    main()
