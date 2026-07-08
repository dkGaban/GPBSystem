export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export function formatScheduleCell(schedule) {
  const splitIndex = schedule.lastIndexOf(" ");
  const timeMeridiem = schedule.slice(Math.max(0, splitIndex - 5));
  const date = schedule.replace(timeMeridiem, "").trim();
  return `${escapeHtml(date)}<br><span class="font-semibold">${escapeHtml(timeMeridiem)}</span>`;
}

export function formatDateTime(date) {
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ${formatTime(date)}`;
}

export function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatPesoPrice(value) {
  if (!value) return "";
  const cleaned = String(value)
    .replace(/php/gi, "")
    .replace(/[\u20b1,\s]/g, "")
    .trim();
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return value;
  const cents = Math.round(amount * 100) % 100;

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatActivityDate(date) {
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

export function statusBadge(status) {
  const className = status.toLowerCase().replace(/\s+/g, "-");
  return `<span class="badge badge-${className}">${escapeHtml(status)}</span>`;
}

export function refreshIcons() {
  if (window.lucide) {
    document.querySelectorAll("[data-icon]").forEach((icon) => {
      icon.setAttribute("data-lucide", icon.dataset.icon);
      icon.removeAttribute("data-icon");
    });
    window.lucide.createIcons({
      attrs: {
        "stroke-width": 2
      }
    });
  }
}

export function showToast(message, els) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 2600);
}
