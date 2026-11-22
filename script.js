// ===== Efeito de digitação =====
const words = ["crio sistemas.", "resolvo problemas.", "automatizo tarefas.", "ajudo pequenos negócios."];
const typedEl = document.getElementById("typed");
let wordIndex = 0, charIndex = 0, deleting = false;

function type() {
  const word = words[wordIndex];
  typedEl.textContent = word.slice(0, charIndex);

  if (!deleting && charIndex < word.length) {
    charIndex++;
    setTimeout(type, 80);
  } else if (!deleting) {
    deleting = true;
    setTimeout(type, 1800);
  } else if (charIndex > 0) {
    charIndex--;
    setTimeout(type, 40);
  } else {
    deleting = false;
    wordIndex = (wordIndex + 1) % words.length;
    setTimeout(type, 300);
  }
}
type();

// ===== Navegação: fundo ao rolar + link ativo =====
const nav = document.getElementById("nav");
const sections = document.querySelectorAll("main section[id]");
const navAnchors = document.querySelectorAll(".nav-links a");

function onScroll() {
  nav.classList.toggle("scrolled", window.scrollY > 40);

  let current = "";
  sections.forEach((sec) => {
    if (window.scrollY >= sec.offsetTop - 200) current = sec.id;
  });
  navAnchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${current}`));
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ===== Menu mobile =====
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuToggle.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", open);
});
navAnchors.forEach((a) =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  })
);

// ===== Revelar ao rolar =====
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  revealObserver.observe(el);
});

// ===== Contadores animados =====
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = +el.dataset.count;
      const duration = 1600;
      const start = performance.now();

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll("[data-count]").forEach((el) => counterObserver.observe(el));

// ===== Filtro de projetos =====
const filters = document.querySelectorAll(".filter");

filters.forEach((btn) =>
  btn.addEventListener("click", () => {
    filters.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const cat = btn.dataset.filter;
    document
      .querySelectorAll(".project")
      .forEach((p) => p.classList.toggle("hide", cat !== "all" && p.dataset.cat !== cat));
  })
);

// ===== Projetos (do painel admin ou, se não houver, de projects-data.js) =====
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
const safeImg = (u) => (/^(https?:\/\/|img\/)[^"'<>\s]+$/i.test((u || "").trim()) ? u.trim() : "");
const safeColor = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : d);

const grid = document.getElementById("projectsGrid");
const projectModal = document.getElementById("projectModal");
const projectModalBody = document.getElementById("projectModalBody");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
let projectList = [];

function parseGallery(p) {
  const items = (p.gallery || [])
    .map((g) => {
      const [src, ...cap] = String(g).split("|");
      return { src: safeImg(src), cap: cap.join("|").trim() };
    })
    .filter((g) => g.src);
  if (!items.length && safeImg(p.image_url)) items.push({ src: safeImg(p.image_url), cap: "" });
  return items;
}

function renderProjects(list) {
  projectList = list;
  grid.innerHTML = list
    .map((p, i) => {
      const img = safeImg(p.image_url);
      const thumb = img
        ? `<div class="project-thumb has-img"><img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy" /></div>`
        : `<div class="project-thumb" style="--c1:${safeColor(p.color1, "#7c3aed")};--c2:${safeColor(p.color2, "#06b6d4")}"><span>${esc(p.emoji || "🧩")}</span></div>`;
      const demo = safeUrl(p.demo_url), code = safeUrl(p.code_url);
      return `
      <article class="project glass reveal" data-cat="${esc(p.category)}" data-i="${i}">
        ${thumb}
        <div class="project-body">
          ${p.client ? `<span class="client">${esc(p.client)}</span>` : ""}
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          <ul class="tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <div class="project-links">
            <button type="button" data-open="${i}">Ver detalhes →</button>
            ${demo ? `<a href="${esc(demo)}" target="_blank" rel="noopener">Ver ↗</a>` : ""}
            ${code ? `<a href="${esc(code)}" target="_blank" rel="noopener">Código ↗</a>` : ""}
          </div>
        </div>
      </article>`;
    })
    .join("");
  grid.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));
  document.querySelector(".filter.active")?.click();
}

function openProject(i) {
  const p = projectList[i];
  if (!p) return;
  const gal = parseGallery(p);
  const steps = (p.steps || []).map((s) => {
    const idx = String(s).indexOf(":");
    return idx > 0 && idx < 40 ? { t: s.slice(0, idx).trim(), d: s.slice(idx + 1).trim() } : { t: "", d: s };
  });
  projectModalBody.innerHTML = `
    <div class="pm-head">
      ${p.client ? `<span class="client">${esc(p.client)}</span>` : ""}
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.description)}</p>
    </div>
    <div class="pm-grid ${gal.length ? "" : "no-gal"}">
      ${gal.length ? `
      <div class="gal">
        <img class="gal-main contain" src="${esc(gal[0].src)}" alt="${esc(gal[0].cap || p.title)}" />
        <p class="gal-cap">${esc(gal[0].cap)}</p>
        ${gal.length > 1 ? `<div class="gal-thumbs ${gal.length > 6 ? "t4" : ""}">
          ${gal.map((g, k) => `<img class="${k === 0 ? "on" : ""}" src="${esc(g.src)}" alt="${esc(g.cap)}" data-cap="${esc(g.cap)}" loading="lazy" />`).join("")}
        </div>` : ""}
      </div>` : ""}
      <div>
        ${steps.length ? `<div class="pm-block"><h4>Como foi</h4><ol class="steps">
          ${steps.map((s) => `<li><b>${esc(s.t)}</b><p>${esc(s.d)}</p></li>`).join("")}</ol></div>` : ""}
        ${(p.features || []).length ? `<div class="pm-block"><h4>Funcionalidades</h4><ul class="feat">
          ${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>` : ""}
        ${p.impact ? `<div class="pm-block"><h4>Resultado</h4><p class="impact">${esc(p.impact)}</p></div>` : ""}
        ${(p.tags || []).length ? `<div class="pm-block"><ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
      </div>
    </div>`;
  projectModal.showModal();
  projectModal.scrollTop = 0;
  window.Site.track("click", `${p.title} → Ver detalhes`);
}

grid.addEventListener("click", (e) => {
  if (e.target.closest("a")) return; // links externos seguem normal
  const card = e.target.closest(".project");
  if (card) openProject(+card.dataset.i);
});

projectModalBody.addEventListener("click", (e) => {
  const thumb = e.target.closest(".gal-thumbs img");
  const main = projectModalBody.querySelector(".gal-main");
  if (thumb && main) {
    main.src = thumb.src;
    main.alt = thumb.alt;
    projectModalBody.querySelector(".gal-cap").textContent = thumb.dataset.cap;
    projectModalBody.querySelectorAll(".gal-thumbs img").forEach((x) => x.classList.toggle("on", x === thumb));
  } else if (e.target === main) {
    lightboxImg.src = main.src;
    lightboxImg.alt = main.alt;
    lightbox.showModal();
  }
});
document.getElementById("projectModalClose").addEventListener("click", () => projectModal.close());
projectModal.addEventListener("click", (e) => { if (e.target === projectModal) projectModal.close(); });
lightbox.addEventListener("click", () => lightbox.close());

renderProjects(window.DEFAULT_PROJECTS || []);
window.Site.loadProjects().then((list) => { if (list && list.length) renderProjects(list); });

// ===== Brilho que segue o cursor + parallax no card de código =====
const glow = document.querySelector(".cursor-glow");
const heroVisual = document.querySelector(".hero-visual");

window.addEventListener("mousemove", (e) => {
  glow.style.opacity = "1";
  glow.style.left = `${e.clientX}px`;
  glow.style.top = `${e.clientY}px`;

  if (heroVisual && window.scrollY < window.innerHeight) {
    const x = (e.clientX / window.innerWidth - 0.5) * 14;
    const y = (e.clientY / window.innerHeight - 0.5) * 14;
    heroVisual.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg)`;
  }
});
document.addEventListener("mouseleave", () => (glow.style.opacity = "0"));

// ===== Formulário de contato (salva no painel; sem painel, abre o e-mail) =====
const form = document.getElementById("contactForm");
const statusEl = document.getElementById("formStatus");
const contactEmail = document.getElementById("contactMail").textContent.trim();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();
  const btn = form.querySelector("button[type=submit]");

  if (window.Site.enabled) {
    btn.disabled = true;
    statusEl.style.color = "";
    statusEl.textContent = "Enviando...";
    const res = await window.Site.sendMessage({ name, email, message });
    btn.disabled = false;
    if (res.ok) {
      statusEl.textContent = "✨ Mensagem enviada! Vou responder em breve.";
      form.reset();
      return;
    }
    statusEl.style.color = "#fca5a5";
    statusEl.textContent = "Não consegui enviar agora. Abrindo seu e-mail como alternativa...";
  }

  const subject = encodeURIComponent(`Contato pelo portfólio — ${name}`);
  const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
  window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  if (!window.Site.enabled) statusEl.textContent = "✨ Abrindo seu app de e-mail... obrigado pela mensagem!";
  form.reset();
});

// ===== Ano no rodapé =====
document.getElementById("year").textContent = new Date().getFullYear();
