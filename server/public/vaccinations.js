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

function getStatus(nextDate) {
    const today = new Date();
    const target = new Date(nextDate);

    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays > 2) {
        return { text: daysLeftText(diffDays), class: "status-ok", days: diffDays };
    } else if (diffDays > 0) {
        return { text: daysLeftText(diffDays), class: "status-soon", days: diffDays };
    } else if (diffDays === 0) {
        return { text: daysLeftText(diffDays), class: "status-today", days: diffDays };
    } else {
        return { text: daysLeftText(diffDays), class: "status-late", days: diffDays };
    }
}

function calculateNextDate(lastDate, repeatDays) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + Number(repeatDays));
    return d.toISOString().split("T")[0];
}

const form = document.getElementById("vaccinationForm");
const table = document.getElementById("vaccinationsTable");

const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");


const animalFile = document.getElementById("animalFile");
const animalInfo = document.getElementById("animalInfo");
const visitsList = document.getElementById("visitsList");
const vaccinationsList = document.getElementById("vaccinationsList");

const allVisitsModal = document.getElementById("allVisitsModal");
const allVisitsList = document.getElementById("allVisitsList");
const closeVisits = document.getElementById("closeVisits");

const animalModal = document.getElementById("animalModal");

document.getElementById("last_date").value = new Date().toISOString().split("T")[0];

let currentPage = 1;
let currentAnimalId = null;
let cachedVisits = [];
let cachedVaccinations = [];
let isEditMode = false;
let editingAnimalId = null;
let confirmAction = null;
let selectedVaccineProduct = null;
let currentProductsPage = 1;
let isLoading = false;
let hasMore = true;
let currentProductSearch = "";


async function loadNotifications() {
    const res = await fetch("/api/vaccinations/reminders");
    const data = await res.json();

    const badge = document.getElementById("notificationCount");

    if (data.length > 0) {
        const res = await fetch("/api/vaccinations/reminders/count")
        const count = await res.json();

        badge.textContent = count.count
        document.getElementById("notificationBtn").classList.remove("hidden");
    } else {
        document.getElementById("notificationBtn").classList.add("hidden");
    }
}

// ================= LOAD =================
async function loadVaccinations(search = "") {
    const res = await fetch(`/api/vaccinations?page=${currentPage}&search=${encodeURIComponent(search)}`);
    const result = await res.json();
    renderTable(result.data);
    renderPagination(result.page, result.totalPages);
}


function renderTable(list) {
    const tableBody = document.getElementById("vaccination_table_body"); // تأكد من استخدام الـ ID الصحيح للـ tbody

    table.innerHTML = list.length
        ? list.map(v => {
            const status = getStatus(v.next_date);

            let animalIcon = "🐾";
            if (v.type === "قطة") animalIcon = "🐱";
            if (v.type === "كلب") animalIcon = "🐶";
            if (v.type === "أرنب" || v.type === "ارنب") animalIcon = "🐇";
            if (v.type === "طائر") animalIcon = "🐤";


            const lastDateFormatted = v.last_date || "---";

            return `
                <tr class="vaccine-row">
                    <td class="animal-cell animal-link" data-id="${v.animal_id}" title="فتح ملف الحيوان">
                        <span class="animal-type-icon">${animalIcon}</span>
                        <span class="animal-name-text">${v.animal}</span>                        
                    </td>
                    
                    <td class="vaccine-name-cell">${v.vaccine_name}</td>
                    
                    <td class="last-date-cell">${lastDateFormatted}</td>
                    
                    <td class="next-date-cell ${status.class}-text">
                        <span>${v.next_date}</span>
                    </td>
                    
                    <td class="${status.class}">${status.text}</td>
                    
                    <td class="actions-cell">
                        <button 
                            class="done-btn"
                            data-id="${v.id}"
                            data-repeat="${v.repeat_days}"
                            data-animal="${v.animal_id}"
                            data-animalname="${v.animal}"
                            data-owner="${v.owner}"
                            data-product="${v.product_id}"
                            title="تم التطعيم">
                            ✓
                        </button>
                        <button class="delete-btn" id="delete-vaccination" data-id="${v.id}" title="حذف">
                            <img src="./images/delete.png" style="width: 25px; height: 25px;">
                        </button>
                    </td>
                </tr>
            `;
        }).join('')
        : `<tr><td colspan="6" class="no-data">لا توجد نتائج</td></tr>`;

    document.querySelectorAll(".animal-link").forEach(link => {
        link.addEventListener("click", () => openAnimal(link.dataset.id));
    });
}

table.addEventListener("click", e => {
    const cell = e.target.closest(".animal-link");
    if (!cell) return;

    const id = cell.dataset.id;
    openAnimal(id);
});


/* ================= PAGINATION ================= */
function renderPagination(page, totalPages) {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    if (page > 1) {
        pagination.innerHTML += `<button data-page="${page - 1}">❮</button>`;
    }

    pagination.innerHTML += `<span>${page} / ${totalPages}</span>`;

    if (page < totalPages) {
        pagination.innerHTML += `<button data-page="${page + 1}">❯</button>`;
    }

    pagination.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            currentPage = Number(btn.dataset.page);
            loadVaccinations();
        });
    });
}

function openVaccineProductModal() {
    loadProductsForVaccines();
    document.getElementById("vaccineProductModal").style.display = "flex";
}

function closeVaccineProductModal() {
    document.getElementById("vaccineProductModal").style.display = "none";
}

const modalBody = document.querySelector("#vaccineProductModal .modal-content");

modalBody.addEventListener("scroll", () => {

    if (
        modalBody.scrollTop +
        modalBody.clientHeight >=
        modalBody.scrollHeight - 200
    ) {
        loadProductsForVaccines();
    }

});

let productsData = [];

// ================= Load Products =================

async function loadProductsForVaccines(reset = false) {

    if (reset) {
        currentProductPage = 1;
        hasMore = true;
        productsData = [];
    }

    if (isLoading || !hasMore) return;

    isLoading = true;

    try {

        const res = await fetch(
            `/api/inventory/products?page=${currentProductPage}&limit=30&category=vaccine&search=${encodeURIComponent(currentProductSearch)}`
        );

        const result = await res.json();

        if (reset) {
            productsData = result.data;
        } else {
            productsData.push(...result.data);
        }

        hasMore = result.hasMore;
        currentProductPage++;

        renderVaccineProducts();

    } finally {
        isLoading = false;
    }
}

function renderVaccineProducts() {
    const grid = document.getElementById("vaccineProductsGrid");

    grid.innerHTML = productsData
        .map(p => {
            const outOfStockClass = p.total_stock === 0 ? " out" : "";

            return `
                <div class="product-card${outOfStockClass}">

                    <img src="${p.image_url
                    ? `app-data://inventory/${p.image_url}`
                    : "./images/default-vaccine.png"}" />

                    <h4>${p.name}</h4>

                    <p>${p.sale_price} جنيه 💲</p>
                    <p>${p.total_stock} 📦</p>

                    <button 
                        onclick="selectVaccineProduct(${p.id})"
                        ${p.total_stock === 0 ? "disabled" : ""}>
                    إختيار
                    </button>

                </div>
            `;
        }).join("");
}

document.getElementById("vaccineProductSearch")
    .addEventListener("input", (e) => {
        currentProductSearch = e.target.value;

        loadProductsForVaccines(true);
    });

function selectVaccineProduct(id) {
    const product = productsData.find(p => p.id == id);

    if (!product || product.total_stock <= 0) {
        return;
    }

    selectedVaccineProduct = product;

    document.getElementById("selectedVaccineName").innerText =
        product.name;

    closeVaccineProductModal();
}

const vaccineModal = document.getElementById("vaccineModal");
const confirmVaccine = document.getElementById("confirmVaccine");
const cancelVaccine = document.getElementById("cancelVaccine");

let vaccineId = null;
let animalId = null;
let productId = null;
let animalName = null;
let owner = null;

table.addEventListener("click", async (e) => {
    const btn = e.target.closest(".done-btn");
    if (!btn) return;

    vaccineId = btn.dataset.id;
    animalId = btn.dataset.animal;
    productId = btn.dataset.product;
    animalName = btn.dataset.animalname;
    owner = btn.dataset.owner;

    selectVaccineProduct(productId)

    if (!selectedVaccineProduct) {
        showToast(" التطعيم غير متوفر", "red");
        return;
    }
    document.getElementById("new_repeat_days").value = btn.dataset.repeat;

    vaccineModal.style.display = "flex";
});

confirmVaccine.addEventListener("click", async () => {
    const repeatDays = document.getElementById("new_repeat_days").value;
    const today = new Date().toISOString().split("T")[0];
    const nextDate = calculateNextDate(today, repeatDays);

    if (!selectedVaccineProduct) {
        showToast(" المنتج غير متوفر", "red");
        return;
    }

    const res = await fetch(`/api/vaccinations/${vaccineId}/done`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            animal_id: animalId,
            product_id: selectedVaccineProduct.id,
            sale_price: selectedVaccineProduct.sale_price,
            last_date: today,
            next_date: nextDate,
            repeat_days: repeatDays
        }),
    });

    if (!res.ok) {
        showToast("حصل خطأ", "red");
        return;
    }

    openInvoiceModal({
        animal: animalName,
        owner: owner,
        items: [
            {
                name: selectedVaccineProduct.name,
                quantity: 1,
                price: Number(selectedVaccineProduct.sale_price)
            }]
    });

    selectedVaccineProduct = null;
    document.getElementById("selectedVaccineName").innerText =
        "لم يتم اختيار تطعيم";
    vaccineModal.style.display = "none";
    loadVaccinations();
    loadProductsForVaccines(true)
});

cancelVaccine.addEventListener("click", () => vaccineModal.style.display = "none");



const animalSelect = document.getElementById("animal_id");
const animalSearchInput = document.getElementById("animalSearchInput");
const animalSearchResults = document.getElementById("animalSearchResults");


form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!animalSelect.value) {
        showToast("اختر الحيوان أولاً", "red");
        return;
    }

    const lastDate = document.getElementById("last_date").value;
    const repeatDays = document.getElementById("repeat_days").value;

    const data = {
        animal_id: Number(animalSelect.value),
        product_id: selectedVaccineProduct.id,
        sale_price: selectedVaccineProduct.sale_price,
        repeat_days: repeatDays,
        last_date: lastDate,
        next_date: calculateNextDate(lastDate, repeatDays),
    };

    const res = await fetch("/api/vaccinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        showToast("حصل خطأ", "red");
        return;
    }

    openInvoiceModal({
        animal: animalSearchInput.value,
        owner: ownerInput.value,
        items: [
            {
                name: selectedVaccineProduct.name,
                quantity: 1,
                price: Number(selectedVaccineProduct.sale_price)
            }]
    });

    form.reset();

    document.getElementById("last_date").value = new Date().toISOString().split("T")[0];

    selectedVaccineProduct = null;
    document.getElementById("selectedVaccineName").innerText =
        "لم يتم اختيار تطعيم";

    loadVaccinations();
    loadProductsForVaccines(true)

    if (typeof openAnimal === "function" && currentAnimalId) {
        await openAnimal(currentAnimalId);
    }

    showToast("تم إضافة التطعيم بنجاح");
});


searchInput.addEventListener("input", () => {
    currentPage = 1;
    loadVaccinations(searchInput.value);
});

/* ================= DELETE ================= */
const confirmModal = document.getElementById("confirmModal");
const confirmBtn = document.getElementById("confirmDelete");
const cancelBtn = document.getElementById("cancelDelete");
let deleteId = null;
document.querySelector("#vaccinationsTable").addEventListener("click", e => {
    const btn = e.target.closest("#delete-vaccination");
    if (!btn) return;
    deleteId = btn.dataset.id;
    document.getElementById("confirmP").textContent = "هل أنت متأكد من حذف التطعيم؟  "
    confirmModal.style.display = "flex";
});

confirmBtn.addEventListener("click", async () => {
    await fetch(`/api/vaccinations/${deleteId}`, { method: "DELETE" });
    confirmModal.style.display = "none";
    loadVaccinations();
    showToast("تم حذف التطعيم بنجاح");
});

cancelBtn.addEventListener("click", () => confirmModal.style.display = "none");

confirmModal.addEventListener("click", e => {
    if (e.target === confirmModal) {
        confirmModal.style.display = "none";
    }
});

const typeInput = document.getElementById("type");
const ownerInput = document.getElementById("owner");
const phoneInput = document.getElementById("phone");
const dateInput = document.getElementById("date");
const notesInput = document.getElementById("notes");

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

async function fillAnimalData(id) {
    const res = await fetch(`/api/animals/${id}`);
    const data = await res.json();
    const a = data.animal;

    animalSelect.value = id;
    typeInput.value = a.type;
    ownerInput.value = a.owner;
    phoneInput.value = a.phone;
}

/* ================= MODALS ================= */
// document.getElementById("addAnimalBtn").onclick = () => {
//     resetAnimalForm();
//     animalModal.style.display = "flex";
// };


document.getElementById("cancelAnimal").onclick = () => animalModal.style.display = "none";
animalModal.addEventListener("click", e => { if (e.target === animalModal) animalModal.style.display = "none"; });

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
const imageModal = document.getElementById("imageModal");
const lightboxImage = document.getElementById("lightboxImage");
const prevImageBtn = document.getElementById("prevImage");
const nextImageBtn = document.getElementById("nextImage");

let currentImages = [];
let currentIndex = 0;


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
                    <img src="uploads/${img}" class="visit-thumb" data-img="${img}">
                `).join("")}
            </div>
            ` : ""}

        </div>
    `).join('');
    if (visits.length > 2) {
        visitsList.innerHTML += `
        <div class="show-all">
            <button id="allVisitsBtn" data-visits="${JSON.stringify(visits)}">
                عرض كل الزيارات (${visits.length})
            </button>
        </div>`;
    }

    attachImageGallery(visitsList);
}

visitsList.addEventListener("click", e => {
    const btn = e.target.closest("#allVisitsBtn");
    if (!btn) return;

    if (cachedVisits) {
        openAllVisits(cachedVisits);
    }
});

function attachImageGallery(container) {
    container.querySelectorAll(".visit-thumb").forEach((img, index) => {
        img.onclick = () => {
            const visitCard = img.closest(".visit-card");
            currentImages = Array.from(visitCard.querySelectorAll(".visit-thumb")).map(i => "uploads/" + i.dataset.img);
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
                <img src="uploads/${img}" class="visit-thumb" data-img="${img}">
            `).join("")}
        </div>` : ""}
    </div>
`).join('');

    allVisitsModal.style.display = "flex";

    attachImageGallery(allVisitsList);
}

/* ================= vaccinations PREVIEW ================= */

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
const newOwner = document.getElementById("new_owner");
const newPhone = document.getElementById("new_phone");
const animalForm = document.getElementById("animalForm");

function resetAnimalForm() {
    animalForm.reset();

    document
        .querySelectorAll('input[name="is_spayed"]')
        .forEach(r => r.checked = false);

    isEditMode = false;
    editingAnimalId = null;

    // document.querySelector("#animalModal h3").textContent = "إضافة حيوان جديد";
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
        is_spayed: isSpayed === "true",
        owner: newOwner.value,
        phone: newPhone.value
    };

    const url = isEditMode
        ? `/api/animals/${editingAnimalId}`
        : `/api/animals`;

    const method = isEditMode ? "PUT" : "POST";

    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const result = await res.json();
    if (!res.ok) return showToast(result.error || "حدث خطأ", "red");

    animalModal.style.display = "none";

    if (isEditMode) {
        await openAnimal(editingAnimalId);
        showToast("تم تعديل البيانات");
    } else {
        showToast("تم إضافة الحيوان");
    }

    await loadAnimals();

    if (!isEditMode) {
        animalSelect.value = result.id;
        animalSearchInput.value = newAnimalName.value;

        await fillAnimalData(result.id);
    }

    isEditMode = false;
    editingAnimalId = null;

    loadVaccinations();

});

// deleteBtn.addEventListener("click", () => {
//     confirmAction = "animal";

//     document.getElementById("confirmP").textContent =
//         "هل أنت متأكد أنك تريد حذف ملف الحيوان؟";

//     confirmModal.style.display = "flex";
// });


confirmBtn.addEventListener("click", async () => {
    if (confirmAction === "visit") {
        await fetch(`/api/visits/${deleteId}`, { method: "DELETE" });
        loadVaccinations();
        showToast("تم حذف الزيارة بنجاح");
    }

    if (confirmAction === "animal") {
        await fetch(`/api/animals/${currentAnimalId}`, { method: "DELETE" });
        animalFile.style.display = "none";
        loadAnimals();
        loadVaccinations();
        showToast("تم حذف الحيوان بنجاح");
    }

    confirmModal.style.display = "none";
    confirmAction = null;
});


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
            </tr>

        `).join("");

    const total =
        invoice.items.reduce((s, i) => s + i.price, 0);

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
const toast = document.getElementById("toast");
function showToast(msg, color = "#4caf50") {
    toast.textContent = msg;
    toast.style.display = "block";
    toast.style.backgroundColor = color;
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

loadAnimals()
loadVaccinations();
loadProductsForVaccines(true)
loadNotifications()