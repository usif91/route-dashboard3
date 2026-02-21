export function normalizeForTokens(s) {
    return (s ?? "")
        .toString()
        .toUpperCase()
        .replace(/&/g, " ")
        .replace(/[,.;:/\\()\[\]{}'"`~!@#$%^*+=<>?|-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function formatVal(v) {
    if (v === null || v === undefined || v === "") return '<span style="color:var(--muted)">—</span>';
    return escapeHtml(v);
}

export function formatRoute(route) {
    if (route === null || route === undefined) return '<span style="color:var(--muted)">—</span>';
    const s = String(route).replace(/\D/g, '');
    if (!s) return escapeHtml(route);
    return s.padStart(5, '0');
}
