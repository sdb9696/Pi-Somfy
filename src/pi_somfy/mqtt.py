#!/usr/bin/python3
# -*- coding: utf-8 -*-
#

import sys
import time
import threading
import json
import logging
from copy import deepcopy

LOGGER = logging.getLogger(__name__)

try:
    # pip3 install paho-mqtt
    import paho.mqtt.client as paho
except Exception as e1:
    print(
        "\n\nThis program requires the modules located from the same github repository that are not present.\n"
    )
    print("Error: " + str(e1))
    sys.exit(2)


class DiscoveryMsg:
    DISCOVERY_MSG = {
        "name": "",
        "command_topic": "somfy/%s/level/cmd",
        "position_topic": "somfy/%s/level/set_state",
        "set_position_topic": "somfy/%s/level/cmd",
        "payload_open": "100",
        "payload_close": "0",
        "state_open": "100",
        "state_closed": "0",
        "unique_id": "",
        "device": {
            "name": "",
            "model": "Pi-Somfy controlled shutter",
            "manufacturer": "Nickduino",
            "identifiers": "",
        },
    }

    def __init__(self, shutter, shutter_id):
        self.discovery_msg = deepcopy(DiscoveryMsg.DISCOVERY_MSG)
        self.discovery_msg["name"] = shutter
        self.discovery_msg["command_topic"] = (
            DiscoveryMsg.DISCOVERY_MSG["command_topic"] % shutter_id
        )
        self.discovery_msg["position_topic"] = (
            DiscoveryMsg.DISCOVERY_MSG["position_topic"] % shutter_id
        )
        self.discovery_msg["set_position_topic"] = (
            DiscoveryMsg.DISCOVERY_MSG["set_position_topic"] % shutter_id
        )
        self.discovery_msg["unique_id"] = shutter_id
        self.discovery_msg["device"]["name"] = (
            "Somfy " + shutter.replace("_", " ").title()
        )
        self.discovery_msg["device"]["identifiers"] = shutter_id

    def __str__(self):
        return json.dumps(self.discovery_msg)


class MQTT(threading.Thread):
    connected_flag = False

    def __init__(self, group=None, target=None, name=None, args=(), kwargs=None):
        threading.Thread.__init__(self, group=group, target=target, name="MQTT")
        self.shutdown_flag = threading.Event()

        self.t = ()
        self.args = args
        self.kwargs = kwargs
        if kwargs["shutter"] != None:
            self.shutter = kwargs["shutter"]
        if kwargs["config"] != None:
            self.config = kwargs["config"]

        return

    def receive_message_from_mqtt(self, client, userdata, message):
        LOGGER.info("starting receive_message_from_mqtt")
        try:
            msg = str(message.payload.decode("utf-8"))
            topic = message.topic
            LOGGER.info("message received from MQTT: " + topic + " = " + msg)

            [prefix, shutter_id, property, command] = topic.split("/")
            if command == "cmd":
                LOGGER.info("sending message: " + str(msg))
                if msg == "STOP":
                    self.shutter.stop(shutter_id)
                elif int(msg) == 0:
                    self.shutter.lower(shutter_id)
                elif int(msg) == 100:
                    self.shutter.rise(shutter_id)
                elif (int(msg) > 0) and (int(msg) < 100):
                    current_position = self.shutter.get_position(shutter_id)
                    if int(msg) > current_position:
                        self.shutter.rise_partial(shutter_id, int(msg))
                    elif int(msg) < current_position:
                        self.shutter.lower_partial(shutter_id, int(msg))
            else:
                LOGGER.error("received unkown message: " + topic + ", message: " + msg)

        except Exception as e1:
            LOGGER.error("Exception Occured: " + str(e1))

        LOGGER.info("finishing receive_message_from_mqtt")

    def send_mqtt(self, topic, msg):
        LOGGER.info("sending message to MQTT: " + topic + " = " + msg)
        self.t.publish(topic, msg, retain=True)

    def send_startup_info(self):
        for shutter, shutter_id in sorted(
            self.config.shutters_by_name.items(), key=lambda kv: kv[1]
        ):
            self.send_mqtt(
                "homeassistant/cover/" + shutter_id + "/config",
                str(DiscoveryMsg(shutter, shutter_id)),
            )

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            LOGGER.info("Connected to MQTT with result code " + str(rc))
            self.connected_flag = True
            for shutter, shutter_id in sorted(
                self.config.shutters_by_name.items(), key=lambda kv: kv[1]
            ):
                LOGGER.info("Subscribe to shutter: " + shutter)
                self.t.subscribe("somfy/" + shutter_id + "/level/cmd")
            if self.config.EnableDiscovery == True:
                LOGGER.info("Sending Home Assistant MQTT Discovery messages")
                self.send_startup_info()
        else:
            print("Bad connection Returned code= ", rc)
            self.connected_flag = False

    def on_disconnect(self, client, userdata, rc=0):
        self.connected_flag = False
        if rc != 0:
            LOGGER.info("Disconnected from MQTT Server. result code: " + str(rc))
            # while not self.connected_flag: #wait in loop
            #    LOGGER.info("Waiting 30sec for reconnect")
            #    time.sleep(30)
            #    self.t.connect(self.config.MQTT_Server,self.config.MQTT_Port)

    def set_state(self, shutter_id, level):
        LOGGER.info(
            "Received request to set Shutter " + shutter_id + " to " + str(level)
        )
        self.send_mqtt("somfy/" + shutter_id + "/level/set_state", str(level))

    def run(self):
        self.connected_flag = False
        LOGGER.info("Entering MQTT polling loop")

        # Setup the mqtt client
        self.t = paho.Client(client_id=self.config.MQTT_ClientID)
        if not (self.config.MQTT_Password.strip() == ""):
            self.t.username_pw_set(
                username=self.config.MQTT_User, password=self.config.MQTT_Password
            )
        self.t.on_connect = self.on_connect
        self.t.on_message = self.receive_message_from_mqtt
        self.t.on_disconnect = self.on_disconnect
        self.shutter.register_callback(self.set_state)

        # Startup the mqtt listener
        error_failure_count = 5
        error = 0
        while not self.shutdown_flag.is_set():
            # Loop until the server is available
            try:
                LOGGER.info("Connecting to MQTT server")
                self.t.connect(self.config.MQTT_Server, self.config.MQTT_Port)
                time.sleep(10)
                break
            except Exception as e:
                error += 1
                if error == 1:
                    LOGGER.info(
                        "Exception in MQTT connect, will retry "
                        + str(error_failure_count)
                        + " times, "
                        + str(error)
                        + ": "
                        + str(e.args)
                    )
                if error >= error_failure_count:
                    LOGGER.error(
                        f"MQTT connect error count exceeded failure threshold of {error_failure_count}.  MQQT functionality will not be active.  Have you installed mosquitto?"
                    )
                    return
                time.sleep(2)

        error = 0
        while not self.shutdown_flag.is_set():
            # Loop and poll for incoming requests
            try:
                # NOTE: Timeout value must be smaller than MQTT keep_alive (which is 60s by default)
                self.t.loop(timeout=30)
                # self.t.loop_start()
                if self.connected_flag == False:
                    LOGGER.info("Re-Connecting to MQTT server")
                    self.t.connect(self.config.MQTT_Server, self.config.MQTT_Port)
                    time.sleep(10)
            except Exception as e:
                error += 1
                LOGGER.info(
                    "Critical MQTT exception " + str(error) + ": " + str(e.args)
                )
                if error >= error_failure_count:
                    LOGGER.error(
                        f"MQTT connect error count exceeded failure threshold of {error_failure_count}.  MQQT functionality will not be active."
                    )
                    return
                time.sleep(0.5)  # Wait half a second when an exception occurs

        LOGGER.error("Received Signal to shut down MQTT thread")
        return
