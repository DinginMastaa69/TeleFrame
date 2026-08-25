#!/usr/bin/env bash

# Installer for TeleFrame on Raspberry Pi OS 12 (bookworm) / 13 (trixie).
#
# Tested on: Raspberry Pi 4 Model B, Raspberry Pi OS 13.6 (arm64), labwc session.
#
# It can be run in two ways:
#   1. from inside an existing clone:  bash tools/install_raspberry.sh
#   2. standalone, which clones into ~/TeleFrame:
#      bash -c "$(curl -sL https://raw.githubusercontent.com/LukeSkywalker92/TeleFrame/master/tools/install_raspberry.sh)"

set -u

echo -e "\e[0m"
echo '_________ _______  _        _______  _______  _______  _______  _______  _______ '
echo '\__   __/(  ____ \( \      (  ____ \(  ____ \(  ____ )(  ___  )(       )(  ____ \'
echo '   ) (   | (    \/| (      | (    \/| (    \/| (    )|| (   ) || () () || (    \/'
echo '   | |   | (__    | |      | (__    | (__    | (____)|| (___) || || || || (__    '
echo '   | |   |  __)   | |      |  __)   |  __)   |     __)|  ___  || |(_)| ||  __)   '
echo '   | |   | (      | |      | (      | (      | (\ (   | (   ) || |   | || (      '
echo '   | |   | (____/\| (____/\| (____/\| )      | ) \ \__| )   ( || )   ( || (____/\'
echo '   )_(   (_______/(_______/(_______/|/       |/   \__/|/     \||/     \|(_______/'
echo -e "\e[0m"

# Node.js version to install. Electron >= 40 requires node >= 22.12,
# Debian trixie only ships node 20, so NodeSource is used.
NODE_MAJOR="24"
NODE_MINIMUM="v22.12.0"

ARM=$(uname -m)

# Installation as root account is not supported
if [ "$EUID" == "0" ]; then
	echo -e "\e[91mSorry, automated installation as user root is not supported."
	echo -e "\e[91mPlease run the TeleFrame install script as a normal user.\e[0m"
	exit 1
fi

# Check the architecture. Raspberry Pi OS is 64 bit (aarch64) by default since
# Bookworm; the old installer refused anything but armv7l and therefore failed
# on every modern Pi.
case "$ARM" in
	aarch64|arm64|armv7l)
		echo -e "\e[92mDetected architecture: $ARM\e[0m"
		;;
	*)
		echo -e "\e[91mSorry, the architecture '$ARM' is not supported."
		echo -e "\e[91mTeleFrame needs a Raspberry Pi 2/3/4/5 (armv7l or arm64)."
		echo -e "\e[91mOn a Pi Zero / Pi 1 you can still use the bot only mode.\e[0m"
		exit 1
		;;
esac

# Define helper methods.
function command_exists () { type "$1" &> /dev/null ;}
function version_gt() { test "$(echo "$@" | tr " " "\n" | sort -V | head -n 1)" != "$1"; }

# Get user wishes
read -p "Do you want TeleFrame to start automatically (systemd user service) (y/N)? " autostartchoice
read -p "Please tell me your telegram bot token. Token:  " token

# Update before first apt-get
echo -e "\e[96mUpdating packages ...\e[90m"
sudo apt-get update || echo -e "\e[91mUpdate failed, carrying on installation ...\e[90m"

# Helper tools.
# sox provides `rec`, which is used for the voice reply feature.
echo -e "\e[96mInstalling helper tools ...\e[90m"
sudo apt-get --assume-yes install curl wget git build-essential unzip sox libsox-fmt-all || exit 1

# Electron runtime libraries. All of these are already present on a Raspberry
# Pi OS Desktop image; the list matters for Lite installations.
echo -e "\e[96mInstalling Electron runtime libraries ...\e[90m"
sudo apt-get --assume-yes install \
	libnss3 libgbm1 libdrm2 libxkbcommon0 libasound2t64 libnotify4 \
	libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgtk-3-0t64 \
	|| echo -e "\e[93mSome runtime libraries could not be installed - continuing.\e[90m"

# The KMS driver has been the default since Bullseye; dtoverlay=vc4-fkms-v3d
# is deprecated and /boot/config.txt moved to /boot/firmware/config.txt.
CONFIG_TXT="/boot/firmware/config.txt"
[ -f "$CONFIG_TXT" ] || CONFIG_TXT="/boot/config.txt"
if [ -f "$CONFIG_TXT" ] && ! grep -q "^dtoverlay=vc4-kms-v3d" "$CONFIG_TXT"; then
	echo -e "\e[93mNote: '${CONFIG_TXT}' does not enable the KMS driver."
	echo -e "\e[93mAdd 'dtoverlay=vc4-kms-v3d' there if the display stays black.\e[0m"
fi

# Check if we need to install or upgrade Node.js.
echo -e "\e[96mCheck current Node installation ...\e[0m"
NODE_INSTALL=false
if command_exists node; then
	NODE_CURRENT=$(node -v)
	echo -e "\e[0mMinimum Node version: \e[1m$NODE_MINIMUM\e[0m"
	echo -e "\e[0mInstalled Node version: \e[1m$NODE_CURRENT\e[0m"
	if version_gt "$NODE_MINIMUM" "$NODE_CURRENT"; then
		echo -e "\e[96mNode should be upgraded.\e[0m"
		NODE_INSTALL=true
	else
		echo -e "\e[92mNo Node.js upgrade necessary.\e[0m"
	fi
else
	echo -e "\e[93mNode.js is not installed.\e[0m"
	NODE_INSTALL=true
fi

if $NODE_INSTALL; then
	echo -e "\e[96mInstalling Node.js ${NODE_MAJOR}.x ...\e[90m"
	curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash - || exit 1
	sudo apt-get install -y nodejs || exit 1
	echo -e "\e[92mNode.js installation done - $(node -v)\e[0m"
fi

# Determine the TeleFrame directory. When the script runs from inside a clone
# that clone is used, otherwise TeleFrame is cloned into ~/TeleFrame.
SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || true)"
if [ -n "$SCRIPT_PATH" ] && [ -f "$(dirname "$SCRIPT_PATH")/../package.json" ]; then
	TELEFRAME_DIR="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
	echo -e "\e[92mUsing existing TeleFrame checkout at $TELEFRAME_DIR\e[0m"
else
	TELEFRAME_DIR="$HOME/TeleFrame"
	if [ -d "$TELEFRAME_DIR" ]; then
		echo -e "\e[93mIt seems like TeleFrame is already installed at $TELEFRAME_DIR."
		echo -e "To prevent overwriting, the installer will be aborted."
		echo -e "If you want to upgrade, run \e[1m\e[97mgit pull && npm install\e[0m\e[93m there.\e[0m"
		exit 1
	fi
	echo -e "\e[96mCloning TeleFrame ...\e[90m"
	git clone --depth=1 https://github.com/LukeSkywalker92/TeleFrame.git "$TELEFRAME_DIR" || {
		echo -e "\e[91mUnable to clone TeleFrame.\e[0m"; exit 1; }
fi

cd "$TELEFRAME_DIR" || exit 1

# Note: no --arch / npm_config_arch juggling any more. `uname -m` returns
# "aarch64", which is not a valid npm architecture ("arm64" is), and on a
# native build npm resolves the architecture correctly all by itself.
echo -e "\e[96mInstalling dependencies ...\e[90m"
if npm install; then
	echo -e "\e[92mDependencies installation done!\e[0m"
else
	echo -e "\e[91mUnable to install dependencies!\e[0m"
	exit 1
fi

# Create config containing the token, if there is none yet
if [ -n "$token" ] && [ ! -f config/config.json ]; then
	printf '{\n  "botToken": "%s"\n}\n' "$token" > config/config.json
	echo -e "\e[92mWrote config/config.json\e[0m"
elif [ -f config/config.json ]; then
	echo -e "\e[93mconfig/config.json already exists - not touching it.\e[0m"
fi

# Create image directory
mkdir -p images

# Check if plymouth is installed, then install the custom splashscreen.
echo -e "\e[96mCheck plymouth installation ...\e[0m"
if command_exists plymouth; then
	THEME_DIR="/usr/share/plymouth/themes"
	if [ -d $THEME_DIR ]; then
		sudo mkdir -p $THEME_DIR/TeleFrame
		if sudo cp "$TELEFRAME_DIR/splashscreen/splash.png" $THEME_DIR/TeleFrame/splash.png \
			&& sudo cp "$TELEFRAME_DIR/splashscreen/TeleFrame.plymouth" $THEME_DIR/TeleFrame/TeleFrame.plymouth \
			&& sudo cp "$TELEFRAME_DIR/splashscreen/TeleFrame.script" $THEME_DIR/TeleFrame/TeleFrame.script; then
			if sudo plymouth-set-default-theme -R TeleFrame; then
				echo -e "\e[92mSplashscreen: Changed theme to TeleFrame successfully.\e[0m"
			else
				echo -e "\e[91mSplashscreen: Couldn't change theme to TeleFrame!\e[0m"
			fi
		else
			echo -e "\e[91mSplashscreen: Copying theme failed!\e[0m"
		fi
	else
		echo -e "\e[91mSplashscreen: Themes folder doesn't exist!\e[0m"
	fi
else
	echo -e "\e[93mplymouth is not installed.\e[0m"
fi

# Autostart via systemd user service.
# Screen blanking and cursor hiding need no treatment any more: unclutter and
# xset are X11 tools, css/style.css already sets `cursor: none`, and the labwc
# session does not blank the screen by default.
if [[ $autostartchoice =~ ^[Yy]$ ]]; then
	bash "$TELEFRAME_DIR/tools/install_service.sh"
fi

echo " "
echo -e "\e[92mWe're ready!\e[0m"
echo -e "Start TeleFrame with \e[1m\e[97msystemctl --user start teleframe\e[0m"
echo -e "or manually from $TELEFRAME_DIR with \e[1m\e[97mnpm start\e[0m."
echo " "
