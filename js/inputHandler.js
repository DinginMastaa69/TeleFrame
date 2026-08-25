const { globalShortcut } = require("electron");

var InputHandler = class {
  constructor(config, emitter, bot, logger) {
    this.config = config;
    this.logger = logger;
    this.emitter = emitter;
    this.bot = bot;
  }

  init() {
    if (this.config.keys === null) {
      this.logger.warn("Keyboard controls are disabeled");
      return;
    }

    const bindings = {
      next: "next",
      previous: "previous",
      pause: "pause",
      play: "play"
    };

    let failed = [];
    for (const action of Object.keys(bindings)) {
      const accelerator = this.config.keys[action];
      if (!accelerator) {
        continue;
      }
      try {
        if (!globalShortcut.register(accelerator, () => {
          this.emitter.send(bindings[action]);
        })) {
          failed.push(accelerator);
        }
      } catch (error) {
        failed.push(accelerator);
      }
    }

    if (failed.length > 0) {
      // globalShortcut needs an X11 grab and does not work on Wayland, which
      // is the default session on Raspberry Pi OS 13 (labwc). The renderer
      // handles the same keys via DOM events, so this is only a notice.
      this.logger.warn(
        `Could not register global shortcut(s) ${failed.join(", ")} - ` +
        `expected on Wayland. TeleFrame handles these keys in the window instead.`
      );
    }
  }
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = InputHandler;
}
