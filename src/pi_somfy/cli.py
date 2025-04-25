#!/usr/bin/python3
import click
import sys
from typing import Optional
import logging
import socket
import logging.config
import click
import os
import getpass
from pathlib import Path
from .operate_shutters import OperateShutters, Args
from .config import MyConfig
from logging.handlers import RotatingFileHandler

def setup_logger(log_file, level=logging.DEBUG, stream=False):
    handlers = []

    if log_file:
        file_handler = RotatingFileHandler(
            log_file,
            mode='a',
            maxBytes=50000,
            backupCount=5
        )
        handlers.append(file_handler)

    if stream:
        console_handler = logging.StreamHandler()
        handlers.append(console_handler)

    formatter = logging.Formatter('%(asctime)s : [%(levelname)s] (%(threadName)-10s) %(message)s')
    for h in handlers:
        if isinstance(h, RotatingFileHandler):
            h.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = []
    for h in handlers:
        root.addHandler(h)

    logging.getLogger(__name__).debug("Logger initialized")


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("shutter_name", required=False)
# -config option needs to preceed other config_file option or will overwite the default
@click.option("-config", "config_location", hidden=True)
@click.option(
    "-c",
    "--config",
    "config_location",
    default=f"{os.getcwd()}/config/",
    help="Config location. If folder name the filenames will be operateShutters.[toml/json]. If full name of a Config File the filenames will be fileName.[toml/json]",
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
@click.option(
    "-l",
    "--log_file",
    "log_file",
    default=None,
)
def cli(
    shutter_name: Optional[str],
    config_location: str,
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
    log_file: Optional[str],
) -> None:
    """
    Operate Somfy Shutters via command-line interface.

    This command-line tool allows control and automation of Somfy Shutters with various options
    for manual control, scheduling, and integration with external services like Alexa and MQTT.
    """
    path = Path(config_location)
    if path.is_dir():
        filename_no_ext = Path(config_location) / "operateShutters"
    else:
        filename_no_ext = path.parent / path.stem

    config = MyConfig(filename=filename_no_ext)
    result = config.load_config()
    if not result:
        click.error("Failure to load configuration parameters")    
    
    log_file = config.LogLocation + "operateShutters-" + getpass.getuser() + ".log"
    setup_logger(log_file, logging.DEBUG, config.LogToConsole)

    args = Args(
        shutter_name=shutter_name,
        up=up,
        down=down,
        stop=stop,
        program=program,
        press=press,
        long=long,
        demo=demo,
        duskdawn=duskdawn,
        auto=auto,
        echo=echo,
        mqtt=mqtt
    )
    # Start things up
    my_shutter = OperateShutters(config=config, args=args)

    try:
        my_shutter.loop_until_complete()

        my_shutter.close()

    except Exception:
        sys.exit(1)

    sys.exit(0)

if __name__ == "__main__":
    cli()
