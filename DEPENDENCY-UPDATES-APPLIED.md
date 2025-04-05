# Dependency Updates Applied

## Updated Dependencies
All dependencies have been updated to their latest versions:

| Package | Old Version | New Version |
|---------|------------|-------------|
| @fortawesome/fontawesome-free | 5.12.0 | 6.7.2 |
| chroma-js | 2.1.0 | 3.1.2 |
| dotenv | 8.2.0 | 16.4.7 |
| electron | 13.6.6 | 35.1.4 |
| image-downloader | 3.5.0 | 4.3.0 |
| jquery | 3.5.0 | 3.7.1 |
| moment | 2.29.2 | 2.30.1 |
| node-audiorecorder | 1.4.2 | 3.0.0 |
| node-schedule | 1.3.2 | 2.1.1 |
| randomcolor | 0.5.4 | 0.6.2 |
| sweetalert2 | 9.5.4 | 11.17.2 |
| telegraf | 3.35.0 | 4.16.3 |
| winston | 3.2.1 | 3.17.0 |

Additionally, added:
- @electron/remote (2.1.2) - Required for Electron's remote module functionality

## Code Changes to Accommodate New Versions

### Electron Updates (v13 → v35)
1. Added contextIsolation: false in webPreferences
2. Added @electron/remote package to replace deprecated remote module:
   ```js
   const remote = require('@electron/remote');
   ```
3. Initialize remote in main process:
   ```js
   const remoteMain = require('@electron/remote/main');
   remoteMain.initialize();
   ```
4. Enable remote on window creation:
   ```js
   remoteMain.enable(win.webContents);
   ```
5. Added no-sandbox option to avoid permission issues in development environments

### Telegraf Updates (v3 → v4)
1. Updated import syntax for Telegraf:
   ```js
   const { Telegraf } = require("telegraf");
   const { Telegram } = require("telegraf");
   const { Extra } = require('telegraf');
   ```
2. Updated bot launching method:
   ```js
   this.bot.launch()
     .then(() => {
       this.logger.info("Bot started!");
     })
     .catch(err => {
       this.logger.error("Bot failed to start:", err);
       setTimeout(() => self.startBot(), 30000);
     });
   
   // Enable graceful stop
   process.once('SIGINT', () => this.bot.stop('SIGINT'));
   process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
   ```

### image-downloader Updates (v3 → v4)
1. Updated the download API call:
   ```js
   // Old
   download.image({...})
   
   // New
   download({...})
   ```

## Running the Application
1. Standard start:
   ```
   npm start
   ```

2. With no-sandbox (for development environments):
   ```
   npm run start-nosandbox
   ```

## Security Notes
- The `--no-sandbox` option is added for development environments
- In production, ensure the Chrome sandbox permissions are properly set up:
  ```
  sudo chown root:root /path/to/chrome-sandbox && sudo chmod 4755 /path/to/chrome-sandbox
  ```