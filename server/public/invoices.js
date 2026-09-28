const API = "http://localhost:3000/api/supplier-invoices";

const tableBody = document.getElementById("invoiceTableBody");
const toast = document.getElementById("toast");

/* ================= helpers ================= */

// company_name / purchases are free text typed by the user - escape them
// before putting them into innerHTML so "<" or "&" can't break the table
// (or inject markup).
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Avoid float artifacts like 0.30000000000000004 in the UI
function fmt(n) {
    return Number(Number(n).toFixed(2));
}

function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 5000);
}

/* ================= list ================= */

async function loadInvoices() {
    try {
        const response = await fetch(API);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const invoices = await response.json();

        tableBody.innerHTML = invoices.map(inv => {
            const remaining = fmt(inv.remaining_amount);
            const isOpen = remaining > 0;

            return `
        <tr class="invoice-row" data-id="${inv.id}">
            <td>${escapeHtml(inv.company_name)}</td>
            <td>${fmt(inv.total_amount)}</td>
            <td>${fmt(inv.paid_amount)}</td>
            <td class="${isOpen ? "debt-open" : "debt-clear"}">${remaining}</td>
            <td>${escapeHtml(String(inv.invoice_date || "").slice(0, 10))}</td>
            <td>
                <button data-id="${inv.id}" data-remain="${remaining}" class="pay" ${isOpen ? "" : "disabled"}>دفع مبلغ</button>
            </td>
            <td>
                <button data-id="${inv.id}" class="delete-btn"><img src="./images/delete.png"></button>
            </td>
            <td class="expand-arrow">▶</td>
        </tr>

        <tr class="invoice-details" id="details-${inv.id}" style="display:none;">
            <td colspan="8">
                <div class="details-box">
                    <div>
                        <b>  المشتريات : </b> ${escapeHtml(inv.purchases) || "لا توجد"}
                    </div>
                </div>
            </td>
        </tr>
    `;
        }).join('');

        if (!invoices.length) {
            tableBody.innerHTML = `<tr><td colspan="8">لا توجد فواتير</td></tr>`;
        }
    } catch (err) {
        console.error("Failed to load invoices:", err);
        showToast("تعذّر تحميل الفواتير");
    }
}

// One delegated listener handles expand / pay / delete for every row, so it
// is registered once and keeps working after each re-render.
tableBody.addEventListener("click", e => {

    const payBtn = e.target.closest(".pay");
    if (payBtn) {
        if (payBtn.disabled) return;
        openPayModal(payBtn.dataset.id, parseFloat(payBtn.dataset.remain));
        return;
    }

    const delBtn = e.target.closest(".delete-btn");
    if (delBtn) {
        deleteId = delBtn.dataset.id;
        confirmModal.style.display = "flex";
        return;
    }

    const row = e.target.closest(".invoice-row");
    if (!row) return;

    const details = document.getElementById(`details-${row.dataset.id}`);
    const arrow = row.querySelector(".expand-arrow");
    const isOpen = details.style.display === "table-row";

    details.style.display = isOpen ? "none" : "table-row";
    arrow.textContent = isOpen ? "▶" : "▼";
});

/* ================= add ================= */

function calculateRemaining() {
    const total = parseFloat(document.getElementById('totalAmount').value) || 0;
    const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
    document.getElementById('remainingAmount').value = fmt(total - paid);
}

async function addInvoice() {
    const payload = {
        company_name: document.getElementById('companyName').value,
        purchases: document.getElementById('purchases').value,
        total_amount: document.getElementById('totalAmount').value,
        paid_amount: document.getElementById('paidAmount').value
    };

    try {
        const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || "تعذّر إضافة الفاتورة");
            return;
        }

        document.getElementById("invoiceForm").reset();
        calculateRemaining();
        showToast("تمت إضافة الفاتورة بنجاح");
        loadInvoices();

    } catch (err) {
        console.error("Add invoice failed:", err);
        showToast("تعذّر الاتصال بالخادم");
    }
}

// A real submit handler (instead of onclick on a button inside the form)
// keeps the browser's required/min validation working and stops the form
// from also doing a native submit / page reload.
document.getElementById("invoiceForm").addEventListener("submit", e => {
    e.preventDefault();
    addInvoice();
});

/* ================= delete ================= */

const confirmModal = document.getElementById("confirmModal");
const confirmBtn = document.getElementById("confirmDelete");
const cancelBtn = document.getElementById("cancelDelete");
let deleteId = null;

cancelBtn.addEventListener("click", () => confirmModal.style.display = "none");

confirmModal.addEventListener("click", e => {
    if (e.target === confirmModal) {
        confirmModal.style.display = "none";
    }
});

confirmBtn.addEventListener("click", async () => {
    try {
        const res = await fetch(`${API}/${deleteId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("HTTP " + res.status);

        showToast("تم حذف الفاتورة بنجاح");
        loadInvoices();
    } catch (err) {
        console.error("Delete failed:", err);
        showToast("تعذّر حذف الفاتورة");
    }

    confirmModal.style.display = "none";
});

/* ================= pay ================= */

const addAmountModal = document.getElementById("addAmountModal");
const newAmountInput = document.getElementById("newAmount");
const addAmountP = document.getElementById("addAmountP");
let payId = null;
let currentRemaining = null;

function openPayModal(id, remaining) {
    payId = id;
    currentRemaining = remaining;

    document.getElementById("remainingAmountH").innerHTML = `المبلغ المتبقي : ${remaining}`;
    newAmountInput.value = "";
    addAmountP.innerText = "";
    addAmountModal.style.display = "flex";
}

function closePayModal() {
    newAmountInput.value = "";
    addAmountP.innerText = "";
    addAmountModal.style.display = "none";
}

document.getElementById("cancelAddAmount").addEventListener("click", closePayModal);

addAmountModal.addEventListener("click", e => {
    if (e.target === addAmountModal) closePayModal();
});

document.getElementById("confirmAddAmount").addEventListener("click", () => {
    makePayment(payId, currentRemaining);
});

async function makePayment(id, remaining) {
    const amount = parseFloat(newAmountInput.value);

    if (!amount || isNaN(amount) || amount <= 0) {
        addAmountP.innerText = "يرجى إدخال مبلغ صحيح";
        return;
    }

    if (amount > remaining) {
        addAmountP.innerText = "المبلغ المدفوع أكبر من المتبقي";
        return;
    }

    try {
        const response = await fetch(`${API}/${id}/pay`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amountPaidNow: amount })
        });

        if (response.ok) {
            closePayModal();
            showToast("تم تحديث الحساب بنجاح");
            loadInvoices();
        } else {
            const errorData = await response.json().catch(() => ({}));
            addAmountP.innerText = errorData.error || "تعذّر تحديث الحساب";
        }
    } catch (error) {
        console.error("Connection error:", error);
        addAmountP.innerText = "تعذّر الاتصال بالخادم";
    }
}

loadInvoices();
