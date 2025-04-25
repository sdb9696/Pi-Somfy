#!/usr/bin/python3
# -*- coding: utf-8 -*-
#
##############################################################################################
#### BASED ON WORK BY : https://github.com/nassir-malik/IOT-Pi3-Alexa-Automation          ####
##############################################################################################


import sys
import time
import threading
import logging

LOGGER = logging.getLogger(__name__)

try:
    from . import fauxmo
    from .fauxmo import DebounceHandler
except Exception as e1:
    print("\n\nThis program requires the modules located from the same github repository that are not present.\n")
    print("Error: " + str(e1))
    sys.exit(2)


class DeviceHandler(DebounceHandler):
    """Publishes the on/off state requested,
       and the IP address of the Echo making the request.
    """
    def __init__(self, shutter=None, config=None):
        self.shutter = shutter
        self.config = config
        super(DeviceHandler, self).__init__()

    def act(self, client_address, state, name):
        LOGGER.info("--> State " + str(state) + " on " + name + " from client @ " + client_address)
        shutter_id = self.config.shutters_by_name[name]
        if state:
           self.shutter.lower(shutter_id)
        else:
           self.shutter.rise(shutter_id)
        return True


class Alexa(threading.Thread, DebounceHandler):

    def __init__(self, group=None, target=None, name=None, args=(), kwargs=None):
        threading.Thread.__init__(self, group=group, target=target, name="Alexa")
        self.shutdown_flag = threading.Event()

        self.args = args
        self.kwargs = kwargs
        if kwargs["shutter"] != None:
            self.shutter = kwargs["shutter"]
        if kwargs["config"] != None:
            self.config = kwargs["config"]

        # Startup the fauxmo server
        self.poller = fauxmo.Poller()
        self.upnp_responder = fauxmo.UPNPBroadcastResponder()
        self.upnp_responder.init_socket()
        self.poller.add(self.upnp_responder)

        # Register the device callback as a fauxmo handler
        dbh = DeviceHandler(shutter=self.shutter, config=self.config)
        for shutter, shutter_id in sorted(self.config.shutters_by_name.items(), key=lambda kv: kv[1]):
            port_id = 50000 + (abs(int(shutter_id,16)) % 10000)
            LOGGER.info ("Remote address in dec: " + str(int(shutter_id,16)) + ", WeMo port will be n°" + str(port_id))
            fauxmo.FauxMo(shutter, self.upnp_responder, self.poller, None, port_id, dbh)

        return

    def run(self):
        LOGGER.info("Entering fauxmo polling loop")
        error = 0
        while not self.shutdown_flag.is_set():
            # Loop and poll for incoming Echo requests
            try:
                # Allow time for a ctrl-c to stop the process
                self.poller.poll(100)
                time.sleep(0.01)
            except Exception as e:
                error += 1
                LOGGER.info("Critical exception n°" + str(error) + ": "+ str(e.args))
                print("Trying not to shut down Alexa")
                time.sleep(0.5) #Wait half a second when an exception occurs
#                if(error > 5):
#                    LOGGER.error("Sixth critical error:" + str(e.args))
#                    break

        LOGGER.error("Received Signal to shut down Alexa thread")
        return
