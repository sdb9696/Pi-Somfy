#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Transmit mumbi power outlet codes"""

import sys
from struct import pack
from time import sleep
import pigpio as gpio
from rfm69 import Rfm69
import numpy as np
import json

class SomfyRfm69Tx(object):

    # define pigpio GPIO-pins where self.RESETPIN- and self.DATAPIN-Pin of RFM69-Transceiver are connected
    RESETPINDEFAULT = 25
    DATAPINDEFAULT = 26

    # define pigpio-host 
    HOST = "localhost"

    COMMANDS={
        'null': 0x00,
        'up': 0x02,
        'down': 0x04,
        'stop': 0x01,
        'prog': 0x08,
        }

    config=None

    clock = 640    

    def __init__(self, resetBcmPinNumber = RESETPINDEFAULT, dataBcmPinNumber = DATAPINDEFAULT, pigpiohost="localhost", pigpioport=8888, spichannel=0, spibaudrate=32000):

        self.piconnected = False

        self.pi = gpio.pi(pigpiohost, pigpioport)
        self.handle = self.pi.spi_open(spichannel, spibaudrate, 0)    # Flags: CPOL=0 and CPHA=0
        self.RESETPIN = resetBcmPinNumber
        self.DATAPIN = dataBcmPinNumber
        self.pigpiohost = pigpiohost
        self.pigpioport = pigpioport
        self.spichannel = spichannel
        self.spibaudrate = spibaudrate

        if not self.pi.connected:
            raise RuntimeError("Cannot connect to pigpiod, is the daemon running? (sudo pigpiod)")
        self.piconnected = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        """clean up stuff"""
        if self.piconnected:
            self.pi.stop()

    def _startTransmit(self):
        
        # prepare GPIO-Pins
        self.pi.set_mode(self.RESETPIN, gpio.OUTPUT)
        self.pi.set_mode(self.DATAPIN, gpio.OUTPUT)
        self.pi.set_pull_up_down(self.DATAPIN, gpio.PUD_OFF)
        self.pi.write(self.DATAPIN, 0)

        # reset transmitter before use
        self.pi.write(self.RESETPIN, 1)
        self.pi.write(self.RESETPIN, 0)
        sleep(.005)

        with Rfm69(host=self.pigpiohost, channel=self.spichannel, baudrate=self.spibaudrate, debug_level=0) as rf:
            # just to make sure SPI is working
            rx_data = rf.read_single(0x5A)
            if rx_data != 0x55:
                print ("SPI Error")

            rf.write_single(0x01, 0b00000100)     # OpMode: STDBY

            #rf.write_burst(0x07, [0x6C, 0x9A, 0x00]) # Frf: Carrier Frequency 434.42MHz
            rf.write_burst(0x07, [0x6C, 0x4F, 0x5C]) # Frf: Carrier Frequency 433.42MHz/61.03515625 

            # Use PA_BOOST
            rf.write_single(0x13, 0x0F)
            rf.write_single(0x5A, 0x5D)
            rf.write_single(0x5C, 0x7C)
            rf.write_single(0x11, 0b01111111)     # Use PA_BOOST

            rf.write_single(0x18, 0b00000110)     # Lna: 50 Ohm, highest gain
            rf.write_single(0x19, 0b01000000)     # RxBw: 4% DCC, BW=250kHz

            # Transmit Mode
            rf.write_single(0x02, 0b01101000)     # DataModul: continuous w/o bit sync, OOK, no shaping
            rf.write_single(0x01, 0b00001100)     # OpMode: SequencerOn, TX

            # wait for ready
            while (rf.read_single(0x27) & 0x80) == 0:
                pass
                #print "waiting..."

    def _endTransmit(self):
        # reset transmitter
        self.pi.write(self.RESETPIN, 1)
        self.pi.write(self.RESETPIN, 0)
        sleep(.005)

    def sendWaveForm2(self, waveform):
        
        self._startTransmit()

        self.pi.wave_add_new()

        self.pi.wave_add_generic(waveform)
        wid = self.pi.wave_create()
        self.pi.wave_send_once(wid)

        # wait until finished
        while self.pi.wave_tx_busy():
            sleep(0.1)

        self._endTransmit()

    def sendWaveForm(self, waveform):
        
        self._startTransmit()

#        self.pi.wave_add_generic(waveform)
 #       wid = self.pi.wave_create()
  #      self.pi.wave_send_once(wid)

        # send frames
        self.pi.wave_chain(waveform)

        # wait until finished
        while self.pi.wave_tx_busy():
            sleep(0.1)

        self._endTransmit()

    def sendCommand(self, address, command, rolling_code):
        
        key = 10

        # delete existing waveforms
        self.pi.wave_clear()

        # calculate frame-data from command-line arguments
        data = pack(">BBH", key | (rolling_code & 0x0f), command << 4, rolling_code) 
        data += pack("<I",address)[:-1]
        frame = np.fromstring(data, dtype=np.uint8)

        # checksum calculation
        cksum = frame[0] ^ (frame[0] >> 4)
        for i in range(1,7):
            cksum = cksum ^ frame[i] ^ (frame[i] >> 4)
        frame[1] = frame[1] | (cksum & 0x0f)
        print ("Data: "+''.join('0x{:02X} '.format(x) for x in frame))

        # data whitening/obfuscation
        for i in range(1, frame.size):
            frame[i] = frame[i] ^ frame[i-1]

        print ("Frame: "+''.join('0x{:02X} '.format(x) for x in frame))

        # how many consecutive frame repetitions
        repetitions = 3

        # create wakeup pulse waveform
        self.pi.wave_add_generic([gpio.pulse(1<<self.DATAPIN, 0, 10000), gpio.pulse(0, 1<<self.DATAPIN, 95000)])
        wakeup = self.pi.wave_create()

        # create hw_sync pulse waveform
        self.pi.wave_add_generic([gpio.pulse(1<<self.DATAPIN, 0, 2500), gpio.pulse(0, 1<<self.DATAPIN, 2500)])
        hw_sync = self.pi.wave_create()

        # create sw_sync pulse waveform
        self.pi.wave_add_generic([gpio.pulse(1<<self.DATAPIN, 0, 4850), gpio.pulse(0, 1<<self.DATAPIN, self.clock)])
        sw_sync = self.pi.wave_create()

        # create "0" pulse waveform
        self.pi.wave_add_generic([gpio.pulse(1<<self.DATAPIN, 0, self.clock), gpio.pulse(0, 1<<self.DATAPIN, self.clock)])
        zero = self.pi.wave_create()

        # create "1" pulse waveform
        self.pi.wave_add_generic([gpio.pulse(0, 1<<self.DATAPIN, self.clock), gpio.pulse(1<<self.DATAPIN, 0, self.clock)])
        one = self.pi.wave_create()

        # create "eof" pulse waveform
        self.pi.wave_add_generic([gpio.pulse(0, 1<<self.DATAPIN, self.clock)])
        eof = self.pi.wave_create()

        # create "inter-frame gap" pulse waveform
        self.pi.wave_add_generic([gpio.pulse(0, 1<<self.DATAPIN, 32000)])
        gap = self.pi.wave_create()

        # create bitstream from frame
        bits = np.where(np.unpackbits(frame) == 1, one, zero)

        # assemble whole frame sequence
        frames = np.concatenate((
                [wakeup], 
                [hw_sync, hw_sync], 
                [sw_sync], 
                bits,                   # send at least once
                [eof],                  # start 
                [gap],   # inter-frame gap
                [255, 0],               # start loop
                    [255, 0], 
                        [hw_sync], 
                    [255, 1, 7, 0],
                    [sw_sync], 
                    bits, 
                    [eof], 
                    [gap],   # inter-frame gap
                [255, 1, repetitions, 0]    # repeat 
                ))

        
        self.sendWaveForm(frames.tolist())
        
        # clean up
        self.pi.wave_delete(zero)
        self.pi.wave_delete(one)
        self.pi.wave_delete(wakeup)
        self.pi.wave_delete(hw_sync)
        self.pi.wave_delete(sw_sync)
        self.pi.wave_delete(eof)
        self.pi.wave_delete(gap)


