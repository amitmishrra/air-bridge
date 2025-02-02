const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const os = require("os");

let mainWindow;

app.whenReady().then(() => {
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
});

// Check ADB Version
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

// List Connected Devices
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

// Connect to Device

ipcMain.handle("connect-device", async (event, ip, host, port) => {
  return new Promise((resolve, reject) => {
    console.log(`Connecting to device at ${ip}${host}:${port}`);
    exec(`adb connect ${ip}${host}:${port}`, (error, stdout, stderr) => {
      // Fixed command format
      console.log("Error:", error);
      console.log("stdout:", stdout);
      console.log("stderr:", stderr);

      if (error || stderr) {
        // Handle error and send back failure message
        console.error("Error or stderr detected:", error || stderr);
        reject({
          type: "error",
          case: "CONNECT_FAILED",
          msg: `Failed to connect: ${error?.message || stderr}`,
        });
        return; // Early exit if there's an error
      }

      // Check stdout for connection success or failure
      let response = {
        type: "success",
        msg: "",
      };

      if (
        stdout.includes("already connected") ||
        stdout.includes("connected to")
      ) {
        // Successful connection
        response = {
          type: "success",
          msg: "Device connected successfully.",
          ip: `${ip}${host}:${port}`,
        };
      } else if (stdout.includes("failed to connect")) {
        // Handle failure to connect
        response = {
          type: "error",
          case: "NOT_PAIRED",
          msg: "The device is not paired, please pair by entering the pairing code!",
        };
      } else {
        // General failure if no known output
        response = {
          type: "error",
          case: "FAILED",
          msg: stdout || "Unknown error occurred during connection.",
        };
      }

      resolve(response); // Resolve with the correct response based on stdout
    });
  });
});

// Disconnect a Device
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

//192.168.29.183:39237

ipcMain.handle("get-ip", async () => {
  try {
    const localIP = getLocalIP();
    console.log("Local IP Address:", localIP);
    return localIP;
  } catch (error) {
    console.error("Error fetching IP:", error);
    throw error;
  }
});

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

ipcMain.handle("pair-device", async (event, ip, host, port, code) => {
  return new Promise((resolve, reject) => {
    console.log(`Pairing device at ${ip}${host}:${port} ${code}`);
    exec(`adb pair ${ip}${host}:${port} ${code}`, (error, stdout, stderr) => {
      // Fixed command format
      // console.log("Error:", error);
      // console.log("stdout:", stdout);
      // console.log("stderr:", stderr);

      if (error || stderr) {
        // Handle error and send back failure message
        // console.error("Error or stderr detected:", error || stderr);
        reject({
          type: "error",
          case: "PAIR_FAILED",
          msg: `Failed to pair device: ${error?.message || stderr}`,
        });
        return; // Early exit if there's an error
      }

      // Check stdout for pairing success or failure
      let response = {
        type: "success",
        msg: "",
      };

      if (stdout.includes("Success") || stdout.includes("Device paired")) {
        // Successful pairing
        response = {
          type: "success",
          msg: "Device paired successfully.",
        };
      } else if (stdout.includes("failed to pair")) {
        // Handle failure to pair
        response = {
          type: "error",
          case: "PAIR_FAILED",
          msg: "Failed to pair the device. Please check the pairing code and try again.",
        };
      } else {
        // General failure if no known output
        response = {
          type: "error",
          case: "FAILED",
          msg: stdout || "Unknown error occurred during pairing.",
        };
      }

      resolve(response); // Resolve with the correct response based on stdout
    });
  });
});
