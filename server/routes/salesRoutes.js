const express = require("express");
const router = express.Router();
const { db } = require("../db/db");
const salesService = require("../services/salesService");
const { withDbLock } = require("../services/db-mutex");

router.get("/", (req, res) => {

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 5);
    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();

    let where = "";
    const params = [];

    if (search) {
        where = `
            WHERE
                CAST(id AS TEXT) LIKE ?
        `;

        const q = `%${search}%`;
        params.push(q);
    }

    const dataSql = `
        SELECT *
        FROM sales
        ${where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    `;

    const countSql = `
        SELECT COUNT(*) AS count
        FROM sales
        ${where}
    `;

    db.all(
        dataSql,
        [...params, limit, offset],
        (err, data) => {

            if (err)
                return res.status(500).json({ error: err.message });

            db.get(
                countSql,
                params,
                (err, result) => {

                    if (err)
                        return res.status(500).json({ error: err.message });

                    res.json({
                        data,
                        page,
                        totalPages: Math.ceil(result.count / limit),
                        totalItems: result.count
                    });

                }
            );

        }
    );

});

// Sale creation is now a single real SQLite transaction (BEGIN/COMMIT/
// ROLLBACK) performed by salesService.createSale, instead of manual
// compensating deletes after the fact - see server/services/salesService.js.
router.post("/", async (req, res) => {
    const { items, reference_type } = req.body;

    try {
        const result = await withDbLock(() =>
            salesService.createSale(items, reference_type)
        );

        res.json({
            success: true,
            id: result.id
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

router.get("/:id", (req, res) => {

    db.get(
        `
        SELECT *
        FROM sales
        WHERE id = ?
        `,
        [req.params.id],
        (err, sale) => {

            if (err)
                return res.status(500).json({ error: err.message });

            if (!sale)
                return res.status(404).json({ error: "Sale not found" });

            db.all(
                `
                SELECT
                    si.*,
                    p.name
                FROM sale_items si
                JOIN products p
                    ON p.id = si.product_id
                WHERE si.sale_id = ?
                `,
                [req.params.id],
                (err2, items) => {

                    if (err2)
                        return res.status(500).json({ error: err2.message });

                    res.json({
                        ...sale,
                        items
                    });
                }
            );

        }
    );

});

router.get("/invoice/:id", (req, res) => {

    const visitId = req.params.id;

    db.get(
        `
        SELECT
            v.*,
            a.name AS animal_name,
            a.owner
        FROM visits v
        JOIN animals a
            ON a.id = v.animal_id
        WHERE v.id = ?
        `,
        [visitId],
        (err, visit) => {

            if (err)
                return res.status(500).json({ error: err.message });

            db.all(
                `
                SELECT
                    p.name,
                    t.quantity
                FROM inventory_transactions t
                JOIN products p
                    ON p.id = t.product_id
                WHERE t.reference_type = 'visit'
                AND t.transaction_type = 'use'
                AND t.reference_id = ?
                `,
                [visitId],
                (err2, products) => {

                    if (err2)
                        return res.status(500).json({ error: err2.message });

                    res.json({
                        ...visit,
                        products
                    });
                }
            );

        }
    );

});

module.exports = router;