// -----------------------------------------------------------------------------
// DOM Elements: Getting all necessary HTML elements used throughout the app
// -----------------------------------------------------------------------------
const connectBtn = document.getElementById("connectBtn");
const loader = document.getElementById("loaderContainer");
const adbVersionText = document.getElementById("adbVersion");
const infoBtn = document.getElementById("infoBtn");
const connectedMenuButton = document.getElementById("connectedMenuButton");
const apkUtilitiesModal = document.getElementById("apkUtilitiesModal");
const closeApkModal = document.getElementById("closeApkModal");
const closeModal = document.getElementById("closeModal");
const closePairingModal = document.getElementById("closePairingModal");
const wirelessGuideModal = document.getElementById("wirelessGuideModal");
const ipText = document.getElementById("ipPrefix");
const hostInput = document.getElementById("host");
const portInput = document.getElementById("port");
const pairingModal = document.getElementById("pairingModal");
const pairPortInput = document.getElementById("pairPort");
const pairCodeInput = document.getElementById("pairCode");
const pairButton = document.getElementById("pairButton");
const notConnected = document.getElementById("notConnected");
const connectedSection = document.getElementById("connectedSection");
const disconnectBtn = document.getElementById("disconnectBtn");
const downloadButton = document.getElementById("downloadButton");
const toggle = document.getElementById("modeToggle");
const label = document.getElementById("modeLabel");
const installApkBtn = document.getElementById("installApkBtn");
const installApkModal = document.getElementById("installApkModal");
const installingAPKModel = document.getElementById("installingAPKModel");
const closeInstallApkModal = document.getElementById("closeInstallApkModal");
const dropZone = document.getElementById("dropZone");
const apkFileInput = document.getElementById("apkFileInput");
const browseApkBtn = document.getElementById("browseApkBtn");
const apkFileDetails = document.getElementById("apkFileDetails");
const apkFileName = document.getElementById("apkFileName");
const apkFilePath = document.getElementById("apkFilePath");
const installApkFinalBtn = document.getElementById("installApkFinalBtn");
const uninstallApkBtn = document.getElementById("uninstallApkBtn");
const uninstallAppsModal = document.getElementById("uninstallAppsModal");
const closeUninstallAppsModal = document.getElementById(
  "closeUninstallAppsModal"
);
const appListContainer = document.getElementById("appList");
const uninstallLoader = document.getElementById("uninstallLoader");
const noAppsFound = document.getElementById("noAppsFound");
const searchApkInput = document.getElementById("searchApkInput");

let _currentDevice = "";
let networkId = "";
let _host = "";
let _port = "";
let selectedApkFile = null;
let appsData = [];

// -----------------------------------------------------------------------------
// Modal Control Events
// -----------------------------------------------------------------------------
infoBtn.onclick = () => (wirelessGuideModal.style.display = "block");
closeModal.onclick = () => (wirelessGuideModal.style.display = "none");
closePairingModal.onclick = () => (pairingModal.style.display = "none");
downloadButton.onclick = () =>
  shell.openExternal(
    "https://developer.android.com/studio/releases/platform-tools"
  );

// -----------------------------------------------------------------------------
// showMessage: Show temporary message to user
// @param {string} msg - message content
// @param {string} type - 'success' | 'error' (used for styling)
// -----------------------------------------------------------------------------
function showMessage(msg, type) {
  const messageBox = document.getElementById("messageBox");
  messageBox.textContent = msg;
  messageBox.className = `message-box ${type} show`;
  setTimeout(() => messageBox.classList.remove("show"), 4000);
}

// -----------------------------------------------------------------------------
// fetchADBVersion: Get and show installed ADB version
// @returns {Promise<string>} - ADB version string or error
// -----------------------------------------------------------------------------
async function fetchADBVersion() {
  loader.style.display = "flex";

  console.log(window);
  const version = await window?.electronAPI.getAdbVersion();
  loader.style.display = "none";

  if (version.includes("not found")) {
    document.getElementById("main").style.display = "none";
    document.getElementById("noADB").style.display = "block";
    return Promise.reject("ADB not found");
  } else {
    document.getElementById("main").style.display = "block";
    document.getElementById("noADB").style.display = "none";
    adbVersionText.textContent = version.split("\n")[0];
    return Promise.resolve(version);
  }
}

// -----------------------------------------------------------------------------
// loadDeviceDetails: Fetch and display info of a connected device
// @param {string} ipPort - IP and port of device (e.g., 192.168.1.101:5555)
// -----------------------------------------------------------------------------
async function loadDeviceDetails(ipPort) {
  const deviceInfo = await window?.electronAPI.fetchDeviceInfo(ipPort);
  if (deviceInfo) {
    document.getElementById("brand").textContent =
      deviceInfo.brand?.toUpperCase();
    document.getElementById("model").textContent = deviceInfo.model;
    document.getElementById("androidVersion").textContent =
      deviceInfo.androidVersion;
    document.getElementById("battery").textContent = deviceInfo.battery;
    document.getElementById("deviceInfoCard").style.display = "block";
  }
}

// -----------------------------------------------------------------------------
// fetchConnectedDevices: Check if a known device is still connected
// @returns {Promise<boolean>} - true if device is connected, else false
// -----------------------------------------------------------------------------
async function fetchConnectedDevices() {
  loader.style.display = "flex";
  const devices = await window?.electronAPI.listConnectedDevices();
  const currentDevice = await localStorage.getItem("adb_history");
  const isConnected = devices?.includes(currentDevice);
  var flag = false;

  if (isConnected) {
    await loadDeviceDetails(currentDevice);
    _currentDevice = currentDevice;
    notConnected.style.display = "none";
    connectedSection.style.display = "block";
    connectedMenuButton.style.display = "flex";
    infoBtn.style.display = "none";
    document.getElementById("connectedIp").innerText = currentDevice;
    flag = true;
  } else {
    await localStorage.clear();
    notConnected.style.display = "block";
    connectedSection.style.display = "none";
    connectedMenuButton.style.display = "none";
    infoBtn.style.display = "flex";
    await switchMode();
  }

  loader.style.display = "none";
  return flag;
}

// -----------------------------------------------------------------------------
// connectToDevice: Connect to device manually using IP and port
// -----------------------------------------------------------------------------
async function connectToDevice() {
  const host = hostInput.value.trim();
  const port = portInput.value.trim();
  if (!host || !port) return showMessage("Enter IP and port", "error");

  connectBtn.disabled = true;
  loader.style.display = "flex";

  try {
    const result = await window?.electronAPI.connectDevice(
      networkId,
      host,
      port
    );
    loader.style.display = "none";
    showMessage(result?.msg, result?.type);

    if (result?.case === "NOT_PAIRED") {
      _host = host;
      _port = port;
      pairingModal.style.display = "block";
    }
    if (result?.type === "success") handleSuccess(result?.ip);
  } catch (error) {
    showMessage(error, "error");
  }

  connectBtn.disabled = false;
}

// -----------------------------------------------------------------------------
// disconnectDevice: Disconnect from current connected device
// -----------------------------------------------------------------------------
async function disconnectDevice() {
  try {
    loader.style.display = "flex";
    disconnectBtn.disabled = true;
    const result = await window?.electronAPI.disconnectDevice(_currentDevice);
    showMessage(result, "success");
    fetchConnectedDevices();
    loader.style.display = "none";
  } catch (error) {
    fetchConnectedDevices();
    loader.style.display = "none";
  }
  disconnectBtn.disabled = false;
}
disconnectBtn.addEventListener("click", disconnectDevice);

// -----------------------------------------------------------------------------
// getIp: Get current network's IP prefix
// -----------------------------------------------------------------------------
async function getIp() {
  const ip = await window?.electronAPI.getLocalIp();
  networkId = ip?.split(".").slice(0, 3).join(".") + ".";
  ipText.innerText = networkId;
}

// -----------------------------------------------------------------------------
// pairDevice: Pair untrusted device using pairing port and code
// -----------------------------------------------------------------------------
async function pairDevice() {
  const port = pairPortInput.value.trim();
  const code = pairCodeInput.value.trim();
  if (!_host || !port || !code)
    return showMessage("Please ensure all fields are filled", "error");

  pairButton.disabled = true;
  try {
    const result = await window?.electronAPI.pairDevice(
      networkId,
      _host,
      port,
      code
    );
    showMessage(result?.msg, result?.type);
    if (result?.type === "success") {
      pairingModal.style.display = "none";
      await handleConnectionAfterPairing(networkId, _host, _port);
    }
  } catch (error) {
    showMessage(error, "error");
  }
  pairButton.disabled = false;
}
connectBtn.addEventListener("click", connectToDevice);
pairButton.addEventListener("click", pairDevice);

// -----------------------------------------------------------------------------
// handleConnectionAfterPairing: Auto-connect after successful pairing
// -----------------------------------------------------------------------------
async function handleConnectionAfterPairing(ip, host, port) {
  try {
    pairButton.disabled = true;
    const result = await window?.electronAPI.connectDevice(ip, host, port);
    showMessage(result?.msg, result?.type);
    if (result?.type === "success") {
      await handleSuccess(result.ip);
      pairButton.disabled = false;
    }
  } catch (error) {
    showMessage(error, "error");
  }
}

// -----------------------------------------------------------------------------
// handleSuccess: Save connected device IP and refresh UI
// @param {string} data - IP:Port of connected device
// -----------------------------------------------------------------------------
async function handleSuccess(data) {
  await localStorage.setItem("adb_history", data);
  await fetchConnectedDevices();
}

// -----------------------------------------------------------------------------
// fetchDiscoveredDevices: Scan and display nearby discoverable devices
// -----------------------------------------------------------------------------
async function fetchDiscoveredDevices() {
  try {
    showLoader();
    const devices = await window?.electronAPI.getDiscoveredDevices();
    console.log("Discovered Devices:", devices);
    if (devices.length > 0) {
      renderDeviceList(devices);
    } else {
      showNoDevicesFound();
      showMessage("No devices found!", "error");
    }
    return devices;
  } catch (error) {
    showMessage(error, "error");
  }
}

// -----------------------------------------------------------------------------
// switchMode: Toggle between Manual and Auto mode
// -----------------------------------------------------------------------------
const switchMode = async () => {
  const connectionModeLable = document.getElementById("connection-mode-lable");
  if (toggle.checked) {
    label.textContent = "Auto Mode";
    connectionModeLable.textContent = "Pick a Nearby Device";
    document.getElementById("manualContainer").style.display = "none";
    document.getElementById("autoContainer").style.display = "block";
    await fetchDiscoveredDevices();
  } else {
    label.textContent = "Manual Mode";
    connectionModeLable.textContent = "Enter Device Host and Port";
    document.getElementById("manualContainer").style.display = "block";
    document.getElementById("autoContainer").style.display = "none";
  }
};
toggle.addEventListener("change", switchMode);

// -----------------------------------------------------------------------------
// connectToDeviceAuto: Connect to a discovered device
// @param {object} device - { name: string, address: string, port: string }
// -----------------------------------------------------------------------------
const connectToDeviceAuto = async (device) => {
  try {
    const result = await window?.electronAPI.connectDeviceAutomatically(
      device?.address,
      device?.port
    );

    loader.style.display = "none";
    showMessage(result?.msg, result?.type);

    if (result?.case === "NOT_PAIRED") {
      const _split = device?.address?.split(".");
      _host = _split[_split?.length - 1];
      _port = device?.port;
      pairingModal.style.display = "block";
    }

    if (result?.type === "success") handleSuccess(result?.ip);
  } catch (error) {
    console.log(error);
  }
};

// -----------------------------------------------------------------------------
// UI Helpers for auto-scan section
// -----------------------------------------------------------------------------
function showLoader() {
  document.getElementById("searchingLoader").style.display = "flex";
  document.getElementById("noDevicesFound").style.display = "none";
  document.getElementById("deviceListContainer").style.display = "none";
}

function showNoDevicesFound() {
  document.getElementById("searchingLoader").style.display = "none";
  document.getElementById("deviceListContainer").style.display = "none";
  document.getElementById("noDevicesFound").style.display = "flex";
}

// -----------------------------------------------------------------------------
// renderDeviceList: Display all discovered devices
// @param {Array} devices - List of discovered devices
// -----------------------------------------------------------------------------
function renderDeviceList(devices) {
  document.getElementById("searchingLoader").style.display = "none";
  document.getElementById("deviceListContainer").style.display = "flex";
  document.getElementById("noDevicesFound").style.display = "none";

  const container = document.getElementById("deviceListContainer");
  container.innerHTML = "";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "10px";

  devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card-row";

    const address = document.createElement("div");
    address.className = "device-address";
    address.textContent = device.name;

    const connectBtn = document.createElement("button");
    connectBtn.className = "connect-btn";
    connectBtn.textContent = "Connect";

    connectBtn.onclick = () => {
      connectToDeviceAuto(device);
    };

    card.appendChild(address);
    card.appendChild(connectBtn);
    container.appendChild(card);
  });
}

// -----------------------------------------------------------------------------
// Manual retry and mode switch controls
// -----------------------------------------------------------------------------
document.getElementById("retryDiscoveryBtn").addEventListener("click", () => {
  fetchDiscoveredDevices();
});

document.getElementById("switchToManualBtn").addEventListener("click", () => {
  toggle.checked = false;
  toggle.dispatchEvent(new Event("change"));
});

// -----------------------------------------------------------------------------
// Modal open/close logic
// -----------------------------------------------------------------------------
connectedMenuButton.addEventListener("click", () => {
  apkUtilitiesModal.style.display = "block";
});

closeApkModal.addEventListener("click", () => {
  apkUtilitiesModal.style.display = "none";
});

installApkBtn.addEventListener("click", () => {
  installApkModal.style.display = "block";
});

closeInstallApkModal.addEventListener("click", () => {
  installApkModal.style.display = "none";
  resetUploadState();
});

// -----------------------------------------------------------------------------
// File Browse using Electron Dialog (via preload)
// -----------------------------------------------------------------------------
browseApkBtn.addEventListener("click", async () => {
  console.log("electronAPI:", window.electronAPI);

  const result = await window?.electronAPI.openApkDialog();
  if (!result.canceled && result.filePaths.length > 0) {
    const apkPath = result.filePaths[0];
    const fileName = apkPath.split(/[\\/]/).pop();
    handleApkFile(apkPath, fileName);
  }
});

// -----------------------------------------------------------------------------
// Handle APK File
// -----------------------------------------------------------------------------
function handleApkFile(path, name) {
  if (!name.endsWith(".apk")) {
    alert("Please select a valid APK file");
    return;
  }
  dropZone.style.display = "none";
  loader.style.display = "none";
  selectedApkFile = { path, name };
  apkFileName.textContent = name;
  apkFilePath.textContent = path;
  apkFileDetails.style.display = "flex";
}

// -----------------------------------------------------------------------------
// Install APK
// -----------------------------------------------------------------------------
installApkFinalBtn.addEventListener("click", async () => {
  if (!selectedApkFile) {
    showMessage("No APK selected.", "error");
    return;
  }

  try {
    closeInstallApkModal.style.display = "none";
    apkFileDetails.style.display = "none";
    installingAPKModel.style.display = "flex";
    const output = await window?.electronAPI.installApk(
      selectedApkFile.path,
      _currentDevice
    );
    installingAPKModel.style.display = "none";
    closeInstallApkModal.style.display = "block";

    showMessage(output.msg, output.type);
  } catch (err) {
    installApkModal.style.display = "none";
    resetUploadState();
    showMessage("Installation failed.", "error");
  } finally {
    installApkModal.style.display = "none";
    resetUploadState();
  }
});

// -----------------------------------------------------------------------------
// Reset Upload State
// -----------------------------------------------------------------------------
function resetUploadState() {
  dropZone.style.display = "block";
  apkFileDetails.style.display = "none";
  loader.style.display = "none";
  selectedApkFile = null;
}
// -----------------------------------------------------------------------------
// On Window Load: Check ADB, set IP prefix, fetch connected device if any
// -----------------------------------------------------------------------------
window.onload = async () => {
  await fetchADBVersion()
    .then(async () => {
      await getIp();
      await fetchConnectedDevices();
    })
    .catch((err) => {
      console.warn(err);
    });
};

uninstallApkBtn.addEventListener("click", async () => {
  uninstallAppsModal.style.display = "block";
  appListContainer.style.display = "none";
  noAppsFound.style.display = "none";
  uninstallLoader.style.display = "block";
  searchApkInput.value = "";

  try {
    // Call preload to get device id and app list
    const apps = await window.electronAPI.getInstalledApks(_currentDevice); // Also exposed from preload

    appsData = apps;
    renderAppList(apps);
  } catch (error) {
    console.error("Failed to fetch apps:", error);
    noAppsFound.style.display = "block";
  } finally {
    uninstallLoader.style.display = "none";
  }
});

// Close modal
closeUninstallAppsModal.addEventListener("click", () => {
  uninstallAppsModal.style.display = "none";
});

// Search
searchApkInput.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filteredApps = appsData.filter((app) =>
    app.toLowerCase().includes(query)
  );
  renderAppList(filteredApps);
});

// Render app cards
function renderAppList(apps) {
  appListContainer.innerHTML = "";
  if (!apps || apps.length === 0) {
    appListContainer.style.display = "none";
    noAppsFound.style.display = "block";
    return;
  }

  noAppsFound.style.display = "none";
  appListContainer.style.display = "block";

  apps.forEach((pkg) => {
    const appCard = document.createElement("div");
    appCard.className = "app-item";
    appCard.innerHTML = `
        <span class="app-name">${pkg}</span>
        <div class="delete-app-btn" data-package="${pkg}">❌</div>
    `;
    appList.appendChild(appCard);
  });

  document.querySelectorAll(".delete-app-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const pkg = e.target.dataset.package;
      try {
        const response = await window.electronAPI.uninstallApp(
          _currentDevice,
          pkg
        );
        if (response.success) {
          showMessage(`${pkg} uninstall succesfully`, "success");
          e.target.innerText = "Uninstalled";
          e.target.disabled = true;
        } else {
          showMessage(`Failed to uninstall ${pkg}`, "error");
        }
      } catch (err) {
        console.error("Uninstall failed:", err);
      }
    });
  });
}
