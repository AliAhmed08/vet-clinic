const express = require("express");
const router = express.Router();
const { db, run } = require("../db/db");
const { createSaleWithinTransaction } = require("../services/salesService");
const { withDbLock } = require("../services/db-mutex");

router.get("/", (req, res) => {
    const page = Number(req.query.page || 1);
    const limit = 15;
    const offset = (page - 1) * limit;

    const { search, animal_id } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (animal_id) {
        where += " AND vaccinations.animal_id = ?";
        params.push(animal_id);
    }

    if (search) {
        where += `
        AND (
            animals.name LIKE ?
            OR animals.owner LIKE ?
            OR animals.phone LIKE ?
            OR animals.type LIKE ?
            OR p.name LIKE ?
        )
        `;
        const q = `%${search}%`;
        params.push(q, q, q, q, q);
    }

    // ================= DATA QUERY =================
    const dataSql = `
        SELECT vaccinations.*, 
               animals.name AS animal,
               animals.type,
               animals.age,
               animals.owner,
               animals.phone,
               p.name AS vaccine_name
        FROM vaccinations
        JOIN animals ON animals.id = vaccinations.animal_id
        LEFT JOIN products p ON p.id = vaccinations.product_id
        ${where}
        ORDER BY next_date ASC
        LIMIT ? OFFSET ?
    `;

    // ================= COUNT QUERY =================
    const countSql = `
        SELECT COUNT(*) as count
        FROM vaccinations
        JOIN animals ON animals.id = vaccinations.animal_id
        LEFT JOIN products p ON p.id = vaccinations.product_id
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

router.put("/:id/done", async (req, res) => {
    const { last_date, next_date, repeat_days, product_id, sale_price, animal_id } = req.body;

    if (!product_id || !animal_id || !last_date || !next_date) {
        return res.status(400).json({ error: "بيانات ناقصة" });
    }

    try {
        // The sale (stock deduction), the vaccine_history row, and the
        // vaccination update now all happen inside ONE real SQLite
        // transaction, instead of an internal HTTP call to /api/sales
        // followed by separate writes. If any part fails, everything is
        // rolled back - there is no window where history/vaccination state
        // can drift out of sync with what stock actually reflects.
        await withDbLock(async () => {
            await run("BEGIN TRANSACTION");

            try {
                await createSaleWithinTransaction(
                    [{ product_id, quantity: 1, sale_price }],
                    "vaccine"
                );

                await run(
                    `INSERT INTO vaccine_history (animal_id, product_id, date)
                    VALUES (?,?,?)`,
                    [animal_id, product_id, last_date]
                );

                await run(
                    `UPDATE vaccinations 
                     SET last_date = ?, next_date = ?, repeat_days = ?, notified = 0
                     WHERE id = ?`,
                    [last_date, next_date, repeat_days, req.params.id]
                );

                await run("COMMIT");
            } catch (err) {
                await run("ROLLBACK").catch(() => {});
                throw err;
            }
        });

        res.json({ success: true });

    } catch (err) {
        const status = [
            "INVALID_ITEMS",
            "INSUFFICIENT_STOCK",
            "PRODUCT_NOT_FOUND"
        ].includes(err.code) ? 400 : 500;

        res.status(status).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    const {
        animal_id,
        product_id,
        sale_price,
        repeat_days,
        last_date,
        next_date
    } = req.body;

    if (!animal_id || !product_id || !last_date || !next_date) {
        return res.status(400).json({ error: "بيانات ناقصة" });
    }

    try {
        // The vaccination row, the sale (stock deduction), and the
        // vaccine_history row are now all written inside ONE real SQLite
        // transaction. Previously the vaccination row was committed on its
        // own, then a separate HTTP call to /api/sales could fail and only
        // be "cleaned up" by a manual compensating DELETE - now a failure
        // rolls back the vaccination insert as well, atomically.
        const vaccinationId = await withDbLock(async () => {
            await run("BEGIN TRANSACTION");

            try {
                const insertResult = await run(
                    `INSERT INTO vaccinations 
                    (animal_id, product_id, repeat_days, last_date, next_date)
                    VALUES (?, ?, ?, ?, ?)`,
                    [animal_id, product_id, repeat_days, last_date, next_date]
                );

                const vaccinationId = insertResult.lastID;

                await createSaleWithinTransaction(
                    [{ product_id, quantity: 1, sale_price }],
                    "vaccine"
                );

                await run(
                    `INSERT INTO vaccine_history (animal_id, product_id, date)
                     VALUES (?, ?, ?)`,
                    [animal_id, product_id, last_date]
                );

                await run("COMMIT");

                return vaccinationId;
            } catch (err) {
                await run("ROLLBACK").catch(() => {});
                throw err;
            }
        });

        res.json({
            id: vaccinationId,
            message: "تم إضافة التطعيم ",
        });

    } catch (err) {
        const status = [
            "INVALID_ITEMS",
            "INSUFFICIENT_STOCK",
            "PRODUCT_NOT_FOUND"
        ].includes(err.code) ? 400 : 500;

        res.status(status).json({ error: err.message });
    }
});


/* =====================
   DELETE
===================== */
router.delete("/:id", (req, res) => {
    db.run(
        "DELETE FROM vaccinations WHERE id = ?",
        [req.params.id],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Failed to delete vaccination" });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: "vaccination not found" });
            }

            res.json({ deleted: true });
        }
    );
});

router.get("/reminders", (req, res) => {
    const query = `
        SELECT 
            v.id,
            p.name AS vaccine_name,
            v.next_date,
            a.name AS animal,
            a.type,
            a.owner,
            a.phone,
            CAST(julianday(v.next_date) - julianday('now') AS INTEGER) AS days_left
        FROM vaccinations v
        JOIN animals a ON a.id = v.animal_id
        LEFT JOIN products p ON p.id = v.product_id
        WHERE julianday(v.next_date) - julianday('now') <= 2
        AND v.notified = 0
        ORDER BY v.next_date ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json(rows);
    });
});

router.get("/reminders/count", (req, res) => {
    const query = `
        SELECT COUNT(*) AS count
        FROM vaccinations
        WHERE julianday(next_date) - julianday('now') <= 2
        AND notified = 0
    `;

    db.get(query, [], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({ count: row.count });
    });
});

router.put("/reminders/:id/mark", (req, res) => {
    db.run(
        "UPDATE vaccinations SET notified = 1 WHERE id = ?",
        [req.params.id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Update failed" });
            }

            res.json({ success: true });
        }
    );
});

module.exports = router;
