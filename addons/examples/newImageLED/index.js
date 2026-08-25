const {exec, execSync} = require("child_process");

/**
 * Start blinking of an LED when a new image arrives.
 * @param  {AddonBase} interface   object to register and send events
 */
const newImageNotifyLed = (interface) => {
  // check if pin was configured
  if (typeof interface.config.newLedGPIO !== 'number') {
    const error = `LED pin is not definied!`;
    interface.logger.error(error);
    throw error;
  }

  // id returnd from setInterval from updateLedStatus()
  let blinkTimerId;

  /**
   * Build the command that drives the LED pin.
   *
   * WiringPi (`gpio`) no longer ships with Raspberry Pi OS, so `pinctrl` from
   * the raspi-utils package is used instead. Both address the pin by its BCM
   * GPIO number, so an existing `newLedGPIO` configuration keeps working.
   * `op` configures the pin as an output, `dh`/`dl` drive it high/low.
   * @param  {number} status 1 to switch the LED on, 0 to switch it off
   * @return {string}        the command to execute
   */
  const setPin = (status) => `pinctrl set ${interface.config.newLedGPIO} op ${status ? 'dh' : 'dl'}`;

  /**
   * Execute the system command async
   * @param  {string} cmd [description]
   */
  const execCmd = (cmd) => {
    exec(cmd, (execError, _stdout, stderr) => {
      if (execError) {
        interface.logger.error(`Executing: ${cmd} ! ${stderr}`);
      }
    })
    //interface.logger.warn('exec', cmd)
  };

  /**
   * Update the led blink status
   */
  const updateLedStatus = () => {
    // build the unseen images count
    let unseenCnt = 0;
    interface.images.forEach(img => {
      if (img.unseen) {
          ++unseenCnt;
      }
    });
    // remove running timer
    clearInterval(blinkTimerId);
    if (unseenCnt > 0) {
      // initialize interval
      let interval = interface.config.blinkInterval || 1500;
      // blink faster if more then one unseen image exists
      if (unseenCnt > 1) {
        interval /= 2;
      }
      // start the timer to update status and execute the pinctrl command
      let ledStatus = 0;
      blinkTimerId = setInterval(() => {
        ledStatus = (ledStatus === 1 ? 0 : 1);
        execCmd(setPin(ledStatus));
      }, interval);
    } else {
      // turn led off
      execCmd(setPin(0));
    }
  }

  // initialize the pin as a low output.
  // execSync throws an error if the command has failed
  execSync(setPin(0));

  // registser listeners
  interface.registerListener(['images-loaded', 'newImage', 'imageUnseenRemoved', 'imageDeleted'], updateLedStatus);
};


/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = newImageNotifyLed
}
