const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

const multer = require("multer");
const path = require("path");
const { app } = require('electron');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const uploadsDir = path.join(userDataPath, 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.get("/", (req, res) => {

    db.get(
        `SELECT * FROM clinic_settings WHERE id = 1`,
        [],
        (err, row) => {

            if (err)
                return res.status(500).json({ error: err.message });

            res.json(row || {});
        }
    );

});

router.put(
    "/",
    upload.single("logo"),
    (req, res) => {

        const {
            clinic_name,
            phone,
            address
        } = req.body;

        const logo =
            req.file?.filename || null;

        db.run(
            `
            UPDATE clinic_settings
            SET
                clinic_name = ?,
                phone = ?,
                address = ?,
                logo = COALESCE(?, logo)
            WHERE id = 1
            `,
            [
                clinic_name,
                phone,
                address,
                logo
            ],
            function (err) {

                if (err)
                    return res.status(500).json({
                        error: err.message
                    });

                res.json({
                    success: true
                });
            }
        );

    }
);

module.exports = router;