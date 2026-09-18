const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("anvilDesktop", {
  pickFolder: () => ipcRenderer.invoke("anvil:pick-folder"),
});
