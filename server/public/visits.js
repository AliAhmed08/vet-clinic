/* ================ ELEMENTS ================ */
const form = document.getElementById("visitForm");
const tableBody = document.querySelector("#visitsTable tbody");
const animalSelect = document.getElementById("animal_id");
const animalSearchInput = document.getElementById("animalSearchInput");
const animalSearchResults = document.getElementById("animalSearchResults");

const typeInput = document.getElementById("type");
const ownerInput = document.getElementById("owner");
const phoneInput = document.getElementById("phone");
const dateInput = document.getElementById("date");
const priceInput = document.getElementById("price");
const notesInput = document.getElementById("notes");

const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");

/* Modals */
const animalFile = document.getElementById("animalFile");
const animalInfo = document.getElementById("animalInfo");
const visitsList = document.getElementById("visitsList");
const vaccinationsList = document.getElementById("vaccinationsList");
const deleteBtn = document.getElementById("delete-animal");

const allVisitsModal = document.getElementById("allVisitsModal");
const allVisitsList = document.getElementById("allVisitsList");
const closeVisits = document.getElementById("closeVisits");

const animalModal = document.getElementById("animalModal");
const confirmModal = document.getElementById("confirmModal");
const confirmBtn = document.getElementById("confirmDelete");
const cancelBtn = document.getElementById("cancelDelete");
const toast = document.getElementById("toast");

/* State */
let currentPage = 1;
let currentSearch = "";
let cachedVisits = [];
let currentAnimalId = null;
let allAnimals = [];
let confirmAction = null
let dateFrom = "";
let dateTo = "";
let currentProductsPage = 1;
let isLoading = false;
let hasMore = true;
let currentProductSearch = "";
let visitProducts = [];
let productsData = [];
let totalProfit = 0;

/* ================= INIT ================= */
dateInput.value = new Date().toISOString().split("T")[0];
loadAnimals();
loadVisits();
loadProducts(true)

/* ================= LOAD ANIMALS ================= */
async function loadAnimals() {
    const res = await fetch("/api/animals?all=true");
    const result = await res.json();
    const animals = result.data;

    animalSelect.innerHTML =
        `<option value="">اختر الحيوان</option>` +
        animals.map(a => `<option value="${a.id}" data-phone="${a.phone}">${a.name} - ${a.owner} - ${a.phone}</option>`).join("");
}

animalSearchInput.addEventListener("input", () => {
    const query = animalSearchInput.value.toLowerCase();
    const options = Array.from(animalSelect.options).filter(o => o.value);

    animalSearchResults.innerHTML = options
        .filter(o =>
            o.text.toLowerCase().includes(query) ||
            (o.dataset.phone && o.dataset.phone.includes(query))
        )
        .map(o => `<li data-id="${o.value}">${o.text}</li>`)
        .join("");

    animalSearchResults.style.display = query ? "block" : "none";

    animalSearchResults.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
            animalSelect.value = li.dataset.id;
            fillAnimalData(li.dataset.id);
            animalSearchInput.value = li.textContent.split(' -')[0];
            animalSearchResults.style.display = "none";
        });
    });
});

document.addEventListener("click", e => {
    if (!e.target.closest(".searchable-select-wrapper")) animalSearchResults.style.display = "none";
});

/* ================= FILL ANIMAL DATA ================= */
async function fillAnimalData(id) {
    const res = await fetch(`/api/animals/${id}`);
    const data = await res.json();
    const a = data.animal;

    animalSelect.value = id;
    typeInput.value = a.type;
    ownerInput.value = a.owner;
    phoneInput.value = a.phone;
}


/* ================= LOAD VISITS ================= */
async function loadVisits() {
    const res = await fetch(`/api/visits?page=${currentPage}&search=${encodeURIComponent(currentSearch)}&dateFrom=${dateFrom || ""}&dateTo=${dateTo || ""}`);
    const result = await res.json();
    renderVisits(result.data);
    renderPagination(result.page, result.totalPages);
}

/* ================= RENDER VISITS ================= */
function renderVisits(visits) {
    tableBody.innerHTML = visits.length
        ? visits.map(v => {

            let animalIcon = "🐾";
            if (v.type === "قطة") animalIcon = "🐱";
            if (v.type === "كلب") animalIcon = "🐶";
            if (v.type === "أرنب" || v.type === "ارنب") animalIcon = "🐰";

            return `
      <tr class="visit-row" data-id="${v.id}">
        
        <td class="animal-link" onclick="openAnimal(${v.animal_id})">${animalIcon} ${v.animal}</td>
        <td>${v.owner}</td>
        <td>${v.price || ""}</td>
        <td>${v.date}</td>
    
        <td>
            <button class="delete-btn" data-id="${v.id}">
                <img src="./images/delete.png">
            </button>
        </td>
        <td class="expand-arrow">▶</td>
      </tr>

      <tr class="visit-details" id="details-${v.id}" style="display:none;">
        <td colspan="6">
            <div class="details-box">

                <div>
                    <b>  الملاحظات : </b> ${v.notes || "لا توجد"}
                </div>

                ${v.images
                    ? `<div class="visit-images">
                            ${v.images.split(",").map(img => `
                                <img src="app-data://uploads/${img}" class="visit-thumb" data-img="${img}">
                            `).join("")}
                           </div>`
                    : ""
                }

            </div>
        </td>
      </tr>

      `}).join('')
        : `<tr><td colspan="7">لا توجد نتائج</td></tr>`;

    attachExpandableRows();
    attachImageModalListeners();
}
function attachExpandableRows() {
    document.querySelectorAll(".visit-row").forEach(row => {

        row.addEventListener("click", function (e) {

            if (e.target.closest(".animal-link") || e.target.closest(".delete-btn"))
                return;

            const id = this.dataset.id;
            const details = document.getElementById(`details-${id}`);
            const arrow = this.querySelector(".expand-arrow");

            const isOpen = details.style.display === "table-row";

            details.style.display = isOpen ? "none" : "table-row";
            arrow.textContent = isOpen ? "▶" : "▼";

        });

    });
}

/* ================= PAGINATION ================= */
function renderPagination(page, totalPages) {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;
    if (page > 1) pagination.innerHTML += `<button onclick="changePage(${page - 1})">❮</button>`;
    pagination.innerHTML += `<span>${page} / ${totalPages}</span>`;
    if (page < totalPages) pagination.innerHTML += `<button onclick="changePage(${page + 1})">❯</button>`;
}

function changePage(p) {
    currentPage = p;
    loadVisits();
}

const fileInput = document.getElementById('images');
const fileNameDisplay = document.getElementById('file-name');

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = `${fileInput.files.length} ملف تم اختياره`;
    } else {
        fileNameDisplay.textContent = 'لم يتم اختيار ملف';
    }
});

const imageModal = document.getElementById("imageModal");
const lightboxImage = document.getElementById("lightboxImage");
const prevImageBtn = document.getElementById("prevImage");
const nextImageBtn = document.getElementById("nextImage");

let currentImages = [];
let currentIndex = 0;

function attachImageModalListeners() {

    document.querySelectorAll(".visit-thumb").forEach((img) => {

        img.onclick = () => {

            const visitImages = img.closest(".visit-images")
                .querySelectorAll(".visit-thumb");

            currentImages = Array.from(visitImages)
                .map(i => "app-data://uploads/" + i.dataset.img);

            currentIndex = Array.from(visitImages).indexOf(img);

            showLightboxImage();

            if (currentImages.length <= 1) {
                prevImageBtn.style.display = "none";
                nextImageBtn.style.display = "none";
            } else {
                prevImageBtn.style.display = "block";
                nextImageBtn.style.display = "block";
            }

            imageModal.style.display = "flex";
        };

    });
}

function showLightboxImage() {
    lightboxImage.src = currentImages[currentIndex];
}

prevImageBtn.onclick = () => {
    if (currentImages.length <= 1) return;

    currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
    showLightboxImage();
};

nextImageBtn.onclick = () => {
    if (currentImages.length <= 1) return;

    currentIndex = (currentIndex + 1) % currentImages.length;
    showLightboxImage();
};

window.onclick = e => {
    if (e.target === imageModal) imageModal.style.display = "none";
};
document.getElementById("closeImageModal").onclick = () => {
    imageModal.style.display = "none";
};

function openProductModal() {
    loadProducts(true);
    document.getElementById("visitProductModal").style.display = "block";
}

function closeProductModal() {
    document.getElementById("visitProductModal").style.display = "none";
}

document.getElementById("visitProductModal").addEventListener("click", e => { if (e.target === document.getElementById("visitProductModal")) document.getElementById("visitProductModal").style.display = "none"; });

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

function renderProducts() {
    const grid = document.getElementById("productsGrid");

    grid.innerHTML = productsData.map(p => {
        const outOfStockClass = p.total_stock === 0 ? " out" : "";

        const image = p.image_url
            ? `app-data://inventory/${p.image_url}`
            : getDefaultProductImage(p.category);

        return `
            <div class="product-card${outOfStockClass}">
                <img src="${image}" />
                <h4>${p.name}</h4>
                <p>${p.sale_price} جنيه 💲</p>
                <p>${p.total_stock} 📦</p>

                <button onclick="addProductToVisit(${p.id})"
                    ${p.total_stock === 0 ? "disabled" : ""}>
                    إضافة
                </button>

                <input type="number"
                    min="1"
                    max="${p.total_stock}"
                    value="1"
                    id="qty-${p.id}"
                    ${p.total_stock === 0 ? "disabled" : ""} />
            </div>
        `;
    }).join("");
}

document.getElementById("modalSearch").addEventListener("input", (e) => {
    currentProductSearch = e.target.value;

    loadProducts(true);

});

function selectProduct(id) {
    const product = productsData.find(p => p.id == id);

    if (!product || product.total_stock <= 0) {
        alert("❌ المنتج غير متوفر");
        return;
    }

    document.getElementById("productSelect").value = id;
    document.getElementById("selectedProductName").innerText = product.name;
    closeProductModal()
}

// ================= Load Products =================
async function loadProducts(reset = false) {

    if (reset) {
        currentProductsPage = 1;
        hasMore = true;
        productsData = [];
    }

    if (isLoading || !hasMore) return;

    isLoading = true;

    try {

        const res = await fetch(
            `/api/inventory/products?page=${currentProductsPage}&limit=30&search=${encodeURIComponent(currentProductSearch)}`
        );

        const result = await res.json();

        if (reset) {
            productsData = result.data;
        } else {
            productsData.push(...result.data);
        }

        hasMore = result.hasMore;
        currentProductsPage++;

        renderProducts();

    } finally {
        isLoading = false;
    }
}

const modalBody = document.querySelector("#visitProductModal .modal-content");

modalBody.addEventListener("scroll", () => {

    if (
        modalBody.scrollTop +
        modalBody.clientHeight >=
        modalBody.scrollHeight - 200
    ) {
        loadProducts();
    }

});

const productSelectHidden = document.getElementById("productSelect");


// ================= Add Product =================
async function addProductToVisit(product_id) {

    const qtyInput = document.getElementById(`qty-${product_id}`);
    const quantity = Number(qtyInput.value);

    if (quantity <= 0) return;

    const product = productsData.find(p => p.id == product_id);

    const res = await fetch(`/api/inventory/stock/${product_id}`);
    const batches = await res.json();

    const alreadyUsed = visitProducts
        .filter(p => p.product_id == product_id)
        .reduce((sum, p) => sum + p.quantity, 0);

    let remaining = quantity;
    let skip = alreadyUsed;
    let productProfit = 0;

    for (let b of batches) {

        if (skip >= b.quantity) {
            skip -= b.quantity;
            continue;
        }

        let available = b.quantity - skip;
        let take = Math.min(available, remaining);

        productProfit += take * (b.sale_price - b.purchase_price);

        remaining -= take;
        skip = 0;

        if (remaining <= 0) break;
    }

    if (remaining > 0) {
        alert("❌ الكمية غير متوفرة");
        return;
    }

    product.total_stock -= quantity;
    renderProducts();

    const existing = visitProducts.find(p => p.product_id == product_id);

    if (existing) {
        existing.quantity += quantity;
        existing.profit += productProfit;
    } else {
        visitProducts.push({
            product_id,
            quantity,
            sale_price: product.sale_price,
            profit: productProfit
        });
    }

    closeProductModal()
    renderVisitProducts();
    calculateTotal();

    qtyInput.value = 1;
}

// ================= Render =================
function removeProduct(index) {
    visitProducts.splice(index, 1);
    renderVisitProducts();
    loadProducts(true)
    calculateTotal();
}

function renderVisitProducts() {
    const div = document.getElementById("visitProducts");

    div.innerHTML = visitProducts.map((p, index) => {
        const product = productsData.find(x => x.id == p.product_id);

        return `
<div class="used-product-card">
    <b>
    <span class="product-name" dir="ltr">${product.name} </span>
    <span> </span>
    <span class="product-qty">×${p.quantity} : </span>
    </b>

    <span class="product-price">
        ${p.sale_price * p.quantity} جنيه
    </span>

    <button
        class="deleteProduct"
        onclick="removeProduct(${index})">
        ❌
    </button>

</div>
`;
    }).join("");
}

priceInput.addEventListener("input", calculateTotal);

// ================= Total =================
function calculateTotal() {
    const visitPrice = Number(priceInput.value) || 0;

    const productsProfit = visitProducts.reduce((sum, p) => sum + p.profit, 0);

    totalProfit = visitPrice + productsProfit;

}


/* ================= ADD VISIT ================= */
form.addEventListener("submit", async e => {
    e.preventDefault();

    const formData = new FormData();

    formData.append("animal_id", Number(animalSelect.value));
    formData.append("date", dateInput.value);
    formData.append("price", priceInput.value);
    formData.append("notes", notesInput.value);

    const images = document.getElementById("images").files;

    for (let i = 0; i < images.length; i++) {
        formData.append("images", images[i]);
    }

    const res = await fetch("/api/visits", {
        method: "POST",
        body: formData
    });

    const result = await res.json();

    if (!res.ok) {
        alert(result.error || "حدث خطأ");
        return;
    }
    const visit_id = result.id;

    if (visitProducts.length > 0) {
        const productsRes = await fetch("/api/sales", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ items: visitProducts, reference_type: "visit" })
        });
        console.log(visitProducts);

        if (!productsRes.ok) {
            showToast("❌ فشل البيع");
            return;
        }
    }



    openInvoiceModal({
        animal: animalSearchInput.value,
        owner: ownerInput.value,
        items: [

            {
                name: "كشف",
                quantity: 1,
                price: Number(priceInput.value),
                totalPrice: Number(priceInput.value)
            },

            ...visitProducts.map(p => {

                const product =
                    productsData.find(x => x.id == p.product_id);

                return {
                    name: product.name,
                    quantity: p.quantity,
                    price:
                        product.sale_price,
                    totalPrice: product.sale_price * p.quantity
                };
            })
        ]
    });

    form.reset();
    fileNameDisplay.textContent = 'لم يتم اختيار ملف';
    dateInput.value = new Date().toISOString().split("T")[0];

    visitProducts = [];
    renderVisitProducts();
    loadVisits();
    loadProducts(true)
    showToast(result.message);
});


/* ================= DELETE ================= */
let deleteId = null;
tableBody.addEventListener("click", e => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    deleteId = btn.dataset.id;
    confirmAction = "visit";

    document.getElementById("confirmP").textContent =
        "هل أنت متأكد من حذف هذه الزيارة؟";

    confirmModal.style.display = "flex";
});


cancelBtn.addEventListener("click", () => confirmModal.style.display = "none");

confirmModal.addEventListener("click", e => {
    if (e.target === confirmModal) {
        confirmModal.style.display = "none";

    }
});

/* ================= MODALS ================= */
document.getElementById("newAnimalBtn").onclick = () => {
    resetAnimalForm();
    animalModal.style.display = "flex";
};


document.getElementById("cancelAnimal").onclick = () => animalModal.style.display = "none";

document.getElementById("closeAnimalFile").addEventListener("click", () => animalFile.style.display = "none");
animalFile.addEventListener("click", e => { if (e.target === animalFile) animalFile.style.display = "none"; });

closeVisits.addEventListener("click", () => allVisitsModal.style.display = "none");
allVisitsModal.addEventListener("click", e => { if (e.target === allVisitsModal) allVisitsModal.style.display = "none"; });

/* ================= OPEN ANIMAL FILE ================= */
async function openAnimal(id) {
    const res = await fetch(`/api/animals/${id}`);
    const data = await res.json();
    currentAnimalId = id;
    cachedVisits = data.visits || [];
    cachedVaccinations = data.vaccinations || [];
    animalFile.style.display = "flex";
    animalInfo.innerHTML = `
     <h2>معلومات الحيوان 🐾</h2>
    <div class="animal-box">
        <div class="part">
            <p><b>الاسم</b> : ${data.animal.name}</p>
            <p><b>النوع</b> : ${data.animal.type}</p>
     
        </div>    
        <div class="part">    
            <p><b>الجنس</b> : ${data.animal.gender}</p>
            <p><b>الفصيلة</b> : ${data.animal.breed || "لا يوجد"}</p>
        </div>    
        <div class="part">
            <p><b>اللون</b> : ${data.animal.color || "لا يوجد"}</p>
            <p><b>تم التعقيم</b>  : ${data.animal.is_spayed ? "نعم" : "لا"}</p>
            
        </div>
        <div class="part">
            <p><b>الوزن</b> : ${data.animal.weight ? `${data.animal.weight} كجم` : "لا يوجد"}</p>
            <p><b>تاريخ الميلاد</b> : ${data.animal.age || "لا يوجد"}</p>
        </div>
    </div>
    <h2>معلومات المالك 👤</h2>
    <div class="owner-box">
        <div class="part"><p><b>الاسم</b> : ${data.animal.owner}</p></div>
        <div class="part"><p><b>الهاتف</b> : <a href="https://wa.me/2${data.animal.phone}" target="_blank" title="Chat on WhatsApp">${data.animal.phone}</a></p></div>
    </div>`;

    renderVisitsPreview(cachedVisits);
    renderVaccinationsPreview(cachedVaccinations);
}




/* ================= VISITS PREVIEW ================= */
function renderVisitsPreview(visits) {
    visitsList.innerHTML = "";
    if (!visits.length) return visitsList.innerHTML = "<p>لا توجد زيارات</p>";

    const lastVisits = visits.slice(0, 2);

    visitsList.innerHTML = lastVisits.map(e => `
        <div class="visit-card">
            <div>
                <div class="visit-date">📅 ${e.date}</div>
                <div class="visit-notes">${getIcon(e.type)} ${e.notes || "بدون ملاحظات"}</div>
            </div>

            ${e.images && e.images !== "null" ? `
            <div class="visit-images">
                ${e.images.split(",").map(img => `
                    <img src="app-data://uploads/${img}" class="visit-thumb" data-img="${img}">
                `).join("")}
            </div>
            ` : ""}

        </div>
    `).join('');
    if (visits.length > 2) {
        visitsList.innerHTML += `
        <div class="show-all">
            <button onclick='openAllVisits(${JSON.stringify(visits)})'>
                عرض كل الزيارات (${visits.length})
            </button>
        </div>`;
    }

    attachImageGallery(visitsList);
}


function attachImageGallery(container) {
    container.querySelectorAll(".visit-thumb").forEach((img, index) => {
        img.onclick = () => {
            const visitCard = img.closest(".visit-card");
            currentImages = Array.from(visitCard.querySelectorAll(".visit-thumb")).map(i => "app-data://uploads/" + i.dataset.img);
            currentIndex = Array.from(visitCard.querySelectorAll(".visit-thumb")).indexOf(img);

            lightboxImage.src = currentImages[currentIndex];

            if (currentImages.length <= 1) {
                prevImageBtn.style.display = "none";
                nextImageBtn.style.display = "none";
            } else {
                prevImageBtn.style.display = "block";
                nextImageBtn.style.display = "block";
            }

            imageModal.style.display = "flex";
        };
    });
}

function getIcon(type) {
    if (type === "visit") return "🩺";
    if (type === "vaccine") return "💉 تطعيم ";
    if (type === "boarding") return "🏨";
}

function openAllVisits(visits) {

    allVisitsList.innerHTML = visits.map(e => `
    <div class="visit-card" data-images='${e.images || ""}'>
        <div>
      <div class="visit-date">📅 ${e.date}</div>
      <div class="visit-notes">${getIcon(e.type)} ${e.notes || "بدون ملاحظات"}</div>
        </div>
        ${e.images && e.images !== "null" ? `
        <div class="visit-images">
            ${e.images.split(",").map(img => `
                <img src="app-data://uploads/${img}" class="visit-thumb" data-img="${img}">
            `).join("")}
        </div>` : ""}
    </div>
`).join('');

    allVisitsModal.style.display = "flex";

    attachImageGallery(allVisitsList);
}

/* ================= vaccinations PREVIEW ================= */
const pluralRules = new Intl.PluralRules("ar");

function daysLeftText(days) {
    if (days < 0) {
        const passed = Math.abs(days);

        switch (pluralRules.select(passed)) {
            case "one":
                return "فات يوم واحد";
            case "two":
                return "فات يومان";
            case "few":
                return `فات ${passed} أيام`;
            default:
                return `فات ${passed} يوم`;
        }
    }
    switch (pluralRules.select(days)) {
        case "zero":
            return "اليوم";
        case "one":
            return "متبقي يوم واحد";
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
function renderVaccinationsPreview(vaccinations) {
    const today = new Date();
    vaccinationsList.innerHTML = "";
    if (!vaccinations.length) return vaccinationsList.innerHTML = "<p>لا توجد تطعيمات</p>";
    vaccinationsList.innerHTML = vaccinations.map(v => `<div class="vaccination-card"><div class="vaccination-name">التطعيم : ${v.vaccine_name}</div><div class="vaccination-date">${daysLeftText(Math.ceil((new Date(v.next_date) - today) / (1000 * 60 * 60 * 24)))}</div></div>`).join('');
}

/* ================= ADD ANIMAL ================= */
const newAnimalName = document.getElementById("new_animal_name");
const newAnimalType = document.getElementById("new_animal_type");
const newAnimalBreed = document.getElementById("new_animal_breed");
const newAnimalGender = document.getElementById("new_animal_gender");
const newAnimalColor = document.getElementById("new_animal_color");
const newAnimalBD = document.getElementById("new_animal_bd");
const newAnimalWeight = document.getElementById("new_animal_weight");
const newOwner = document.getElementById("new_owner");
const newPhone = document.getElementById("new_phone");
const animalForm = document.getElementById("animalForm");

function resetAnimalForm() {
    animalForm.reset();

    document
        .querySelectorAll('input[name="is_spayed"]')
        .forEach(r => r.checked = false);

}


animalForm.addEventListener("submit", async e => {
    e.preventDefault();

    const isSpayed = document.querySelector('input[name="is_spayed"]:checked')?.value;

    const data = {
        name: newAnimalName.value,
        type: newAnimalType.value,
        breed: newAnimalBreed.value,
        gender: newAnimalGender.value,
        color: newAnimalColor.value,
        age: newAnimalBD.value,
        weight: newAnimalWeight.value,
        is_spayed: isSpayed === "true",
        owner: newOwner.value,
        phone: newPhone.value
    };


    const res = await fetch("/api/animals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    if (!res.ok) return alert(result.error || "حدث خطأ");

    animalModal.style.display = "none";

    showToast("تم إضافة الحيوان");


    await loadAnimals();


    animalSelect.value = result.id;
    animalSearchInput.value = newAnimalName.value;

    await fillAnimalData(result.id);


    loadVisits();

});


confirmBtn.addEventListener("click", async () => {
    if (confirmAction === "visit") {
        await fetch(`/api/visits/${deleteId}`, { method: "DELETE" });
        loadVisits();
        showToast("تم حذف الزيارة بنجاح");
    }

    confirmModal.style.display = "none";
    confirmAction = null;
});

/* ================= SEARCH VISITS ================= */
searchInput.addEventListener("input", () => {
    currentSearch = searchInput.value;
    currentPage = 1;
    loadVisits();
});

document.getElementById("dateFrom")
    .addEventListener("change", function () {
        dateFrom = this.value;
        currentPage = 1;
        loadVisits();
    });

document.getElementById("dateTo")
    .addEventListener("change", function () {
        dateTo = this.value;
        currentPage = 1;
        loadVisits();
    });

function clearArchiveFilters() {

    currentSearch = "";
    dateFrom = "";
    dateTo = "";
    currentPage = 1;

    document.getElementById("searchInput").value = "";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";

    loadVisits();
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

    document.getElementById("invoiceAnimal")
        .textContent = invoice.animal;

    document.getElementById("invoiceOwner")
        .textContent = invoice.owner;

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
                <td>${i.totalPrice}</td>
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
function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 5000);
}
