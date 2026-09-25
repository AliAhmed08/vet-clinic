const settingsForm = document.getElementById("settingsForm");

const clinicName = document.getElementById("clinic_name");
const phone = document.getElementById("phone");
const address = document.getElementById("address");

const logo = document.getElementById("logo");
const logoPreview = document.getElementById("logoPreview");

async function loadSettings() {

    try {

        const res = await fetch("/api/settings");
        const data = await res.json();

        clinicName.value = data.clinic_name || "";
        phone.value = data.phone || "";
        address.value = data.address || "";

        if (data.logo) {

            logoPreview.src =
                `app-data://uploads/${data.logo}`;

        }

    } catch (err) {

        console.error(err);

    }

}

settingsForm.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        try {

            const formData = new FormData();

            formData.append(
                "clinic_name",
                clinicName.value
            );

            formData.append(
                "phone",
                phone.value
            );

            formData.append(
                "address",
                address.value
            );

            if (logo.files.length) {

                formData.append(
                    "logo",
                    logo.files[0]
                );

            }

            const res = await fetch(
                "/api/settings",
                {
                    method: "PUT",
                    body: formData
                }
            );

            const result = await res.json();

            if (!res.ok) {

                alert(
                    result.error ||
                    "حدث خطأ أثناء الحفظ"
                );

                return;
            }

            showToast("تم حفظ الإعدادات بنجاح");

            await loadSettings();

        } catch (err) {

            console.error(err);
            alert("حدث خطأ");

        }

    }
);

logo.addEventListener("change", () => {

    const file = logo.files[0];

    if (!file) return;

    logoPreview.src = URL.createObjectURL(file);

});

document.getElementById('backupBtn').addEventListener('click', async () => {
    const result = await window.electronAPI.backupDatabase();
    if (result.success) {
        showToast("تم حفظ النسخة بنجاح في: " + result.path);
    } else if (result.error !== "Canceled") {
        alert("فشل الحفظ: " + result.error);
    }
});


/* ================= TOAST ================= */
function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

loadSettings();