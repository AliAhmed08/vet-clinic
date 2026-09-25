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

const { initDatabase } = require("./db/db");

const PORT = 3000;

initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
});
