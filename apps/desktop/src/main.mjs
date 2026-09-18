import { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = "http://127.0.0.1:5173";
const __dirname = dirname(fileURLToPath(import.meta.url));
let window = null;
let tray = null;

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#faf9f5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadURL(WEB);
  window.on("closed", () => {
    window = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("Anvil");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开窗口", click: () => (window ? window.show() : createWindow()) },
      { label: "退出", click: () => app.quit() },
    ]),
  );
  ipcMain.handle("anvil:pick-folder", async () => {
    const result = await dialog.showOpenDialog(window ?? undefined, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
