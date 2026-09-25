let salesData = [];
let currentPage = 1;
let currentSearch = "";

async function loadSales() {

    const res = await fetch(
        `/api/sales?page=${currentPage}&search=${encodeURIComponent(currentSearch)}`
    );

    const result = await res.json();

    salesData = result.data;

    renderSales();
    renderPagination(result.page, result.totalPages);
}

document
    .getElementById("searchInvoice")
    .addEventListener("input", e => {

        currentSearch = e.target.value;
        currentPage = 1;

        loadSales();

    });

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
    loadSales();
}

function renderSales() {

    const list = document.getElementById("salesList");

    list.innerHTML = "";

    salesData.forEach(sale => {

        list.innerHTML += `
            <div class="sale-card" onclick="openInvoice(${sale.id})">

                <div class="sale-info">

                    <div class="sale-number">
                        فاتورة #${sale.id}
                    </div>

                    <div class="sale-date">
                        ${new Date(sale.created_at).toLocaleDateString()}
                        -
                        ${new Date(sale.created_at).toLocaleTimeString()}
                    </div>

                </div>

                <div class="sale-total">
                    ${sale.total_amount} ج
                </div>

            </div>
        `;

    });

}

async function openInvoice(id) {

    const res =
        await fetch(
            `/api/sales/${id}`
        );

    const sale =
        await res.json();

    document
        .getElementById("invoiceNumber")
        .textContent =
        `فاتورة #${id}`;

    document
        .getElementById("invoiceTotal")
        .textContent =
        sale.total_amount + " ج";

    document
        .getElementById("invoiceInfo")
        .innerHTML = `
        <p>
           <b> التاريخ :</b>
            ${new Date(
            sale.created_at
        ).toLocaleDateString()}
        </p>

                <p>
           <b> الوقت :</b>
            ${new Date(
            sale.created_at
        ).toLocaleTimeString()}
        </p>
    `;

    const tbody =
        document.getElementById(
            "invoiceItems"
        );

    tbody.innerHTML = "";

    sale.items.forEach(item => {

        tbody.innerHTML += `

            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.price}</td>
            </tr>

        `;
    });

    document
        .getElementById("invoiceModal")
        .style.display = "flex";
}

function closeInvoiceModal() {

    document
        .getElementById("invoiceModal")
        .style.display = "none";

}

loadSales()