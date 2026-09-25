const API = "http://localhost:3000/api/boardings";

let currentBoardingId = null;
const addRoomModal = document.getElementById("addRoomModal")

async function loadRooms() {
    const res = await fetch(`${API}/rooms-status`);
    const rooms = await res.json();

    const container = document.getElementById("roomsContainer");
    container.innerHTML = "";

    rooms.forEach(room => {
        const card = document.createElement("div");
        card.classList.add("boardingCard", room.status);

        card.innerHTML = `
      <h2>غرفة ${room.room_number}</h2>
      <p><b>الحالة:</b> ${room.status === "empty" ? "متاحة" : "مشغولة"}</p>
      ${room.status === "occupied"
                ? `
          <p><b>الحيوان: </b> ${room.animal_name} ( ${room.type} )</p>
          <p><b>عدد الأيام : </b> ${room.days_count}</p>
          <p><b>التكلفة : </b> ${room.days_count * room.daily_price}</p>
          <p><b>بدأت : </b> ${room.start_date}</p>
        `
                : ""
            }
    `;

        if (room.status === "occupied") {
            card.addEventListener("click", () => openBoarding(room.boarding_id));
        }

        container.appendChild(card);
    });
    // Add-room card
    const addCard = document.createElement("div");
    addCard.classList.add("boardingCard", "add-room");
    addCard.innerHTML = "➕ إضافة غرفة";
    addCard.addEventListener("click", () => {
        addRoomModal.style.display = "flex";
    });
    container.appendChild(addCard);
}




document.getElementById("cancelAddRoom").addEventListener("click", () => {
    document.getElementById("roomNumberInput").value = ""
    addRoomModal.style.display = "none";
});

addRoomModal.addEventListener("click", e => {
    if (e.target === addRoomModal) {
        document.getElementById("roomNumberInput").value = ""
        addRoomModal.style.display = "none";
    }
});


async function addRoom(e) {
    if (e) e.preventDefault();

    const roomInput = document.getElementById("roomNumberInput");
    const errorP = document.getElementById("addRoomP");
    const roomNumber = roomInput.value.trim();

    if (!roomNumber) {
        errorP.innerText = "ادخل رقم الغرفة";
        return
    };

    errorP.innerText = "";

    const res = await fetch(`${API}/add-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_number: roomNumber })
    });

    if (!res.ok) {
        const err = await res.json();
        errorP.innerText = err.message;
        return;
    }

    roomInput.value = "";
    loadRooms();
    loadEmptyRooms()

    addRoomModal.style.display = "none";
}

async function loadEmptyRooms() {
    const res = await fetch(`${API}/rooms-status`);
    const rooms = await res.json();

    const roomSelect = document.getElementById("room_id");

    const emptyRooms = rooms.filter(r => r.status === "empty");

    roomSelect.innerHTML =
        `<option value="">اختر الغرفة</option>` +
        emptyRooms.map(r =>
            `<option value="${r.room_id}">غرفة ${r.room_number}</option>`
        ).join("");
}

async function loadBoardingAnimals() {
    const res = await fetch("/api/animals?all=true");
    const result = await res.json();
    const animals = result.data;

    const select = document.getElementById("boarding_animal_id");

    select.innerHTML =
        animals.map(a =>
            `<option value="${a.id}" data-phone="${a.phone}">${a.name} - ${a.owner} - ${a.phone}</option>`
        ).join("");
}

const animalInput = document.getElementById("boardingAnimalSearchInput");
const animalResults = document.getElementById("boardingAnimalResults");
const animalSelect = document.getElementById("boarding_animal_id");

animalInput.addEventListener("input", () => {
    const query = animalInput.value.toLowerCase();
    const options = Array.from(animalSelect.options);

    animalResults.innerHTML = options
        .filter(o =>
            o.text.toLowerCase().includes(query) ||
            (o.dataset.phone && o.dataset.phone.includes(query))
        )
        .map(o => `<li data-id="${o.value}">${o.text}</li>`)
        .join("");

    animalResults.style.display = query ? "block" : "none";

    animalResults.querySelectorAll("li").forEach(li => {
        li.addEventListener("click", () => {
            animalSelect.value = li.dataset.id;
            animalInput.value = li.textContent.split(' -')[0];
            animalResults.style.display = "none";
        });
    });
});

document.addEventListener("click", e => {
    if (!e.target.closest(".searchable-select-wrapper"))
        animalResults.style.display = "none";
});

const start_date = document.getElementById("start_date")
start_date.value = new Date().toISOString().split("T")[0];
document.getElementById("boardingForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const animal_id = document.getElementById("boarding_animal_id").value;
    const room_id = document.getElementById("room_id").value;
    const daily_price = document.getElementById("daily_price").value;

    if (!animal_id || !room_id || !start_date.value || !daily_price) {
        return alert("أكمل البيانات");
    }

    const res = await fetch(`${API}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            animal_id,
            room_id,
            start_date: start_date.value,
            daily_price
        })
    });

    if (!res.ok) {
        const err = await res.json();
        return alert(err.message || "حصل خطأ");
    }

    e.target.reset();
    start_date.value = new Date().toISOString().split("T")[0];
    loadEmptyRooms();
    loadRooms();
});

async function openBoarding(id) {
    currentBoardingId = id;

    const res = await fetch(`${API}/${id}`);
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
            <p> --------- </p>
            <p><b>تاريخ الميلاد</b> : ${data.age || "لا يوجد"}</p>
        </div>
    </div>
    <h2>معلومات المالك 👤</h2>
    <div class="owner-box">
        <div class="part"><p><b>الاسم</b> : ${data.owner}</p></div>
        <div class="part"><p><b>الهاتف</b> : <a href="https://wa.me/2${data.phone}" target="_blank" title="Chat on WhatsApp">${data.phone}</a></p></div>
    </div>`;

    await loadNotes();

    document.getElementById("boardingModal").style.display = "flex";
}

const boardingModal = document.getElementById("boardingModal")
document.getElementById("close").addEventListener("click", () => {
    boardingModal.style.display = "none";
});


const priceModal = document.getElementById("priceModal")

const confirmModal = document.getElementById("confirmModal");
const confirmBtn = document.getElementById("confirmBoarding");
const cancelBtn = document.getElementById("cancelBoarding");

document.getElementById("endBoarding").addEventListener("click", () => {
    confirmModal.style.display = "flex";
})

confirmBtn.addEventListener("click", async () => {
    const res = await fetch(`${API}/end/${currentBoardingId}`, {
        method: "PUT"
    });
    const data = await res.json();

    document.getElementById("priceP").innerHTML = `
            <b>سعر اليوم</b> : ${data.daily_price}<br>
            <b>عدد الايام</b> : ${data.total_days}<br><hr/>
            <b>اجمالي التكلفة</b> : ${data.total_cost}`

    confirmModal.style.display = "none";
    boardingModal.style.display = "none";
    priceModal.style.display = "flex";

    loadRooms();
    loadEmptyRooms();
})

cancelBtn.addEventListener("click", async () => {
    confirmModal.style.display = "none";
})

confirmModal.addEventListener("click", e => {
    if (e.target === confirmModal) {
        confirmModal.style.display = "none";

    }
});


priceModal.addEventListener("click", e => {
    if (e.target === priceModal) {
        priceModal.style.display = "none";

    }
});

async function loadNotes() {
    const res = await fetch(`${API}/${currentBoardingId}/notes`);
    const notes = await res.json();

    const container = document.getElementById("notesContainer");
    container.innerHTML = "";

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

async function addNote() {
    const text = document.getElementById("newNote").value;
    if (!text) return;

    await fetch(`${API}/${currentBoardingId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: text })
    });

    document.getElementById("newNote").value = "";
    await loadNotes();
}
loadRooms();
loadBoardingAnimals();
loadEmptyRooms();
