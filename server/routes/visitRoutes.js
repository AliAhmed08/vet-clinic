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
    const page = Number(req.query.page || 1);
    const limit = 15;
    const offset = (page - 1) * limit;

    const { search, animal_id, dateFrom, dateTo } = req.query;

    const all = req.query.all === "true";

    if (all) {
        db.all(
            `  SELECT visits.*, 
               animals.name AS animal,
               animals.type,
               animals.age,
               animals.owner,
               animals.phone
        FROM visits
        JOIN animals ON animals.id = visits.animal_id`,
            [],
            (err, visits) => {
                if (err)
                    return res.status(500).json({ error: err.message });

                return res.json({ data: visits });
            }
        );
        return;
    }

    // ================= BUILD WHERE =================
    let where = "WHERE 1=1";
    const params = [];

    if (animal_id) {
        where += " AND visits.animal_id = ?";
        params.push(animal_id);
    }
    if (search) {
        where += `
      AND (
        animals.name LIKE ?
        OR animals.owner LIKE ?
        OR animals.phone LIKE ?
        OR animals.type LIKE ?
        OR visits.date LIKE ?
        OR visits.notes LIKE ?
      )
    `;
        const q = `%${search}%`;
        params.push(q, q, q, q, q, q);
    }

    if (dateFrom) {
        where += " AND visits.date >= ?";
        params.push(dateFrom);
    }

    if (dateTo) {
        where += " AND visits.date <= ?";
        params.push(dateTo);
    }


    // ================= DATA QUERY =================
    const dataSql = `
        SELECT visits.*, 
               animals.name AS animal,
               animals.type,
               animals.owner,
               animals.phone
        FROM visits
        JOIN animals ON animals.id = visits.animal_id
        ${where}
        ORDER BY visits.created_at DESC
        LIMIT ? OFFSET ?
    `;

    // ================= COUNT QUERY =================
    const countSql = `
        SELECT COUNT(*) as count
        FROM visits
        JOIN animals ON animals.id = visits.animal_id
        ${where}
    `;

    db.all(dataSql, [...params, limit, offset], (err, data) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(countSql, params, (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                data,
                page,
                totalPages: Math.ceil(result.count / limit),
            });
        });
    });
});


router.post("/", upload.array("images", 4), (req, res) => {

    const { animal_id, date, notes, price } = req.body;

    const images = req.files.map(file => file.filename).join(",");

    if (!animal_id || !date) {
        return res.status(400).json({ error: "بيانات ناقصة" });
    }

    const sql = `
      INSERT INTO visits (animal_id, date, notes, price, images)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.run(sql, [animal_id, date, notes, price, images], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
            id: this.lastID,
            message: "تم إضافة الزيارة بنجاح",
        });
    });
});

/* =====================
   EXPORT EXCEL
===================== */
// router.get("/export/excel", (req, res) => {
//     db.all(
//         `
//         SELECT visits.*, 
//                animals.name AS animal,
//                animals.type,
//                animals.age,
//                animals.owner,
//                animals.phone
//         FROM visits
//         JOIN animals ON animals.id = visits.animal_id
//         ORDER BY visits.created_at DESC
//         `,
//         [],
//         async (err, rows) => {
//             if (err) {
//                 console.error(err);
//                 return res.status(500).json({ error: "Failed to export visits" });
//             }

//             const workbook = new ExcelJS.Workbook();
//             const sheet = workbook.addWorksheet("Visits");

//             sheet.columns = [
//                 { header: "اسم الحيوان", key: "animal", width: 15 },
//                 { header: "نوع الحيوان", key: "type", width: 15 },
//                 { header: "العمر", key: "age", width: 10 },
//                 { header: "اسم العميل", key: "owner", width: 20 },
//                 { header: "رقم الهاتف", key: "phone", width: 15 },
//                 { header: "تاريخ الزيارة", key: "date", width: 15 },
//                 { header: "ملاحظات", key: "notes", width: 25 },
//             ];

//             sheet.addRows(rows);

//             res.setHeader(
//                 "Content-Type",
//                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//             );
//             res.setHeader(
//                 "Content-Disposition",
//                 `attachment; filename=visits-${new Date()
//                     .toISOString()
//                     .slice(0, 10)}.xlsx`
//             );

//             await workbook.xlsx.write(res);
//             res.end();
//         }
//     );
// });

/* =====================
   DELETE
===================== */
router.delete("/:id", (req, res) => {
    const visitId = req.params.id;

    // 1️⃣ رجّع المخزون الأول
    db.all(
        `SELECT * FROM inventory_transactions
         WHERE reference_type = 'visit'
         AND reference_id = ?
         AND transaction_type = 'use'`,
        [visitId],
        (err, transactions) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Restore fetch failed" });
            }

            const restoreNext = (index) => {
                if (index >= transactions.length) {
                    // 2️⃣ بعد ما خلص restore → امسح الزيارة
                    db.run(
                        "DELETE FROM visits WHERE id = ?",
                        [visitId],
                        function (err2) {
                            if (err2) {
                                console.error(err2);
                                return res.status(500).json({ error: "Failed to delete visit" });
                            }

                            if (this.changes === 0) {
                                return res.status(404).json({ error: "Visit not found" });
                            }

                            // 3️⃣ امسح الـ transactions عشان تمنع double restore
                            db.run(
                                `DELETE FROM inventory_transactions
                                 WHERE reference_type = 'visit'
                                 AND reference_id = ?`,
                                [visitId]
                            );

                            res.json({ deleted: true });
                        }
                    );
                    return;
                }

                const t = transactions[index];

                db.run(
                    `UPDATE inventory_batches
                     SET quantity = quantity + ?
                     WHERE id = ?`,
                    [t.quantity, t.batch_id],
                    (err3) => {
                        if (err3) {
                            console.error(err3);
                            return res.status(500).json({ error: "Restore failed" });
                        }

                        restoreNext(index + 1);
                    }
                );
            };

            restoreNext(0);
        }
    );
});

module.exports = router;
