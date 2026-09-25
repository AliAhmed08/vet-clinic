import { getStatus } from "./common-animal.js";

async function loadVaccinations() {
    const res = await fetch(`/api/vaccinations/reminders`);
    const data = await res.json();
    renderTable(data);
}

const table = document.getElementById("vaccinationsTable");



function renderTable(list) {
    table.innerHTML = list.map(v => {
        const status = getStatus(v.next_date);
        const message = `مرحبًا \nنحب نفكرك أن تطعيم ${v.animal} القادم يوم ${v.next_date} \nننتظركم في العيادة.`;

        return `
      <tr>
        <td>${v.animal}</td>
        <td>${v.type}</td>
        <td>${v.vaccine_name}</td>
        <td>${v.owner}</td>
        <td>${v.phone}</td>
        <td>${v.next_date}</td>
        <td class="${status.class}">${status.text}</td>
        <td>
            <button 
                class="remind-btn" 
                data-id="${v.id}" 
                data-phone="${v.phone}" 
                data-msg="${encodeURIComponent(message)}">
                تذكير
            </button>
        </td>
      </tr>
    `;
    }).join("");
}


table.addEventListener("click", async (event) => {
    const btn = event.target.closest(".remind-btn");
    if (!btn) return;

    const { id, phone, msg } = btn.dataset;

    try {
        await fetch(`api/vaccinations/reminders/${id}/mark`, { method: 'PUT' });

        btn.style.backgroundColor = "#ccc";
        btn.innerText = "تم الإرسال";
    } catch (err) {
        console.error("Database update failed:", err);
    }

    const whatsappURL = `https://wa.me/2${phone}?text=${msg}`;
    window.open(whatsappURL, "_blank");
});
loadVaccinations()