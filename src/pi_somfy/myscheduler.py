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
    from .myconfig import MyConfig
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

    def __init__(self,active,repeatType,repeatValue,timeType,timeValue,shutterAction,shutterIds):
    
        if active not in ('active', 'paused', 'deleted'):
            raise ValueError("%s is not a valid value for ACTIVE." % active )
        self.active = active

        if repeatType not in ('once', 'weekday'):
            raise ValueError("%s is not a valid value for REPEATTYPE." % timeType)
        self.repeatType = repeatType
                
        if (repeatValue == 'weekday') and not all(elem in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] for elem in repeatValue):
            raise ValueError("%s is not a valid value for REPEATVALUE (weekday)." % repeatValue )
        if (repeatValue == 'once') and not (datetime.datetime.strptime(repeatValue, '%Y/%m/%d')):
            raise ValueError("%s is not a valid value for REPEATVALUE (once)." % repeatValue )
        self.repeatValue = repeatValue
        
        if timeType not in ('clock', 'astro'):
            raise ValueError("%s is not a valid value for TIMETYPE." % timeType)
        self.timeType = timeType

        if (timeType == "clock") and not time.strptime(timeValue, '%H:%M'):
            raise ValueError("%s is not a valid value for TIMEVALUE (clock)." % timeValue )
        astro_parts = re.split(r'\+|\-', timeValue)
        if (timeType == "astro") and not ((astro_parts[0] in ('sunset', 'sunrise')) and ((len(astro_parts) == 1) or (astro_parts[1] == None or int(astro_parts[1])))):
            raise ValueError("%s is not a valid value for TIMEVALUE (astro)." % timeValue)
        self.timeValue = timeValue

        # if not ((isinstance(shutterAction, str)) and ((shutterAction.startswith("up") or shutterAction.startswith("down")))):
        if not ((shutterAction.startswith("up") or shutterAction.startswith("down") or shutterAction.startswith("stop"))):
            raise ValueError("%s is not a valid value for ACTION." % shutterAction)
        self.shutterAction = shutterAction

        self.shutterIds = shutterIds
        
    def prettyprint(self):
        outstr  = "active        : "+str(self.active)+"\n"
        outstr += "repeatType    : "+str(self.repeatType)+"\n"
        outstr += "repeatValue   : "+str(self.repeatValue)+"\n"
        outstr += "timeType      : "+str(self.timeType)+"\n"
        outstr += "timeValue     : "+str(self.timeValue)+"\n"
        outstr += "shutterAction : "+str(self.shutterAction)+"\n"
        outstr += "shutterIds    : "+str(self.shutterIds)+"\n"
        
        return outstr
           
class Schedule:
    def __init__(self, config: MyConfig = None):
        super(Schedule, self).__init__()
        self.lock = threading.Lock()
        self.config = config

        self.schedule = {}
        self.setUpdateTime()
        
    def addEvent(self, id, evt):
        if id in self.schedule.items():
            LOGGER.error("Event ID is not unique: "+ str(id))
            
        LOGGER.debug('addEvent: Waiting for Lock')
        self.lock.acquire()
        try:
            LOGGER.debug('addEvent: Lock aquired')
            self.schedule[id] = evt
            self.setUpdateTime()
        finally:
            self.lock.release()
            LOGGER.debug('addEvent: Lock released')
            
    def getNewId(self):
        ids = []
        for key in self.schedule:
            ids.append(int(key))
        if len(ids) == 0:
            return 1
        return (max(ids)+1)
            
    def addOneEventByTime(self, shutterIds, shutterAction, hour, minute):
        try: 
            evt = Event('active', 'once', datetime.datetime.today().strftime('%Y/%m/%d'), "clock", str(hour)+":"+str(minute), shutterAction, shutterIds)
            self.addEvent(self.getNewId(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass

    def addRepeatEventByTime(self, shutterIds, shutterAction, hour, minute, weekdays):
        try: 
            evt = Event('active', 'weekday', weekdays, "clock", str(hour)+":"+str(minute), shutterAction, shutterIds)
            self.addEvent(self.getNewId(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass

    def addRepeatEventBySunrise(self, shutterIds, shutterAction, delay, weekdays):
        try: 
            timeValue = "sunrise"
            if int(delay) > 0:
               timeValue = "sunrise+"+str(delay)
            if int(delay) < 0:
               timeValue = "sunrise"+str(delay)
            evt = Event('active', 'weekday', weekdays, "astro", timeValue, shutterAction, shutterIds)
            self.addEvent(self.getNewId(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass

    def addRepeatEventBySunset(self, shutterIds, shutterAction, delay, weekdays):
        try: 
            timeValue = "sunset"
            if int(delay) > 0:
               timeValue = "sunset+"+str(delay)
            if int(delay) < 0:
               timeValue = "sunset"+str(delay)
            evt = Event('active', 'weekday', weekdays, "astro", timeValue, shutterAction, shutterIds)
            self.addEvent(self.getNewId(), evt)
        except ValueError as ex:
            LOGGER.error("Failed to add event: "+ str(ex))
            pass
            
    def loadScheudleFromConfig(self):
        LOGGER.debug("Loading Schedule from Config File")
        for id, data in self.config.Schedule.items():
            LOGGER.debug("Loading Schedule "+str(id))
            repeatValue = data['repeatValue']
            evt =  Event(data['active'],data['repeatType'],repeatValue,data['timeType'],data['timeValue'],data['shutterAction'],data['shutterIds'])
            self.addEvent(id, evt)
            
    def addSchedule(self, active, repeatType, repeatValue, timeType, timeValue, shutterAction, shutterIds):

        id = self.getNewId()

           
        self.config.setSchedule(id, active, repeatType, repeatValue, timeType, timeValue, shutterAction, shutterIds)

        self.config.Schedule[str(id)] = {'active': active, 'repeatType': repeatType, 'repeatValue': repeatValue, 
                                    'timeType': timeType, 'timeValue': timeValue, 'shutterAction': shutterAction, 
                                    'shutterIds': shutterIds}


        evt =  Event(active,repeatType,repeatValue,timeType,timeValue,shutterAction,shutterIds)
        self.addEvent(str(id), evt)
            
        self.setUpdateTime()
        return { 'status': 'OK', 'id': str(id) }

    def editSchedule(self, id, active, repeatType, repeatValue, timeType, timeValue, shutterAction, shutterIds):

        if ((not id in self.schedule) or (not id in self.config.Schedule)):
            return {'status': 'ERROR', 'message': 'Schedule does not exist'}
        else:

            self.config.setSchedule(id, active, repeatType, repeatValue, timeType, timeValue, shutterAction, shutterIds)
            self.config.Schedule[id] = {'active': active, 'repeatType': repeatType, 'repeatValue': repeatValue, 
                                        'timeType': timeType, 'timeValue': timeValue, 'shutterAction': shutterAction, 
                                        'shutterIds': shutterIds}

            self.schedule.pop(id, None)
            evt =  Event(active,repeatType,repeatValue,timeType,timeValue,shutterAction,shutterIds)
            self.addEvent(id, evt)
            
            self.setUpdateTime()
            return {'status': 'OK'}

    def deleteSchedule(self, id):
        if ((not id in self.schedule) or (not id in self.config.Schedule)):
            return {'status': 'ERROR', 'message': 'Schedule does not exist'}
        else:
            evt = self.config.Schedule[id]
            self.config.setSchedule(id, "deleted", evt['repeatType'], evt['repeatValue'], evt['timeType'], evt['timeValue'], evt['shutterAction'], evt['shutterIds'])

            self.config.Schedule.pop(id, None)
            self.schedule.pop(id, None)
            self.setUpdateTime()
            return {'status': 'OK'}
            
    def printSchedule(self):
        for id, evt in self.schedule.items():
           print ("")
           print ("Event: "+str(id))
           print (evt.prettyprint())

    def getSchedule(self):
        return self.schedule

    def getScheduleAsDict(self):
        obj = {}
        for id, evt in self.schedule.items():
            if evt.active != "deleted":
                item = {'active': evt.active, 'repeatType':evt.repeatType, 'repeatValue':evt.repeatValue, 'timeType':evt.timeType, 'timeValue': evt.timeValue, 'shutterIds': evt.shutterIds, 'shutterAction': evt.shutterAction}
                obj[id] = item
        return obj

    def setUpdateTime(self):
        self.updateTime = int(time.time())

    def getUpdateTime(self):
        return self.updateTime
        

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
        self.lastScheduleUpdateTime = 0
        self.currentSchedule = {}

        self.homeLocation = ephem.Observer()
        locale.setlocale(locale.LC_TIME,'')
        return

    def updateSchedule(self):
        weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        self.homeLocation.lat = str(self.config.Latitude)
        self.homeLocation.lon = str(self.config.Longitude)
        self.homeLocation.date = datetime.datetime.now().strftime("%Y/%m/%d 00:00:00")
        sunrise = ephem.localtime(self.homeLocation.next_rising(ephem.Sun()))
        sunset = ephem.localtime(self.homeLocation.next_setting(ephem.Sun()))
        weekday = weekDays[datetime.datetime.today().weekday()]
        date    = datetime.datetime.today().strftime('%Y/%m/%d')
        LOGGER.info("Today is "+date+", a "+weekday+", Sunrise is at "+str(sunrise.time())+" and Sunset is at "+ str(sunset.time()));

        self.currentSchedule = {}
        for id, event in self.schedule.getSchedule().items():
            if ((event.active == "active") and (((event.repeatType == 'weekday') and (weekday in event.repeatValue)) or ((event.repeatType == 'once') and (date == event.repeatValue)))):
                if (event.timeType == "clock"):
                    eventTime = datetime.time(int(event.timeValue.split(":")[0]), int(event.timeValue.split(":")[1]), 0)
                elif ((event.timeType == "astro") and (event.timeValue.startswith("sunrise"))):
                    eventTime = (sunrise + datetime.timedelta(minutes=int(event.timeValue[7:] or 0))).time()
                elif ((event.timeType == "astro") and (event.timeValue.startswith("sunset"))):
                    eventTime = (sunset + datetime.timedelta(minutes=int(event.timeValue[6:] or 0))).time()

                if (eventTime > datetime.datetime.now().time()): 
                    eventTimeStr = "%02d:%02d" % (eventTime.hour, eventTime.minute)
                    if not eventTimeStr in self.currentSchedule:
                        self.currentSchedule[eventTimeStr] = []
                    self.currentSchedule[eventTimeStr].append([event.shutterIds, event.shutterAction])  
        LOGGER.debug("Current schedule: %s", self.currentSchedule)
    
    def run(self):
        # self.schedule.printSchedule()
        while not self.shutdown_flag.is_set():
            currentScheduleUpdateTime = self.schedule.getUpdateTime();
            if ((self.lastScheduleUpdateTime < currentScheduleUpdateTime) or (self.weekday != datetime.datetime.today().weekday())):
                self.updateSchedule()
                self.weekday = datetime.datetime.today().weekday()
                self.lastScheduleUpdateTime = currentScheduleUpdateTime
               
            ## check next event 
            timeNow = datetime.datetime.now().time()
            timeNowStr = "%02d:%02d" % (timeNow.hour, timeNow.minute)
            eventsToDelete = [];
            for eventTimeStr, eventDetails in self.currentSchedule.items():
                if (eventTimeStr <= timeNowStr):
                    for eventDetail in eventDetails:
                        for shutterId in eventDetail[0]:
                            try:
                                LOGGER.info("Send action \""+eventDetail[1]+"\" to shutterId \""+shutterId+"\" at " + datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S"))
                                if (eventDetail[1].startswith("up")):
                                    s = eventDetail[1][2:].strip()
                                    s1 = int(s) if s else -1
                                    if (0 < s1 < 100):
                                        if (self.shutter.getPosition(shutterId) < s1):   #Is Shutter below requested Position?
                                            self.shutter.risePartial(shutterId, s1)
                                        else:
                                            LOGGER.warning("Send action \""+eventDetail[1]+"\" to shutterId \""+shutterId+"\" was canceled! Shutter was already at same or above requested position")                                      
                                    else :  
                                        for i in range(self.config.SendRepeat):
                                            self.shutter.rise(shutterId)
                                            time.sleep(5)
                                elif (eventDetail[1].startswith("down")):
                                    s = eventDetail[1][4:].strip()
                                    s1 = int(s) if s else -1
                                    if (0 < s1 < 100):
                                        if (self.shutter.getPosition(shutterId) > s1):   #Is Shutter above requested Position?
                                            self.shutter.lowerPartial(shutterId, s1)
                                        else:
                                            LOGGER.warning("Send action \""+eventDetail[1]+"\" to shutterId \""+shutterId+"\" was canceled! Shutter was already at same or below requested position")                                         
                                    else :  
                                        for i in range(self.config.SendRepeat):
                                            self.shutter.lower(shutterId)
                                            time.sleep(5)
                                elif (eventDetail[1].startswith("stop")):
                                    self.shutter.stop(shutterId)
                            except Exception as e:
                                LOGGER.error ("Error: cannot open "+shutterId)
                                LOGGER.error (traceback.format_exc())
                    eventsToDelete.append(eventTimeStr);
            for key in eventsToDelete:
                try:
                    del self.currentSchedule[key] 
                except KeyError:
                    pass
            if (len(eventsToDelete) > 0):
                LOGGER.debug(str(self.currentSchedule))
         
            self.shutdown_flag.wait(60 - datetime.datetime.now().time().second)
            
        LOGGER.error("Received Signal to shut down Scheduler thread")
        return

