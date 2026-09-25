/* ================= TOAST ================= */
export function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 5000);
}

const pluralRules = new Intl.PluralRules("ar");

export function daysLeftText(days) {
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

export function getStatus(nextDate) {
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