const { get, all, run } = require("../db/db");

function insufficientStockError() {
    const err = new Error("المخزون غير كافي");
    err.code = "INSUFFICIENT_STOCK";
    return err;
}

async function getTotalStock(product_id) {
    const row = await get(
        `SELECT IFNULL(SUM(quantity), 0) AS total FROM inventory_batches WHERE product_id = ?`,
        [product_id]
    );
    return row ? row.total : 0;
}

// Deducts `quantity` units of `product_id` from its batches, oldest expiry
// first, and records one inventory_transactions row per batch touched.
//
// Callers are expected to run this inside a transaction they manage (see
// server/services/db-mutex.js + BEGIN/COMMIT/ROLLBACK in the calling route),
// and must not assume this function commits anything on its own. It still
// re-checks total availability itself so it can never be tricked into
// deducting more than exists even if a caller forgets to pre-validate.
async function deductStock({ product_id, quantity, reference_type, reference_id }) {
    const qty = Number(quantity);

    if (!product_id || !Number.isFinite(qty) || qty <= 0) {
        const err = new Error("كمية غير صالحة");
        err.code = "INVALID_QUANTITY";
        throw err;
    }

    const product = await get(
        `SELECT sale_price FROM products WHERE id = ?`,
        [product_id]
    );

    if (!product) {
        const err = new Error("المنتج غير موجود");
        err.code = "PRODUCT_NOT_FOUND";
        throw err;
    }

    const batches = await all(
        `SELECT * FROM inventory_batches
         WHERE product_id = ? AND quantity > 0
         ORDER BY expiry_date ASC`,
        [product_id]
    );

    const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);

    if (totalAvailable < qty) {
        throw insufficientStockError();
    }

    let remaining = qty;

    for (const batch of batches) {
        if (remaining <= 0) break;

        const deduct = Math.min(batch.quantity, remaining);
        const profit = deduct * (product.sale_price - batch.purchase_price);

        await run(
            `UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?`,
            [deduct, batch.id]
        );

        await run(
            `INSERT INTO inventory_transactions
             (product_id, batch_id, transaction_type, quantity, reference_type, reference_id, profit)
             VALUES (?, ?, 'use', ?, ?, ?, ?)`,
            [product_id, batch.id, deduct, reference_type, reference_id, profit]
        );

        remaining -= deduct;
    }
}

module.exports = { getTotalStock, deductStock };
