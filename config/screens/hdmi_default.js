/*
 * settings for standard screen connected via HDMI
 *
 * `tvservice` was removed together with the legacy display stack - Raspberry
 * Pi OS uses the KMS driver (dtoverlay=vc4-kms-v3d) since Bullseye, and
 * `vcgencmd display_power` reports -1 there as well.
 *
 * Under Wayland (labwc is the default session on Raspberry Pi OS 13) outputs
 * are switched with `wlopm`. The `xset` call is the fallback for X11/Xwayland
 * sessions. `wlr-randr --output <name> --off` would be an alternative if you
 * want to address one specific output instead of all of them.
 */
var screen = {
    name: "Standard HDMI screen",
    xres: 1024,
    yres: 600,
    aspectRatio: 1.0, // defines the aspect ratio of a pixel (width/height)
    hasTouch: true,
    hasBacklightCtl: true,
    hasBacklightDimming: false,
    cmdInit: "",
    cmdBacklightOff: `sh -c "wlopm --off '*' || xset dpms force off"`,
    cmdBacklightOn:  `sh -c "wlopm --on '*' || xset dpms force on"`,
    cmdBacklightDimming: "",
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = screen;
}
