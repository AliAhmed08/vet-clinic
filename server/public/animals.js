/* ================= ELEMENTS ================= */
const tableBody = document.querySelector("#animalsTable tbody");
const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");

const animalFile = document.getElementById("animalFile");
const animalName = document.getElementById("animalName");
const animalInfo = document.getElementById("animalInfo");
const visitsList = document.getElementById("visitsList");
const vaccinationsList = document.getElementById("vaccinationsList");
const deleteBtn = document.getElementById("delete-animal");

const allVisitsModal = document.getElementById("allVisitsModal");
const allVisitsList = document.getElementById("allVisitsList");
const closeVisits = document.getElementById("closeVisits");

const confirmModal = document.getElementById("confirmModal");
const confirmBtn = document.getElementById("confirmDelete");
const cancelBtn = document.getElementById("cancelDelete");

const toast = document.getElementById("toast");

/* ================= ADD / EDIT ELEMENTS ================= */
const animalModal = document.getElementById("animalModal");
const animalForm = document.getElementById("animalForm");
const addAnimalBtn = document.getElementById("addAnimalBtn");
const cancelAnimal = document.getElementById("cancelAnimal");

const newAnimalName = document.getElementById("new_animal_name");
const newAnimalType = document.getElementById("new_animal_type");
const newAnimalBreed = document.getElementById("new_animal_breed");
const newAnimalColor = document.getElementById("new_animal_color");
const newAnimalGender = document.getElementById("new_animal_gender");
const newAnimalBD = document.getElementById("new_animal_bd");
const newAnimalWeight = document.getElementById("new_animal_weight");
const newOwner = document.getElementById("new_owner");
const newPhone = document.getElementById("new_phone");

/* ================= STATE ================= */
let currentPage = 1;
let currentSearch = "";
let cachedVisits = [];
let currentAnimalId = null;
let currentAnimalData = null;
let isEditMode = false;
let editingAnimalId = null;


/* ================= LOAD ANIMALS ================= */
async function loadAnimals() {
    const res = await fetch(
        `/api/animals?page=${currentPage}&search=${encodeURIComponent(currentSearch)}`
    );
    const result = await res.json();

    if (!Array.isArray(result.data)) return;

    renderAnimals(result.data);
    renderPagination(result.page, result.totalPages);
}

/* ================= RENDER TABLE ================= */
function renderAnimals(animals) {
    const gridContainer = document.getElementById("animalsGrid");

    gridContainer.innerHTML = animals.length
        ? animals.map(a => {
            let icon = "🐾";
            if (a.type === "قطة") icon = "🐱";
            if (a.type === "كلب") icon = "🐶";
            if (a.type === "أرنب" || a.type === "ارنب") icon = "🐇";
            if (a.type === "طائر") icon = "🐤";

            const metaInfo = [a.breed, a.gender].filter(Boolean).join(" • ");

            return `
                <div class="animal-card">
                    <!-- الهيدر: الأيقونة على اليسار والاسم على اليمين -->
                    <div class="card-header">
                    <div class="animal-icon">${icon}</div>
                        <div class="animal-info">
                            <h3 class="animal-name">${a.name}</h3>
                            <span class="animal-meta">${metaInfo || "بدون بيانات"}</span>
                        </div>
                        
                    </div>
                    
                    <!-- البودي: المالك وجنبه الهاتف، والأيقونة على اليسار -->
                    <div class="card-body">
                        <div class="owner-info">
                        <span class="owner-icon">👤</span>
                            <div class="owner-text">
                                <span class="owner-name">${a.owner}</span>
                                <span class="divider">▪</span>
                                <span class="owner-phone">${a.phone}</span>
                            </div>                              
                        </div>
                    </div>
                    
                    <div class="card-footer">
                        <button class="animalFile btn-file" data-id="${a.id}">
                            ملف الحيوان
                        </button>
                    </div>
                </div>
            `;
        }).join("")
        : `<div class="no-results">لا توجد نتائج</div>`;

    document.querySelectorAll(".animalFile").forEach(btn => {
        btn.addEventListener("click", () => {
            openAnimal(btn.dataset.id);
        });
    });
}

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
            loadAnimals();
        });
    });
}

/* ================= OPEN ANIMAL FILE ================= */
async function openAnimal(id) {
    const res = await fetch(`/api/animals/${id}`);
    const data = await res.json();

    currentAnimalId = id;
    currentAnimalData = data.animal;
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
        <div class="part"><p><b>الهاتف</b> : ${data.animal.phone}</p></div
    </div>`;

    document.getElementById("whatsapp").setAttribute(
        "href",
        `https://wa.me/2${data.animal.phone}`
    );

    document.getElementById("whatsapp").setAttribute("target", "_blank");

    renderVisitsPreview(cachedVisits);
    renderVaccinationsPreview(cachedVaccinations);
    deleteBtn.dataset.id = id;
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
            return "لا يوجد أيام متبقية";
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

function resetAnimalForm() {
    animalForm.reset();

    document
        .querySelectorAll('input[name="is_spayed"]')
        .forEach(r => r.checked = false);

    isEditMode = false;
    editingAnimalId = null;
}

function fillAnimalForm(animal) {
    newAnimalName.value = animal.name;
    newAnimalType.value = animal.type;
    newAnimalBreed.value = animal.breed;
    newAnimalGender.value = animal.gender;
    newAnimalColor.value = animal.color;
    newAnimalBD.value = animal.age;
    newAnimalWeight.value = animal.weight;
    newOwner.value = animal.owner;
    newPhone.value = animal.phone;

    document.querySelector(
        `input[name="is_spayed"][value="${animal.is_spayed ? "true" : "false"}"]`
    ).checked = true;
}
addAnimalBtn.addEventListener("click", () => {
    resetAnimalForm();
    animalModal.style.display = "flex";
});

document.getElementById("editAnimalBtn").onclick = () => {
    if (!currentAnimalData) return;

    isEditMode = true;
    editingAnimalId = currentAnimalId;

    fillAnimalForm(currentAnimalData);

    // animalModal.querySelector("h3").textContent = "تعديل بيانات الحيوان";
    animalModal.style.display = "flex";
};

animalForm.addEventListener("submit", async e => {
    e.preventDefault();

    if (!animalForm.checkValidity()) {
        animalForm.reportValidity();
        return;
    }

    const isSpayed = document.querySelector('input[name="is_spayed"]:checked').value;

    const data = {
        name: newAnimalName.value.trim(),
        type: newAnimalType.value,
        breed: newAnimalBreed.value.trim(),
        gender: newAnimalGender.value,
        color: newAnimalColor.value,
        age: newAnimalBD.value,
        weight: newAnimalWeight.value,
        is_spayed: isSpayed === "true",
        owner: newOwner.value.trim(),
        phone: newPhone.value.trim()
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
    if (!res.ok) {
        showToast(result.error || "حدث خطأ");
        return;
    }

    animalModal.style.display = "none";
    showToast(isEditMode ? "تم تعديل البيانات بنجاح" : "تم إضافة الحيوان بنجاح");

    const editedId = editingAnimalId;

    resetAnimalForm();
    loadAnimals();

    if (method === "PUT") {
        openAnimal(editedId);
    }

});

cancelAnimal.addEventListener("click", () => {
    animalModal.style.display = "none";
    resetAnimalForm();
});

// animalModal.addEventListener("click", e => {
//     if (e.target === animalModal) {
//         animalModal.style.display = "none";
//         resetAnimalForm();
//     }
// });


/* ================= CLOSE MODALS ================= */
closeVisits.addEventListener("click", () => {
    allVisitsModal.style.display = "none";
});

allVisitsModal.addEventListener("click", (e) => {
    if (e.target === allVisitsModal) {
        allVisitsModal.style.display = "none";
    }
});

document.getElementById("closeAnimalFile").addEventListener("click", () => {
    animalFile.style.display = "none";
});

animalFile.addEventListener("click", (e) => {
    if (e.target === animalFile) {
        animalFile.style.display = "none";
    }
});

/* ================= SEARCH ================= */
let searchTimer;
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentSearch = searchInput.value.trim();
        currentPage = 1;
        loadAnimals();
    }, 200);
});

/* ================= DELETE ================= */
deleteBtn.addEventListener("click", () => {
    confirmModal.style.display = "flex";
});

confirmBtn.addEventListener("click", async () => {
    await fetch(`/api/animals/${currentAnimalId}`, { method: "DELETE" });

    confirmModal.style.display = "none";
    animalFile.style.display = "none";

    showToast("تم الحذف بنجاح");
    loadAnimals();
});

cancelBtn.addEventListener("click", () => {
    confirmModal.style.display = "none";
});

/* ================= TOAST ================= */
function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

/* ================= INIT ================= */
loadAnimals();