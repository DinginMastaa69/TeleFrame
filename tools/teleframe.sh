#!/usr/bin/env bash
#
# Launcher for TeleFrame.
#
# Replaces the old tf.sh / tf_bo.sh / tf_wfi.sh / tf_wfi_bo.sh scripts, which
# hardcoded /home/pi and DISPLAY=:0. Waiting for the network is no longer done
# here either - the bot retries on its own when polling cannot be started.
#
# usage: teleframe.sh [--botonly]

set -u

REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
cd "$REPO_DIR" || exit 1

export AUDIODRIVER=alsa

# systemd user services do not necessarily inherit the session environment
: "${XDG_RUNTIME_DIR:=/run/user/$(id -u)}"
export XDG_RUNTIME_DIR

if [ -z "${WAYLAND_DISPLAY:-}" ] && [ -S "$XDG_RUNTIME_DIR/wayland-0" ]; then
    export WAYLAND_DISPLAY=wayland-0
fi

if [ -z "${DISPLAY:-}" ] && [ -S /tmp/.X11-unix/X0 ]; then
    export DISPLAY=:0
fi

# Pick the display platform explicitly.
#
# Neither `--ozone-platform-hint=auto` nor `=wayland` is reliable here: the hint
# is resolved against XDG_SESSION_TYPE, which is "tty" over SSH and in a systemd
# unit that did not import the session environment, so Electron silently falls
# back to X11/Xwayland - where ANGLE cannot create a GL context on the Pi
# ("Could not create a backing OpenGL context") and the window never appears.
# The presence of the Wayland socket is the reliable signal, and
# `--ozone-platform` (without "-hint") is honoured unconditionally.
if [ -n "${TELEFRAME_OZONE_PLATFORM:-}" ]; then
    OZONE_PLATFORM="$TELEFRAME_OZONE_PLATFORM"
elif [ -n "${WAYLAND_DISPLAY:-}" ]; then
    OZONE_PLATFORM=wayland
else
    OZONE_PLATFORM=x11
fi

if [ "${1:-}" = "--botonly" ]; then
    exec node "$REPO_DIR/botonly.js"
fi

# Use the real binary rather than node_modules/.bin/electron: that wrapper is a
# node script (#!/usr/bin/env node) and would need `node` on PATH, which a
# systemd user unit does not guarantee.
ELECTRON="$REPO_DIR/node_modules/electron/dist/electron"
if [ ! -x "$ELECTRON" ]; then
    ELECTRON="$REPO_DIR/node_modules/.bin/electron"
fi
if [ ! -x "$ELECTRON" ]; then
    echo "TeleFrame: electron not found - run 'npm install' first." >&2
    exit 1
fi

# exec directly instead of going through `npm start`, which would keep an
# extra node process (~30 MB) alive for nothing.
exec "$ELECTRON" --ozone-platform="$OZONE_PLATFORM" "$REPO_DIR"
