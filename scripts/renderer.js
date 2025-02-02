const { ipcRenderer, shell } = require("electron");

// Get DOM elements
const connectBtn = document.getElementById("connectBtn");
const loader = document.getElementById("loaderContainer");
const adbVersionText = document.getElementById("adbVersion");
const infoBtn = document.getElementById("infoBtn");
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

let _currentDevice = "";
let networkId = "";
let _host = "";
let _port = "";

// Show/Hide modals
infoBtn.onclick = () => (wirelessGuideModal.style.display = "block");
closeModal.onclick = () => (wirelessGuideModal.style.display = "none");
closePairingModal.onclick = () => (pairingModal.style.display = "none");
downloadButton.onclick = () =>
  shell.openExternal(
    "https://developer.android.com/studio/releases/platform-tools"
  );

// Display messages with auto-hide
function showMessage(msg, type) {
  const messageBox = document.getElementById("messageBox");
  messageBox.textContent = msg;
  messageBox.className = `message-box ${type} show`;
  setTimeout(() => messageBox.classList.remove("show"), 4000);
}

// Fetch and display ADB version
async function fetchADBVersion() {
  loader.style.display = "flex";
  const version = await ipcRenderer.invoke("get-adb-version");
  loader.style.display = "none";

  if (version.includes("not found")) {
    document.getElementById("main").style.display = "none";
    document.getElementById("noADB").style.display = "block";
  } else {
    document.getElementById("main").style.display = "block";
    document.getElementById("noADB").style.display = "none";
    adbVersionText.textContent = version.split("\n")[0];
  }
}

// Fetch and display connected devices
async function fetchConnectedDevices() {
  loader.style.display = "flex";
  const devices = await ipcRenderer.invoke("list-connected-devices");
  const currentDevice = await localStorage.getItem("adb_history");
  const isConnected = devices?.includes(currentDevice);

  if (isConnected) {
    _currentDevice = currentDevice;
    notConnected.style.display = "none";
    connectedSection.style.display = "block";
    document.getElementById("connectedIp").innerText = currentDevice;
  } else {
    await localStorage.clear();
    notConnected.style.display = "block";
    connectedSection.style.display = "none";
  }
  loader.style.display = "none";
}

// Connect to a device
async function connectToDevice() {
  const host = hostInput.value.trim();
  const port = portInput.value.trim();
  if (!host || !port) return showMessage("Enter IP and port", "error");

  connectBtn.disabled = true;
  loader.style.display = "flex";

  try {
    const result = await ipcRenderer.invoke(
      "connect-device",
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

// Disconnect a device
async function disconnectDevice() {
  try {
    loader.style.display = "flex";
    disconnectBtn.disabled = true;
    const result = await ipcRenderer.invoke(
      "disconnect-device",
      _currentDevice
    );
    showMessage(result, "success");
    fetchConnectedDevices();
    loader.style.display = "none";
  } catch (error) {
    showMessage(error, "error");
  }
  disconnectBtn.disabled = false;
}

disconnectBtn.addEventListener("click", disconnectDevice);

// Get local IP prefix
async function getIp() {
  const ip = await ipcRenderer.invoke("get-ip");
  networkId = ip?.split(".").slice(0, 3).join(".") + ".";
  ipText.innerText = networkId;
}

// Pair device using pairing code
async function pairDevice() {
  const port = pairPortInput.value.trim();
  const code = pairCodeInput.value.trim();
  if (!_host || !port || !code)
    return showMessage("Please ensure all fields are filled", "error");

  pairButton.disabled = true;
  try {
    const result = await ipcRenderer.invoke(
      "pair-device",
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

// Handle connection after pairing
async function handleConnectionAfterPairing(ip, host, port) {
  try {
    pairButton.disabled = true;
    const result = await ipcRenderer.invoke("connect-device", ip, host, port);
    showMessage(result?.msg, result?.type);
    if (result?.type === "success") {
      await handleSuccess(result.ip);
      pairButton.disabled = false;
    }
  } catch (error) {
    showMessage(error, "error");
  }
}

// Save connection history and refresh devices
async function handleSuccess(data) {
  await localStorage.setItem("adb_history", data);
  await fetchConnectedDevices();
}

// Initial load
window.onload = async () => {
  await fetchADBVersion();
  await fetchConnectedDevices();
  await getIp();
};
