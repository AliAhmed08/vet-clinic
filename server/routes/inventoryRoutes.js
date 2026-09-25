const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

const multer = require("multer");
const path = require("path");
const { app } = require('electron');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const uploadsDir = path.join(userDataPath, 'inventory');

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

// ==============================
// 📦 1. Add Product
// ==============================
router.post("/products", upload.single('image'), (req, res) => {
    const { name, sale_price, category, min_stock } = req.body;

    let image_url = null;
    if (req.file) {
        image_url = req.file.filename;
    }

    db.run(
        `INSERT INTO products (name, sale_price, category, min_stock, image_url)
         VALUES (?, ?, ?, ?, ?)`,
        [name, sale_price, category, min_stock || 0, image_url],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                id: this.lastID,
                image_url
            });
        }
    );
});

// ==============================
// 📦 2. Get All Products
// ==============================
router.get("/products", (req, res) => {

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 30);
    const offset = (page - 1) * limit;

    const {
        category = "all",
        search = ""
    } = req.query;

    let where = `WHERE p.is_active = 1`;
    const params = [];

    if (category !== "all") {
        where += ` AND LOWER(p.category) = ?`;
        params.push(category.toLowerCase());
    }

    if (search.trim()) {
        where += ` AND LOWER(p.name) LIKE ?`;
        params.push(`%${search.toLowerCase()}%`);
    }

    const dataSql = `
        SELECT
            p.*,
            IFNULL(SUM(b.quantity),0) AS total_stock
        FROM products p
        LEFT JOIN inventory_batches b
            ON p.id = b.product_id
        ${where}
        GROUP BY p.id
        ORDER BY total_stock DESC
        LIMIT ? OFFSET ?
    `;

    const countSql = `
        SELECT COUNT(*) AS count
        FROM products p
        ${where}
    `;

    db.all(
        dataSql,
        [...params, limit, offset],
        (err, rows) => {

            if (err)
                return res.status(500).json({ error: err.message });

            db.get(countSql, params, (err, result) => {

                if (err)
                    return res.status(500).json({ error: err.message });

                res.json({
                    data: rows,
                    page,
                    totalPages: Math.ceil(result.count / limit),
                    hasMore: page < Math.ceil(result.count / limit)
                });

            });

        });

});

router.get("/vaccines", (req, res) => {
    db.all(`SELECT 
            p.*,
            IFNULL(SUM(b.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN inventory_batches b ON p.id = b.product_id
        WHERE is_active = 1 AND p.category = 'vaccine'
        GROUP BY p.id
        ORDER BY total_stock DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.get("/product/:id", (req, res) => {
    const id = req.params.id;

    // 1. product (وفيه sale_price)
    db.get(`
        SELECT *
        FROM products
        WHERE id = ? AND is_active = 1
    `, [id], (err, product) => {

        if (err) return res.status(500).json({ error: err.message });
        if (!product) return res.status(404).json({ error: "Product not found" });

        // 2. batches
        db.all(`
            SELECT *
            FROM inventory_batches
            WHERE product_id = ?
            ORDER BY expiry_date ASC
        `, [id], (err2, batches) => {

            if (err2) return res.status(500).json({ error: err2.message });
            const total_stock = batches.reduce((sum, b) => sum + b.quantity, 0);
            res.json({
                product,   // 👈 فيه sale_price جاهز
                batches,
                total_stock
            });
        });
    });
});

/* =====================
   DELETE PRODUCT
===================== */

router.put("/products/:id/deactivate", (req, res) => {
    const id = req.params.id;

    db.get(
        `SELECT SUM(quantity) as total FROM inventory_batches WHERE product_id = ?`,
        [id],
        (err, row) => {
            if (row.total > 0) {
                return res.status(400).json({
                    error: "لا يمكن إلغاء التفعيل - يوجد مخزون"
                });
            }

            db.run(
                `UPDATE products SET is_active = 0 WHERE id = ?`,
                [id],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    res.json({ success: true });
                }
            );
        }
    );
});

router.put("/products/:id", upload.single("image"), (req, res) => {
    const id = req.params.id;

    const { name, sale_price } = req.body;

    let image_url = null;

    if (req.file) {
        image_url = req.file.filename;
    }

    // لو مفيش صورة جديدة → متغيرش القديمة
    const sql = image_url
        ? `UPDATE products SET name=?, sale_price=?, image_url=? WHERE id=?`
        : `UPDATE products SET name=?, sale_price=? WHERE id=?`;

    const params = image_url
        ? [name, sale_price, image_url, id]
        : [name, sale_price, id];

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ success: true });
    });
});

// ==============================
// 📦 3. Add Stock (Batch)
// ==============================
router.post("/stock/add", (req, res) => {
    const { product_id, quantity, expiry_date, purchase_price, supplier } = req.body;

    db.run(
        `INSERT INTO inventory_batches 
        (product_id, quantity, expiry_date, purchase_price, supplier)
        VALUES (?, ?, ?, ?, ?)`,
        [product_id, quantity, expiry_date, purchase_price || 0, supplier],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const batchId = this.lastID; // ✅ امسك الـ batch_id هنا

            db.run(
                `INSERT INTO inventory_transactions 
                (product_id, batch_id, transaction_type, reference_type, quantity)
                VALUES (?, ?, 'add', 'inventory', ?)`,
                [product_id, batchId, quantity],
                (err2) => {
                    if (err2) return res.status(500).json({ error: err2.message });

                    res.status(200).json({
                        success: true,
                        message: "Stock added and transaction recorded",
                        batch_id: batchId
                    });
                }
            );
        }
    );
});

// ==============================
// 📦 4. Get Stock per Product
// ==============================
router.get("/stock/:product_id", (req, res) => {
    const { product_id } = req.params;

    db.all(
        `SELECT * FROM inventory_batches 
         WHERE product_id = ?`,
        [product_id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ==============================
// 🔴 5. Use Stock (FIFO)
// ==============================
router.post("/stock/use", (req, res) => {
    const { product_id, quantity, reference_type, reference_id } = req.body;

    let remaining = quantity;

    db.get(
        `SELECT sale_price FROM products WHERE id = ?`,
        [product_id],
        (err, product) => {

            if (err) return res.status(500).json({ error: err.message });

            db.all(
                `SELECT * FROM inventory_batches 
                 WHERE product_id = ? AND quantity > 0
                 ORDER BY expiry_date ASC`,
                [product_id],
                (err, batches) => {

                    if (err) return res.status(500).json({ error: err.message });

                    if (!batches.length) {
                        return res.status(400).json({ error: "No stock available" });
                    }

                    const processBatch = (index) => {

                        if (remaining > 0 && index >= batches.length) {
                            return res.status(400).json({ error: "المخزون غير كافي" });
                        }

                        if (remaining <= 0) {
                            return res.json({ success: true });
                        }

                        let batch = batches[index];
                        let deduct = Math.min(batch.quantity, remaining);

                        let profit = deduct * (product.sale_price - batch.purchase_price);

                        db.run(
                            `UPDATE inventory_batches 
                             SET quantity = quantity - ? 
                             WHERE id = ?`,
                            [deduct, batch.id],
                            (err) => {

                                if (err) return res.status(500).json({ error: err.message });

                                db.run(
                                    `INSERT INTO inventory_transactions
                                    (product_id, batch_id, transaction_type, quantity, reference_type, reference_id, profit)
                                    VALUES (?, ?, 'use', ?, ?, ?, ?)`,
                                    [product_id, batch.id, deduct, reference_type, reference_id, profit]
                                );

                                remaining -= deduct;
                                processBatch(index + 1);
                            }
                        );
                    };

                    processBatch(0);
                }
            );
        }
    );
});

router.post("/batch/adjust", (req, res) => {
    const { purchase_price, expiry_date, quantity, supplier, batch_id } = req.body;

    db.get(`SELECT quantity, product_id FROM inventory_batches WHERE id=?`,
        [batch_id],
        (err, batch) => {

            if (err) return res.status(500).json({ error: err.message });

            const diff = quantity - batch.quantity;

            db.run(`
                UPDATE inventory_batches 
                SET purchase_price = ?, expiry_date = ?, quantity = ?, supplier = ?
                WHERE id=?
            `, [purchase_price, expiry_date, quantity, supplier, batch_id]);

            // سجل transaction
            db.run(`
                INSERT INTO inventory_transactions
                (product_id, batch_id, quantity, transaction_type, reference_type)
                VALUES (?, ?, ?, 'adjustment', 'inventory')
            `, [batch.product_id, batch.id, diff]);

            res.json({ success: true });
        });
});

// ==============================
// 📊 6. Low Stock Products
// ==============================
router.get("/alerts", (req, res) => {
    const query = `
        SELECT 
            p.id,
            p.name,
            p.min_stock,
            COALESCE(SUM(b.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN inventory_batches b 
            ON b.product_id = p.id
        GROUP BY p.id
        HAVING total_stock <= p.min_stock AND is_active = 1
        ORDER BY total_stock ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ==============================
// 📊 7. Expiring Soon
// ==============================
router.get("/expiry-alerts", (req, res) => {
    const query = `
        SELECT b.*, p.name
        FROM inventory_batches b
        JOIN products p ON p.id = b.product_id
        WHERE julianday(expiry_date) - julianday('now') <= 7 AND is_active = 1
        AND quantity > 0
        ORDER BY expiry_date ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ==============================
// 💰 Visit Profit
// ==============================
router.get("/reports/visits", (req, res) => {

    db.all(
        `
        SELECT 
            v.id,
            v.date,
            v.price AS visit_price,

            IFNULL(SUM(
                CASE 
                    WHEN t.transaction_type = 'use'
                    THEN t.profit
                    ELSE 0
                END
            ), 0) AS products_profit,

            v.price + IFNULL(SUM(
                CASE 
                    WHEN t.transaction_type = 'use'
                    THEN t.profit
                    ELSE 0
                END
            ), 0) AS total_profit

        FROM visits v

        LEFT JOIN inventory_transactions t 
            ON t.reference_id = v.id
            AND t.reference_type = 'visit'

        GROUP BY v.id

        ORDER BY v.date DESC
        `,
        [],
        (err, rows) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.json(rows);
        }
    );
});

router.get("/reports/profit", (req, res) => {

    db.get(`
        SELECT

        -- صافي أرباح اليوم
        (
            SELECT IFNULL(SUM(price), 0)
            FROM visits
            WHERE date(date) = date('now')
        )

        +

        (
            SELECT IFNULL(SUM(profit), 0)
            FROM inventory_transactions
            WHERE transaction_type = 'use'
            AND date(created_at) = date('now')
        )

        +

        (
            SELECT IFNULL(SUM((CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1) * daily_price), 0)
            FROM boardings
            WHERE date(end_date) = date('now')
        )

        AS today_net_profit,

        -- إجمالي أرباح اليوم
        (
            SELECT IFNULL(SUM(price), 0)
            FROM visits
            WHERE date(date) = date('now')
        )

        +

        (
            SELECT IFNULL(SUM(si.quantity * si.price), 0)
            FROM sale_items si
            JOIN sales s
                ON s.id = si.sale_id
            WHERE date(s.created_at) = date('now')
        )

        +

        (
            SELECT IFNULL(SUM((CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1) * daily_price), 0)
            FROM boardings
            WHERE date(end_date) = date('now')
        )

        AS today_revenue,

        -- صافي أرباح الشهر
        (
            SELECT IFNULL(SUM(price), 0)
            FROM visits
            WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        )

        +

        (
            SELECT IFNULL(SUM(profit), 0)
            FROM inventory_transactions
            WHERE transaction_type = 'use'
            AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        )

        +

        (
            SELECT IFNULL(SUM((CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1) * daily_price), 0)
            FROM boardings
            WHERE strftime('%Y-%m', end_date) = strftime('%Y-%m', 'now')
        )

        AS month_net_profit,

        -- إجمالي أرباح الشهر
        (
            SELECT IFNULL(SUM(price), 0)
            FROM visits
            WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        )

        +

        (
            SELECT IFNULL(SUM(si.quantity * si.price), 0)
            FROM sale_items si
            JOIN sales s
                ON s.id = si.sale_id
            WHERE strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')
        )

        +

        (
            SELECT IFNULL(SUM((CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1) * daily_price), 0)
            FROM boardings
            WHERE strftime('%Y-%m', end_date) = strftime('%Y-%m', 'now')
        )

        AS month_revenue

    `, [], (err, row) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(row);
    });
});

router.get("/reports/profits/monthly", (req, res) => {

    db.all(`
        SELECT
            month,
            SUM(total) AS total_profit
        FROM (

            -- أرباح الزيارات
            SELECT
                strftime('%Y-%m', date) AS month,
                SUM(price) AS total
            FROM visits
            GROUP BY month

            UNION ALL

            -- أرباح المنتجات
            SELECT
                strftime('%Y-%m', created_at) AS month,
                SUM(profit) AS total
            FROM inventory_transactions
            WHERE transaction_type = 'use'
            GROUP BY month

            UNION ALL

            -- أرباح الاستضافات
            SELECT
                strftime('%Y-%m', end_date) AS month,
                SUM((
                (CAST((julianday(end_date) - julianday(start_date)) AS INTEGER) + 1)
                * daily_price
            )) AS total
            FROM boardings
            GROUP BY month
        )

        GROUP BY month
        ORDER BY month DESC
        LIMIT 5
    `, [], (err, rows) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(rows);
    });
});

router.get("/reports/products", (req, res) => {

    db.all(`
        SELECT
            p.name,
            SUM(t.quantity) as total_sold
        FROM inventory_transactions t
        JOIN products p
            ON p.id = t.product_id
        WHERE t.transaction_type = 'use'
        GROUP BY t.product_id
        ORDER BY total_sold DESC
        LIMIT 5
    `, [], (err, rows) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(rows);
    });
});

router.get("/reports/top-animals", (req, res) => {

    db.all(`
        SELECT
            a.id,
            a.name,
            a.type,
            COUNT(v.id) AS visits_count
        FROM animals a
        JOIN visits v
            ON v.animal_id = a.id
        GROUP BY a.id
        ORDER BY visits_count DESC
        LIMIT 10
    `,
        (err, rows) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.json(rows);
        });
});

router.get("/transactions", (req, res) => {
    db.all(`SELECT * FROM inventory_transactions`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;