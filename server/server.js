const path = require("path");
const express = require("express");
const cors = require('cors');
const app = express();

app.use(express.json());


app.use("/api/animals", require("./routes/animalRoutes"));
app.use("/api/visits", require("./routes/visitRoutes"));
app.use("/api/vaccinations", require("./routes/vaccinationRoutes"));
app.use("/api/boardings", require("./routes/boardingRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/sales", require("./routes/salesRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));

app.get('/reminders', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/reminders.html'));
});

app.use(express.static(path.join(__dirname, "public")));

// Catch-all error handler: any route (including a synchronous throw, which
// Express forwards here automatically) ends up as a plain JSON error
// instead of Express's default HTML response with a full stack trace.
// Individual routes can still return their own specific status codes -
// this only fires for anything they didn't already handle.
app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: "حدث خطأ غير متوقع في الخادم" });
});

const { initDatabase } = require("./db/db");

const PORT = 3000;

// Resolved once the HTTP server is actually accepting connections, so
// callers (Electron's main process) can wait for this instead of assuming
// the server is ready as soon as this module has been required.
const ready = initDatabase().then(() => {
    return new Promise((resolve) => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            resolve();
        });
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
});

module.exports = { app, ready };
