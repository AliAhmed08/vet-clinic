const API = "http://localhost:3000/api/inventory";

let currentPage = 1;
let selectedProduct = null;
let currentProductId = null;
let selectedBatchId = null;
let productsData = [];
let batches = [];

// ================= LOAD PRODUCTS =================
let currentSearch = "";

async function loadProducts() {

    const res = await fetch(
        `${API}/products?page=${currentPage}&category=${currentCategory}&search=${encodeURIComponent(currentSearch)}`
    );

    const result = await res.json();

    productsData = result.data;

    renderPagination(result.page, result.totalPages);

    renderProducts();

}

/* ================= PAGINATION ================= */
const pagination = document.getElementById("pagination");
function renderPagination(page, totalPages) {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;
    if (page > 1) pagination.innerHTML += `<button onclick="changePage(${page - 1})">❮</button>`;
    pagination.innerHTML += `<span>${page} / ${totalPages}</span>`;
    if (page < totalPages) pagination.innerHTML += `<button onclick="changePage(${page + 1})">❯</button>`;
}

function changePage(p) {
    currentPage = p;
    loadProducts();
}

function getDefaultProductImage(type) {

    switch ((type || "").toLowerCase()) {

        case "vaccine":
        case "vaccines":
            return "./images/default-vaccine.png";

        case "medicine":
        case "medications":
            return "./images/default-medicine.png";

        case "food":
            return "./images/default-food.png";

        case "accessory":
            return "./images/default-accessory.png";

        default:
            return "";
    }
}

// تأكد أن هذا المتغير معرف خارج الدالة في أعلى الملف
let currentCategory = "all";

function renderProducts() {

    const grid = document.getElementById("productsGrid");

    grid.innerHTML = "";

    for (const p of productsData) {

        const totalStock = p.total_stock;
        const isLow = totalStock <= p.min_stock;
        const empty = totalStock === 0;

        const image = p.image_url
            ? `app-data://inventory/${p.image_url}`
            : getDefaultProductImage(p.category);

        grid.innerHTML += `
            <div class="product-card ${empty ? "empty" : ""}"
                 onclick="openProductDetails(${p.id})">

                <img src="${image}">

                <div class="name">${p.name}</div>

                <div class="stock ${isLow ? "low" : ""}">
                    ${totalStock}
                </div>

            </div>
        `;
    }

    if (!productsData.length) {

        grid.innerHTML = `
            <p style="text-align:center">
                لا توجد نتائج
            </p>
        `;
    }
}

function switchCategory(category, buttonElement) {

    currentCategory = category.toLowerCase();

    document.querySelectorAll(".tab-btn")
        .forEach(btn => btn.classList.remove("active"));

    buttonElement.classList.add("active");

    currentPage = 1;

    loadProducts();

}

document
    .getElementById("productSearch")
    .addEventListener("input", e => {

        currentSearch = e.target.value;
        currentPage = 1;

        loadProducts();

    });

function openProductDetails(id) {
    currentProductId = id;

    const product = productsData.find(p => p.id == id);

    document.getElementById("productName").innerText = product.name;

    fetch(`${API}/product/${id}`)
        .then(res => res.json())
        .then(data => {
            batches = data.batches
            renderBatches(data.batches);
            renderStats(data);
        })
        .catch(err => {
            console.error("Error loading batches:", err);
        });

    document.getElementById("productActions").innerHTML = `
    <button onclick="deactivateProduct(${product.id})" class="delete-product">حذف</button>
    <button onclick="openEditProduct(${product.id})" class="edit-product">تعديل</button>`;

    document.getElementById("productDetailsModal").style.display = "flex";
}

function openAddBatchInside() {
    if (!currentProductId) return;

    selectedProduct = currentProductId;

    document.getElementById("addModal").style.display = "flex";
}

function renderBatches(batches) {
    const div = document.getElementById("batchesTable");

    const checkboxContainer = document.getElementById("expBatches");

    const hasEmpty = batches.some(b => b.quantity === 0);

    checkboxContainer.style.display = hasEmpty ? "flex" : "none";

    const showEmpty = document.getElementById("showEmptyBatches").checked;

    div.innerHTML = batches
        .filter(b => showEmpty || b.quantity > 0)
        .map(b => {

            const expired = new Date(b.expiry_date) < new Date();
            const empty = b.quantity === 0;

            return `
                <div class="batch-card  ${empty ? 'empty' : ''}">

                    <span>📦 الكمية : ${b.quantity}</span>
                    <span>💰 سعر الشراء : ${b.purchase_price}</span>
                    <span>🏢 ${b.supplier || "بدون مورد"}</span>
                    <span>${b.expiry_date ? "📅 تاريخ الانتهاء  : " + b.expiry_date : ''}</span>

                    <button onclick="adjustBatch(${b.id})">
                         تعديل 
                    </button>

                </div>
            `;
        }).join("");
}

function renderStats(p) {
    document.getElementById("productStats").innerHTML = `
    <p> <b>سعر البيع : </b>${p.product.sale_price} </p>
        <p>
            <b> إجمالي المخزون : </b>${p.total_stock}
        </p>
    `;
}

document.getElementById("showEmptyBatches")
    .addEventListener("change", () => {
        openProductDetails(currentProductId);
    });

function adjustBatch(id) {
    const batch = batches.find(b => b.id === id);

    selectedBatchId = id;

    document.getElementById("edit_batch_price").value = batch.purchase_price;
    document.getElementById("edit_batch_expiry").value = batch.expiry_date;
    document.getElementById("edit_batch_qty").value = batch.quantity;
    document.getElementById("edit_batch_supplier").value = batch.supplier;
    console.log(batch.supplier)

    document.getElementById("adjustModal").style.display = "flex";
}

async function submitAdjustment() {

    const purchase_price = document.getElementById("edit_batch_price").value;
    const expiry_date = document.getElementById("edit_batch_expiry").value;
    const quantity = document.getElementById("edit_batch_qty").value;
    const supplier = document.getElementById("edit_batch_supplier").value;

    if (isNaN(quantity) || quantity < 0) {
        showToast(" رقم غير صالح", "red");
        return;
    }

    await fetch("/api/inventory/batch/adjust", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            batch_id: selectedBatchId,
            purchase_price,
            expiry_date,
            quantity,
            supplier

        })
    });

    closeModal("adjustModal");

    openProductDetails(currentProductId);
    loadProducts();
    loadStockAlerts();
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

// ================= ADD STOCK =================
document.getElementById("addStockForm").addEventListener("submit", async e => {
    e.preventDefault();

    const data = {
        product_id: selectedProduct,
        quantity: Number(document.getElementById("addQuantity").value),
        expiry_date: document.getElementById("addExpiry").value,
        supplier: document.getElementById("supplier").value,
        purchase_price: Number(document.getElementById("purchasePrice").value)
    };

    await fetch(API + "/stock/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    document.getElementById("addQuantity").value = "";
    document.getElementById("addExpiry").value = "";
    document.getElementById("supplier").value = "";
    document.getElementById("purchasePrice").value = "";

    closeModal("addModal");
    openProductDetails(currentProductId);
    loadProducts();
    loadStockAlerts();
});

function openAddProductModal() {
    document.getElementById("productModal").style.display = "flex";
}

document.getElementById("addForm").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("newProductName").value;
    const sale_price = Number(document.getElementById("salePrice").value);
    const category = document.getElementById("productCategory").value;
    const min_stock = Number(document.getElementById("productMinStock").value);
    const imageFile = document.getElementById("productImage").files[0];

    const formData = new FormData();
    formData.append("name", name);
    formData.append("sale_price", sale_price);
    formData.append("category", category);
    formData.append("min_stock", min_stock);
    if (imageFile) formData.append("image", imageFile);


    await fetch(API + "/products", {
        method: "POST",
        body: formData
    });

    closeModal("productModal");

    // reset fields
    document.getElementById("newProductName").value = "";
    document.getElementById("salePrice").value = "";
    document.getElementById("productCategory").value = "";
    document.getElementById("productMinStock").value = "";
    document.getElementById("productImage").value = "";

    loadProducts();
    renderProducts();
});

let productToDeactivate = null;

function deactivateProduct(id) {
    productToDeactivate = id;

    document.getElementById("confirmP").textContent =
        "هل أنت متأكد من إلغاء تفعيل المنتج؟";

    document.getElementById("confirmModal").style.display = "flex";
}

document.getElementById("confirmDelete").addEventListener("click", async () => {

    if (productToDeactivate) {
        await fetch(`/api/inventory/products/${productToDeactivate}/deactivate`, {
            method: "PUT"
        });

        productToDeactivate = null;
        loadProducts();
        renderProducts();
    }

    document.getElementById("confirmModal").style.display = "none";
    document.getElementById("productDetailsModal").style.display = "none";
});

document.getElementById("cancelDelete").addEventListener("click", () => {
    document.getElementById("confirmModal").style.display = "none";
})

const fileInput = document.getElementById("edit_image_file");
const preview = document.getElementById("edit_preview");

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
});

let editingProductId = null

function openEditProduct(id) {
    const product = productsData.find(p => p.id == id);

    editingProductId = id;

    document.getElementById("edit_name").value = product.name;
    document.getElementById("edit_price").value = product.sale_price;

    if (product.image_url) {
        preview.src = `app-data://inventory/${product.image_url}`;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
    }

    document.getElementById("editProductModal").style.display = "flex";
}

async function submitEditProduct() {

    const name = document.getElementById("edit_name").value.trim();
    const sale_price = document.getElementById("edit_price").value;
    const file = document.getElementById("edit_image_file").files[0];

    if (!name || !sale_price) {
        showToast("بيانات ناقصة", "red");
        return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("sale_price", sale_price);

    if (file) {
        formData.append("image", file);
    }

    const res = await fetch(`/api/inventory/products/${editingProductId}`, {
        method: "PUT",
        body: formData
    });

    const result = await res.json();

    if (!res.ok) {
        alert(result.error || "حصل خطأ");
        return;
    }

    closeModal("editProductModal");
    openProductDetails(currentProductId);
    await loadProducts();
    renderProducts();
    loadStockAlerts();

    showToast("تم التعديل بنجاح");
}

async function loadStockAlerts() {
    const [lowRes, expRes] = await Promise.all([
        fetch("/api/inventory/alerts"),
        fetch("/api/inventory/expiry-alerts")
    ]);

    const lowStock = await lowRes.json();
    const expiry = await expRes.json();

    updateBadge(lowStock.length + expiry.length);

    renderLowStock(lowStock);
    renderExpiry(expiry);
}

function updateBadge(count) {
    const btn = document.getElementById("stockAlertBtn");
    const badge = document.getElementById("stockAlertCount");

    if (count > 0) {
        btn.classList.remove("hidden");
        badge.textContent = count;
    } else {
        btn.classList.add("hidden");
    }
}

function renderLowStock(list) {
    const div = document.getElementById("lowStockList");

    if (!list.length) {
        div.innerHTML = `<p class="alert-empty">لا يوجد منتجات ناقصة ✅</p>`;
        return;
    }

    div.innerHTML = list.map(p => `
        <div class="alert-card${p.total_stock === 0 ? " expired" : " expiring"}" onclick="openProductDetails(${p.id})">
            <h4>${p.name}</h4>
            <div class="alert-stock">
                الكمية: ${p.total_stock} &ensp;|&ensp;  الحد الأدنى: ${p.min_stock} 
            </div>
        </div>
    `).join("");
}

const pluralRules = new Intl.PluralRules("ar");
function daysLeftText(days) {
    switch (pluralRules.select(days)) {
        case "zero":
            return "اليوم";
        case "one":
            return "متبقي يوم ";
        case "two":
            return "متبقي يومان";
        case "few":
            return `متبقي ${days} ايام`;
        case "many":
            return `متبقي ${days} يوم`;
        default:
            return `متبقي ${days} يوم`;
    }
}

function renderExpiry(list) {
    const div = document.getElementById("expiryList");

    if (!list.length) {
        div.innerHTML = `<p class="alert-empty"> لا يوجد منتجات منتهية</p>`;
        return;
    }

    const today = new Date();

    div.innerHTML = list.map(b => {

        const expDate = new Date(b.expiry_date);
        const diff = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

        let cls = "";
        let label = "";

        if (diff < 0) {
            cls = "expired";
            label = `انتهت الصلاحية في ${b.expiry_date}`;
        } else {
            cls = "expiring";
            label = ` ${daysLeftText(diff)}  علي انتهاء الصلاحية`;
        }

        return `
            <div class="alert-card ${cls}" onclick="openProductDetails(${b.product_id})">
                <h4>${b.name}</h4>
                <div class="alert-stock">
                    الكمية: ${b.quantity} &ensp;|&ensp; ${label} 
                </div>
            </div>
        `;
    }).join("");
}

document.getElementById("stockAlertBtn").onclick = () => {
    document.getElementById("stockAlertModal").style.display = "flex";
};

/* ================= TOAST ================= */
function showToast(msg, color = "#4caf50") {
    toast.textContent = msg;
    toast.style.display = "block";
    toast.style.backgroundColor = color;
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// ================= INIT =================
loadProducts();
loadStockAlerts();