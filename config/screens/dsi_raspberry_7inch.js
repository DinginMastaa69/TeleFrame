/*
 * settings for the official Raspberry Pi 7'' screen connected via DSI
 *
 * The sysfs name of the backlight device changed over time:
 *   - older kernels / Raspbian:      /sys/class/backlight/rpi_backlight
 *   - Raspberry Pi OS 12 and newer:  /sys/class/backlight/10-0045
 *                                    (the I2C address of the panel)
 * It is therefore resolved at runtime instead of being hardcoded.
 *
 * On Raspberry Pi OS the `brightness` file belongs to group `video`, so no
 * sudo is required as long as the user is a member of that group
 * (`id -nG` should list `video`). `bl_power` is root-only and not used.
 *
 * Optionally the device can be pinned in config.json:
 *   "screenSwitchOptions": { "backlightDevice": "10-0045" }
 */
const fs = require("fs");

const BACKLIGHT_BASE = "/sys/class/backlight";

var screen = {
    name: "Raspberry Pi 7'' DSI screen",
    xres: 800,
    yres: 480,
    aspectRatio: 1.0, // defines the aspect ratio of a pixel (width/height)
    hasTouch: true,
    hasBacklightCtl: true,
    hasBacklightDimming: true,
    cmdInit: "",
    cmdBacklightOff: "",
    cmdBacklightOn:  "",
    cmdBacklightDimming: "",

    /**
     * Resolves the backlight device and builds the command strings
     * @param  {Object} options The screenSwitchOptions object from config.json
     * @param  {Object} logger  The logger object from schedules
     */
    init: (options, logger) => {
      let device = (options && typeof options.backlightDevice === "string")
        ? options.backlightDevice
        : null;

      if (!device) {
        try {
          const devices = fs.readdirSync(BACKLIGHT_BASE);
          device = devices.length > 0 ? devices[0] : null;
        } catch (error) {
          device = null;
        }
      }

      if (!device) {
        const errorMsg = 'ERROR! screen.init() "' + screen.name + '"! No backlight device found in '
          + BACKLIGHT_BASE + '. Is the DSI display connected?';
        logger.warn(errorMsg);
        ['cmdInit', 'cmdBacklightOff', 'cmdBacklightOn', 'cmdBacklightDimming']
          .forEach((e) => screen[e] = 'echo ' + JSON.stringify(errorMsg));
        return;
      }

      const path = `${BACKLIGHT_BASE}/${device}`;
      logger.info(`Using backlight device ${path}`);

      // Note: the redirection has to happen inside the shell that actually
      // writes the file. The old `sudo echo 1 > ...` never worked, because
      // the redirection is performed by the unprivileged calling shell.
      screen.cmdInit = `sh -c "test -w ${path}/brightness || echo 'WARNING: ${path}/brightness is not writable by \\$(id -un) - add the user to group video'"`;
      screen.cmdBacklightOff = `sh -c "echo 0 > ${path}/brightness"`;
      screen.cmdBacklightOn = `sh -c "cat ${path}/max_brightness > ${path}/brightness"`;
      screen.cmdBacklightDimming = `sh -c "echo %% > ${path}/brightness"`;
    }
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = screen;
}
