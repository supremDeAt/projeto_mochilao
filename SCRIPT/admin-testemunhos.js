/* =====================================================
   O MOCHILÃO — admin-testemunhos.js  (ES module)
   Admin → Site Web → "Testemunhos"

   • Aprovar / recusar os testemunhos enviados pelos clientes
     (PAGES/testemunhos.html) — nada aparece no site sem aprovação
   • Destacar (aparecem primeiro no index)
   • Editar, apagar e adicionar testemunhos à mão
     (ex.: os que chegam pelo WhatsApp ou Instagram)

   O separador e o painel são criados por este ficheiro.
   Arranca sozinho: basta esta linha no fim do admin.html
     <script type="module" src="../SCRIPT/admin-testemunhos.js"></script>
   ===================================================== */

import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { esc, toast } from "./admin-utils.js";
import { avatarFromFile } from "./testemunho-form.js";
import { initials, sortTestimonials } from "./testemunhos.js";

const TAB = "testemunhos";
const STATUS = {
  pendente: { label: "Pendentes", one: "Pendente" },
  aprovado: { label: "Publicados", one: "Publicado" },
  recusado: { label: "Recusados", one: "Recusado" },
};

const toDate = (t) => (t?.toDate ? t.toDate() : t?.seconds ? new Date(t.seconds * 1000) : null);
const fmtDate = (t) => {
  const d = toDate(t);
  return d ? d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) : "";
};

export function initTestimonialsAdmin({ db, canEdit = false }) {
  const root = document.getElementById("conteudo");
  const tabsBar = root?.querySelector(".content-tabs");
  if (!root || !tabsBar || root.querySelector(`[data-content-tab="${TAB}"]`)) return;

  if (!document.getElementById("tmAdminCss")) {
    const link = document.createElement("link");
    link.id = "tmAdminCss";
    link.rel = "stylesheet";
    link.href = "../STYLES/admin-testemunhos.css";
    document.head.appendChild(link);
  }

  /* ─────────────────────────────────────────
     SEPARADOR + PAINEL
     ───────────────────────────────────────── */
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "content-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", "false");
  tab.dataset.contentTab = TAB;
  tab.innerHTML = '<i class="fa-regular fa-comment-dots"></i> Testemunhos <span class="tm-adm-badge" data-tm-badge hidden></span>';
  tabsBar.appendChild(tab);

  const pane = document.createElement("div");
  pane.className = "content-pane tm-adm";
  pane.dataset.contentPane = TAB;
  pane.hidden = true;
  const panes = root.querySelectorAll("[data-content-pane]");
  (panes[panes.length - 1] || tabsBar).after(pane);

  const showOnly = (name) => {
    root.querySelectorAll("[data-content-tab]").forEach((t) => {
      const on = t.dataset.contentTab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    root.querySelectorAll("[data-content-pane]").forEach((p) => (p.hidden = p.dataset.contentPane !== name));
  };
  tabsBar.addEventListener("click", (e) => {
    const t = e.target.closest("[data-content-tab]");
    if (t) showOnly(t.dataset.contentTab);
  });

  pane.innerHTML = `
    <div class="tm-adm__bar">
      <p class="content-help">
        Os testemunhos enviados pelos clientes em <a href="testemunhos.html" target="_blank" rel="noopener">testemunhos.html</a>
        chegam como <strong>Pendentes</strong> e só aparecem no site depois de aprovados.
        Os <strong>destacados</strong> aparecem primeiro no início do site.
      </p>
      ${canEdit ? `<button type="button" class="btn btn--primary" data-tm-new><i class="fa-solid fa-plus"></i> Adicionar testemunho</button>` : ""}
    </div>

    <form class="tm-adm__form" data-tm-form hidden novalidate>
      <h3 class="tm-adm__form-title" data-tm-form-title>Novo testemunho</h3>
      <div class="tm-adm__form-grid">
        <label class="ab-field"><span>Nome *</span><input type="text" maxlength="60" data-f="nome" /></label>
        <label class="ab-field"><span>De onde é</span><input type="text" maxlength="60" data-f="local" placeholder="Ex.: Luanda" /></label>
        <label class="ab-field"><span>Viagem</span><select data-f="programa"></select></label>
        <label class="ab-field"><span>Estrelas</span>
          <select data-f="estrelas">
            <option value="5">★★★★★ 5</option><option value="4">★★★★ 4</option><option value="3">★★★ 3</option>
            <option value="2">★★ 2</option><option value="1">★ 1</option>
          </select>
        </label>
        <label class="ab-field tm-adm__full"><span>Testemunho *</span><textarea rows="5" maxlength="1500" data-f="texto"></textarea></label>
        <div class="ab-field tm-adm__full">
          <span>Foto <small>(opcional)</small></span>
          <div class="tm-adm__photo">
            <span class="tm-adm__avatar" data-tm-form-avatar></span>
            <label class="btn btn--outline btn--sm"><i class="fa-solid fa-camera"></i> Escolher foto
              <input type="file" accept="image/*" class="visually-hidden" data-tm-file /></label>
            <button type="button" class="btn-link-danger" data-tm-photo-clear hidden>Remover foto</button>
          </div>
        </div>
      </div>
      <div class="content-actions">
        <button type="submit" class="btn btn--primary" data-tm-save>Guardar e publicar <i class="fa-solid fa-check"></i></button>
        <button type="button" class="btn btn--outline" data-tm-cancel>Cancelar</button>
      </div>
    </form>

    <div class="tm-adm__filters" role="tablist">
      ${Object.entries(STATUS)
        .map(
          ([k, s]) =>
            `<button type="button" class="tm-adm__filter${k === "pendente" ? " is-active" : ""}" data-tm-filter="${k}">${s.label} <em data-tm-count="${k}">0</em></button>`,
        )
        .join("")}
    </div>
    <ul class="tm-adm__list" data-tm-list><li class="tm-adm__empty">A carregar…</li></ul>`;

  const $ = (sel) => pane.querySelector(sel);
  const form = $("[data-tm-form]");
  const list = $("[data-tm-list]");

  /* ─────────────────────────────────────────
     ESTADO
     ───────────────────────────────────────── */
  let items = [];
  let programs = [];
  let filter = "pendente";
  let editing = null; // id em edição (null = novo)
  let formFoto = "";

  /* ─────────────────────────────────────────
     LISTA
     ───────────────────────────────────────── */
  function render() {
    const counts = { pendente: 0, aprovado: 0, recusado: 0 };
    items.forEach((t) => (counts[t.status in counts ? t.status : "pendente"] += 1));
    Object.entries(counts).forEach(([k, n]) => ($(`[data-tm-count="${k}"]`).textContent = n));
    const badge = tab.querySelector("[data-tm-badge]");
    badge.textContent = counts.pendente;
    badge.hidden = !counts.pendente;

    const rows = sortTestimonials(items.filter((t) => (t.status in counts ? t.status : "pendente") === filter));
    if (filter === "pendente") rows.sort((a, b) => (toDate(b.criadoEm) || 0) - (toDate(a.criadoEm) || 0));

    list.innerHTML =
      rows
        .map((t) => {
          const n = Math.max(1, Math.min(5, parseInt(t.estrelas, 10) || 5));
          const acts = [];
          if (canEdit) {
            if (t.status !== "aprovado") acts.push(`<button type="button" class="tm-adm__act tm-adm__act--ok" data-act="aprovar"><i class="fa-solid fa-check"></i> Aprovar</button>`);
            if (t.status === "aprovado")
              acts.push(
                `<button type="button" class="tm-adm__act${t.destaque ? " is-on" : ""}" data-act="destaque" title="Os destacados aparecem primeiro no início do site"><i class="fa-${t.destaque ? "solid" : "regular"} fa-star"></i> ${t.destaque ? "Destacado" : "Destacar"}</button>`,
                `<button type="button" class="tm-adm__act" data-act="pendente"><i class="fa-regular fa-eye-slash"></i> Retirar do site</button>`,
              );
            if (t.status === "pendente") acts.push(`<button type="button" class="tm-adm__act tm-adm__act--no" data-act="recusar"><i class="fa-solid fa-xmark"></i> Recusar</button>`);
            acts.push(
              `<button type="button" class="tm-adm__act" data-act="editar"><i class="fa-solid fa-pen"></i> Editar</button>`,
              `<button type="button" class="tm-adm__act tm-adm__act--no" data-act="apagar" title="Apagar"><i class="fa-regular fa-trash-can"></i></button>`,
            );
          }
          return `
          <li class="tm-adm__item" data-id="${esc(t.id)}">
            ${t.foto ? `<img class="tm-adm__avatar" src="${esc(t.foto)}" alt="" />` : `<span class="tm-adm__avatar">${esc(initials(t.nome))}</span>`}
            <div class="tm-adm__body">
              <div class="tm-adm__head">
                <strong>${esc(t.nome)}</strong>
                ${t.local ? `<span>${esc(t.local)}</span>` : ""}
                <span class="tm-adm__stars" title="${n} de 5">${"★".repeat(n)}<i>${"★".repeat(5 - n)}</i></span>
                ${t.destaque && t.status === "aprovado" ? '<span class="tm-adm__tag">Destaque</span>' : ""}
              </div>
              <div class="tm-adm__meta">
                ${t.programaNome ? `<i class="fa-solid fa-location-dot"></i> ${esc(t.programaNome)} · ` : ""}
                ${fmtDate(t.criadoEm)}${t.origem === "painel" ? " · adicionado no painel" : " · enviado pelo site"}
              </div>
              <p class="tm-adm__text">${esc(t.texto)}</p>
              ${acts.length ? `<div class="tm-adm__acts">${acts.join("")}</div>` : ""}
            </div>
          </li>`;
        })
        .join("") ||
      `<li class="tm-adm__empty">${
        filter === "pendente" ? "Não há testemunhos à espera de aprovação." : `Sem testemunhos ${STATUS[filter].label.toLowerCase()}.`
      }</li>`;
  }

  pane.querySelectorAll("[data-tm-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.tmFilter;
      pane.querySelectorAll("[data-tm-filter]").forEach((x) => x.classList.toggle("is-active", x === b));
      render();
    }),
  );

  /* ─────────────────────────────────────────
     FIRESTORE
     ───────────────────────────────────────── */
  onSnapshot(
    collection(db, "testimonials"),
    (snap) => {
      items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("[testemunhos]", err);
      list.innerHTML = `<li class="tm-adm__empty">Não foi possível carregar os testemunhos${err?.code === "permission-denied" ? " (falta atualizar as regras do Firestore)" : ""}.</li>`;
    },
  );

  onSnapshot(collection(db, "programs"), (snap) => {
    programs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.nome)
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt"));
    fillProgramSelect();
  });

  function fillProgramSelect(value) {
    const sel = form.querySelector('[data-f="programa"]');
    const cur = value ?? sel.value;
    sel.innerHTML =
      '<option value="">— Nenhuma —</option>' +
      programs.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join("") +
      '<option value="__outro">Viagem personalizada</option>';
    sel.value = cur;
  }

  /* ─────────────────────────────────────────
     AÇÕES
     ───────────────────────────────────────── */
  const save = async (id, data, msg) => {
    try {
      await updateDoc(doc(db, "testimonials", id), data);
      if (msg) toast(msg);
    } catch (err) {
      console.error("[testemunhos]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para alterar testemunhos." : err?.message || "Erro ao guardar.", "error");
    }
  };

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest("[data-id]").dataset.id;
    const t = items.find((x) => x.id === id);
    if (!t) return;
    switch (btn.dataset.act) {
      case "aprovar":
        return save(id, { status: "aprovado", aprovadoEm: serverTimestamp() }, "Testemunho publicado no site.");
      case "recusar":
        return save(id, { status: "recusado", destaque: false }, "Testemunho recusado.");
      case "pendente":
        return save(id, { status: "pendente", destaque: false }, "Testemunho retirado do site.");
      case "destaque":
        return save(id, { destaque: !t.destaque }, t.destaque ? "Destaque retirado." : "Testemunho destacado no início do site.");
      case "editar":
        return openForm(t);
      case "apagar":
        if (!confirm(`Apagar o testemunho de ${t.nome}? Não é possível desfazer.`)) return;
        try {
          await deleteDoc(doc(db, "testimonials", id));
          toast("Testemunho apagado.");
        } catch (err) {
          toast(err?.message || "Erro ao apagar.", "error");
        }
    }
  });

  /* ─────────────────────────────────────────
     FORMULÁRIO (novo / editar)
     ───────────────────────────────────────── */
  const f = (k) => form.querySelector(`[data-f="${k}"]`);

  function setFormFoto(data, nome = "") {
    formFoto = data || "";
    const box = $("[data-tm-form-avatar]");
    box.innerHTML = formFoto ? `<img src="${esc(formFoto)}" alt="" />` : esc(initials(nome || f("nome").value || "?"));
    $("[data-tm-photo-clear]").hidden = !formFoto;
  }

  function openForm(t = null) {
    editing = t?.id || null;
    $("[data-tm-form-title]").textContent = t ? `Editar testemunho de ${t.nome}` : "Novo testemunho";
    $("[data-tm-save]").innerHTML = t
      ? 'Guardar alterações <i class="fa-solid fa-check"></i>'
      : 'Guardar e publicar <i class="fa-solid fa-check"></i>';
    f("nome").value = t?.nome || "";
    f("local").value = t?.local || "";
    f("texto").value = t?.texto || "";
    f("estrelas").value = String(t?.estrelas || 5);
    fillProgramSelect(t ? t.programaId || (t.programaNome ? "__outro" : "") : "");
    setFormFoto(t?.foto || "", t?.nome);
    form.hidden = false;
    form.scrollIntoView({ block: "start", behavior: "smooth" });
    f("nome").focus({ preventScroll: true });
  }

  $("[data-tm-new]")?.addEventListener("click", () => openForm(null));
  $("[data-tm-cancel]").addEventListener("click", () => {
    form.hidden = true;
    editing = null;
  });
  f("nome").addEventListener("input", () => !formFoto && setFormFoto(""));
  $("[data-tm-photo-clear]").addEventListener("click", () => setFormFoto(""));
  $("[data-tm-file]").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setFormFoto(await avatarFromFile(file));
    } catch (err) {
      toast(err.message || "Não foi possível usar esta imagem.", "error");
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = f("nome").value.trim();
    const texto = f("texto").value.trim();
    f("nome").classList.toggle("is-invalid", !nome);
    f("texto").classList.toggle("is-invalid", !texto);
    if (!nome || !texto) {
      toast("Indique o nome e o testemunho.", "error");
      return;
    }
    const prog = f("programa").value;
    const data = {
      nome,
      local: f("local").value.trim(),
      programaId: prog && prog !== "__outro" ? prog : "",
      programaNome:
        prog === "__outro" ? "Viagem personalizada" : prog ? programs.find((p) => p.id === prog)?.nome || "" : "",
      estrelas: parseInt(f("estrelas").value, 10) || 5,
      texto,
      foto: formFoto,
    };
    const btn = $("[data-tm-save]");
    btn.disabled = true;
    try {
      if (editing) {
        await updateDoc(doc(db, "testimonials", editing), data);
        toast("Testemunho atualizado.");
      } else {
        await addDoc(collection(db, "testimonials"), {
          ...data,
          status: "aprovado",
          destaque: false,
          origem: "painel",
          criadoEm: serverTimestamp(),
          aprovadoEm: serverTimestamp(),
        });
        toast("Testemunho publicado no site.");
        filter = "aprovado";
        pane.querySelectorAll("[data-tm-filter]").forEach((x) => x.classList.toggle("is-active", x.dataset.tmFilter === filter));
        render();
      }
      form.hidden = true;
      editing = null;
    } catch (err) {
      console.error("[testemunhos]", err);
      toast(err?.code === "permission-denied" ? "Sem permissão para guardar testemunhos." : err?.message || "Erro ao guardar.", "error");
    } finally {
      btn.disabled = false;
    }
  });
}

/* ─────────────────────────────────────────
   ARRANQUE AUTOMÁTICO (sem mexer no admin.js)
   ───────────────────────────────────────── */
const EDIT_ROLES = ["Super Admin", "Gestor de Conteúdo"];

async function autoStart() {
  try {
    const [{ auth, db }, { onAuthStateChanged }, { getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      let canEdit = false;
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        const a = snap.exists() ? snap.data() : {};
        canEdit = a.ativo !== false && EDIT_ROLES.includes(a.role);
      } catch (err) {
        console.warn("[testemunhos] Não foi possível ler o nível de acesso:", err);
      }
      const tryInit = (n = 0) => {
        if (document.querySelector("#conteudo .content-tabs")) initTestimonialsAdmin({ db, canEdit });
        else if (n < 50) setTimeout(() => tryInit(n + 1), 200);
      };
      tryInit();
    });
  } catch (err) {
    console.error("[testemunhos] Erro ao arrancar:", err);
  }
}

if (document.querySelector(".admin-page")) autoStart();
