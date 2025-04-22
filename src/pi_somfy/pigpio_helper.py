import pigpio
import threading
import os
import logging

LOGGER = logging.getLogger(__name__)

def create_pigpio_connection(
        pigpiohost = os.getenv("PIGPIO_ADDR", 'localhost'),
        pigpioport = os.getenv("PIGPIO_PORT", 8888),
        show_errors = True,
        *,
        timeout=None
    ):

    if timeout is None:
        return pigpio.pi(pigpiohost, pigpioport, show_errors)

    class CreatePiThread(threading.Thread):
        def __init__(self):
            super().__init__()
            self.pi = None
    
        def run(self):
            try:
                self.pi = pigpio.pi(pigpiohost, pigpioport, False)
            except Exception as e:
                print(f"Error creating pigpio connection: {e}")
            
    pi_thread = CreatePiThread()
    pi_thread.start()
    pi_thread.join(timeout)
    
    if pi_thread.is_alive():
        pi_thread.join(0)  # Force termination if still running
        raise TimeoutError(f"Connection to pigpiod at {pigpiohost}:{pigpioport} timed out after {timeout} seconds.")
    
    return pi_thread.pi

