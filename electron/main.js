const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_URL = "https://antenatal-postnatal.preview.emergentagent.com";

function getAppUrl() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
    if (cfg.appUrl) return cfg.appUrl;
  } catch (e) {}
  return DEFAULT_URL;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "BidanKu",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });

  Menu.setApplicationMenu(null);
  win.loadURL(getAppUrl());

  // Link eksternal (wa.me, dll) dibuka di browser, bukan di dalam aplikasi
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
