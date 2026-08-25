# Screen configuration files
A screen configuration contains commands to switch the screen on/off.

## Choosing a configuration

Set `screenConfig` in your `config/config.json`, e.g.

```json
{
  "screenConfig": "./config/screens/dsi_raspberry_7inch.js",
  "toggleMonitor": true,
  "turnOnHour": 9,
  "turnOffHour": 22
}
```

| **File** | **Use for** |
|----------|-------------|
| `hdmi_default.js` | any HDMI screen; switches the output off via `wlopm` (Wayland) with an `xset dpms` fallback for X11 |
| `dsi_raspberry_7inch.js` | the official Raspberry Pi 7" DSI display; dims the panel backlight via sysfs |
| `hdmi_sunfounder_10-1_Inch_touch_screen.js` | Sunfounder 10.1" screen switched through a GPIO pin and an optocoupler |

## Raspberry Pi OS 12/13 notes

The legacy display tooling is gone on current Raspberry Pi OS releases, so the
shipped configurations were rewritten:

* **`tvservice` no longer exists.** It belonged to the pre-KMS firmware stack.
  `vcgencmd display_power` reports `-1` as well. Outputs are now switched with
  `wlopm --off '*'` / `wlopm --on '*'` under Wayland (labwc is the default
  session), or `wlr-randr --output <name> --off` for a single output.
* **The DSI backlight moved.** `/sys/class/backlight/rpi_backlight` became
  `/sys/class/backlight/10-0045` (the panel's I2C address). The configuration
  resolves the device at runtime, so it keeps working across releases. You can
  pin it explicitly with `"screenSwitchOptions": { "backlightDevice": "10-0045" }`.
* **`brightness` needs no `sudo`.** It belongs to group `video`, and the default
  Raspberry Pi OS user is a member. Check with `id -nG`.
  (The old configurations used `sudo echo 1 > /sys/…`, which never actually
  worked — the redirection is performed by the *calling* unprivileged shell,
  not by `sudo`.)
* **WiringPi is gone.** The `gpio` utility was replaced by `pinctrl`, which uses
  **BCM GPIO numbering** instead of WiringPi numbering. If you used the
  Sunfounder configuration, translate your pin number when upgrading.

## Options

The following options are available:

| **Option**             | **Type**   | **Description**                                                             |
|------------------------|------------|-----------------------------------------------------------------------------|
| `name`                 | {string}   | Screen configuration name                                                   |
| `xres`                 | {number}   | screen x resolution - used as the initial window width                      |
| `yres`                 | {number}   | screen y resolution - used as the initial window height                     |
| `aspectRatio`          | {float}    | defines the aspect ratio of a pixel (width/height) - _currently not in use_ |
| `hasTouch`             | {boolean}  | has touch function - _currently not in use_                                 |
| `hasBacklightCtl`      | {boolean}  | has backlight control - _currently not in use_                              |
| `hasBacklightDimming`  | {boolean}  | has backlight dimming - _currently not in use_                              |
| `cmdInit`              | {string}   | command to initialize switching                                             |
| `cmdBacklightOff`      | {string}   | command executed to turn the screen **off**                                 |
| `cmdBacklightOn`       | {string}   | command executed to turn the screen **on**                                  |
| `cmdBacklightDimming`  | {string}   | command to dim the backlight, `%%` is replaced by the value - _currently not in use_ |
| `init`                 | {function} | **optional** function to initialize the commands using `screenSwitchOptions` from `config.json`. See example below |

If the commands require parameters which must be configured by the user - e.g. a GPIO pin for the RPI, the function `init` can be defined optionally.
This function is called when the configuration is initialized and the object config.screenSwitchOptions is passed.

Example config using `init` function
```js
/*
* settings for Sunfounder 10.1 inch touch sreen connected via HDMI
* http://wiki.sunfounder.cc/index.php?title=10.1_Inch_Touch_Screen_for_Raspberry_Pi
*
* This screen is turned on and off via a GPIO port, because when HDMI is turned off
* via software, the text "No Signal" is permanently displayed.
*
* To control the power switch an additional script and some hardware (optocoupler
* and a resistor) is required.

  THE PIN NEEDS TO BE CONFIGURED MANUALLY IN YOUR config/config.json
  It depends on your individual setup, to which
  Pin the optocoupler is connected to.
  NOTE: pinctrl uses BCM GPIO numbering, not WiringPi numbering.

  Example config.json:
  {
    "botToken": "...",
    ...
    "screenConfig": "./screens/hdmi_sunfounder_10-1_Inch_touch_screen.js",
    "screenSwitchOptions": { "pin": 21 },
    ...
  }
*/
var screen = {
    name: "Sunfounder HDMI screen",
    xres: 1280,
    yres: 800,
    aspectRatio: 1.0, // defines the aspect ratio of a pixel (width/height)
    hasTouch: true,
    hasBacklightCtl: false,
    hasBacklightDimming: false,
    cmdBacklightDimming: "",
    /**
     * initialize the command strings
     * @param  {Object} options The screenSwitchOptions object from config.json
     * @param  {Object} logger The logger object from schedules
     */
    init: (options, logger) => {
      // check configuration option
      if (typeof options.pin !== 'number') {
        const errorMsg = 'ERROR! screen.init() "' + screen.name + '"! Missing or invalid configuration of "screenSwitchOptions.pin" in config.js.';
        logger.warn(errorMsg);
        ['cmdInit', 'cmdBacklightOff', 'cmdBacklightOn'].forEach((e) => screen[e] = 'echo ' + errorMsg);
      } else {
        screen.cmdInit = "pinctrl set " + options.pin + " op dl";
        screen.cmdBacklightOff = "bash ./tools/screen_switch.sh " + options.pin;
        screen.cmdBacklightOn =  "bash ./tools/screen_switch.sh " + options.pin;
      }
    }
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = screen;
}
```
 See also the wiki page [How to switch off the Sunfounder 10.1 inch HDMI display via the toggleMonitor function](https://github.com/LukeSkywalker92/TeleFrame/wiki/How-to-switch-off-the-Sunfounder-10.1-inch-HDMI-display-via-the-toggleMonitor-function) for this example.
