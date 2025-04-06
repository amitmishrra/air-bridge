const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const { exec } = require("child_process");
const os = require("os");
const dnssd = require("dnssd");

let mainWindow;

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
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Create the system tray icon
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirname, "assets", "tray-icon.png")
  ); // Path to your tray icon
  tray = new Tray(trayIcon);

  // Create a context menu for the tray
  const trayMenu = Menu.buildFromTemplate([
    {
      label: "Open App",
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  // Set the context menu to the tray icon
  tray.setContextMenu(trayMenu);

  // Make the tray icon respond to click
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // Show the app window if it's not focused
  mainWindow.on("show", () => {
    tray.setHighlightMode("always");
  });

  // Hide the app when it's closed
  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
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
