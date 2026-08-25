![TeleFrame](.github/header.png)

![TeleFrame in action](.github/TeleFrame.gif)

<p align="center">
	<a><img src="https://img.shields.io/github/last-commit/LukeSkywalker92/TeleFrame.svg" alt="Latest Comit"></a>
	<a><img src="https://img.shields.io/github/release/LukeSkywalker92/TeleFrame.svg" alt="Release"></a>
</p>

**TeleFrame** is an open source digital image frame that displays images and videos, which were send to an Telegram Bot.

## Requirements

| | |
|---|---|
| Hardware | Raspberry Pi 2/3/4/5 (a Pi Zero / Pi 1 can only run the [bot only mode](#bot-only-mode-no-gui)) |
| OS | Raspberry Pi OS 12 (bookworm) or 13 (trixie), 32 or 64 bit, **Desktop image** |
| Node.js | 22.12 or newer (the installer sets up Node 24 LTS) |

> **Upgrading from TeleFrame 3.x?** See [Updating](#updating). The old
> `npm_config_arch=$(uname -m)` workaround is obsolete and was actively wrong on
> 64 bit systems - `uname -m` returns `aarch64`, which is not a valid npm
> architecture. Just delete `node_modules/` and run `npm install`.

## Table Of Contents

- [Requirements](#requirements)
- [Installation](#installation)
  - [Automatic Installation (Raspberry Pi only!)](#automatic-installation-raspberry-pi-only)
  - [Manual Installation](#manual-installation)
- [Autostart](#autostart)
- [Configuration](#configuration)
- [Whitelist Chats](#whitelist-chats)
- [Voice Replies using TeleFrame](#voice-replies-using-teleframe)
- [Touchscreen support](#touchscreen-support)
- [Updating](#updating)
- [Addon interface](#addon-interface)
- [Bot only mode (no GUI)](#bot-only-mode-no-gui)
- [Building a TeleFrame](#building-a-teleframe)

## Installation

### Automatic Installation (Raspberry Pi only!)

*Electron*, the app wrapper around TeleFrame, supports the Raspberry Pi 2/3/4/5.
The Raspberry Pi 0/1 is **not** supported for the GUI, but can run the
[bot only mode](#bot-only-mode-no-gui).

Use a full Raspberry Pi OS image, **not** the Lite version.

Execute the following command on your Raspberry Pi to install TeleFrame:

```bash
bash -c "$(curl -sL https://raw.githubusercontent.com/LukeSkywalker92/TeleFrame/master/tools/install_raspberry.sh)"
```

The installer sets up Node.js 24 LTS, installs the dependencies, writes your bot
token to `config/config.json`, installs the plymouth splash screen and - on
request - the [autostart service](#autostart).

If you already have a clone, run the very same script from inside it and it will
use that directory instead of cloning again:

```bash
bash tools/install_raspberry.sh
```

### Manual Installation

1. Install *Node.js* **22.12 or newer** (Debian/Raspberry Pi OS 13 only ships
   Node 20, which is too old for the bundled Electron version):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. If you want to use the voice reply feature, install sox: `sudo apt-get install sox libsox-fmt-all`
3. Clone the repository and check out the master branch: `git clone https://github.com/LukeSkywalker92/TeleFrame.git`
4. Enter the repository: `cd TeleFrame/`
5. Install and run the app with: `npm install && npm start`

*Electron does not need to be installed globally* - it comes from `node_modules`.

Also note that:

- Raspberry Pi OS 13 runs a **Wayland** session (labwc). Starting TeleFrame over
  SSH therefore needs the session environment, not `DISPLAY=:0`:
  ```bash
  XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0 npm start
  ```
  On an X11 session `DISPLAY=:0 npm start` still works.
- Electron picks the platform automatically (`--ozone-platform-hint=auto`). To
  force one, set `ELECTRON_OZONE_PLATFORM_HINT=wayland` or `=x11`.
- To access the toolbar menu when in fullscreen mode, hit the `ALT` key.
- To toggle the (web) `Developer Tools` from fullscreen mode, use `CTRL-SHIFT-I` or `ALT` and select `View`.

## Autostart

TeleFrame runs as a **systemd user service**, started from the labwc session.
(Earlier versions used pm2 and `/etc/xdg/lxsession/LXDE-pi/autostart`; neither
exists on current Raspberry Pi OS releases.)

```bash
bash tools/install_service.sh
```

This installs `~/.config/systemd/user/teleframe.service` and appends a start
command to `~/.config/labwc/autostart`.

> If `~/.config/labwc/autostart` does not exist yet, the script first copies
> `/etc/xdg/labwc/autostart`. A user autostart file **replaces** the system one
> completely, so without that copy the desktop and the panel would disappear.

Day to day commands:

```bash
systemctl --user start teleframe        # start now
systemctl --user stop teleframe         # stop
systemctl --user restart teleframe      # restart
systemctl --user status teleframe       # is it running?
journalctl -t teleframe -f              # follow the log
```

Use `journalctl -t teleframe`, not `journalctl --user-unit=teleframe.service`:
Chromium moves its browser process into a scope of its own shortly after start,
and the unit filter drops everything logged after that - including all
`[Renderer]` lines and the shutdown messages.

The service restarts automatically when TeleFrame crashes. There is no separate
"wait for internet" variant any more - the bot retries on its own when it cannot
reach Telegram at boot time.

### Pinning TeleFrame to one display

Under Wayland a client cannot choose its output. With only the DSI panel
connected this does not matter, but as soon as a second screen is attached
labwc is free to put the frame on either one — usually the wrong one.

**Copy the system configuration first.** Like `autostart`, labwc uses the *first*
`rc.xml` it finds in the XDG hierarchy, so a user file replaces the system one
completely. Creating it from scratch silently drops all default keybindings,
mouse bindings and the theme:

```sh
mkdir -p ~/.config/labwc
cp /etc/xdg/labwc/rc.xml ~/.config/labwc/rc.xml
```

Then add the rule inside the existing `<windowRules>` block:

```xml
<windowRule identifier="teleframe">
  <action name="MoveToOutput" output="DSI-1" />
</windowRule>
```

Apply it without logging out with `kill -HUP $(pgrep -x labwc)`, then restart
TeleFrame.

`wlr-randr` lists the available output names. The identifier is the Wayland
`app_id`, which Electron takes from the `name` field of `package.json` and is
therefore `teleframe` — *not* the `--class` value set in `main.js`, which only
reaches XWayland. `wlrctl toplevel list` prints what the compositor actually
sees. labwc matches identifiers case-insensitively.

Note that labwc ignores `MoveToOutput` for windows that are already fullscreen,
so the rule has to be in place before TeleFrame starts.

## Configuration

1. Copy `TeleFrame/config/config.example.json` to `TeleFrame/config/config.json`. \
   **Note:** If you used the installer script. This step is already done for you.

2. Modify your required settings.
  **Note:** You only need to define settings that differ from the standard configuration.


The following properties can be configured:

| **Option**	| **Type** | **Description** | **Default Value** |
| ----------	| -------- | --------------- | ----------------- |
| `botToken`	| {string} | The token of the Telegram Bot, which will recieve the images. How to create a bot and get the token is explained [here](https://core.telegram.org/bots#6-botfather).	|  |
| `whitelistChats`	| {array-of-string} | Use this to only allow certain users to send photos to your TeleFrame. See [hints](#whitelist-chats) below. |  |
| `whitelistAdmins`	| {array-of-string} | Use this to increase individual users as admin. |  |
| `screenConfig`		| {string} | Defines the configuration file of your screen, see folder TeleFrame/config/screens/ and [README-File](config/screens/README.md) for possible configurations. For the official 7" DSI display use `./config/screens/dsi_raspberry_7inch.js`.	| ./config/screens/hdmi_default.js	|
| `playSoundOnRecieve`	| {string} | Play a sound on recieving a message, set `false` to turn off.	| "sound1.mp3" |
| `showVideos`	| {boolean} | When set to true, videos that are send to the bot are also shown.	| True |
| `playVideoAudio`	| {boolean} | If recieved videos should be played with sound or not.	| False |
| `imageFolder`	| {string} | The folder where the images are stored.	| "images" |
| `fullscreen`	| {boolean} | When set to true, TeleFrame will run in fullscreen mode.	| True |
| `fadeTime`	| {number} | The fading time between two images. [Milliseconds]	| 1500 |
| `interval`	| {number} | The time that an image is shown. [Milliseconds]	| 10000 |
| `imageCount`	| {number} | Defines how many different images are shown in the slideshow.	| 30 |
| `randomOrder`	| {boolean} | When set to true, Teleframe will show pictures in random order.	| True |
| `autoDeleteImages`	| {boolean} | Defines if old images should be deleted, when they are no longer used in the slideshow (see 'imageCount'). Starred images will not be deleted.	| True |
| `showSender`	| {boolean} | When set to true, TeleFrame will show the name of the sender when the image is shown.	| True |
| `showCaption`	| {boolean} | When set to true, TeleFrame will show the caption of the image when the image is shown.	| True |
| `cropZoomImages`	| {boolean} | When set to true, TeleFrame will crop and zoom images so there is no black border.	| False |
| `toggleMonitor`	| {boolean} | When set to true, TeleFrame will switch the monitor off and on at the defined hours.	| False |
| `turnOnHour`	| {number} | Defines when the monitor should be turned on.	| 9 |
| `turnOffHour`	| {number} | Defines when the monitor should be turned off.	| 22 |
| `switchLedsOff`	| {boolean} | Defines if the 2 LEDs on the RaspberryPi should be switched off.	| False |
| `botReply`	| {boolean} | Defines if the bot should answer on images or videos with a short reply (:+1: :camera_flash: for images, :+1: :movie_camera: for movies). Also throws a warning on receiving unknown file extensions.	| True |
| `confirmDeleteImage`	| {boolean} | Defines if to show a confirm message before delete an image `true` or `false`	|  |
| `confirmShutdown`	| {boolean} | Defines if to show a confirm message before shutdown the system `true` or `false`	|  |
| `confirmReboot`	| {boolean} | Defines if to show a confirm message before rebooting the system `true` or `false`	|  |
| `keys`	| {object} | Defines an object with 4 strings specifying the keyboard shortcuts for play, next, previous and pause. Set to null for no controls	|  |
| `voiceReply`	| {object} | Defines an object with the config for sending voicemessages with TeleFrame, see [info](#voice-replies-using-teleframe) below	|  |
| `touchBar`	| {object} | Defines an object with the config for using a touch bar for executing commands instead of the default touch gestures, see [info](#using-the-touch-bar) below	|  |
| `language`	| {string} | Defines the language to use.  See `config.example.js` 'Language configuration' for details	|  |
| `adminAction` | {object} | Defines an object with the config for sending Admin-Commands to the TeleFrame, see [info](#sending-admin-commands-to-the-teleframe) below	|  |


## Whitelist Chats

When you start your TeleFrame and send a "Hi" to the bot it will send you back the current chat id. Paste this id or several of them into the `whitelistChats` config option to only allow only pictures from these ids (eg `[1234567, 89101010]`). Leave empty (`[]`) for no whitelist.

## Using the Touch Bar

To use a touch bar for executing commands instead of the default touch gestures you need to add a touchBar obect to your config.
To open the touch bar, just touch the screen. Do the same to hide it again.
The touchBar object takes the height of the touchbar, optionally the autoHideTimeout and a list of elements that should appear as keys. Availiable elements are:

| **Element**             | **Description**                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `showNewest`            | Navigate last arrived image. 																													|
| `previousImage`         | Navigate to the previous Image. 																													|
| `nextImage`  						| Navigate to the next Image. 																															|
| `play`         					| Resume slideshow. 																																				|
| `pause` 								| Pause slideshow. 																																					|
| `playPause`  					  | Toggle between play and pause. 																														|
| `record`         				| Record voice reply. 																																			|
| `starImage`        			| Star the active image to prevent it from beeing deleted.                                  |
| `deleteImage`        		| Delete the active an image.                                                               |
| `mute`        					| Mute notification sounds. 																																|
| `shutdown`        			| Shutdown the system. 																																			|
| `reboot`        				| Reboot the system. 																																				|

## Voice Replies using TeleFrame

A very simple way to respond to the images is by using TeleFrame`s voice reply feature. The feature is intended to work like this: Who ever comes by the frame presses a button, speaks their message into the frame, when there is 2 seconds of silence or the maximum time is reached the recording will stop and the telegram bot will send it to the chat where the current image came from.


| **Option**              | **Description**                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `key`                   | The keyboardkey to start the voice recording                                              |
| `maxRecordTime`         | How long the recorder will record if there is no silence detected (in milliseconds)       |

Requirements: a recording device (e.g. a USB microphone - `arecord -l` must list
one) and `sox`, which provides the `rec` command:
`sudo apt-get install sox libsox-fmt-all`.

## Sending Admin-Commands to the TeleFrame

As administrator of a TeleFrame, it could be very useful to execute commands on the TeleFrame computer.
With the TeleFrame-Bot you are able to send these commands without logging on to the remote computer.

Examples for such admin actions could be:
- Reboot the Raspberry Pi
- Restart of the TeleFrame application
- Open a VPN connection
- Close a VPN connection
- ....

To enable Admin-Action on the TeleFrame, following settings must be made in the Config file:
- Adding the Chat-ID to the list of Administators (whitelistAdmins)
- Activating the Admin Actions (allowAdminAction)
- Adding an Action Object (actions) [see adminAction-Object]
- Activation of the action object (enable)

Now the action on the TeleFrame can be triggered by sending the corresponding command (e.g. /reboot for the command named "reboot").

**Note on `sudo`:** actions like `sudo reboot` or `sudo systemctl start openvpn`
run non-interactively and therefore need a passwordless sudo rule. Create one
with `sudo visudo -f /etc/sudoers.d/teleframe`, for example:

```
%sudo ALL=(ALL) NOPASSWD: /sbin/reboot, /sbin/shutdown, /usr/bin/systemctl start openvpn, /usr/bin/systemctl stop openvpn
```

Restarting TeleFrame itself (`systemctl --user restart teleframe.service`) needs
no sudo at all.

### adminAction-object
| **Option**              | **Description**                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `allowAdminAction`      | Global Switch to enable the Admin-Actions                                                 |
| `actions`               | Defines an array of action-objects, see info bellow                                       |

### action-object
| **Option**              | **Description**                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `name`                  | Name of the action                                                                        |
| `command`               | Command to execute on TeleFrame                                                          |
| `enable`                | When set to True, the command is added to the bot                                         |



## Touchscreen support
* Navigate through the images by touching at the left or right side of your touchscreen.
* Pause and resume the slideshow by touching in the middle of your touchscreen.
* Record a voice message and reply to the shown image by making a long touch in the middle of your touchscreen. The recording starts when you take your finger off.

## Updating

If you want to update your TeleFrame to the latest version, use your terminal to go to your TeleFrame folder and type the following command:

```bash
git pull && npm install
```

If you changed nothing more than the config, this should work without any problems.
Type `git status` to see your changes, if there are any, you can reset them with `git reset --hard`. After that, git pull should be possible.

### Upgrading from TeleFrame 3.x

Version 4 targets Raspberry Pi OS 12/13 and needs a few one-off steps:

```bash
# 1. Node 22.12+ is required (Raspberry Pi OS 13 ships Node 20)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. drop the old dependency tree, it contains a 32 bit Electron 13
cd ~/TeleFrame
rm -rf node_modules package-lock.json
npm install

# 3. replace the pm2 autostart with the systemd user service
pm2 delete all && pm2 save        # only if you used pm2 before
bash tools/install_service.sh
```

What changed and might need attention in your `config/config.json`:

| | |
|---|---|
| `adminAction` | `pm2 restart all` becomes `systemctl --user restart teleframe.service`. `systemctl openvpn start` was never valid syntax and is now `sudo systemctl start openvpn`. |
| `screenConfig` | `tvservice` no longer exists. The shipped configurations use `wlopm` (HDMI) and the sysfs backlight (DSI) instead - see [config/screens/README.md](config/screens/README.md). |
| `screenSwitchOptions.pin` | The Sunfounder screen is now driven with `pinctrl`, which uses **BCM** GPIO numbering instead of WiringPi numbering. |

Custom addons keep working; the addon interface is unchanged.

## Addon interface

TeleFrame provides an addon interface to implement own extensions. See [documentation addon interface](addons/README.md).

## Bot only mode (no GUI)

To run only the bot (without GUI), that saves the recieved images and videos into the folder specified in the config you need to run

```bash
npm run botonly
```
in the TeleFrame folder.

## Building a TeleFrame

A detailed instruction on how to build your own TeleFrame will follow soon.
