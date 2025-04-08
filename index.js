const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  dialog,
} = require("electron");
const { exec } = require("child_process");
const os = require("os");
const dnssd = require("dnssd");
const path = require("path");

let mainWindow;
let win;

// -----------------------------------------------------------------------------
// Electron App: Create main window and load UI
// -----------------------------------------------------------------------------
app.whenReady().then(() => {
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");
});

// Quit the app when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// -----------------------------------------------------------------------------
// get-discovered-devices: One-time scan using mDNS for nearby ADB devices
// Returns discovered devices to renderer after short delay
// -----------------------------------------------------------------------------
ipcMain.handle("get-discovered-devices", async () => {
  return new Promise((resolve) => {
    const browser = new dnssd.Browser(dnssd.tcp("adb-tls-connect"));
    let _discoveredDevices = [];

    browser.on("serviceUp", (service) => {
      const ipv4 = service?.addresses?.find((addr) =>
        /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(addr)
      );
      const device = {
        name: service.name,
        address: ipv4 || service.addresses[0],
        port: service.port,
      };

      const alreadyExists = _discoveredDevices.some(
        (d) => d.address === device.address && d.port === device.port
      );

      if (!alreadyExists) {
        _discoveredDevices.push(device);
      }
    });

    browser.start();

    setTimeout(() => {
      browser.stop();
      mainWindow.webContents.send("device-found", _discoveredDevices);
      resolve(_discoveredDevices);
    }, 3000);
  });
});

// -----------------------------------------------------------------------------
// get-adb-version: Checks if ADB is installed and returns version info
// -----------------------------------------------------------------------------
ipcMain.handle("get-adb-version", async () => {
  return new Promise((resolve) => {
    exec("adb version", (error, stdout, stderr) => {
      if (error || stderr) {
        resolve("ADB not found");
      } else {
        resolve(stdout);
      }
    });
  });
});

// -----------------------------------------------------------------------------
// list-connected-devices: Lists devices currently connected via ADB
// -----------------------------------------------------------------------------
ipcMain.handle("list-connected-devices", async () => {
  return new Promise((resolve) => {
    exec("adb devices", (error, stdout) => {
      const devices = stdout
        .split("\n")
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line !== "" && line.includes("\tdevice"));
      resolve(devices.map((device) => device.split("\t")[0]));
    });
  });
});

// -----------------------------------------------------------------------------
// connect-device: Manually connect to a device using IP, host, and port
// Returns success or error message based on ADB output
// -----------------------------------------------------------------------------
ipcMain.handle("connect-device", async (event, ip, host, port) => {
  return new Promise((resolve, reject) => {
    exec(`adb connect ${ip}${host}:${port}`, (error, stdout, stderr) => {
      if (error || stderr) {
        reject({
          type: "error",
          case: "CONNECT_FAILED",
          msg: `Failed to connect: ${error?.message || stderr}`,
        });
        return;
      }

      let response = {
        type: "success",
        msg: "",
      };

      if (
        stdout.includes("already connected") ||
        stdout.includes("connected to")
      ) {
        response = {
          type: "success",
          msg: "Device connected successfully.",
          ip: `${ip}${host}:${port}`,
        };
      } else if (stdout.includes("failed to connect")) {
        response = {
          type: "error",
          case: "NOT_PAIRED",
          msg: "The device is not paired, please pair by entering the pairing code!",
        };
      } else {
        response = {
          type: "error",
          case: "FAILED",
          msg: stdout || "Unknown error occurred during connection.",
        };
      }

      resolve(response);
    });
  });
});

// -----------------------------------------------------------------------------
// connect-device-automatically: Auto connect using host:port only
// Same logic as manual connect
// -----------------------------------------------------------------------------
ipcMain.handle("connect-device-automatically", async (event, host, port) => {
  return new Promise((resolve, reject) => {
    exec(`adb connect ${host}:${port}`, (error, stdout, stderr) => {
      if (error || stderr) {
        reject({
          type: "error",
          case: "CONNECT_FAILED",
          msg: `Failed to connect: ${error?.message || stderr}`,
        });
        return;
      }

      let response = {
        type: "success",
        msg: "",
      };

      if (
        stdout.includes("already connected") ||
        stdout.includes("connected to")
      ) {
        response = {
          type: "success",
          msg: "Device connected successfully.",
          ip: `${host}:${port}`,
        };
      } else if (stdout.includes("failed to connect")) {
        response = {
          type: "error",
          case: "NOT_PAIRED",
          msg: "The device is not paired, please pair by entering the pairing code!",
        };
      } else {
        response = {
          type: "error",
          case: "FAILED",
          msg: stdout || "Unknown error occurred during connection.",
        };
      }

      resolve(response);
    });
  });
});

// -----------------------------------------------------------------------------
// disconnect-device: Disconnects a specific device using ADB
// -----------------------------------------------------------------------------
ipcMain.handle("disconnect-device", async (event, deviceId) => {
  return new Promise((resolve, reject) => {
    exec(`adb disconnect ${deviceId}`, (error, stdout, stderr) => {
      if (error || stderr) {
        reject(`Failed to disconnect: ${error.message || stderr}`);
      } else {
        resolve("Device disconnected successfully");
      }
    });
  });
});

// -----------------------------------------------------------------------------
// get-ip: Returns the current local IP address of the machine
// -----------------------------------------------------------------------------
ipcMain.handle("get-ip", async () => {
  try {
    const localIP = getLocalIP();
    return localIP;
  } catch (error) {
    throw error;
  }
});

// -----------------------------------------------------------------------------
// getLocalIP: Finds the first non-internal IPv4 address
// -----------------------------------------------------------------------------
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (let iface in interfaces) {
    for (let address of interfaces[iface]) {
      if (!address.internal && address.family === "IPv4") {
        return address.address;
      }
    }
  }
  throw new Error("No valid IP address found");
}

// -----------------------------------------------------------------------------
// pair-device: Pairs the desktop with a device using pairing code
// Returns success or failure based on ADB output
// -----------------------------------------------------------------------------
ipcMain.handle("pair-device", async (event, ip, host, port, code) => {
  return new Promise((resolve, reject) => {
    exec(`adb pair ${ip}${host}:${port} ${code}`, (error, stdout, stderr) => {
      if (error || stderr) {
        reject({
          type: "error",
          case: "PAIR_FAILED",
          msg: `Failed to pair device: ${error?.message || stderr}`,
        });
        return;
      }

      let response = {
        type: "success",
        msg: "",
      };

      if (stdout.includes("Success") || stdout.includes("Device paired")) {
        response = {
          type: "success",
          msg: "Device paired successfully.",
        };
      } else if (stdout.includes("failed to pair")) {
        response = {
          type: "error",
          case: "PAIR_FAILED",
          msg: "Failed to pair the device. Please check the pairing code and try again.",
        };
      } else {
        response = {
          type: "error",
          case: "FAILED",
          msg: stdout || "Unknown error occurred during pairing.",
        };
      }

      resolve(response);
    });
  });
});

// -----------------------------------------------------------------------------
// fetch-device-info: Gathers device details (brand, model, battery, etc.)
// using ADB shell commands
// -----------------------------------------------------------------------------
ipcMain.handle("fetch-device-info", async (event, deviceId) => {
  const execShell = (cmd) =>
    new Promise((resolve) => {
      exec(cmd, (err, stdout) => resolve(stdout.trim()));
    });

  const rawBattery = await execShell(
    `adb -s ${deviceId} shell dumpsys battery`
  );
  const batteryMatch = rawBattery.match(/level: (\d+)/);
  const battery = batteryMatch ? batteryMatch[1] : "Unknown";

  const deviceInfo = {
    brand: await execShell(
      `adb -s ${deviceId} shell getprop ro.product.manufacturer`
    ),
    model: await execShell(`adb -s ${deviceId} shell getprop ro.product.model`),
    androidVersion: await execShell(
      `adb -s ${deviceId} shell getprop ro.build.version.release`
    ),
    sdkVersion: await execShell(
      `adb -s ${deviceId} shell getprop ro.build.version.sdk`
    ),
    osBuild: await execShell(
      `adb -s ${deviceId} shell getprop ro.build.display.id`
    ),
    battery: battery,
  };

  return deviceInfo;
});

ipcMain.handle("dialog:openApk", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "APK Files", extensions: ["apk"] }],
  });
  return result;
});

// -----------------------------------------------------------------------------
// install-apk: Installs an APK on the connected device using ADB
// -----------------------------------------------------------------------------
ipcMain.handle("install-apk", async (event, apkPath, deviceId) => {
  return new Promise((resolve, reject) => {
    if (!apkPath || !apkPath.endsWith(".apk")) {
      reject({
        type: "error",
        msg: "Invalid APK path.",
      });
      return;
    }
    if (!deviceId) {
      reject({
        type: "error",
        msg: "Device ID is required when multiple devices are connected.",
      });
      return;
    }

    exec(`adb -s ${deviceId} install "${apkPath}"`, (error, stdout, stderr) => {
      if (error || stderr.includes("Failure")) {
        reject({
          type: "error",
          msg: `Failed to install APK: ${error?.message || stderr}`,
        });
      } else {
        resolve({ type: "success", msg: "APK installed successfully." });
      }
    });
  });
});



// -----------------------------------------------------------------------------
// get-installed-apks: Fetches all installed APKs on a specific device
// -----------------------------------------------------------------------------
ipcMain.handle('get-installed-apks', async (event, deviceId) => {
  return new Promise((resolve, reject) => {
      exec(`adb -s ${deviceId} shell pm list packages -3`, (err, stdout) => {
          if (err) return reject(err);
          const packages = stdout.split('\n')
              .filter(line => line.trim() !== '')
              .map(line => line.replace('package:', '').trim());
          resolve(packages);
      });
  });
});

ipcMain.handle('uninstall-app', async (event, deviceId, packageName) => {
  return new Promise((resolve) => {
      exec(`adb -s ${deviceId} uninstall ${packageName}`, (err, stdout) => {
          if (err || !stdout.includes('Success')) {
              resolve({ success: false });
          } else {
              resolve({ success: true });
          }
      });
  });
});

// -----------------------------------------------------------------------------
// Mirror Screen
// -----------------------------------------------------------------------------
ipcMain.on('mirror-screen', (event, deviceId) => {
  const scrcpyPath = path.join(__dirname, 'bin/scrcpy-win64', 'scrcpy.exe');
  const command = `"${scrcpyPath}" -s ${deviceId}`;

  exec(command, (error, stdout, stderr) => {
      if (error) {
          console.error(`scrcpy error: ${stderr}`);
          return;
      }
      console.log(`scrcpy started: ${stdout}`);
  });
});