#!/bin/bash
#
# Pulses a GPIO pin to toggle the screen power via an optocoupler.
#
# WiringPi (`gpio`) was removed from Raspberry Pi OS; this uses `pinctrl`,
# which ships with the raspi-utils package and uses BCM GPIO numbering.
# The user needs to be in group `gpio` (default on Raspberry Pi OS).
#
# see https://www.raspberrypi.com/documentation/computers/os.html#pinctrl

PIN=$1

if [ -z "$PIN" ]; then
    echo "usage: $0 <bcm-gpio-number>" >&2
    exit 1
fi

# trigger the optocoupler (drive the output high)
pinctrl set "$PIN" op dh
# wait for the display to respond
sleep 0.05
# turn off the trigger (drive the output low)
pinctrl set "$PIN" op dl
