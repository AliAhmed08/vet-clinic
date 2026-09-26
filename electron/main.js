const { app, BrowserWindow, shell, Menu, Notification } = require("electron");
const path = require("path");

app.setAppUserModelId('Vet Clinic');


function showReminderNotification(count) {
    const notification = new Notification({
        title: "تطعيمات قريبة 🐾",
        body: `لديك ${count} تطعيم خلال يومين لا تنسي التذكير بهم`,
        icon: path.join(__dirname, 'assets/icon.png'),
        silent: false
    });

    notification.show();

    notification.on('click', () => {
        mainWindow.show();
        mainWindow.webContents.send("open-reminders-page");
    });
}

async function checkAndNotifyReminders() {
    const res = await fetch("http://localhost:3000/api/vaccinations/reminders/count")
    const data = await res.json();
    const count = data.count
    if (count > 0) {
        showReminderNotification(count);
    }
}

const server = require("../server/server.js");

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, "assets/icon.png"),
        webPreferences: {
            contextIsolation: true,
            devTools: false
        },
    });

    mainWindow.loadURL("http://localhost:3000");

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://") || url.startsWith("http://")) {
            shell.openExternal(url);
            return { action: "deny" };
        }
        return { action: "allow" };
    });
}


app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);

    // Wait for the Express server (and its DB migrations) to actually be
    // listening before pointing the BrowserWindow at it. Previously the
    // window loaded http://localhost:3000 immediately, racing the async
    // initDatabase()/app.listen() call in server.js - on a slower machine
    // or a large migration this produced "fetch failed" / ECONNREFUSED on
    // first load.
    await server.ready;

    createWindow()
    setTimeout(() => {
        checkAndNotifyReminders();
    }, 2000);
})
