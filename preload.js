const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getDiscoveredDevices: () => ipcRenderer.invoke("get-discovered-devices"),
  getAdbVersion: () => ipcRenderer.invoke("get-adb-version"),
  listConnectedDevices: () => ipcRenderer.invoke("list-connected-devices"),
  connectDevice: (ip, host, port) =>
    ipcRenderer.invoke("connect-device", ip, host, port),
  connectDeviceAutomatically: (host, port) =>
    ipcRenderer.invoke("connect-device-automatically", host, port),
  disconnectDevice: (deviceId) =>
    ipcRenderer.invoke("disconnect-device", deviceId),
  getLocalIp: () => ipcRenderer.invoke("get-ip"),
  pairDevice: (ip, host, port, code) =>
    ipcRenderer.invoke("pair-device", ip, host, port, code),
  fetchDeviceInfo: (deviceId) =>
    ipcRenderer.invoke("fetch-device-info", deviceId),
  openApkDialog: () => ipcRenderer.invoke("dialog:openApk"),
  installApk: (apkPath, deviceId) =>
    ipcRenderer.invoke("install-apk", apkPath, deviceId),
  getInstalledApks: (deviceId) =>
    ipcRenderer.invoke("get-installed-apks", deviceId),
  uninstallApp: (deviceId, packageName) =>
    ipcRenderer.invoke("uninstall-app", deviceId, packageName),
  onDeviceFound: (callback) =>
    ipcRenderer.on("device-found", (event, data) => callback(data)),
});
