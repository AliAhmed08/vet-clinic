const express = require("express");
const router = express.Router();
const { db } = require("../db/db");

router.get("/", (req, res) => {

    db.all(
        `SELECT * FROM supplier_invoices ORDER BY invoice_date DESC, id DESC`,
        [],
        (err, rows) => {

            if (err)
                return res.status(500).json({ error: err.message });

            res.json(rows);
        }
    );

});

router.post("/", (req, res) => {

    const { company_name, purchases, total_amount, paid_amount } = req.body;

    const total = Number(total_amount);
    const paid = paid_amount === undefined || paid_amount === null || paid_amount === ""
        ? 0
        : Number(paid_amount);

    if (!company_name || !company_name.trim()) {
        return res.status(400).json({ error: "اسم الشركة مطلوب" });
    }

    if (!Number.isFinite(total) || total <= 0) {
        return res.status(400).json({ error: "الإجمالي غير صالح" });
    }

    if (!Number.isFinite(paid) || paid < 0) {
        return res.status(400).json({ error: "المبلغ المدفوع غير صالح" });
    }

    if (paid > total) {
        return res.status(400).json({ error: "المبلغ المدفوع أكبر من الإجمالي" });
    }

    // remaining_amount is derived server-side from total/paid rather than
    // trusted from the client, so it can never drift out of sync with them.
    const round2 = n => Math.round(n * 100) / 100;
    const remaining = round2(total - paid);

    db.run(
        `INSERT INTO supplier_invoices
         (company_name, purchases, total_amount, paid_amount, remaining_amount)
         VALUES (?, ?, ?, ?, ?)`,
        [company_name.trim(), (purchases || "").toString().trim(), round2(total), round2(paid), remaining],
        function (err) {

            if (err)
                return res.status(500).json({ error: err.message });

            res.json({ id: this.lastID });
        }
    );

});

router.patch("/:id/pay", (req, res) => {

    const { id } = req.params;
    const amount = Number(req.body.amountPaidNow);

    if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "يرجى إدخال مبلغ صحيح" });
    }

    db.get(
        `SELECT remaining_amount FROM supplier_invoices WHERE id = ?`,
        [id],
        (err, invoice) => {

            if (err)
                return res.status(500).json({ error: err.message });

            if (!invoice)
                return res.status(404).json({ error: "الفاتورة غير موجودة" });

            // Re-validate against the invoice's ACTUAL remaining amount from
            // the database, not whatever the client last saw - prevents a
            // stale/tampered request from overpaying an invoice.
            if (amount > invoice.remaining_amount + 0.005) {
                return res.status(400).json({ error: "المبلغ المدفوع أكبر من المتبقي" });
            }

            db.run(
                `UPDATE supplier_invoices
                 SET paid_amount = ROUND(paid_amount + ?, 2),
                     remaining_amount = MAX(ROUND(remaining_amount - ?, 2), 0)
                 WHERE id = ?`,
                [amount, amount, id],
                function (err2) {

                    if (err2)
                        return res.status(500).json({ error: err2.message });

                    res.json({ success: true });
                }
            );
        }
    );

});

router.delete("/:id", (req, res) => {

    db.run(
        `DELETE FROM supplier_invoices WHERE id = ?`,
        [req.params.id],
        function (err) {

            if (err)
                return res.status(500).json({ error: err.message });

            res.json({ success: true });
        }
    );

});

module.exports = router;
