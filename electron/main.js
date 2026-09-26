const { app, BrowserWindow, shell, Menu, Notification, protocol, net } = require("electron");
const path = require("path");

// The frontend loads images via a custom "app-data://" scheme (e.g.
// app-data://inventory/foo.png, app-data://uploads/bar.jpg) but nothing in
// this file ever registered that scheme with Electron/Chromium, so every
// such <img> request silently failed (broken image icon) - the files were
// always being saved correctly to disk by the upload routes, there was just
// no handler that could serve them back. Must be called before app is ready.
protocol.registerSchemesAsPrivileged([
    {
        scheme: "app-data",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

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

    // Serve app-data://<folder>/<file> from the matching folder under
    // Electron's userData directory (the same folders the upload routes in
    // server/routes/*.js already write to: "inventory" and "uploads").
    // Resolves the real path and verifies it is still inside the intended
    // folder before reading anything, so a crafted "../../secret" filename
    // cannot be used to read files outside that folder.
    protocol.handle("app-data", (request) => {
        const url = new URL(request.url);
        const folder = url.hostname; // "inventory" or "uploads"
        const baseDir = path.join(app.getPath("userData"), folder);

        const requestedPath = path.join(baseDir, decodeURIComponent(url.pathname));

        if (!requestedPath.startsWith(baseDir + path.sep) && requestedPath !== baseDir) {
            return new Response("Forbidden", { status: 403 });
        }

        return net.fetch(`file://${requestedPath}`);
    });

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
