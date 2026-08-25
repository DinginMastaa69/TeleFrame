#!/usr/bin/env bash
#
# Installs TeleFrame as a systemd user service and starts it from the
# labwc session. Safe to run repeatedly.
#
# Raspberry Pi OS 13 boots into a Wayland session (labwc), so the old
# /etc/xdg/lxsession/LXDE-pi/autostart and pm2 mechanisms no longer apply.

set -eu

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT_FILE="$UNIT_DIR/teleframe.service"
LABWC_USER_AUTOSTART="$HOME/.config/labwc/autostart"
LABWC_SYSTEM_AUTOSTART="/etc/xdg/labwc/autostart"

echo -e "\e[96mInstalling systemd user service ...\e[0m"
mkdir -p "$UNIT_DIR"
sed "s|@@REPO_DIR@@|$REPO_DIR|g" "$REPO_DIR/tools/systemd/teleframe.service.in" > "$UNIT_FILE"
systemctl --user daemon-reload
echo -e "\e[92mInstalled $UNIT_FILE\e[0m"

echo -e "\e[96mHooking TeleFrame into the labwc session ...\e[0m"
mkdir -p "$(dirname "$LABWC_USER_AUTOSTART")"

if [ ! -f "$LABWC_USER_AUTOSTART" ]; then
    if [ -f "$LABWC_SYSTEM_AUTOSTART" ]; then
        # IMPORTANT: labwc uses the FIRST autostart file it finds in the XDG
        # hierarchy - a user file replaces the system one completely. Without
        # this copy the desktop (pcmanfm-pi) and the panel (wf-panel-pi) would
        # silently disappear.
        echo -e "\e[90mCopying $LABWC_SYSTEM_AUTOSTART so the desktop keeps working\e[0m"
        cp "$LABWC_SYSTEM_AUTOSTART" "$LABWC_USER_AUTOSTART"
    else
        : > "$LABWC_USER_AUTOSTART"
    fi
fi

if grep -q "teleframe.service" "$LABWC_USER_AUTOSTART"; then
    echo -e "\e[93mlabwc autostart already references teleframe.service, leaving it alone\e[0m"
else
    cat >> "$LABWC_USER_AUTOSTART" <<'AUTOSTART'

# TeleFrame: hand the Wayland session environment to the systemd user instance
# and start the frame.
systemctl --user import-environment WAYLAND_DISPLAY XDG_RUNTIME_DIR DISPLAY XDG_SESSION_TYPE
systemctl --user start teleframe.service
AUTOSTART
    echo -e "\e[92mAppended TeleFrame startup to $LABWC_USER_AUTOSTART\e[0m"
fi

echo ""
echo -e "\e[92mDone.\e[0m"
echo "  start now:  systemctl --user start teleframe"
echo "  status:     systemctl --user status teleframe"
echo "  logs:       journalctl --user-unit=teleframe.service -f"
echo "  stop:       systemctl --user stop teleframe"
echo ""
echo "TeleFrame starts automatically with the next labwc session (reboot)."
