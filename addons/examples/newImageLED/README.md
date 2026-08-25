# TeleFrame addon - New image notification led

This example addon switches an LED when new images arrive. It can be used in normal operation, but there are better solutions to implement it if a GPIO package is also installed.

Unfortunately, the available GPIO packages all have dependencies where problems may occur during installation.
Therefore the switching of the LED was implemented via executing a system command using the `pinctrl` utility.
This should work on all Raspberry PI's. It is not very efficiently, but should be sufficient for demonstration purposes.

---
### Installation

**You must define the GPIO port for the LED to be switched in the configuration. Otherwise the addon will not be executed.**

If you are not sure which GPIO port to configure, you can run the `pinout` tool. The number after **GPIO** is required.

To install the **newImageLED**  addon example open a terminal and execute:

```sh
cd ~/TeleFrame
cp -R addons/examples/newImageLED addons/newImageLED
tools/addon_control.sh enable newImageLED
tools/addon_control.sh config newImageLED newLedGPIO <your LED GPIO port number>
```

Then restart TeleFrame.


### Requirements

`pinctrl` is part of the `raspi-utils` package and is preinstalled on Raspberry Pi OS.
If it is missing, install it with `sudo apt-get install raspi-utils`.

Switching a pin needs no `sudo`, but your user has to be a member of the group
`gpio` - which is the default on Raspberry Pi OS. Check with `id -nG`.

> **Upgrading from TeleFrame 3.x?** This addon used WiringPi (`gpio -g`) before,
> which no longer ships with Raspberry Pi OS. Both utilities address the pin by
> its BCM GPIO number, so your configured `newLedGPIO` stays as it is.


### Configuration options

The following configuration options are available.

| Name          | Type   | Description                                                      |
| ------------- | ------ | ---------------------------------------------------------------- |
| newLedGPIO    | number | **required**: BCM GPIO port to use to switch the LED              |
| blinkInterval | number | _optional_: duration in milliseconds during the LED is on or off |
