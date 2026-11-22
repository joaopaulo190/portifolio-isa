// =====================================================================
//  Painel admin — só funciona logado com o e-mail definido em schema.sql
// =====================================================================
const cfg = window.SITE_CONFIG || {};
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

if (!cfg.ready || !window.supabase) {
  $("#setupScreen").classList.remove("hidden");
  throw new Error("Supabase não configurado (config.js).");
}

const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const state = { visits: [], events: [], messages: [], projects: [], search: "" };

// ---------- Utilidades ----------
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}
const fmtDate = (d) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDur = (s) => {
  s = Math.round(s || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
};
const place = (v) => [v.city, v.region, v.country].filter(Boolean).join(", ") || "Desconhecido";
const refName = (v) => {
  if (v.utm_source) return v.utm_source;
  if (!v.referrer) return "Acesso direto";
  try { return new URL(v.referrer).hostname.replace(/^www\./, ""); } catch (_) { return v.referrer; }
};
const visitorTag = (id) => `#${String(id).replace(/-/g, "").slice(0, 5).toUpperCase()}`;
const sectionNames = { inicio: "Início", sobre: "Sobre", skills: "Serviços", projetos: "Projetos", experiencia: "Experiência", contato: "Contato" };

// ---------- Autenticação ----------
async function checkAdmin() {
  const { data, error } = await db.rpc("is_admin");
  return !error && data === true;
}

async function boot() {
  const { data: { session } } = await db.auth.getSession();
  if (session && (await checkAdmin())) return showApp(session.user.email);
  if (session) await db.auth.signOut();
  $("#loginScreen").classList.remove("hidden");
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#loginError");
  err.textContent = "";
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  const { data, error } = await db.auth.signInWithPassword({
    email: $("#loginEmail").value.trim(),
    password: $("#loginPass").value,
  });
  btn.disabled = false;
  if (error) { err.textContent = "E-mail ou senha incorretos."; return; }
  if (!(await checkAdmin())) {
    await db.auth.signOut();
    err.textContent = "Acesso negado: esta conta não é a do administrador.";
    return;
  }
  $("#loginScreen").classList.add("hidden");
  showApp(data.user.email);
});

$("#logoutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

function showApp(email) {
  try { localStorage.setItem("pf_is_admin", "1"); } catch (_) {} // não conta suas próprias visitas
  $("#adminEmail").textContent = email;
  $("#app").classList.remove("hidden");
  loadAll();
}

// ---------- Navegação ----------
const titles = { overview: "Visão geral", visits: "Visitas", messages: "Mensagens", projects: "Projetos" };
$$(".side-link").forEach((b) =>
  b.addEventListener("click", () => {
    $$(".side-link").forEach((x) => x.classList.toggle("active", x === b));
    $$(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== `tab-${b.dataset.tab}`));
    $("#pageTitle").textContent = titles[b.dataset.tab];
    $("#rangeSelect").style.visibility = ["overview", "visits"].includes(b.dataset.tab) ? "visible" : "hidden";
  })
);
$("#rangeSelect").addEventListener("change", loadAll);
$("#refreshBtn").addEventListener("click", () => loadAll().then(() => toast("Dados atualizados")));
$$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

// ---------- Carregamento ----------
function sinceISO() {
  const days = +$("#rangeSelect").value;
  const d = new Date();
  if (days === 1) d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function loadAll() {
  const since = sinceISO();
  const [v, e, m, p] = await Promise.all([
    db.from("visits").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    db.from("events").select("visit_id,type,label,created_at").gte("created_at", since).limit(20000),
    db.from("messages").select("*").order("created_at", { ascending: false }),
    db.from("projects").select("*").order("sort_order", { ascending: true }),
  ]);
  const err = [v, e, m, p].find((r) => r.error);
  if (err) toast("Erro ao carregar: " + err.error.message);
  state.visits = v.data || [];
  state.events = e.data || [];
  state.messages = m.data || [];
  state.projects = p.data || [];
  renderOverview();
  renderVisits();
  renderMessages();
  renderProjects();
}

// ---------- Visão geral ----------
function countBy(list, fn) {
  const map = new Map();
  list.forEach((x) => { const k = fn(x); if (k) map.set(k, (map.get(k) || 0) + 1); });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
function renderRank(el, entries, max = 6) {
  if (!entries.length) { $(el).innerHTML = `<span class="none">Sem dados ainda.</span>`; return; }
  const top = entries[0][1];
  $(el).innerHTML = entries
    .slice(0, max)
    .map(([k, n]) => `<li><span class="name" title="${esc(k)}">${esc(k)}</span><span class="val">${n}</span>
      <span class="track"><span class="fill" style="width:${(n / top) * 100}%"></span></span></li>`)
    .join("");
}

function renderOverview() {
  const vs = state.visits;
  const unique = new Set(vs.map((v) => v.visitor_id)).size;
  const avg = vs.length ? vs.reduce((s, v) => s + (v.duration_s || 0), 0) / vs.length : 0;
  const unread = state.messages.filter((m) => !m.read).length;
  $("#kVisits").textContent = vs.length;
  $("#kUnique").textContent = unique;
  $("#kTime").textContent = fmtDur(avg);
  $("#kMsgs").textContent = unread;
  $("#unreadPill").textContent = unread;
  $("#unreadPill").classList.toggle("hidden", !unread);

  renderChart(vs);
  renderRank("#rCities", countBy(vs, place));
  renderRank("#rRefs", countBy(vs, refName));
  renderRank("#rDevices", countBy(vs, (v) => [v.device, v.os].filter(Boolean).join(" · ")));
  renderRank("#rBrowsers", countBy(vs, (v) => v.browser));
  renderRank("#rSections", countBy(state.events.filter((e) => e.type === "section"), (e) => sectionNames[e.label] || e.label));
  renderRank("#rClicks", countBy(state.events.filter((e) => e.type === "click" || e.type === "form"), (e) => e.label), 8);
}

function renderChart(vs) {
  const days = +$("#rangeSelect").value;
  const buckets = [];
  const now = new Date();
  let keyOf;

  if (days === 1) {
    for (let h = 0; h <= now.getHours(); h++) buckets.push({ key: h, label: `${h}h`, tip: `${h}h`, n: 0 });
    keyOf = (d) => d.getHours();
    $("#chartNote").textContent = "por hora";
  } else {
    let span = days;
    if (days > 90) {
      const oldest = vs.length ? new Date(vs[vs.length - 1].created_at) : now;
      span = Math.min(Math.ceil((now - oldest) / 864e5) + 1, 90);
    }
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toDateString();
      buckets.push({
        key,
        label: span <= 14 || i % Math.ceil(span / 10) === 0 ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "",
        tip: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }),
        n: 0,
      });
    }
    keyOf = (d) => d.toDateString();
    $("#chartNote").textContent = days > 90 ? `últimos ${span} dias` : "por dia";
  }

  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  vs.forEach((v) => { const i = idx.get(keyOf(new Date(v.created_at))); if (i !== undefined) buckets[i].n++; });
  const max = Math.max(1, ...buckets.map((b) => b.n));
  $("#chart").innerHTML = buckets
    .map((b) => `<div class="bar-col"><span class="tip">${esc(b.tip)}: <b>${b.n}</b> ${b.n === 1 ? "visita" : "visitas"}</span>
      <div class="bar" style="height:${(b.n / max) * 100}%"></div><span class="bar-label">${esc(b.label)}</span></div>`)
    .join("");
}

// ---------- Visitas ----------
$("#visitSearch").addEventListener("input", (e) => { state.search = e.target.value.toLowerCase(); renderVisits(); });

function renderVisits() {
  const perVisitor = new Map();
  state.visits.forEach((v) => perVisitor.set(v.visitor_id, (perVisitor.get(v.visitor_id) || 0) + 1));
  const q = state.search;
  const list = state.visits.filter((v) =>
    !q || [place(v), v.browser, v.os, v.device, v.ip, refName(v), visitorTag(v.visitor_id)].join(" ").toLowerCase().includes(q)
  );
  $("#visitsEmpty").classList.toggle("hidden", list.length > 0);
  $("#visitsBody").innerHTML = list
    .map((v) => {
      const n = perVisitor.get(v.visitor_id);
      const badge = n > 1 ? `<span class="badge-back">voltou · ${n}x</span>` : `<span class="badge-new">novo</span>`;
      return `<tr data-id="${esc(v.id)}">
        <td>${fmtDate(v.created_at)}</td>
        <td>${esc(place(v))}<span class="sub">${esc(v.ip || "")}</span></td>
        <td>${esc(v.device || "")}<span class="sub">${esc([v.browser, v.os].filter(Boolean).join(" · "))}</span></td>
        <td>${esc(refName(v))}</td>
        <td>${fmtDur(v.duration_s)}</td>
        <td>${esc(visitorTag(v.visitor_id))} ${badge}</td>
        <td><button class="icon-btn" data-del="${esc(v.id)}" title="Apagar">🗑</button></td>
      </tr>`;
    })
    .join("");
}

$("#visitsBody").addEventListener("click", async (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    e.stopPropagation();
    if (!confirm("Apagar esta visita?")) return;
    const { error } = await db.from("visits").delete().eq("id", del.dataset.del);
    if (error) return toast("Erro: " + error.message);
    toast("Visita apagada");
    return loadAll();
  }
  const row = e.target.closest("tr[data-id]");
  if (row) openVisit(row.dataset.id);
});

function openVisit(id) {
  const v = state.visits.find((x) => x.id === id);
  if (!v) return;
  const evs = state.events.filter((e) => e.visit_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const others = state.visits.filter((x) => x.visitor_id === v.visitor_id).length;
  const rows = [
    ["Quando", fmtDate(v.created_at)],
    ["Visitante", `${visitorTag(v.visitor_id)} (${others} ${others === 1 ? "visita" : "visitas"} no período)`],
    ["Local", place(v)],
    ["IP", v.ip || "—"],
    ["Dispositivo", [v.device, v.os, v.browser].filter(Boolean).join(" · ")],
    ["Tela", v.screen || "—"],
    ["Idioma / fuso", [v.language, v.timezone].filter(Boolean).join(" · ") || "—"],
    ["Origem", v.referrer || refName(v)],
    ["Página", v.page || "/"],
    ["Tempo no site", fmtDur(v.duration_s)],
  ];
  const evLabel = (e) =>
    e.type === "section" ? `👁️ Viu a seção <b>${esc(sectionNames[e.label] || e.label)}</b>` :
    e.type === "form" ? `💬 ${esc(e.label)}` : `🖱️ Clicou em <b>${esc(e.label)}</b>`;
  $("#visitDetail").innerHTML = `
    <dl class="detail-grid">${rows.map(([k, val]) => `<dt>${k}</dt><dd>${esc(val)}</dd>`).join("")}</dl>
    <h2 style="font-family:var(--font-head);font-size:1.05rem;margin-bottom:12px">O que fez no site</h2>
    ${evs.length
      ? `<ul class="timeline-mini">${evs.map((e) => `<li><span class="t">${new Date(e.created_at).toLocaleTimeString("pt-BR")}</span>${evLabel(e)}</li>`).join("")}</ul>`
      : `<p class="muted">Nenhuma ação registrada.</p>`}`;
  $("#visitModal").showModal();
}

$("#clearVisitsBtn").addEventListener("click", async () => {
  const label = $("#rangeSelect").selectedOptions[0].textContent.toLowerCase();
  if (!confirm(`Apagar TODAS as visitas de: ${label}? Isso não pode ser desfeito.`)) return;
  const { error } = await db.from("visits").delete().gte("created_at", sinceISO());
  if (error) return toast("Erro: " + error.message);
  toast("Visitas apagadas");
  loadAll();
});

// ---------- Mensagens ----------
function renderMessages() {
  const ms = state.messages;
  $("#messagesEmpty").classList.toggle("hidden", ms.length > 0);
  $("#messagesList").innerHTML = ms
    .map((m) => `<article class="msg glass ${m.read ? "" : "unread"}">
      <div class="msg-head">
        <div><strong>${esc(m.name)}</strong> <span class="muted small">· ${esc(m.email)}</span></div>
        <span class="muted small">${fmtDate(m.created_at)}</span>
      </div>
      <p>${esc(m.message)}</p>
      <div class="msg-actions">
        <a class="btn btn-primary btn-sm" href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: contato pelo portfólio")}">Responder</a>
        <button class="btn btn-ghost btn-sm" data-read="${m.id}" data-val="${!m.read}">${m.read ? "Marcar como não lida" : "Marcar como lida"}</button>
        <button class="btn btn-ghost btn-sm danger" data-mdel="${m.id}">Apagar</button>
      </div>
    </article>`)
    .join("");
}

$("#messagesList").addEventListener("click", async (e) => {
  const r = e.target.closest("[data-read]");
  const d = e.target.closest("[data-mdel]");
  if (r) {
    const { error } = await db.from("messages").update({ read: r.dataset.val === "true" }).eq("id", r.dataset.read);
    if (error) return toast("Erro: " + error.message);
    loadAll();
  } else if (d) {
    if (!confirm("Apagar esta mensagem?")) return;
    const { error } = await db.from("messages").delete().eq("id", d.dataset.mdel);
    if (error) return toast("Erro: " + error.message);
    toast("Mensagem apagada");
    loadAll();
  }
});

// ---------- Projetos ----------
const safeColor = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : d);

function renderProjects() {
  $("#projectList").innerHTML =
    state.projects
      .map((p) => `<article class="p-item glass">
        <div class="p-thumb" style="--c1:${safeColor(p.color1, "#7c3aed")};--c2:${safeColor(p.color2, "#06b6d4")}">${
          /^(https?:\/\/|img\/)[^"'<>\s]+$/i.test(p.image_url || "")
            ? `<img src="${esc(p.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover" />`
            : esc(p.emoji || "🧩")
        }</div>
        <div class="p-body">
          <h3>${esc(p.title)} ${p.published ? "" : `<span class="draft">rascunho</span>`}</h3>
          <p>${esc(p.description || "")}</p>
          <div class="msg-actions">
            <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button>
            <button class="btn btn-ghost btn-sm" data-toggle="${p.id}">${p.published ? "Ocultar" : "Publicar"}</button>
            <button class="btn btn-ghost btn-sm danger" data-pdel="${p.id}">Apagar</button>
          </div>
        </div>
      </article>`)
      .join("") || `<p class="empty">Nenhum projeto. Clique em “+ Novo projeto”.</p>`;
}

function openProject(p) {
  $("#projectFormTitle").textContent = p ? "Editar projeto" : "Novo projeto";
  $("#pId").value = p?.id || "";
  $("#pTitle").value = p?.title || "";
  $("#pDesc").value = p?.description || "";
  $("#pClient").value = p?.client || "";
  $("#pFeat").value = (p?.features || []).join("\n");
  $("#pImpact").value = p?.impact || "";
  $("#pImg").value = p?.image_url || "";
  $("#pSteps").value = (p?.steps || []).join("\n");
  $("#pGallery").value = (p?.gallery || []).join("\n");
  $("#pEmoji").value = p?.emoji || "🧩";
  $("#pCat").value = p?.category || "varejo";
  $("#pC1").value = safeColor(p?.color1, "#7c3aed");
  $("#pC2").value = safeColor(p?.color2, "#06b6d4");
  $("#pTags").value = (p?.tags || []).join(", ");
  $("#pDemo").value = p?.demo_url || "";
  $("#pCode").value = p?.code_url || "";
  $("#pOrder").value = p?.sort_order ?? state.projects.length + 1;
  $("#pPub").checked = p ? p.published : true;
  $("#projectModal").showModal();
}

$("#newProjectBtn").addEventListener("click", () => openProject(null));

$("#projectList").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]");
  const tg = e.target.closest("[data-toggle]");
  const dl = e.target.closest("[data-pdel]");
  if (ed) return openProject(state.projects.find((p) => p.id == ed.dataset.edit));
  if (tg) {
    const p = state.projects.find((x) => x.id == tg.dataset.toggle);
    const { error } = await db.from("projects").update({ published: !p.published }).eq("id", p.id);
    if (error) return toast("Erro: " + error.message);
    toast(p.published ? "Projeto ocultado do site" : "Projeto publicado no site");
    return loadAll();
  }
  if (dl) {
    if (!confirm("Apagar este projeto?")) return;
    const { error } = await db.from("projects").delete().eq("id", dl.dataset.pdel);
    if (error) return toast("Erro: " + error.message);
    toast("Projeto apagado");
    loadAll();
  }
});

$("#projectForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = {
    title: $("#pTitle").value.trim(),
    description: $("#pDesc").value.trim(),
    client: $("#pClient").value.trim() || null,
    features: $("#pFeat").value.split("\n").map((t) => t.trim()).filter(Boolean),
    impact: $("#pImpact").value.trim() || null,
    image_url: $("#pImg").value.trim() || null,
    steps: $("#pSteps").value.split("\n").map((t) => t.trim()).filter(Boolean),
    gallery: $("#pGallery").value.split("\n").map((t) => t.trim()).filter(Boolean),
    emoji: $("#pEmoji").value.trim() || "🧩",
    category: $("#pCat").value,
    color1: $("#pC1").value,
    color2: $("#pC2").value,
    tags: $("#pTags").value.split(",").map((t) => t.trim()).filter(Boolean),
    demo_url: $("#pDemo").value.trim() || null,
    code_url: $("#pCode").value.trim() || null,
    sort_order: +$("#pOrder").value || 0,
    published: $("#pPub").checked,
  };
  const id = $("#pId").value;
  const { error } = id
    ? await db.from("projects").update(row).eq("id", id)
    : await db.from("projects").insert(row);
  if (error) return toast("Erro: " + error.message);
  $("#projectModal").close();
  toast(id ? "Projeto atualizado" : "Projeto criado");
  loadAll();
});

boot();
