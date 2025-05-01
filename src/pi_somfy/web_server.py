#!/usr/bin/python3
import logging
import threading
import re
from .config import MyConfig

try:
    from flask import Flask, request, Response, json
except Exception as e1:
    print(
        "\n\nThis program requires the Flask library. Please see the project documentation at https://github.com/Nickduino/Pi-Somfy.\n"
    )
    print("Error: " + str(e1))
    sys.exit(2)

import sys
import os
import atexit
import traceback

LOGGER = logging.getLogger(__name__)


def camel_to_snake(name):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


class EndpointAction:
    def __init__(self, action):
        self.action = action
        self.response = Response(status=200, headers={})

    def __call__(self, *args, **kwargs):
        if (len(args) > 0) or (len(kwargs) > 0):
            self.response = self.action(args, kwargs)
        else:
            self.response = self.action()
        return self.response


class FlaskAppWrapper(threading.Thread):
    app = None
    CriticalLock = None

    def __init__(
        self,
        name=__name__,
        static_url_path="",
        shutter=None,
        schedule=None,
        config: MyConfig = None,
    ):
        threading.Thread.__init__(self, name="Web Server")

        logging.getLogger("werkzeug").setLevel(logging.ERROR)

        self.shutter = shutter
        self.schedule = schedule
        self.config = config

        self.app = Flask(
            import_name=name, static_url_path="", static_folder=static_url_path
        )
        self.app.after_request(self.add_header)
        self.add_endpoint(endpoint="/", endpoint_name="main", handler=self.request_main)
        self.add_endpoint(
            endpoint="/shutdown", endpoint_name="shutdown", handler=self.shutdown_server
        )
        self.add_endpoint(
            endpoint="/cmd/<command>",
            endpoint_name="cmd",
            handler=self.process_command,
            methods=["GET", "POST"],
        )

    def isfloat(self, value):
        try:
            float(value)
            return True
        except ValueError:
            return False

    def add_header(self, r):
        r.headers["Cache-Control"] = (
            "no-cache, no-store, must-revalidate, public, max-age=0"
        )
        r.headers["Pragma"] = "no-cache"
        r.headers["Expires"] = "0"

        return r

    def add_endpoint(
        self, endpoint=None, endpoint_name=None, handler=None, methods=["GET"]
    ):
        self.app.add_url_rule(
            endpoint, endpoint_name, EndpointAction(handler), methods=methods
        )

    def request_main(self):
        if not self.validate_password(header=False):
            return self.app.send_static_file("error.html")
        LOGGER.debug(request.url)
        return self.app.send_static_file("index.html")

    def process_command(self, *args, **kwargs):
        LOGGER.debug(
            request.url
            + " ( "
            + request.method
            + " ): "
            + str(args)
            + " | "
            + str(kwargs)
        )
        try:
            # LOGGER.debug(request.values.get('sitename', 0, type=str))
            # LOGGER.debug("JSON: "+str(request.get_json()))
            # LOGGER.debug("RAW: "+str(request.get_data()))
            command = args[1]["command"]
            if command in [
                "up",
                "down",
                "stop",
                "program",
                "press",
                "getConfig",
                "addSchedule",
                "editSchedule",
                "deleteSchedule",
                "addShutter",
                "editShutter",
                "deleteShutter",
            ]:
                LOGGER.info(
                    'processing Command "'
                    + command
                    + '" with parameters: '
                    + str(request.values)
                )
                snake_command = camel_to_snake(command)
                result = getattr(self, snake_command)(request.values)
                return Response(json.dumps(result), status=200)
            elif command in [
                "setLocation",
                "setWebSettings",
                "setMqttSettings",
                "setRadioSettings",
            ]:
                LOGGER.info(
                    'processing Command "'
                    + command
                    + '" with parameters: '
                    + str(request.json)
                )
                snake_command = camel_to_snake(command)
                result = getattr(self, snake_command)(request.json)
                return Response(json.dumps(result), status=200)
            else:
                LOGGER.warning("UNKNOWN COMMAND " + command)
                return Response("Error: Unknown Command: " + command, status=400)
        except Exception as e1:
            tb = traceback.format_exc()
            LOGGER.exception("Error in Process Command: " + command + ": " + str(e1))
            LOGGER.error(tb)
            return Response("Error: Exception occured", status=400)

    def validate_password(self, header=True):
        # If no password configured, it's OK
        if self.config.password == "":
            return True

        if header:
            # Support password from 'Password' header
            password = request.headers.get("Password")
        else:
            # Support password from 'Password' url param
            password = request.args.get("Password")

        if password != self.config.password:
            LOGGER.debug("received invalid password")
            LOGGER.debug(password)
            return False
        return True

    def shutdown_server(self):
        func = request.environ.get("werkzeug.server.shutdown")
        if func is None:
            raise RuntimeError("Not running with the Werkzeug Server")
        func()
        return Response("Shutting Down", status=400)

    def up(self, params):
        if not self.validate_password():
            return {"status": "ERROR"}
        shutter = params.get("shutter", 0, type=str)
        LOGGER.debug('rise shutter "' + shutter + '"')
        if shutter not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        self.shutter.rise(shutter)
        return {"status": "OK"}

    def down(self, params):
        if not self.validate_password():
            return {"status": "ERROR"}
        shutter = params.get("shutter", 0, type=str)
        LOGGER.debug('lower shutter "' + shutter + '"')
        if shutter not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        self.shutter.lower(shutter)
        return {"status": "OK"}

    def stop(self, params):
        if not self.validate_password():
            return {"status": "ERROR"}
        shutter = params.get("shutter", 0, type=str)
        LOGGER.debug('stop shutter "' + shutter + '"')
        if shutter not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        self.shutter.stop(shutter)
        return {"status": "OK"}

    def program(self, params):
        shutter = params.get("shutter", 0, type=str)
        LOGGER.debug('program shutter "' + shutter + '"')
        if shutter not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        self.shutter.program(shutter)
        return {"status": "OK"}

    def press(self, params):
        shutter = params.get("shutter", 0, type=str)
        buttons = params.get("buttons", 0, type=int)
        long_press = params.get("longPress", 0, type=str) == "true"
        LOGGER.debug(
            ("long" if long_press else "short")
            + ' press buttons: "'
            + str(buttons)
            + '" shutter "'
            + shutter
            + '"'
        )
        if shutter not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        self.shutter.press_buttons(shutter, buttons, long_press)
        return {"status": "OK"}

    def set_location(self, json_data):
        LOGGER.debug(f"set Location: {json_data['lat']} / {json_data['lng']}")
        self.config.set_location(json_data["lat"], json_data["lng"])
        self.schedule.set_update_time()
        return {"status": "OK"}

    def set_web_settings(self, json_data):
        if not self.validate_password():
            return {"status": "ERROR", "message": "Invalid password"}

        http_port = json_data["httpPort"]
        https_port = json_data["httpsPort"]
        use_https = json_data["useHttps"]
        password = json_data["password"]

        LOGGER.debug(
            f"Setting web settings: HTTP Port={http_port}, HTTPS Port={https_port}, Use HTTPS={use_https}, Password=*****"
        )
        self.config.set_web(http_port, https_port, use_https, password)
        return {"status": "OK"}

    def set_mqtt_settings(self, json_data):
        if not self.validate_password():
            return {"status": "ERROR", "message": "Invalid password"}

        server = json_data["server"]
        port = json_data["port"]
        user = json_data["user"]
        password = json_data["password"]
        client_id = json_data["clientId"]
        enable_discovery = json_data["enableDiscovery"]

        LOGGER.debug(
            f"Setting MQTT settings: Server={server}, Port={port}, User={user}, Password=*****, Client ID={client_id}, Enable Discovery={enable_discovery}"
        )
        self.config.set_mq(server, port, user, password, client_id, enable_discovery)
        return {"status": "OK"}

    def set_radio_settings(self, json_data):
        if not self.validate_password():
            return {"status": "ERROR", "message": "Invalid password"}

        tx_gpio = json_data["txGpio"]
        rts_address = json_data["rtsAddress"]
        send_repeat = json_data["sendRepeat"]
        rfm69_enabled = json_data["rfm69Enabled"]
        rfm69_reset_gpio = json_data["rfm69ResetGpio"]
        rfm69_spi_channel = json_data["rfm69SpiChannel"]
        pigpio_host = json_data["pigpioHost"]
        pigpio_port = json_data["pigpioPort"]

        LOGGER.debug(
            "Setting radio settings: TX GPIO=%s, RTS Address=%s, "
            "Send Repeat=%s, RFM69 Enabled=%s, RFM69 Reset GPIO=%s, "
            "RFM69 SPI Channel=%s, Pigpio Host=%s, Pigpio Port=%s",
            tx_gpio,
            rts_address,
            send_repeat,
            rfm69_enabled,
            rfm69_reset_gpio,
            rfm69_spi_channel,
            pigpio_host,
            pigpio_port,
        )
        self.config.set_radio(
            tx_gpio,
            rts_address,
            send_repeat,
            rfm69_enabled,
            rfm69_reset_gpio,
            rfm69_spi_channel,
            pigpio_host,
            pigpio_port,
        )

        return {"status": "OK"}

    def add_shutter(self, params):
        if sys.version_info[0] < 3:
            import unicodedata

            name = params.get("name", 0, type=unicode)
            name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore")
            duration = params.get("duration", 0, type=unicode)
            duration = unicodedata.normalize("NFKD", duration).encode("ascii", "ignore")
        else:
            name = params.get("name", 0, type=str)
            duration = params.get("duration", 0, type=str)
        LOGGER.debug("add shutter: " + name)
        if name in self.config.shutters_by_name:
            return {"status": "ERROR", "message": "Name is not unique"}
        elif "," in name:
            return {
                "status": "ERROR",
                "message": "New name can not contain SPACES or COMMAS",
            }
        elif not self.isfloat(duration):
            return {
                "status": "ERROR",
                "message": "seconds must be a number (may contain decimals)",
            }
        else:
            self.config.add_shutter(name, duration)
            id = self.config.shutters_by_name[name]
            LOGGER.debug("got a new shutter id: " + str(id))
            return {"status": "OK", "id": str(id)}

    def edit_shutter(self, params):
        id = params.get("id", 0, type=str)
        if sys.version_info[0] < 3:
            import unicodedata

            name = params.get("name", 0, type=unicode)
            name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore")
            duration = params.get("duration", 0, type=unicode)
            duration = unicodedata.normalize("NFKD", duration).encode("ascii", "ignore")
        else:
            name = params.get("name", 0, type=str)
            duration = params.get("duration", 0, type=str)
        LOGGER.debug("edit shutter: " + id + " / " + name)
        if id not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        elif (name == self.config.shutters[id]["name"]) and (
            duration == self.config.shutters[id]["durationDown"]
        ):
            return {
                "status": "ERROR",
                "message": "Neither Name nor Duration has not changed, remaining the same.",
            }
        elif (name != self.config.shutters[id]["name"]) and (
            name in self.config.shutters_by_name
        ):
            return {"status": "ERROR", "message": "Name is not unique"}
        elif "," in name:
            return {"status": "ERROR", "message": "New name can not contain COMMAS"}
        elif not self.isfloat(duration):
            return {
                "status": "ERROR",
                "message": "seconds must be a number (may contain decimals)",
            }
        else:
            self.config.set_shutter(id, name, duration)

            return {"status": "OK"}

    def delete_shutter(self, params):
        id = params.get("id", 0, type=str)
        LOGGER.debug("delete shutter: " + id)
        if id not in self.config.shutters:
            return {"status": "ERROR", "message": "Shutter does not exist"}
        else:
            self.config.set_shutter_active(id, False)
            return {"status": "OK"}

    def add_schedule(self, params):
        if not self.validate_password():
            return {"status": "ERROR", "message": "Invalid password"}

        try:
            (
                active,
                repeat_type,
                repeat_value,
                time_type,
                time_value,
                shutter_action,
                shutter_ids,
            ) = self._get_schedule_params(params)
        except ValueError as e:
            return {"status": "ERROR", "message": str(e)}

        LOGGER.debug("create new schedule")
        return self.schedule.add_schedule(
            active,
            repeat_type,
            repeat_value,
            time_type,
            time_value,
            shutter_action,
            shutter_ids,
        )

    def edit_schedule(self, params):
        if not self.validate_password():
            return {"status": "ERROR", "message": "Invalid password"}

        id = params.get("id", type=str)
        if not id:
            return {"status": "ERROR", "message": "Schedule ID is required"}

        try:
            (
                active,
                repeat_type,
                repeat_value,
                time_type,
                time_value,
                shutter_action,
                shutter_ids,
            ) = self._get_schedule_params(params)
        except ValueError as e:
            return {"status": "ERROR", "message": str(e)}

        LOGGER.debug("change schedule: " + id)
        return self.schedule.edit_schedule(
            id,
            active,
            repeat_type,
            repeat_value,
            time_type,
            time_value,
            shutter_action,
            shutter_ids,
        )

    def _get_schedule_params(self, params):
        param_values = {
            key: params.get(key)
            for key in [
                "active",
                "repeatType",
                "repeatValue",
                "timeType",
                "timeValue",
                "shutterAction",
                "shutterIds",
            ]
        }
        param_values["shutterIds"] = params.getlist("shutterIds[]")
        if param_values["repeatType"] != "once":
            param_values["repeatValue"] = params.getlist("repeatValue[]")
        missing_params = [key for key, val in param_values.items() if not val]
        if missing_params:
            raise ValueError(
                f"Missing or empty parameter values: {', '.join(missing_params)}"
            )

        return (param_value for param_value in param_values.values())

    def delete_schedule(self, params):
        id = params.get("id", 0, type=str)
        LOGGER.debug("delete schedule: " + id)
        return self.schedule.delete_schedule(id)

    def get_config(self, params):
        shutters = {}
        durations = {}
        for k in self.config.shutters:
            shutters[k] = self.config.shutters[k]["name"]
            durations[k] = self.config.shutters[k]["durationDown"]
        obj = {
            "Shutters": shutters,
            "ShutterDurations": durations,
            "Schedule": self.schedule.get_schedule_as_dict(),
            "Settings": {
                "LocationSettings": {
                    "Latitude": self.config.latitude,
                    "Longitude": self.config.longitude,
                },
                "WebSettings": {
                    "UseHttps": self.config.use_https,
                    "HttpPort": self.config.http_port,
                    "HttpsPort": self.config.https_port,
                    # Password not included for security reasons
                },
                "MqSettings": {
                    "Server": self.config.mqtt_server,
                    "Port": self.config.mqtt_port,
                    "Username": self.config.mqtt_user,
                    # Password not included for security reasons
                    "ClientId": self.config.mqtt_client_id,
                    "EnableDiscovery": self.config.enable_discovery,
                },
                "RadioSettings": {
                    "TxGpio": self.config.tx_gpio,
                    "RtsAddress": self.config.rts_address,
                    "SendRepeat": self.config.send_repeat,
                    "Rfm69Enabled": self.config.rfm69_enabled,
                    "Rfm69ResetGpio": self.config.rfm69_reset_gpio,
                    "Rfm69SpiChannel": self.config.rfm69_spi_channel,
                    "PigpioHost": self.config.pigpio_host,
                    "PigpioPort": self.config.pigpio_port,
                },
            },
        }
        LOGGER.debug("getConfig called, sending: " + json.dumps(obj))
        return obj

    def generate_adhoc_ssl_context(self):
        """Generates an adhoc SSL context for the development server."""
        import ssl
        from OpenSSL import crypto
        import tempfile
        from random import random

        cert = crypto.X509()
        cert.set_serial_number(int(random() * sys.maxsize))
        cert.gmtime_adj_notBefore(0)
        cert.gmtime_adj_notAfter(60 * 60 * 24 * 365)

        subject = cert.get_subject()
        subject.CN = "*"
        subject.O = "Dummy Certificate"

        issuer = cert.get_issuer()
        issuer.CN = "Untrusted Authority"
        issuer.O = "Self-Signed"

        pkey = crypto.PKey()
        pkey.generate_key(crypto.TYPE_RSA, 2048)
        cert.set_pubkey(pkey)
        cert.sign(pkey, "sha256")

        cert_handle, cert_file = tempfile.mkstemp()
        pkey_handle, pkey_file = tempfile.mkstemp()
        atexit.register(os.remove, pkey_file)
        atexit.register(os.remove, cert_file)

        os.write(cert_handle, crypto.dump_certificate(crypto.FILETYPE_PEM, cert))
        os.write(pkey_handle, crypto.dump_privatekey(crypto.FILETYPE_PEM, pkey))
        os.close(cert_handle)
        os.close(pkey_handle)
        # ctx = ssl.SSLContext(ssl.PROTOCOL_TLS)
        ctx = ssl.SSLContext(ssl.PROTOCOL_SSLv23)
        ctx.load_cert_chain(cert_file, pkey_file)
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    def run(self):
        if self.config.use_https:
            LOGGER.info(
                "Starting secure WebServer on Port " + str(self.config.https_port)
            )
            self.app.run(
                host="0.0.0.0",
                port=self.config.https_port,
                threaded=True,
                ssl_context=self.generate_adhoc_ssl_context(),
                use_reloader=False,
                debug=False,
            )
        else:
            LOGGER.info("Starting WebServer on Port " + str(self.config.http_port))
            self.app.run(
                host="0.0.0.0",
                threaded=True,
                port=self.config.http_port,
                use_reloader=False,
                debug=False,
            )
        LOGGER.info("Stopping WebServer")
