import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { app, auth, db } from "./firebase-config.js";
import { initProgramFormUI, populateProgramForm } from "./program-form-ui.js";
import { saveProgram, deleteProgramFully, describeError } from "./program-save.js";
import { loadProgramImages } from "./image-store.js";
import { initTeamAdmin } from "./team-admin.js";
import { initServicesAdmin } from "./services-admin.js";
import { createReservationsView } from "./admin-reservas.js";
import { createMessagesView } from "./admin-mensagens.js";
import { createDashboard } from "./admin-dashboard.js";
import { initContentAdmin } from "./admin-conteudo.js";
import { toast } from "./admin-utils.js";
import { initAdminsAdmin } from "./admin-admins.js";

document.addEventListener("DOMContentLoaded", function () {
  let currentUser = null;
  let currentUserRole = "Visualizador";

  let programsList = [];
  let messagesList = [];
  let reservationsList = [];
  let currentUserName = "";

  const rolesPermissions = {
    "Super Admin": {
      canEditPrograms: true,
      canEditAdmins: true,
      canEditContent: true,
      canManageReservations: true,
    },
    "Gestor de Conteúdo": {
      canEditPrograms: true,
      canEditAdmins: false,
      canEditContent: true,
      canManageReservations: true,
    },
    Atendente: {
      canEditPrograms: false,
      canEditAdmins: false,
      canEditContent: false,
      canManageReservations: true,
    },
    Visualizador: {
      canEditPrograms: false,
      canEditAdmins: false,
      canEditContent: false,
      canManageReservations: false,
    },
  };

  function applyPermissions(role) {
    currentUserRole = role || "Visualizador";
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    const addProgBtn = document.getElementById("addProgramBtn");
    if (addProgBtn)
      addProgBtn.style.display = perms.canEditPrograms
        ? "inline-block"
        : "none";

    renderPrograms();
  }

  async function checkAuth() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (!user) {
          window.location.href = "login.html";
          resolve(null);
          return;
        }

        currentUser = user;

        try {
          const adminDoc = await getDoc(doc(db, "admins", user.uid));
          if (!adminDoc.exists()) {
            await signOut(auth);
            window.location.href = "login.html";
            resolve(null);
            return;
          }

          // Conta suspensa → sem acesso ao painel
          if (adminDoc.data().ativo === false) {
            await signOut(auth);
            alert("A sua conta de administrador está suspensa. Fale com o Super Admin.");
            window.location.href = "login.html";
            resolve(null);
            return;
          }

          currentUserRole = adminDoc.data().role || "Visualizador";
          // Regista o último acesso (precisa da regra de "self update")
          updateDoc(doc(db, "admins", user.uid), {
            ultimoAcesso: serverTimestamp(),
          }).catch(() => {});
          currentUserName = adminDoc.data().nome || user.displayName || "";
          localStorage.setItem(
            "omochilao-demo-auth",
            JSON.stringify({
              uid: user.uid,
              email: user.email,
              name: adminDoc.data().nome || user.displayName || "Admin",
              role: currentUserRole,
            }),
          );
          resolve(user);
        } catch (error) {
          console.error("Erro ao verificar autenticação:", error);
          await signOut(auth);
          window.location.href = "login.html";
          resolve(null);
        }
      });
    });
  }

  // --- MODAL SYSTEM ---
  const globalModal = document.getElementById("globalModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modalClose = document.getElementById("modalClose");
  let modalOnClose = null;

  function openModal(title, htmlContent, { wide = false, onClose = null } = {}) {
    modalTitle.textContent = title;
    modalBody.innerHTML = htmlContent;
    globalModal.querySelector(".modal")?.classList.toggle("modal--wide", wide);
    modalOnClose = onClose;
    if (globalModal.hidden) {
      globalModal.hidden = false;
      modalClose?.focus();
    }
  }

  function closeModal() {
    globalModal.hidden = true;
    modalBody.innerHTML = "";
    const cb = modalOnClose;
    modalOnClose = null;
    cb?.();
  }

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (globalModal)
    globalModal.addEventListener("click", (e) => {
      if (e.target === globalModal) closeModal();
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && globalModal && !globalModal.hidden) closeModal();
  });

  const getPerms = () =>
    rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

  // --- ECRÃS (módulos) ---
  const reservationsView = createReservationsView({
    db,
    getPerms,
    getRole: () => currentUserRole,
    getUser: () => currentUser,
    openModal,
    closeModal,
  });
  const messagesView = createMessagesView({
    db,
    getPerms,
    getRole: () => currentUserRole,
    openModal,
    closeModal,
  });
  const dashboard = createDashboard({
    getUserName: () => currentUserName,
    onOpenReservation: (id) => reservationsView.openDetail(id),
    onOpenMessage: (id) => messagesView.openDetail(id),
    goTo: (view) => showView(view),
  });

  function renderPrograms() {
    const list = document.getElementById("programList");
    if (!list) return;
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    if (!programsList.length) {
      list.innerHTML = `<tr><td colspan="5" class="admin-empty-state">Nenhum programa cadastrado. Adicione o seu primeiro destino!</td></tr>`;
      return;
    }

    list.innerHTML = programsList
      .map(
        (program) => `
      <tr>
        <td><strong>${program.nome || ""}</strong></td>
        <td>${program.categoria || ""}</td>
        <td>${program.duracao || ""}</td>
        <td>${program.preco || ""}</td>
        <td>
          ${
            perms.canEditPrograms
              ? `<button class="table-action table-action--primary btn-edit-program" data-id="${program.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
               <button class="table-action table-action--danger btn-delete-program" data-id="${program.id}" title="Remover"><i class="fa-solid fa-trash-can"></i></button>`
              : "-"
          }
        </td>
      </tr>
    `,
      )
      .join("");

    document
      .querySelectorAll(".btn-edit-program")
      .forEach((btn) =>
        btn.addEventListener("click", () => window.editProgram(btn.dataset.id)),
      );
    document
      .querySelectorAll(".btn-delete-program")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          window.deleteProgram(btn.dataset.id),
        ),
      );
  }

  // --- Subscriptions ---
  function subscribeAll() {
    const onError = (name) => (err) => {
      console.error(`[admin] ${name}:`, err);
      toast(`Não foi possível carregar ${name}.`, "error");
    };
    onSnapshot(
      collection(db, "programs"),
      (snap) => {
        programsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderPrograms();
        dashboard.setPrograms(programsList);
      },
      onError("os programas"),
    );
    onSnapshot(
      collection(db, "messages"),
      (snap) => {
        messagesList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        messagesView.render(messagesList);
        dashboard.setMessages(messagesList);
      },
      onError("as mensagens"),
    );
    onSnapshot(
      collection(db, "reservations"),
      (snap) => {
        reservationsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        reservationsView.render(reservationsList);
        dashboard.setReservations(reservationsList);
      },
      onError("as reservas"),
    );
  }

  // --- Forms & Actions ---
  function setupForms() {
    // ═══════════ PROGRAMAS ═══════════
    initProgramFormUI();
    const addProgramBtn = document.getElementById("addProgramBtn");
    const programForm = document.getElementById("programForm");
    const cancelProgramBtn = document.getElementById("cancelProgramBtn");

    if (addProgramBtn && programForm) {
      addProgramBtn.addEventListener("click", () => {
        programForm.reset();
        document.getElementById("programId").value = "";
        document.getElementById("programFormTitle").textContent =
          "Novo Programa";
        programForm.classList.add("is-open");
      });
      cancelProgramBtn.addEventListener("click", () => {
        programForm.classList.remove("is-open");
      });
      programForm
        .querySelectorAll(".drawer-cancel-action")
        .forEach((button) => {
          button.addEventListener("click", () => {
            programForm.classList.remove("is-open");
          });
        });

      programForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("saveProgramBtn");
        if (btn.disabled) return;
        const originalButtonContent = btn.innerHTML;

        const id = document.getElementById("programId").value;
        const existing = programsList.find((p) => p.id === id) || null;

        btn.disabled = true;
        btn.textContent = "A preparar...";

        try {
          const result = await saveProgram({
            db,
            id,
            existing,
            onStatus: (msg) => (btn.textContent = msg),
          });

          if (!result.ok) {
            alert(
              "Corrija os campos assinalados:\n\n• " + result.errors.join("\n• "),
            );
            return;
          }
          if (result.cleanupFailures) {
            console.warn(
              `[programs] ${result.cleanupFailures} imagem(ns) antiga(s) não apagada(s).`,
            );
          }

          programForm.reset();
          programForm.classList.remove("is-open");
        } catch (err) {
          console.error("[programs] Erro ao salvar:", err.code, err);
          alert("Erro ao salvar programa:\n" + describeError(err));
        } finally {
          btn.innerHTML = originalButtonContent;
          btn.disabled = false;
        }
      });
    }

  }

  window.editProgram = async function (id) {
    const prog = programsList.find((p) => p.id === id);
    if (!prog) return;

    // As fotos da galeria estão na subcoleção "imagens" → carregar primeiro
    document.body.style.cursor = "progress";
    let galeria = [];
    try {
      const imgs = await loadProgramImages(db, prog.id);
      galeria = (prog.galeria || [])
        .map((g) => ({ url: imgs[g.id]?.data, publicId: g.id }))
        .filter((g) => g.url);
    } catch (err) {
      console.error("[programs] Erro ao carregar imagens:", err);
      alert("Não foi possível carregar as fotos da galeria:\n" + describeError(err));
    } finally {
      document.body.style.cursor = "";
    }

    populateProgramForm({ ...prog, galeria }); // campos + listas + roteiro + capa + galeria
    document.getElementById("programFormTitle").textContent = "Editar Programa";
    document.getElementById("programForm").classList.add("is-open");
  };

  window.deleteProgram = async function (id) {
    const program = programsList.find((p) => p.id === id);
    if (!program) return;
    if (
      !confirm(
        `Eliminar "${program.nome}"?\nA capa e todas as fotos da galeria também serão apagadas.`,
      )
    )
      return;

    try {
      const { failed } = await deleteProgramFully({ db, program });
      if (failed) {
        alert(
          `Programa eliminado, mas ${failed} imagem(ns) não foram apagadas. Pode apagá-las na consola do Firestore (programs/${program.id}/imagens).`,
        );
      }
    } catch (err) {
      console.error("[programs] Erro ao eliminar:", err);
      alert("Erro ao eliminar programa:\n" + describeError(err));
    }
  };

  function initialize() {
    const fbStatus = document.getElementById("firebaseStatus");
    if (fbStatus) {
      fbStatus.textContent = "Conectado ao Firebase";
      fbStatus.classList.add("is-ready");
    }

    subscribeAll();
    setupForms();

    // Equipa do Site — quem edita conteúdos pode gerir os cards
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];
    initTeamAdmin({ db, canEdit: perms.canEditContent });
    initServicesAdmin({ db, canEdit: perms.canEditContent });
    initContentAdmin({ db, canEdit: perms.canEditContent });
    initAdminsAdmin({
      db,
      app,
      auth,
      getRole: () => currentUserRole,
      getUser: () => currentUser,
    });

    const navLinks = document.querySelectorAll(".admin-nav__link");
    const views = document.querySelectorAll(".admin-view");
    const adminSidebar = document.querySelector(".admin-sidebar");
    const menuToggle = document.getElementById("adminMenuToggle");

    const closeAdminMenu = () => {
      adminSidebar?.classList.remove("is-menu-open");
      menuToggle?.setAttribute("aria-expanded", "false");
      const icon = menuToggle?.querySelector("i");
      icon?.classList.replace("fa-xmark", "fa-bars");
    };

    menuToggle?.addEventListener("click", () => {
      const isOpen = adminSidebar?.classList.toggle("is-menu-open") ?? false;
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      const icon = menuToggle.querySelector("i");
      icon?.classList.toggle("fa-bars", !isOpen);
      icon?.classList.toggle("fa-xmark", isOpen);
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        showView(link.dataset.view);
        closeAdminMenu();
      });
    });

    // Abrir diretamente um ecrã pelo endereço (ex.: admin.html#reservas)
    const fromHash = window.location.hash.replace("#", "");
    if (fromHash && document.querySelector(`.admin-view[data-view="${fromHash}"]`)) {
      showView(fromHash);
    }
  }

  function showView(selectedView) {
    document.querySelectorAll(".admin-nav__link").forEach((item) =>
      item.classList.toggle("is-active", item.dataset.view === selectedView),
    );
    document.querySelectorAll(".admin-view").forEach((view) =>
      view.classList.toggle("is-visible", view.dataset.view === selectedView),
    );
    history.replaceState(null, "", "#" + selectedView);
    document.querySelector(".admin-main")?.scrollTo?.({ top: 0 });
  }

  checkAuth().then((user) => {
    if (!user) return;
    applyPermissions(currentUserRole);
    initialize();
  });

  const logoutButton = document.getElementById("logoutBtn");
  if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
      try {
        await signOut(auth);
        localStorage.removeItem("omochilao-demo-auth");
        window.location.href = "login.html";
      } catch (error) {
        console.error("Erro ao sair:", error);
      }
    });
  }
});