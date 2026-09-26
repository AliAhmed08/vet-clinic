const { run } = require("../db/db");
const { getTotalStock, deductStock } = require("./stock");

function invalidItemsError(message) {
    const err = new Error(message);
    err.code = "INVALID_ITEMS";
    return err;
}

function insufficientStockError() {
    const err = new Error("المخزون غير كافي");
    err.code = "INSUFFICIENT_STOCK";
    return err;
}

// Creates a sale, its sale_items, and deducts stock for every item.
// Assumes the caller has ALREADY issued BEGIN TRANSACTION on the shared
// connection (directly, or via createSale() below) and will COMMIT/ROLLBACK
// around this call - that's what lets vaccination routes fold a sale into
// the same transaction as their own vaccination/vaccine_history writes.
async function createSaleWithinTransaction(items, reference_type) {
    if (!Array.isArray(items) || items.length === 0) {
        throw invalidItemsError("لا توجد عناصر في عملية البيع");
    }

    // Aggregate requested quantity per product (the same product can appear
    // more than once in one basket) and validate availability for
    // everything BEFORE writing anything - this is what makes the sale
    // atomic in the common case.
    const neededByProduct = {};

    for (const item of items) {
        const quantity = Number(item.quantity);

        if (!item.product_id || !Number.isFinite(quantity) || quantity <= 0) {
            throw invalidItemsError("كمية أو منتج غير صالح");
        }

        neededByProduct[item.product_id] =
            (neededByProduct[item.product_id] || 0) + quantity;
    }

    for (const product_id of Object.keys(neededByProduct)) {
        const available = await getTotalStock(product_id);
        if (available < neededByProduct[product_id]) {
            throw insufficientStockError();
        }
    }

    const created_at = new Date().toISOString();

    const saleResult = await run(
        "INSERT INTO sales (total_amount, created_at) VALUES (0, ?)",
        [created_at]
    );
    const saleId = saleResult.lastID;

    let total = 0;

    for (const item of items) {
        const { product_id, quantity, sale_price } = item;

        total += quantity * sale_price;

        await run(
            `INSERT INTO sale_items (sale_id, product_id, quantity, price)
             VALUES (?, ?, ?, ?)`,
            [saleId, product_id, quantity, sale_price]
        );

        await deductStock({
            product_id,
            quantity,
            reference_type,
            reference_id: saleId
        });
    }

    await run("UPDATE sales SET total_amount = ? WHERE id = ?", [total, saleId]);

    return { id: saleId, total };
}

// Standalone entry point for callers that are not already inside a
// transaction of their own (the plain POST /api/sales route). Manages its
// own BEGIN/COMMIT/ROLLBACK.
async function createSale(items, reference_type) {
    await run("BEGIN TRANSACTION");

    try {
        const result = await createSaleWithinTransaction(items, reference_type);
        await run("COMMIT");
        return result;
    } catch (err) {
        await run("ROLLBACK").catch(() => {});
        throw err;
    }
}

module.exports = { createSale, createSaleWithinTransaction };
