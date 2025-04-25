#!/usr/bin/python3

import sys, re, argparse
import fcntl
import os
import re
import locale
import time
import datetime
import ephem
import pigpio
import socket
import signal, atexit, subprocess, traceback
import logging, logging.handlers
import threading

LOGGER = logging.getLogger(__name__)

try:
    from .config import MyConfig
except Exception as e1:
    print("\n\nThis program requires the modules located from the same github repository that are not present.\n")
    print("Error: " + str(e1))
    sys.exit(2)


class Event:
    ## active: Either 'active', 'paused', 'deleted'
    ## repeatType: String: 'once' or 'weekday'
    ## repeatValue: Date in format "YYYY/MM/DD" or Array ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    ## timeType: String: 'clock' or 'astro' are valid values
    ## timeValue: String: Time in format "HH:MM" or values 'sunset' or 'sunrise' or 'sunset+MIN', 'sunset-MIN', 'sunrise+MIN', 'sunrise-MIN'
    ## shutterAction: String: 'up', 'down' or 'stop' (My-Position) are valid values. If this is followed by an integer, this indicates the duration of the operation
    ## shutterIds: Array of shutterIds to operate

    def __init__(self, active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids):
    
        if active not in ('active', 'paused', 'deleted'):
            raise ValueError("%s is not a valid value for ACTIVE." % active )
        self.active = active

        if repeat_type not in ('once', 'weekday'):
            raise ValueError("%s is not a valid value for REPEATTYPE." % time_type)
        self.repeat_type = repeat_type
                
        if (repeat_value == 'weekday') and not all(elem in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] for elem in repeat_value):
            raise ValueError("%s is not a valid value for REPEATVALUE (weekday)." % repeat_value )
        if (repeat_value == 'once') and not (datetime.datetime.strptime(repeat_value, '%Y/%m/%d')):
            raise ValueError("%s is not a valid value for REPEATVALUE (once)." % repeat_value )
        self.repeat_value = repeat_value
        
        if time_type not in ('clock', 'astro'):
            raise ValueError("%s is not a valid value for TIMETYPE." % time_type)
        self.time_type = time_type

        if (time_type == "clock") and not time.strptime(time_value, '%H:%M'):
            raise ValueError("%s is not a valid value for TIMEVALUE (clock)." % time_value )
        astro_parts = re.split(r'\+|\-', time_value)
        if (time_type == "astro") and not ((astro_parts[0] in ('sunset', 'sunrise')) and ((len(astro_parts) == 1) or (astro_parts[1] == None or int(astro_parts[1])))):
            raise ValueError("%s is not a valid value for TIMEVALUE (astro)." % time_value)
        self.time_value = time_value

        # if not ((isinstance(shutterAction, str)) and ((shutterAction.startswith("up") or shutterAction.startswith("down")))):
        if not ((shutter_action.startswith("up") or shutter_action.startswith("down") or shutter_action.startswith("stop"))):
            raise ValueError("%s is not a valid value for ACTION." % shutter_action)
        self.shutter_action = shutter_action

        self.shutter_ids = shutter_ids
        
    def pretty_print(self):
        outstr  = "active        : "+str(self.active)+"\n"
        outstr += "repeat_type    : "+str(self.repeat_type)+"\n"
        outstr += "repeat_value   : "+str(self.repeat_value)+"\n"
        outstr += "time_type      : "+str(self.time_type)+"\n"
        outstr += "time_value     : "+str(self.time_value)+"\n"
        outstr += "shutter_action : "+str(self.shutter_action)+"\n"
        outstr += "shutter_ids    : "+str(self.shutter_ids)+"\n"
        
        return outstr
           
class Schedule:
    def __init__(self, config: MyConfig = None):
        super(Schedule, self).__init__()
        self.lock = threading.Lock()
        self.config = config

        self.schedule = {}
        self.set_update_time()
        
    def add_event(self, id, evt):
        if id in self.schedule.items():
            LOGGER.error("Event ID is not unique: "+ str(id))
            
        LOGGER.debug('add_event: Waiting for Lock')
        self.lock.acquire()
        try:
            LOGGER.debug('add_event: Lock aquired')
            self.schedule[id] = evt
            self.set_update_time()
        finally:
            self.lock.release()
            LOGGER.debug('add_event: Lock released')
            
    def get_new_id(self):
        ids = []
        for key in self.schedule:
            ids.append(int(key))
        if len(ids) == 0:
            return 1
        return (max(ids)+1)
            
    def add_one_event_by_time(self, shutter_ids, shutter_action, hour, minute):
        try: 
            evt = Event('active', 'once', datetime.datetime.today().strftime('%Y/%m/%d'), "clock", str(hour)+":"+str(minute), shutter_action, shutter_ids)
            self.add_event(self.get_new_id(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass

    def add_repeat_event_by_time(self, shutter_ids, shutter_action, hour, minute, weekdays):
        try: 
            evt = Event('active', 'weekday', weekdays, "clock", str(hour)+":"+str(minute), shutter_action, shutter_ids)
            self.add_event(self.get_new_id(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass

    def add_repeat_event_by_sunrise(self, shutter_ids, shutter_action, delay, weekdays):
        try: 
            time_value = "sunrise"
            if int(delay) > 0:
               time_value = "sunrise+"+str(delay)
            if int(delay) < 0:
               time_value = "sunrise"+str(delay)
            evt = Event('active', 'weekday', weekdays, "astro", time_value, shutter_action, shutter_ids)
            self.add_event(self.get_new_id(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass

    def add_repeat_event_by_sunset(self, shutter_ids, shutter_action, delay, weekdays):
        try: 
            time_value = "sunset"
            if int(delay) > 0:
               time_value = "sunset+"+str(delay)
            if int(delay) < 0:
               time_value = "sunset"+str(delay)
            evt = Event('active', 'weekday', weekdays, "astro", time_value, shutter_action, shutter_ids)
            self.add_event(self.get_new_id(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass
            
    def load_schedule_from_config(self):
        LOGGER.debug("Loading Schedule from Config File")
        for id, data in self.config.schedule.items():
            LOGGER.debug("Loading Schedule "+str(id))
            repeat_value = data['repeatValue']
            evt = Event(data['active'], data['repeatType'], repeat_value, data['timeType'], data['timeValue'], data['shutterAction'], data['shutterIds'])
            self.add_event(id, evt)
            
    def add_schedule(self, active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids):

        id = self.get_new_id()

           
        self.config.set_schedule(id, active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids)

        self.config.schedule[str(id)] = {'active': active, 'repeatType': repeat_type, 'repeatValue': repeat_value,
                                    'timeType': time_type, 'timeValue': time_value, 'shutterAction': shutter_action,
                                    'shutterIds': shutter_ids}


        evt = Event(active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids)
        self.add_event(str(id), evt)
            
        self.set_update_time()
        return { 'status': 'OK', 'id': str(id) }

    def edit_schedule(self, id, active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids):

        if ((not id in self.schedule) or (not id in self.config.schedule)):
            return {'status': 'ERROR', 'message': 'Schedule does not exist'}
        else:

            self.config.set_schedule(id, active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids)
            self.config.schedule[id] = {'active': active, 'repeatType': repeat_type, 'repeatValue': repeat_value,
                                        'timeType': time_type, 'timeValue': time_value, 'shutterAction': shutter_action,
                                        'shutterIds': shutter_ids}

            self.schedule.pop(id, None)
            evt = Event(active, repeat_type, repeat_value, time_type, time_value, shutter_action, shutter_ids)
            self.add_event(id, evt)
            
            self.set_update_time()
            return {'status': 'OK'}

    def delete_schedule(self, id):
        if ((not id in self.schedule) or (not id in self.config.schedule)):
            return {'status': 'ERROR', 'message': 'Schedule does not exist'}
        else:
            evt = self.config.schedule[id]
            self.config.set_schedule(id, "deleted", evt['repeatType'], evt['repeatValue'], evt['timeType'], evt['timeValue'], evt['shutterAction'], evt['shutterIds'])

            self.config.schedule.pop(id, None)
            self.schedule.pop(id, None)
            self.set_update_time()
            return {'status': 'OK'}
            
    def print_schedule(self):
        for id, evt in self.schedule.items():
           print ("")
           print ("Event: "+str(id))
           print (evt.pretty_print())

    def get_schedule(self):
        return self.schedule

    def get_schedule_as_dict(self):
        obj = {}
        for id, evt in self.schedule.items():
            if evt.active != "deleted":
                item = {'active': evt.active, 'repeatType':evt.repeat_type, 'repeatValue':evt.repeat_value, 'timeType':evt.time_type, 'timeValue': evt.time_value, 'shutterIds': evt.shutter_ids, 'shutterAction': evt.shutter_action}
                obj[id] = item
        return obj

    def set_update_time(self):
        self.update_time = int(time.time())

    def get_update_time(self):
        return self.update_time
        

class Scheduler(threading.Thread):

    def __init__(self, group=None, target=None, name=None, args=(), kwargs=None):
        threading.Thread.__init__(self, group=group, target=target, name="Scheduler")
        self.shutdown_flag = threading.Event()
        self.args = args
        self.kwargs = kwargs
        self.schedule = kwargs["schedule"]
        self.shutter = kwargs["shutter"]
        self.config = kwargs["config"]
        self.weekday = datetime.datetime.today().weekday()
        self.last_schedule_update_time = 0
        self.current_schedule = {}

        self.home_location = ephem.Observer()
        locale.setlocale(locale.LC_TIME,'')
        return

    def update_schedule(self):
        week_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        self.home_location.lat = str(self.config.Latitude)
        self.home_location.lon = str(self.config.Longitude)
        self.home_location.date = datetime.datetime.now().strftime("%Y/%m/%d 00:00:00")
        sunrise = ephem.localtime(self.home_location.next_rising(ephem.Sun()))
        sunset = ephem.localtime(self.home_location.next_setting(ephem.Sun()))
        weekday = week_days[datetime.datetime.today().weekday()]
        date = datetime.datetime.today().strftime('%Y/%m/%d')
        LOGGER.info("Today is "+date+", a "+weekday+", Sunrise is at "+str(sunrise.time())+" and Sunset is at "+ str(sunset.time()));
        self.current_schedule = {}
        for id, event in self.schedule.get_schedule().items():
            if ((event.active == "active") and (((event.repeat_type == 'weekday') and (weekday in event.repeat_value)) or ((event.repeat_type == 'once') and (date == event.repeat_value)))):
                if (event.time_type == "clock"):
                    event_time = datetime.time(int(event.time_value.split(":")[0]), int(event.time_value.split(":")[1]), 0)
                elif ((event.time_type == "astro") and (event.time_value.startswith("sunrise"))):
                    event_time = (sunrise + datetime.timedelta(minutes=int(event.time_value[7:] or 0))).time()
                elif ((event.time_type == "astro") and (event.time_value.startswith("sunset"))):
                    event_time = (sunset + datetime.timedelta(minutes=int(event.time_value[6:] or 0))).time()

                if (event_time > datetime.datetime.now().time()):
                    event_time_str = "%02d:%02d" % (event_time.hour, event_time.minute)
                    if not event_time_str in self.current_schedule:
                        self.current_schedule[event_time_str] = []
                    self.current_schedule[event_time_str].append([event.shutter_ids, event.shutter_action])
        LOGGER.debug("Current schedule: %s", self.current_schedule)
    
    def run(self):
        # self.schedule.print_schedule()
        while not self.shutdown_flag.is_set():
            current_schedule_update_time = self.schedule.get_update_time();
            if ((self.last_schedule_update_time < current_schedule_update_time) or (self.weekday != datetime.datetime.today().weekday())):
                self.update_schedule()
                self.weekday = datetime.datetime.today().weekday()
                self.last_schedule_update_time = current_schedule_update_time
               
            ## check next event 
            time_now = datetime.datetime.now().time()
            time_now_str = "%02d:%02d" % (time_now.hour, time_now.minute)
            events_to_delete = [];
            for event_time_str, event_details in self.current_schedule.items():
                if (event_time_str <= time_now_str):
                    for event_detail in event_details:
                        for shutter_id in event_detail[0]:
                            try:
                                LOGGER.info("Send action \""+event_detail[1]+"\" to shutter_id \""+shutter_id+"\" at " + datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S"))
                                if (event_detail[1].startswith("up")):
                                    s = event_detail[1][2:].strip()
                                    s1 = int(s) if s else -1
                                    if (0 < s1 < 100):
                                        if (self.shutter.get_position(shutter_id) < s1):   #Is Shutter below requested Position?
                                            self.shutter.rise_partial(shutter_id, s1)
                                        else:
                                            LOGGER.warning("Send action \""+event_detail[1]+"\" to shutter_id \""+shutter_id+"\" was canceled! Shutter was already at same or above requested position")
                                    else :  
                                        for i in range(self.config.SendRepeat):
                                            self.shutter.rise(shutter_id)
                                            time.sleep(5)
                                elif (event_detail[1].startswith("down")):
                                    s = event_detail[1][4:].strip()
                                    s1 = int(s) if s else -1
                                    if (0 < s1 < 100):
                                        if (self.shutter.get_position(shutter_id) > s1):   #Is Shutter above requested Position?
                                            self.shutter.lower_partial(shutter_id, s1)
                                        else:
                                            LOGGER.warning("Send action \""+event_detail[1]+"\" to shutter_id \""+shutter_id+"\" was canceled! Shutter was already at same or below requested position")
                                    else :  
                                        for i in range(self.config.SendRepeat):
                                            self.shutter.lower(shutter_id)
                                            time.sleep(5)
                                elif (event_detail[1].startswith("stop")):
                                    self.shutter.stop(shutter_id)
                            except Exception as e:
                                LOGGER.error ("Error: cannot open "+shutter_id)
                                LOGGER.error (traceback.format_exc())
                    events_to_delete.append(event_time_str);
            for key in events_to_delete:
                try:
                    del self.current_schedule[key]
                except KeyError:
                    pass
            if (len(events_to_delete) > 0):
                LOGGER.debug(str(self.current_schedule))
         
            self.shutdown_flag.wait(60 - datetime.datetime.now().time().second)
            
        LOGGER.error("Received Signal to shut down Scheduler thread")
        return

