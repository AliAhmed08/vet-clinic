async function loadDashboard() {
    const res = await fetch("http://localhost:3000/api/inventory/reports/profit");
    const profit = await res.json();

    updateCards(profit);
    // drawAnimalsChart(profit);
}

/* =======================
   SUMMARY CARDS
======================= */
async function updateCards(profit) {
    // const today = new Date().toISOString().slice(0, 10);
    // const month = today.slice(0, 7);

    const todayNetProfit = profit.today_net_profit || 0
    const todayRevenue = profit.today_revenue || 0

    const monthNetProfit = profit.month_net_profit
    const monthRevenue = profit.month_revenue || 0

    document.getElementById("todayRevenue").textContent =
        todayRevenue.toFixed(0) + " ج";

    document.getElementById("today_netProfit").textContent =
        todayNetProfit.toFixed(0) + " ج";

    document.getElementById("monthRevenue").textContent =
        monthRevenue.toFixed(0) + " ج";

    document.getElementById("month_netProfit").textContent =
        monthNetProfit.toFixed(0) + " ج";

    // const animalRes = await fetch("/api/animals?all=true");
    // const animalsResult = await animalRes.json();

    // document.getElementById("ownersCount").textContent =
    //     animalsResult.data.length;
}

/* =======================
   VISITS LINE CHART
======================= */
async function drawProfitChart() {

    const res = await fetch(
        "http://localhost:3000/api/inventory/reports/profits/monthly"
    );

    const data = await res.json();

    const container =
        document.getElementById("profitChart");

    const maxProfit =
        Math.max(...data.map(x => x.total_profit));

    container.innerHTML = data.map(item => `

        <div class="profit-row">

            <div class="profit-month">
                ${item.month}
            </div>

            <div class="profit-bar-wrapper">

                <div
                    class="profit-bar"
                    style="width:${(item.total_profit / maxProfit) * 100}%">
                </div>

            </div>
            
            <div class="profit-value">
                ${Number(item.total_profit).toLocaleString()}
            </div>

        </div>

    `).join("");
}

/* =======================
   PRODUCTS CHART
======================= */
async function drawProductsChart() {

    const res = await fetch(
        "http://localhost:3000/api/inventory/reports/products"
    );

    const products = await res.json();

    const container =
        document.getElementById("topProductsChart");

    const maxSold =
        Math.max(...products.map(p => p.total_sold));

    container.innerHTML = products.map(product => `

        <div class="product-row">

            <div class="product-name">
                ${product.name}
            </div>

            <div class="product-bar-wrapper">

                <div
                    class="product-bar"
                    style="width:${(product.total_sold / maxSold) * 100}%">
                </div>

            </div>

            <div class="product-value">
                ${product.total_sold}
            </div>

        </div>

    `).join("");
}

async function drawTopAnimals() {

    const res =
        await fetch("http://localhost:3000/api/inventory/reports/top-animals");

    const animals =
        await res.json();

    const container =
        document.getElementById("topAnimals");

    const maxVisits =
        Math.max(...animals.map(a => a.visits_count));

    container.innerHTML =
        animals.map(animal => {
            let animalIcon = "🐾";
            if (animal.type === "قطة") animalIcon = "🐱";
            if (animal.type === "كلب") animalIcon = "🐶";
            if (animal.type === "أرنب" || animal.type === "ارنب") animalIcon = "🐇";
            if (animal.type === "طائر") animalIcon = "🐤";

            return `
        <div class="animal-row">

            <div class="animal-name animal-link" onclick="openAnimal(${animal.id})">
               <span class="animal-type-icon">${animalIcon}</span> ${animal.name}
            </div>

            <div class="animal-bar-wrapper">

                <div
                    class="animal-bar"
                    style="width:${animal.visits_count / maxVisits * 100}%">
                </div>

            </div>

            <div class="animal-value">
                ${animal.visits_count}
            </div>
            

        </div>

    `
        }).join("");
}

/* ================= OPEN ANIMAL FILE ================= */
async function openAnimal(id) {
    const res = await fetch(`/api/animals/${id}`);
    const data = await res.json();

    const animalFile = document.getElementById("animalFile");
    const animalInfo = document.getElementById("animalInfo");


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

}
document.getElementById("closeAnimalFile").addEventListener("click", () => animalFile.style.display = "none");
animalFile.addEventListener("click", e => { if (e.target === animalFile) animalFile.style.display = "none"; });

/* =======================
   ANIMALS PIE CHART
======================= */
async function drawAnimalsChart() {
    const animals = {};
    const res = await fetch("/api/visits?all=true&limit=1000");
    const json = await res.json();
    const visits = json.data || [];
    visits.forEach(v => {
        animals[v.type] = (animals[v.type] || 0) + 1;
    });

    new Chart(document.getElementById("animalChart"), {
        type: "pie",
        data: {
            labels: Object.keys(animals),
            datasets: [{
                data: Object.values(animals)
            }]
        }
    });
}

/* INIT */
loadDashboard();
drawProfitChart();
drawProductsChart();
drawTopAnimals();
drawAnimalsChart();