// =====================================================================
//  Rastreamento de visitas + integração com o Supabase (lado do site)
// =====================================================================
(function () {
  const cfg = window.SITE_CONFIG || {};
  const Site = (window.Site = {
    enabled: false,
    visitId: null,
    track() {},
    async loadProjects() { return null; },
    async sendMessage() { return { ok: false, reason: "offline" }; },
  });

  if (!cfg.ready || !window.supabase) return;

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  Site.enabled = true;

  // Se você abriu o painel neste navegador, suas visitas não são contadas
  let isAdmin = false;
  try { isAdmin = localStorage.getItem("pf_is_admin") === "1"; } catch (_) {}

  // ---------- Projetos e mensagens (funcionam mesmo para o admin) ----------
  Site.loadProjects = async function () {
    const { data, error } = await db
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error) { console.warn("Projetos:", error.message); return null; }
    return data;
  };

  Site.sendMessage = async function ({ name, email, message }) {
    const { error } = await db.from("messages").insert({ name, email, message, visit_id: Site.visitId });
    if (error) { console.warn("Mensagem:", error.message); return { ok: false, reason: error.message }; }
    Site.track("form", "Mensagem enviada");
    return { ok: true };
  };

  if (isAdmin) return;

  // ---------- Identificação do navegador ----------
  const uuid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });

  let visitorId;
  try {
    visitorId = localStorage.getItem("pf_visitor");
    if (!visitorId) { visitorId = uuid(); localStorage.setItem("pf_visitor", visitorId); }
  } catch (_) { visitorId = uuid(); }

  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Outro";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "Outro";
  const device = /iPad|Tablet/.test(ua) ? "Tablet" : /Mobi|Android|iPhone/.test(ua) ? "Celular" : "Computador";

  const params = new URLSearchParams(location.search);
  let referrer = document.referrer || "";
  try { if (referrer && new URL(referrer).host === location.host) referrer = ""; } catch (_) {}

  const visitId = uuid();
  Site.visitId = visitId;
  const queue = [];
  let visitSaved = false;

  Site.track = function (type, label) {
    const ev = { visit_id: visitId, type, label: String(label || "").slice(0, 200) };
    if (visitSaved) db.from("events").insert(ev).then(() => {});
    else queue.push(ev);
  };

  async function geo() {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: ctrl.signal });
      return await r.json();
    } catch (_) { return {}; }
  }

  (async function registerVisit() {
    const g = await geo();
    const { error } = await db.from("visits").insert({
      id: visitId,
      visitor_id: visitorId,
      page: location.pathname + location.hash,
      referrer: referrer || null,
      utm_source: params.get("utm_source") || params.get("ref") || null,
      browser, os, device,
      screen: `${screen.width}x${screen.height}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ip: g.ip || null,
      country: g.country || null,
      region: g.region || null,
      city: g.city || null,
    });
    if (error) { console.warn("Visita:", error.message); return; }
    visitSaved = true;
    if (queue.length) db.from("events").insert(queue.splice(0)).then(() => {});
  })();

  // ---------- Tempo no site ----------
  const start = Date.now();
  function sendDuration() {
    if (!visitSaved) return;
    const seconds = Math.round((Date.now() - start) / 1000);
    fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/update_visit_duration`, {
      method: "POST",
      keepalive: true,
      headers: Object.assign(
        { apikey: cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        // chave antiga (JWT "eyJ...") também vai no Authorization; a nova (sb_publishable_...) não
        cfg.SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}` } : {}
      ),
      body: JSON.stringify({ p_visit: visitId, p_seconds: seconds }),
    }).catch(() => {});
  }
  setInterval(sendDuration, 20000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sendDuration(); });
  window.addEventListener("pagehide", sendDuration);

  // ---------- Seções vistas ----------
  const seen = new Set();
  const secObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const id = e.target.id;
      if (e.isIntersecting && !seen.has(id)) { seen.add(id); Site.track("section", id); }
    });
  }, { threshold: 0.4 });
  document.addEventListener("DOMContentLoaded", () =>
    document.querySelectorAll("main section[id]").forEach((s) => secObserver.observe(s))
  );

  // ---------- Cliques em links e botões ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("a, button");
    if (!el || el.type === "submit") return;
    const project = el.closest(".project");
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ");
    const label = project ? `${project.querySelector("h3")?.textContent} → ${text}` : text;
    Site.track("click", label);
  });
})();
