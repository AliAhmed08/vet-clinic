let cart = []
let productsData = [];
let currentCategory = "all";
let currentSearch = "";
let currentPage = 1;
let isLoading = false;
let hasMore = true;


async function loadProducts(reset = false) {

    if (reset) {
        currentPage = 1;
        hasMore = true;
        productsData = [];
    }

    if (isLoading || !hasMore) return;

    isLoading = true;

    try {

        const res = await fetch(
            `/api/inventory/products?page=${currentPage}&limit=30&category=${currentCategory}&search=${encodeURIComponent(currentSearch)}`
        );

        const result = await res.json();

        if (reset) {
            productsData = result.data;
        } else {
            productsData.push(...result.data);
        }

        hasMore = result.hasMore;
        currentPage++;

        renderProducts();

    } finally {
        isLoading = false;
    }
}

document
    .getElementById("posSearch")
    .addEventListener("input", e => {

        currentSearch = e.target.value;

        loadProducts(true);

    });

function addToCart(product_id) {

    const qty = 1;

    const product = productsData.find(p => p.id == product_id);

    const existing = cart.find(p => p.product_id == product_id);
    const currentQtyInCart = existing ? existing.quantity : 0;

    const newTotalQty = currentQtyInCart + qty;

    if (product.total_stock < newTotalQty) {
        showToast("الكمية غير متوفرة في المخزون", "red");
        return;
    }

    if (existing) {
        existing.quantity += qty;
    } else {
        cart.push({
            product_id,
            quantity: qty,
            sale_price: product.sale_price
        });
    }

    renderCart();
}

async function checkout() {
    if (!cart.length) return showToast("الكارت فاضي", "red");
    console.log(cart);

    const res = await fetch("/api/sales", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ items: cart })
    });

    if (!res.ok) {
        showToast("❌ فشل البيع", "red");
        return;
    }

    const invoiceItems = cart.map(item => {
        const product = productsData.find(p => p.id == item.product_id);
        return {
            name: product ? product.name : "منتج غير معروف",
            quantity: item.quantity,
            price: Number(item.sale_price)
        };
    });

    openInvoiceModal({
        items: invoiceItems
    });

    cart = [];
    renderCart();
    loadProducts();
    showToast("تمت العملية بنجاح");
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

function switchCategory(category, btn) {

    currentCategory = category;

    document
        .querySelectorAll(".tab-btn")
        .forEach(x => x.classList.remove("active"));

    btn.classList.add("active");

    loadProducts(true);

}

const productsSection = document.querySelector(".products-section");

productsSection.addEventListener("scroll", async () => {

    if (isLoading || !hasMore) return;

    const distanceFromBottom =
        productsSection.scrollHeight -
        productsSection.scrollTop -
        productsSection.clientHeight;

    if (distanceFromBottom < 200) {
        await loadProducts();
    }

});

function renderProducts() {
    const grid = document.getElementById("productsGrid");

    grid.innerHTML = "";

    productsData.forEach(p => {
        const image = p.image_url
            ? `app-data://inventory/${p.image_url}`
            : `${getDefaultProductImage(p.category)}`;

        const stockClass =
            p.total_stock === 0 ? 'out' :
                p.total_stock < p.min_stock ? 'low' : 'ok';

        grid.innerHTML += `
                <div class="product-card ${stockClass}" onclick="addToCart(${p.id})">
                    <img src="${image}" />
                    <h4>${p.name}</h4>
                    <p>💰 ${p.sale_price ?? 0} جنيه</p>
                    <p>📦 ${p.total_stock}</p>
                </div>
            `;
    })
}

function renderCart() {

    const container = document.getElementById("cartItems");

    container.innerHTML = cart.map((item, i) => {
        const product = productsData.find(p => p.id == item.product_id);

        return `
            <div class="cart-item">
                <span>${product.name}</span>

                <div>
                    <button onclick="decreaseQty(${item.product_id})">-</button>
                    ${item.quantity}
                    <button onclick="increaseQty(${item.product_id})">+</button>
                </div>

                <span>${item.sale_price * item.quantity} جنيه</span>
            </div>  
        `;
    }).join("");

    const total = cart.reduce((sum, i) => sum + (i.sale_price * i.quantity), 0);

    document.getElementById("cartTotal").innerText = total;
}
function increaseQty(product_id) {
    addToCart(product_id);
}

function decreaseQty(product_id) {
    const item = cart.find(p => p.product_id == product_id);

    if (!item) return;

    item.quantity--;

    if (item.quantity <= 0) {
        cart = cart.filter(p => p.product_id != product_id);
    }

    renderCart();
}

async function openInvoiceModal(invoice) {

    const settings =
        await fetch("/api/settings")
            .then(r => r.json());

    document.getElementById("clinicName")
        .textContent = settings.clinic_name;

    if (settings.logo) {
        document.getElementById("clinicLogo").src =
            `app-data://uploads/${settings.logo}`;
    }

    document.getElementById("clinicPhone")
        .textContent = settings.phone;

    document.getElementById("clinicAddress")
        .textContent = settings.address;

    document.getElementById("invoiceTime")
        .textContent = new Date().toLocaleTimeString();

    document.getElementById("invoiceDate")
        .textContent = new Date().toLocaleDateString();

    document.getElementById("invoiceItems")
        .innerHTML = invoice.items.map(i => `

            <tr>
                <td>${i.name}</td>
                <td>${i.quantity}</td>
                <td>${i.price}</td>
            </tr>

        `).join("");

    const total = invoice.items.reduce((s, i) => s + (i.price * i.quantity), 0);

    document.getElementById("invoiceTotal")
        .textContent = `الإجمالي: ${total} جنيه`;

    document.getElementById("invoiceModal")
        .style.display = "flex";
}

document.getElementById("printInvoiceBtn")
    .addEventListener("click", () => {

        const content =
            document.getElementById("invoiceContent").innerHTML;

        const win = window.open("", "", "width=400,height=700");

        win.document.write(`
        <html>
        <head>
            <title>Invoice</title>
            <link rel="stylesheet" href="invoice.css">
        </head>

        <body>

            ${content}

        </body>
        </html>
    `);

        win.document.close();

        win.onload = () => {

            setTimeout(() => {

                win.focus();
                win.print();
                win.close()

            }, 500);

        };
    });

document.getElementById("closeInvoice").addEventListener("click", () => {
    document.getElementById("invoiceModal").style.display = "none";
})

/* ================= TOAST ================= */
function showToast(msg, color = "#4caf50") {
    toast.textContent = msg;
    toast.style.display = "block";
    toast.style.backgroundColor = color;
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

loadProducts(true);