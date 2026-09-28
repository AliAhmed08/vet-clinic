const API = "http://localhost:3000/api/boardings";

let currentPage = 1;
let currentSearch = "";
let dateFrom = "";
let dateTo = "";

async function loadArchive() {

    const query = new URLSearchParams({
        page: currentPage,
        search: currentSearch,
        dateFrom: dateFrom,
        dateTo: dateTo
    });

    const res = await fetch(`${API}/archive?${query.toString()}`);
    const result = await res.json();

    renderArchive(result.data);
    renderPagination(result.page, result.totalPages);
}

function renderArchive(data) {
    const tbody = document.getElementById("archiveTable");

    tbody.innerHTML = data.length
        ? data.map(row => `
            <tr>
                <td>${row.name}</td>
                <td>${row.type}</td>
                <td>${row.room_number}</td>
                <td>${row.start_date}</td>
                <td>${row.end_date}</td>
                <td>${row.total_days}</td>
                <td>${row.total_cost} جنيه</td>
                <td><button class="btn-primary" onclick="openBoarding(${row.id})">بيانات الاستضافة</button></td>
            </tr>
        `).join('')
        : `<tr><td colspan="8">لا توجد نتائج</td></tr>`;
}

const pagination = document.getElementById("pagination");

function renderPagination(page, totalPages) {
    pagination.innerHTML = "";

    if (totalPages <= 1) return;

    if (page > 1)
        pagination.innerHTML += `<button onclick="changePage(${page - 1})">❮</button>`;

    pagination.innerHTML += `<span>${page} / ${totalPages}</span>`;

    if (page < totalPages)
        pagination.innerHTML += `<button onclick="changePage(${page + 1})">❯</button>`;
}

function changePage(p) {
    currentPage = p;
    loadArchive();
}

document.getElementById("searchInput")
    .addEventListener("input", function () {
        currentSearch = this.value;
        currentPage = 1;
        loadArchive();
    });

document.getElementById("dateFrom")
    .addEventListener("change", function () {
        dateFrom = this.value;
        currentPage = 1;
        loadArchive();
    });

document.getElementById("dateTo")
    .addEventListener("change", function () {
        dateTo = this.value;
        currentPage = 1;
        loadArchive();
    });

function clearArchiveFilters() {

    currentSearch = "";
    dateFrom = "";
    dateTo = "";
    currentPage = 1;

    document.getElementById("searchInput").value = "";
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";

    loadArchive();
}

let currentBoardingId = null
async function loadNotes() {
    const res = await fetch(`${API}/${currentBoardingId}/notes`);
    const notes = await res.json();
    console.log(currentBoardingId)
    console.log(notes)
    const container = document.getElementById("notesContainer");
    container.innerHTML = "";

    if (notes.length === 0) {
        const div = document.createElement("div");
        div.innerHTML = "- لا توجد ملاحظات يومية";
        container.appendChild(div);
    } else {
        notes.forEach(note => {
            const div = document.createElement("div");
            div.innerHTML = `
      <strong>${note.note_date}</strong>
      <p>${note.note_text}</p>
      <hr/>
    `;
            container.appendChild(div);
        });
    }
}
async function openBoarding(id) {
    currentBoardingId = id;
    console.log(currentBoardingId)

    const res = await fetch(`${API}/${currentBoardingId}`);
    const data = await res.json();

    document.getElementById("boardingDetails").innerHTML = `
     <h2>معلومات الحيوان 🐾</h2>
    <div class="animal-box">
        <div class="part">
            <p><b>الاسم</b> : ${data.name}</p>
            <p><b>النوع</b> : ${data.type}</p>
     
        </div>    
        <div class="part">    
            <p><b>الجنس</b> : ${data.gender}</p>
            <p><b>الفصيلة</b> : ${data.breed || "لا يوجد"}</p>
        </div>    
        <div class="part">
            <p><b>اللون</b> : ${data.color || "لا يوجد"}</p>
            <p><b>تم التعقيم</b>  : ${data.is_spayed ? "نعم" : "لا"}</p>
            
        </div>
        <div class="part">
            <p><b>الوزن</b> : ${data.weight ? `${data.weight} كجم` : "لا يوجد"}</p>
            <p><b>تاريخ الميلاد</b> : ${data.age || "لا يوجد"}</p>
        </div>
    </div>
    <h2>معلومات المالك 👤</h2>
    <div class="owner-box">
        <div class="part"><p><b>الاسم</b> : ${data.owner}</p></div>
        <div class="part"><p><b>الهاتف</b> : <a href="https://wa.me/2${data.phone}" target="_blank" title="Chat on WhatsApp">${data.phone}</a></p></div>
    </div>`;

    await loadNotes();

    document.getElementById("modal").style.display = "flex";
}

const modal = document.getElementById("modal")
document.getElementById("close").addEventListener("click", () => {
    modal.style.display = "none";
});

modal.addEventListener("click", e => {
    if (e.target === modal) {
        modal.style.display = "none";

    }
});

loadArchive();