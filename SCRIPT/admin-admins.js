/* =====================================================
   O MOCHILÃO — admin-admins.js  (ES module)
   Ecrã "Administradores": contas com acesso ao painel.

   admins/{uid}: nome, email, telefone, role, ativo,
                 criadoEm, criadoPor, ultimoAcesso
   • Criar conta → Firebase Auth (app secundária, para não
     terminar a sessão de quem está a criar) + documento.
   • Suspender → ativo:false (o login é recusado).
   • Revogar → apaga o documento (a conta Auth deixa de entrar
     no painel; para apagar o email de vez: consola do Firebase).
   ===================================================== */

import {
  initializeApp,
  deleteApp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { esc, slugClass, timeAgo, formatDate, toast, searchable } from "./admin-utils.js";

export const ROLES = [
  {
    value: "Super Admin",
    icon: "fa-crown",
    desc: "Acesso total, incluindo gerir administradores e eliminar registos.",
    can: ["Programas, serviços, equipa e site", "Reservas e mensagens", "Administradores", "Eliminar reservas e mensagens"],
  },
  {
    value: "Gestor de Conteúdo",
    icon: "fa-pen-ruler",
    desc: "Gere o conteúdo do site e acompanha reservas e mensagens.",
    can: ["Programas, serviços, equipa e site", "Reservas e mensagens"],
  },
  {
    value: "Atendente",
    icon: "fa-headset",
    desc: "Responde a clientes e atualiza o estado das reservas.",
    can: ["Reservas e mensagens"],
  },
  {
    value: "Visualizador",
    icon: "fa-eye",
    desc: "Só consulta. Não altera nada.",
    can: [],
  },
];

const AUTH_ERRORS = {
  "auth/email-already-in-use": "Este email já tem uma conta. Use outro email.",
  "auth/invalid-email": "O email não é válido.",
  "auth/weak-password": "A senha é demasiado fraca (mínimo 6 caracteres).",
  "auth/too-many-requests": "Demasiadas tentativas. Aguarde alguns minutos.",
  "auth/user-not-found": "Não existe conta com este email.",
  "permission-denied": "Sem permissão. Só o Super Admin pode gerir administradores.",
};
const errMsg = (err) => AUTH_ERRORS[err?.code] || err?.message || "Operação não concluída.";

function initials(name) {
  return (
    String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("") || "?"
  );
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return [...arr].map((n) => chars[n % chars.length]).join("") + "!";
}

export function initAdminsAdmin({ db, app, auth, getRole, getUser }) {
  const $ = (id) => document.getElementById(id);
  const grid = $("adminsGrid");
  const form = $("adminForm");
  const addBtn = $("addAdminBtn");
  const search = $("adminSearch");
  const rolesGuide = $("rolesGuide");
  if (!grid || !form) return;

  const isSuper = () => getRole() === "Super Admin";
  const me = () => getUser()?.uid;

  let admins = [];
  let query = "";
  let busy = false;

  /* ── Guia dos níveis de acesso ── */
  if (rolesGuide) {
    rolesGuide.innerHTML = ROLES.map(
      (r) => `
      <li class="role-guide">
        <span class="role-guide__icon role-badge--${slugClass(r.value)}"><i class="fa-solid ${r.icon}"></i></span>
        <div>
          <strong>${esc(r.value)}</strong>
          <p>${esc(r.desc)}</p>
        </div>
      </li>`,
    ).join("");
  }

  /* ── Opções de nível no formulário ── */
  $("adminRoleOptions").innerHTML = ROLES.map(
    (r) => `
    <label class="role-option">
      <input type="radio" name="adminRole" value="${esc(r.value)}" />
      <span class="role-option__card">
        <span class="role-option__head"><i class="fa-solid ${r.icon}"></i> ${esc(r.value)}</span>
        <span class="role-option__desc">${esc(r.desc)}</span>
      </span>
    </label>`,
  ).join("");

  /* ─────────────────────────────────────────
     LISTA
     ───────────────────────────────────────── */
  function render() {
    const q = searchable(query).trim();
    const rows = admins
      .filter((a) => !q || searchable(a.nome, a.email, a.role, a.telefone).includes(q))
      .sort((a, b) => {
        if (a.id === me()) return -1;
        if (b.id === me()) return 1;
        const ra = ROLES.findIndex((r) => r.value === a.role);
        const rb = ROLES.findIndex((r) => r.value === b.role);
        return ra - rb || String(a.nome).localeCompare(String(b.nome));
      });

    const count = $("adminsCount");
    if (count) {
      const ativos = admins.filter((a) => a.ativo !== false).length;
      count.textContent = `${admins.length} conta${admins.length !== 1 ? "s" : ""} · ${ativos} ativa${ativos !== 1 ? "s" : ""}`;
    }

    if (!rows.length) {
      grid.innerHTML = `<p class="team-admin__empty">${admins.length ? "Nenhum administrador corresponde à pesquisa." : "A carregar..."}</p>`;
      return;
    }

    grid.innerHTML = rows
      .map((a) => {
        const self = a.id === me();
        const suspended = a.ativo === false;
        const role = ROLES.find((r) => r.value === a.role);
        return `
        <article class="admin-card${suspended ? " is-suspended" : ""}" data-id="${esc(a.id)}">
          <div class="admin-card__top">
            <span class="admin-card__avatar role-badge--${slugClass(a.role)}">${esc(initials(a.nome))}</span>
            <div class="admin-card__id">
              <strong>${esc(a.nome || "Sem nome")} ${self ? `<span class="admin-card__you">Você</span>` : ""}</strong>
              <span>${esc(a.email || "")}</span>
            </div>
          </div>
          <div class="admin-card__tags">
            <span class="role-badge role-badge--${slugClass(a.role)}"><i class="fa-solid ${role?.icon || "fa-user"}"></i> ${esc(a.role || "Visualizador")}</span>
            ${suspended ? `<span class="status-badge status-badge--cancelada">Suspenso</span>` : ""}
          </div>
          <dl class="admin-card__meta">
            <div><dt>Telefone</dt><dd>${esc(a.telefone || "–")}</dd></div>
            <div><dt>Último acesso</dt><dd title="${esc(formatDate(a.ultimoAcesso, true))}">${a.ultimoAcesso ? esc(timeAgo(a.ultimoAcesso)) : "–"}</dd></div>
          </dl>
          ${
            isSuper()
              ? `<div class="team-admin-card__actions admin-card__actions">
                  <button type="button" class="team-admin-card__btn" data-action="edit" title="Editar" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
                  <button type="button" class="team-admin-card__btn" data-action="reset" title="Enviar email para redefinir a senha" aria-label="Redefinir senha"><i class="fa-solid fa-key"></i></button>
                  ${
                    self
                      ? ""
                      : `<button type="button" class="team-admin-card__btn" data-action="toggle" title="${suspended ? "Reativar acesso" : "Suspender acesso"}" aria-label="${suspended ? "Reativar" : "Suspender"}"><i class="fa-solid ${suspended ? "fa-user-check" : "fa-user-slash"}"></i></button>
                         <button type="button" class="team-admin-card__btn team-admin-card__btn--danger" data-action="delete" title="Revogar acesso" aria-label="Revogar acesso"><i class="fa-regular fa-trash-can"></i></button>`
                  }
                </div>`
              : self
                ? `<div class="team-admin-card__actions admin-card__actions">
                    <button type="button" class="team-admin-card__btn" data-action="reset"><i class="fa-solid fa-key"></i>&nbsp; Mudar a minha senha</button>
                  </div>`
                : ""
          }
        </article>`;
      })
      .join("");
  }

  /* ── Dados ──
     Super Admin: lista completa (regra "list").
     Restantes: só o próprio perfil (regra "get"). */
  function subscribe() {
    if (isSuper()) {
      onSnapshot(
        collection(db, "admins"),
        (snap) => {
          admins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          render();
        },
        (err) => {
          console.error("[admins]", err);
          grid.innerHTML = `<p class="team-admin__empty">Não foi possível carregar: ${esc(errMsg(err))}</p>`;
        },
      );
    } else if (me()) {
      onSnapshot(doc(db, "admins", me()), (snap) => {
        admins = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
        render();
      });
    }
  }

  if (addBtn) addBtn.hidden = !isSuper();
  $("adminsReadonly")?.toggleAttribute("hidden", isSuper());
  if (search) search.closest(".search-box").hidden = !isSuper();
  subscribe();

  search?.addEventListener("input", () => {
    query = search.value;
    render();
  });

  /* ─────────────────────────────────────────
     AÇÕES
     ───────────────────────────────────────── */
  const superCount = () => admins.filter((a) => a.role === "Super Admin" && a.ativo !== false).length;

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || busy) return;
    const id = btn.closest(".admin-card")?.dataset.id;
    const a = admins.find((x) => x.id === id);
    if (!a) return;
    const action = btn.dataset.action;

    if (action === "edit") return openForm(a);

    if (action === "reset") {
      if (!a.email) return toast("Esta conta não tem email registado.", "error");
      if (!confirm(`Enviar para ${a.email} um email com o link para definir uma nova senha?`)) return;
      try {
        await sendPasswordResetEmail(auth, a.email);
        toast(`Email enviado para ${a.email}.`);
      } catch (err) {
        console.error("[admins]", err);
        toast(errMsg(err), "error");
      }
      return;
    }

    if (!isSuper() || id === me()) return;

    if (action === "toggle") {
      const suspend = a.ativo !== false;
      if (suspend && a.role === "Super Admin" && superCount() <= 1) {
        return toast("Não pode suspender o único Super Admin ativo.", "error");
      }
      if (suspend && !confirm(`Suspender o acesso de ${a.nome}? Deixa de conseguir entrar no painel até ser reativado.`)) return;
      busy = true;
      try {
        await updateDoc(doc(db, "admins", id), { ativo: !suspend, atualizadoEm: serverTimestamp() });
        toast(suspend ? `${a.nome} foi suspenso.` : `${a.nome} foi reativado.`);
      } catch (err) {
        console.error("[admins]", err);
        toast(errMsg(err), "error");
      } finally {
        busy = false;
      }
      return;
    }

    if (action === "delete") {
      if (a.role === "Super Admin" && superCount() <= 1) {
        return toast("Não pode remover o único Super Admin.", "error");
      }
      if (!confirm(`Revogar o acesso de ${a.nome} (${a.email})?\n\nA pessoa deixa de conseguir entrar no painel. Para reativar será preciso criar a conta de novo com outro email, ou apagar este email na consola do Firebase (Authentication).`)) return;
      busy = true;
      try {
        await deleteDoc(doc(db, "admins", id));
        toast(`Acesso de ${a.nome} revogado.`);
      } catch (err) {
        console.error("[admins]", err);
        toast(errMsg(err), "error");
      } finally {
        busy = false;
      }
    }
  });

  /* ─────────────────────────────────────────
     FORMULÁRIO
     ───────────────────────────────────────── */
  const f = {
    id: $("adminId"),
    title: $("adminFormTitle"),
    nome: $("adminName"),
    email: $("adminEmail"),
    tel: $("adminPhone"),
    pass: $("adminPassword"),
    passField: $("adminPasswordField"),
    passToggle: $("adminPassToggle"),
    passGen: $("adminPassGen"),
    emailHint: $("adminEmailHint"),
    save: $("saveAdminBtn"),
  };

  function setRole(value) {
    const input =
      form.querySelector(`input[name="adminRole"][value="${value}"]`) ||
      form.querySelector('input[name="adminRole"][value="Atendente"]');
    if (input) input.checked = true;
  }

  function openForm(a = null) {
    form.reset();
    f.id.value = a?.id || "";
    f.title.textContent = a ? "Editar administrador" : "Novo administrador";
    f.nome.value = a?.nome || "";
    f.email.value = a?.email || "";
    f.tel.value = a?.telefone || "";
    f.email.readOnly = Boolean(a); // o email é o login: não muda aqui
    f.emailHint.hidden = !a;
    f.passField.hidden = Boolean(a);
    f.pass.type = "password";
    setRole(a?.role || "Atendente");

    // Não deixar o próprio Super Admin baixar o seu nível
    const self = a && a.id === me();
    form.querySelectorAll('input[name="adminRole"]').forEach((r) => (r.disabled = self && r.value !== a.role));
    $("adminSelfHint").hidden = !self;

    form.classList.add("is-open");
    f.nome.focus();
  }
  const closeForm = () => form.classList.remove("is-open");

  addBtn?.addEventListener("click", () => openForm());
  form.querySelectorAll(".drawer-cancel-action").forEach((b) => b.addEventListener("click", closeForm));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && form.classList.contains("is-open")) closeForm();
  });

  f.passToggle?.addEventListener("click", () => {
    const show = f.pass.type === "password";
    f.pass.type = show ? "text" : "password";
    f.passToggle.innerHTML = `<i class="fa-solid ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
  });
  f.passGen?.addEventListener("click", () => {
    f.pass.value = generatePassword();
    f.pass.type = "text";
    f.passToggle.innerHTML = `<i class="fa-solid fa-eye-slash"></i>`;
    navigator.clipboard?.writeText(f.pass.value).then(
      () => toast("Senha gerada e copiada. Envie-a à pessoa por um canal seguro.", "info"),
      () => {},
    );
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isSuper() || busy) return;

    const id = f.id.value;
    const nome = f.nome.value.trim().replace(/\s+/g, " ");
    const email = f.email.value.trim().toLowerCase();
    const telefone = f.tel.value.trim();
    const role = form.querySelector('input[name="adminRole"]:checked')?.value || "Atendente";
    const password = f.pass.value;

    const errors = [];
    if (nome.length < 3) errors.push("Indique o nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Indique um email válido.");
    if (!id && password.length < 6) errors.push("A senha precisa de pelo menos 6 caracteres.");
    if (!id && admins.some((a) => (a.email || "").toLowerCase() === email)) errors.push("Já existe um administrador com este email.");
    const current = admins.find((a) => a.id === id);
    if (current?.role === "Super Admin" && role !== "Super Admin" && superCount() <= 1) {
      errors.push("Tem de existir pelo menos um Super Admin.");
    }
    if (errors.length) return toast(errors.join(" "), "error");

    busy = true;
    const original = f.save.innerHTML;
    f.save.disabled = true;
    f.save.textContent = id ? "A guardar..." : "A criar conta...";

    try {
      if (id) {
        await updateDoc(doc(db, "admins", id), { nome, telefone, role, atualizadoEm: serverTimestamp() });
        toast("Administrador atualizado.");
      } else {
        // App secundária: criar a conta sem terminar a sessão atual
        const secondary = initializeApp(app.options, `AdminCreation-${Date.now()}`);
        const secondaryAuth = getAuth(secondary);
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          await setDoc(doc(db, "admins", cred.user.uid), {
            nome,
            email,
            telefone,
            role,
            ativo: true,
            criadoEm: serverTimestamp(),
            criadoPor: getUser()?.email || "",
          });
        } finally {
          await signOut(secondaryAuth).catch(() => {});
          await deleteApp(secondary).catch(() => {});
        }
        toast(`Conta criada para ${nome}.`);
      }
      closeForm();
    } catch (err) {
      console.error("[admins]", err);
      toast(errMsg(err), "error");
    } finally {
      busy = false;
      f.save.disabled = false;
      f.save.innerHTML = original;
    }
  });
}