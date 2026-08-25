// TeleFrame install script
// Runs automatically as the npm `install` lifecycle script.

const fs = require('fs');
const path = require('path');
const {execSync, spawnSync} = require('child_process');

const repoDir = path.join(__dirname, '..');

// configure git to ignore filemode changes.
// Fails when TeleFrame was installed from a tarball instead of a git clone,
// which must not abort the whole `npm install`.
try {
  execSync('git config core.filemode false', {stdio: 'ignore', cwd: repoDir});
} catch (error) {
  console.warn('Skipping "git config core.filemode false" (not a git repository).');
}

// make the helper scripts executable.
// Note: 0755 is a legacy octal literal that throws in strict mode - use 0o755.
['addon_control.sh', 'teleframe.sh', 'screen_switch.sh', 'install_service.sh'].forEach((script) => {
  const scriptPath = path.join(__dirname, script);
  try {
    fs.chmodSync(scriptPath, 0o755);
  } catch (error) {
    console.warn(`Could not chmod ${scriptPath}: ${error.message}`);
  }
});

/**
 * Downloads the Electron binary.
 *
 * Since Electron 43 the package no longer ships a postinstall hook - the
 * binary is fetched lazily on first launch. That would mean the very first
 * boot of the frame needs a working internet connection, so it is fetched
 * here instead, while the user is watching `npm install`.
 */
const installElectron = () => {
  const electronInstaller = path.join(repoDir, 'node_modules', 'electron', 'install.js');
  if (!fs.existsSync(electronInstaller)) {
    // electron is not installed (e.g. `npm install --omit=optional` setups)
    return;
  }
  if (fs.existsSync(path.join(repoDir, 'node_modules', 'electron', 'path.txt'))) {
    // already downloaded; electron's installer is idempotent anyway
    return;
  }

  const env = Object.assign({}, process.env);

  // Old TeleFrame versions told users to put `export npm_config_arch=$(uname -m)`
  // into ~/.profile. On 64 bit systems that evaluates to "aarch64", which is not
  // a valid npm/Node architecture ("arm64" is) and makes Electron try to
  // download a build that does not exist. Drop bogus values.
  const VALID_ARCHITECTURES = [
    'arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel',
    'ppc', 'ppc64', 'riscv64', 's390', 's390x', 'x64'
  ];
  for (const variable of ['npm_config_arch', 'ELECTRON_INSTALL_ARCH']) {
    if (env[variable] && VALID_ARCHITECTURES.indexOf(env[variable]) === -1) {
      console.warn(
        `Ignoring ${variable}="${env[variable]}" - not a valid architecture. ` +
        `Using "${process.arch}" instead. You can remove that export from your ~/.profile.`
      );
      delete env[variable];
    }
  }

  console.log('Downloading the Electron binary ...');
  const result = spawnSync(process.execPath, [electronInstaller], {stdio: 'inherit', env, cwd: repoDir});
  if (result.status !== 0) {
    console.warn(
      'Could not download the Electron binary. TeleFrame will retry on the first start, ' +
      'or you can run "npx install-electron" manually once you are online.'
    );
  }
};

installElectron();
