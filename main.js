const fs = require("fs");
const exec = require("child_process").execSync;
const { app, BrowserWindow, ipcMain } = require("electron");
const remoteMain = require("@electron/remote/main");
const { logger, rendererLogger } = require("./js/logger");
const telebot = require("./js/bot");
const imagewatcher = require("./js/imageWatchdog");
const inputhandler = require("./js/inputHandler");
const voicerecorder = require("./js/voiceRecorder");
const schedules = require("./js/schedules");
const CommandExecutor = require("./js/systemCommands");
const {config, screen} = require("./js/configuration");
const initAddonInterface = require('./js/addonInterface').initAddonInterface;

logger.info("Configuring for: " +  screen.name);

// initialize @electron/remote, which replaces the `remote` module that was
// removed from the Electron core in v14.
remoteMain.initialize();

//create global variables
global.config = config;
global.screen = screen;
global.rendererLogger = rendererLogger;
global.images = [];


logger.info("Main app started ...");

/**
 * Switch off the on board LEDs.
 * Kernel 6.x on Raspberry Pi OS exposes them as ACT/PWR, the legacy names
 * led0/led1 are gone. Missing LEDs (or a missing sudo rule) must not keep
 * TeleFrame from starting, so every write is guarded.
 */
const switchLedsOff = () => {
  ['ACT', 'PWR', 'led0', 'led1'].forEach((led) => {
    const brightness = `/sys/class/leds/${led}/brightness`;
    if (!fs.existsSync(brightness)) {
      return;
    }
    try {
      exec(`sudo sh -c 'echo 0 > ${brightness}'`, { encoding: 'utf-8' });
      logger.info(`Switched off LED ${led}`);
    } catch (error) {
      logger.warn(`Could not switch off LED ${led}: ${error.message}`);
    }
  });
};

if (config.switchLedsOff) {
  switchLedsOff();
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Note: the display platform CANNOT be selected from here. Chromium picks the
// Ozone platform before this script runs, so app.commandLine.appendSwitch()
// comes too late - the switch is stored but ignored. It has to be a real
// command line argument, which is what tools/teleframe.sh (and therefore
// `npm start`) passes.
//
// Warn when TeleFrame was started directly with `electron .` in a Wayland
// session: Electron then defaults to X11/Xwayland, where ANGLE cannot create a
// GL context on the Pi ("Could not create a backing OpenGL context") and the
// window never appears.
if (process.env.WAYLAND_DISPLAY && !app.commandLine.hasSwitch("ozone-platform")) {
  logger.warn(
    "WAYLAND_DISPLAY is set but Electron was started without --ozone-platform=wayland. " +
    "The window will likely fail to open. Start TeleFrame with `npm start` or " +
    "tools/teleframe.sh instead of `electron .`."
  );
}
// Sets the Wayland app_id / X11 WM_CLASS so compositor window rules can
// address TeleFrame, e.g. to pin it to a specific output.
app.commandLine.appendSwitch("class", "TeleFrame");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
  // Create the browser window, using the resolution of the configured screen.
  win = new BrowserWindow({
    width: screen.xres || 1024,
    height: screen.yres || 600,
    webPreferences: {
      nodeIntegration: true,
      // Required since Electron 12 so that nodeIntegration and
      // @electron/remote are available in the renderer.
      contextIsolation: false
    },
  });

  // allow this window to use @electron/remote
  remoteMain.enable(win.webContents);

  win.setFullScreen(config.fullscreen);
  // and load the index.html of the app.
  win.loadFile("index.html");

  // reload request coming from the renderer (replaces remote.getCurrentWindow())
  ipcMain.on("reloadWindow", () => {
    if (win) {
      win.reload();
    }
  });

  // get instance of webContents for sending messages to the frontend
  const emitter = win.webContents;

  // initialize the addon handler
  const addonInterface = initAddonInterface(global.images, logger, emitter, ipcMain, config);

  // create imageWatchdog and bot
  var imageWatchdog = new imagewatcher(
    config.imageFolder,
    config.imageCount,
    config.autoDeleteImages,
    global.images,
    emitter,
    logger,
    ipcMain,
    // load addons
    addonInterface
  );
  imageWatchdog.init()

  var bot = null;
  if (config.botToken !== 'bot-disabled') {
    bot = new telebot(
      imageWatchdog,
      logger,
      config
    );
  }

  var inputHandler = new inputhandler(config, emitter, bot, logger);
  inputHandler.init();

  var commandExecutor = new CommandExecutor(emitter, logger, ipcMain);
  commandExecutor.init();

  var voiceReply = null;
  if (config.voiceReply !== null) {
    voiceReply = new voicerecorder(config, emitter, bot, logger, ipcMain, addonInterface);
    voiceReply.init();
  }

  // generate scheduler, when times for turning monitor off and on
  // are given in the config file
  var scheduler = new schedules(config, screen, logger, addonInterface);


  // Open the DevTools.
  if (config.develop) {
    win.webContents.openDevTools()
  }

  if (config.botToken !== 'bot-disabled') {
    bot.startBot();
    // stop long polling cleanly so `systemctl --user restart teleframe` and
    // Ctrl-C do not leave a dangling getUpdates connection behind.
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.once(signal, () => {
        logger.info(`Received ${signal}, stopping bot ...`);
        bot.stopBot(signal);
      });
    });
  }

  addonInterface.executeEventCallbacks('teleFrame-ready', {
    config: config,
    screen: screen,
    imageWatchdog: imageWatchdog,
    bot: bot,
    voiceReply: voiceReply,
    scheduler: scheduler
  });

  // Emitted when the window is closed.
  win.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
