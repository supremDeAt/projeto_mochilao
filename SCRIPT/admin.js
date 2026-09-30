import {
  deleteApp,
  initializeApp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";
import { app, auth, db, storage } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", function () {
  let currentUser = null;
  let currentUserRole = "Visualizador";

  let programsList = [];
  let messagesList = [];
  let reservationsList = [];
  let adminsList = [];
  let siteConfig = {};

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

    const addAdminBtn = document.getElementById("addAdminBtn");
    if (addAdminBtn)
      addAdminBtn.style.display = perms.canEditAdmins ? "inline-block" : "none";

    const saveContentBtn = document.getElementById("saveContentBtn");
    if (saveContentBtn)
      saveContentBtn.style.display = perms.canEditContent
        ? "inline-block"
        : "none";

    document
      .querySelectorAll("#contentForm input, #contentForm textarea")
      .forEach((el) => (el.disabled = !perms.canEditContent));

    renderPrograms();
    renderAdmins();
    renderMessages();
    renderReservations();
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

          currentUserRole = adminDoc.data().role || "Visualizador";
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

  function openModal(title, htmlContent) {
    modalTitle.textContent = title;
    modalBody.innerHTML = htmlContent;
    globalModal.hidden = false;
  }

  function closeModal() {
    globalModal.hidden = true;
    modalBody.innerHTML = "";
  }

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (globalModal)
    globalModal.addEventListener("click", (e) => {
      if (e.target === globalModal) closeModal();
    });

  // --- VIEW FULL MESSAGE ---
  window.viewMessage = async function (id) {
    const msg = messagesList.find((m) => m.id === id);
    if (!msg) return;

    // Se estiver pendente, muda automaticamente para "Lida/Respondida" ao abrir
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];
    if (perms.canManageReservations && msg.status === "Pendente") {
      updateDoc(doc(db, "messages", id), {
        status: "Respondido",
        lido: true,
      }).catch(console.error);
    }

    const dataStr = msg.data
      ? msg.data.toDate
        ? msg.data.toDate().toLocaleDateString("pt-PT")
        : msg.data
      : "–";
    const wppHref = msg.telefone
      ? `https://wa.me/${msg.telefone.replace(/\D/g, "")}`
      : "";

    const html = `
      <div style="display:flex; flex-direction:column; gap:0.8rem;">
        <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Cliente</strong><br>${msg.nome || "–"}</div>
        <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Data e Contacto</strong><br>${dataStr} &bull; ${msg.email || "–"} ${msg.telefone ? `&bull; ${msg.telefone}` : ""}</div>
        <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Assunto</strong><br>${msg.assunto || "–"}</div>
        <div style="background:#faf8f4; padding:1.2rem; border-radius:12px; margin-top:0.5rem; font-size:0.95rem;">${msg.mensagem || "Sem conteúdo."}</div>
        <div style="display:flex; gap:1rem; margin-top:1rem;">
          <a href="mailto:${msg.email}" class="btn btn--outline"><i class="fa-solid fa-envelope"></i> Responder via Email</a>
          ${wppHref ? `<a href="${wppHref}" target="_blank" class="btn btn--primary" style="background:#25d366"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}
        </div>
      </div>
    `;
    openModal("Detalhes da Mensagem", html);
  };

  // --- VIEW RESERVATION & NOTES ---
  window.viewReservation = function (id) {
    const res = reservationsList.find((r) => r.id === id);
    if (!res) return;

    const dataStr = res.data
      ? res.data.toDate
        ? res.data.toDate().toLocaleDateString("pt-PT")
        : res.data
      : "–";
    const wppHref = res.telefone
      ? `https://wa.me/${res.telefone.replace(/\D/g, "")}`
      : "";
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    const html = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
          <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Cliente</strong><br>${res.nome || "–"}</div>
          <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Telefone</strong><br>${res.telefone || "–"}</div>
          <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Destino</strong><br>${res.destino || "–"}</div>
          <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Data Desejada</strong><br>${dataStr}</div>
          <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Pessoas</strong><br>${res.pessoas || "–"}</div>
          <div><strong style="color:var(--clr-text-muted); font-size:0.75rem; text-transform:uppercase;">Status</strong><br>${res.status || "Pendente"}</div>
        </div>
        
        <div class="field" style="margin-top:1rem;">
          <label>Notas Internas (Admin)</label>
          <textarea id="modalNotesInput" placeholder="Ex: Cliente quer guia em inglês...">${res.notas || ""}</textarea>
        </div>
        
        <div style="display:flex; gap:1rem; margin-top:0.5rem;">
          ${perms.canManageReservations ? `<button id="saveNotesBtn" class="btn btn--primary">Guardar Notas</button>` : ""}
          ${wppHref ? `<a href="${wppHref}" target="_blank" class="btn btn--outline" style="color:#25d366; border-color:#25d366;"><i class="fa-brands fa-whatsapp"></i> Falar com Cliente</a>` : ""}
        </div>
      </div>
    `;

    openModal("Detalhes da Reserva", html);

    // Adicionar evento ao botão de salvar notas no modal
    if (perms.canManageReservations) {
      setTimeout(() => {
        const btn = document.getElementById("saveNotesBtn");
        if (btn) {
          btn.addEventListener("click", async () => {
            const notas = document.getElementById("modalNotesInput").value;
            btn.innerHTML = "A guardar...";
            btn.disabled = true;
            try {
              await updateDoc(doc(db, "reservations", id), { notas: notas });
              btn.innerHTML = 'Guardado <i class="fa-solid fa-check"></i>';
              setTimeout(closeModal, 800);
            } catch (err) {
              console.error(err);
              btn.innerHTML = "Erro!";
            }
          });
        }
      }, 50); // espera o modal renderizar o HTML interno
    }
  };

  // --- RENDER FUNCTIONS ---
  function renderStats() {
    const cards = document.querySelectorAll("[data-stat]");
    const totals = {
      messages: messagesList.length,
      reservations: reservationsList.length,
      programs: programsList.length,
      admins: adminsList.length,
    };
    cards.forEach((card) => {
      const key = card.dataset.stat;
      card.querySelector(".stat-card__value").textContent = totals[key] ?? 0;
    });

    const pendingMsgs = messagesList.filter(
      (m) => m.status === "Pendente",
    ).length;
    const subMsg = document.getElementById("dashMsgPending");
    if (subMsg)
      subMsg.textContent = `${pendingMsgs} pendente${pendingMsgs !== 1 ? "s" : ""}`;

    const confirmedRes = reservationsList.filter(
      (r) => r.status === "Confirmada",
    ).length;
    const subRes = document.getElementById("dashResConfirmed");
    if (subRes)
      subRes.textContent = `${confirmedRes} confirmada${confirmedRes !== 1 ? "s" : ""}`;

    const cats = [
      ...new Set(programsList.map((p) => p.categoria).filter(Boolean)),
    ].length;
    const subProg = document.getElementById("dashProgCats");
    if (subProg)
      subProg.textContent = `${cats} categoria${cats !== 1 ? "s" : ""}`;

    const subAdmin = document.getElementById("dashAdminRole");
    if (subAdmin) subAdmin.textContent = currentUserRole || "–";

    renderAlerts();
    renderRecentActivity();
  }

  function renderAlerts() {
    const alertsList = document.getElementById("dashAlertsList");
    if (!alertsList) return;

    const alerts = [];
    const pendingMsgs = messagesList.filter(
      (m) => m.status === "Pendente",
    ).length;
    if (pendingMsgs > 0) {
      alerts.push({
        icon: "fa-envelope",
        danger: false,
        title: `${pendingMsgs} mensagem${pendingMsgs > 1 ? "s" : ""} por responder`,
        desc: "Clientes à espera de resposta.",
      });
    }

    const pendingRes = reservationsList.filter(
      (r) => r.status === "Pendente",
    ).length;
    if (pendingRes > 0) {
      alerts.push({
        icon: "fa-calendar-xmark",
        danger: true,
        title: `${pendingRes} reserva${pendingRes > 1 ? "s" : ""} por analisar`,
        desc: "Ainda não foram analisadas na secção de Reservas.",
      });
    }

    if (programsList.length === 0) {
      alerts.push({
        icon: "fa-map-location-dot",
        danger: true,
        title: "Nenhum programa cadastrado",
        desc: "Adiciona programas para que apareçam no site.",
      });
    }

    if (alerts.length === 0) {
      alertsList.innerHTML = `<li class="alerts-list__empty"><i class="fa-solid fa-circle-check"></i> Tudo em ordem! Sem alertas de momento.</li>`;
      return;
    }

    alertsList.innerHTML = alerts
      .map(
        (a) => `
      <li class="alert-item${a.danger ? " alert-item--danger" : ""}">
        <i class="fa-solid ${a.icon}"></i>
        <div><strong>${a.title}</strong>${a.desc}</div>
      </li>
    `,
      )
      .join("");
  }

  function renderRecentActivity() {
    const recentList = document.getElementById("dashRecentList");
    if (!recentList) return;

    const statusDot = {
      Confirmada: "--green",
      Cancelada: "--red",
      "Em análise": "--blue",
      Respondido: "--green",
      Arquivado: "--blue",
      Pendente: "",
    };
    const entries = [];

    [...messagesList]
      .slice(-4)
      .reverse()
      .forEach((m) => {
        entries.push({
          dot: statusDot[m.status] || "",
          title: m.nome || "Cliente",
          desc: m.assunto || "Nova mensagem",
          badge: m.status || "Pendente",
          badgeMod: statusDot[m.status] || "",
        });
      });

    [...reservationsList]
      .slice(-4)
      .reverse()
      .forEach((r) => {
        entries.push({
          dot: statusDot[r.status] || "",
          title: r.nome || "Cliente",
          desc: `Reserva → ${r.destino || "destino"}`,
          badge: r.status || "Pendente",
          badgeMod: statusDot[r.status] || "",
        });
      });

    if (entries.length === 0) {
      recentList.innerHTML = `<li class="recent-list__empty">Sem atividade recente.</li>`;
      return;
    }

    recentList.innerHTML = entries
      .slice(0, 6)
      .map(
        (e) => `
      <li class="recent-item">
        <div class="recent-item__dot recent-item__dot${e.dot}"></div>
        <div class="recent-item__body">
          <div class="recent-item__title">${e.title}</div>
          <div class="recent-item__desc">${e.desc}</div>
        </div>
        <span class="recent-item__badge recent-item__badge${e.badgeMod}">${e.badge}</span>
      </li>
    `,
      )
      .join("");
  }

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

  function renderMessages() {
    const list = document.getElementById("messagesList");
    if (!list) return;
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    if (!messagesList.length) {
      list.innerHTML = `<tr><td colspan="5" class="admin-empty-state">A caixa de entrada está limpa. Sem mensagens de clientes.</td></tr>`;
      return;
    }

    list.innerHTML = messagesList
      .map((msg) => {
        const statusClass = (msg.status || "")
          .toLowerCase()
          .replace(/\s+/g, "-");
        const dataStr = msg.data
          ? msg.data.toDate
            ? msg.data.toDate().toLocaleDateString("pt-PT")
            : msg.data
          : "–";

        return `
        <tr>
          <td><strong>${msg.nome || "–"}</strong></td>
          <td>
            <div style="font-size:0.85rem;">${msg.email || "–"}</div>
            <div style="font-size:0.78rem; color: var(--clr-text-muted);">${msg.telefone || ""}</div>
          </td>
          <td style="white-space:nowrap;">${dataStr}</td>
          <td><span class="status-badge status-badge--${statusClass}">${msg.status || "Pendente"}</span></td>
          <td style="white-space:nowrap; display:flex; gap:0.4rem;">
            <button class="table-action table-action--primary" onclick="viewMessage('${msg.id}')" title="Ler Mensagem">
              <i class="fa-solid fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");
  }

  function renderReservations() {
    const list = document.getElementById("reservationsList");
    if (!list) return;
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    if (!reservationsList.length) {
      list.innerHTML = `<tr><td colspan="7" class="admin-empty-state">Ainda sem reservas registadas.</td></tr>`;
      return;
    }

    list.innerHTML = reservationsList
      .map((res) => {
        const statusClass = (res.status || "")
          .toLowerCase()
          .replace(/\s+/g, "-");
        const dataStr = res.data
          ? res.data.toDate
            ? res.data.toDate().toLocaleDateString("pt-PT")
            : res.data
          : "–";

        let statusCell;
        if (perms.canManageReservations) {
          statusCell = `
            <select class="status-select" data-id="${res.id}" title="Atualizar status">
              <option value="Pendente"    ${res.status === "Pendente" ? "selected" : ""}>Pendente</option>
              <option value="Em análise"  ${res.status === "Em análise" ? "selected" : ""}>Em análise</option>
              <option value="Confirmada"  ${res.status === "Confirmada" ? "selected" : ""}>Confirmada</option>
              <option value="Cancelada"   ${res.status === "Cancelada" ? "selected" : ""}>Cancelada</option>
            </select>`;
        } else {
          statusCell = `<span class="status-badge status-badge--${statusClass}">${res.status || "Pendente"}</span>`;
        }

        return `
        <tr>
          <td><strong>${res.nome || "–"}</strong></td>
          <td>${res.destino || "–"}</td>
          <td style="white-space:nowrap;">${dataStr}</td>
          <td style="text-align:center;">${res.pessoas || "–"}</td>
          <td>${res.telefone || "–"}</td>
          <td>${statusCell}</td>
          <td>
            <button class="table-action table-action--primary" onclick="viewReservation('${res.id}')" title="Detalhes e Notas">
              <i class="fa-solid fa-file-lines"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    document.querySelectorAll(".status-select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = sel.dataset.id;
        const newStatus = sel.value;
        sel.disabled = true;
        try {
          await updateDoc(doc(db, "reservations", id), { status: newStatus });
        } catch (err) {
          console.error("[admin] Erro:", err);
        } finally {
          sel.disabled = false;
        }
      });
    });
  }

  function renderAdmins() {
    const list = document.getElementById("adminsList");
    if (!list) return;
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    if (!adminsList.length) {
      list.innerHTML = `<tr><td colspan="4" class="admin-empty-state">Nenhum administrador encontrado.</td></tr>`;
      return;
    }

    list.innerHTML = adminsList
      .map(
        (admin) => `
      <tr>
        <td><strong>${admin.nome || ""}</strong></td>
        <td>${admin.email || ""}</td>
        <td>${admin.role || ""}</td>
        <td>
          ${
            perms.canEditAdmins
              ? `<button class="table-action table-action--primary btn-edit-admin" data-id="${admin.id}"><i class="fa-solid fa-pen"></i></button>
                 <button class="table-action table-action--danger btn-delete-admin" data-id="${admin.id}"><i class="fa-solid fa-trash-can"></i></button>`
              : "-"
          }
        </td>
      </tr>
    `,
      )
      .join("");

    document
      .querySelectorAll(".btn-edit-admin")
      .forEach((btn) =>
        btn.addEventListener("click", () => editAdmin(btn.dataset.id)),
      );
    document
      .querySelectorAll(".btn-delete-admin")
      .forEach((btn) =>
        btn.addEventListener("click", () => deleteAdmin(btn.dataset.id)),
      );
  }

  function renderContent() {
    const imagePreview = document.getElementById("heroImagePreview");
    if (
      imagePreview &&
      !document.getElementById("contentHeroImage")?.files.length
    ) {
      imagePreview.src =
        siteConfig.heroImageUrl || "../imagens/fundo_kifuka2.jpeg";
    }
    if (siteConfig.heroTitle) {
      document.getElementById("heroTitlePreview").textContent =
        siteConfig.heroTitle;
      document.getElementById("contentHeroTitle").value = siteConfig.heroTitle;
    }
    if (siteConfig.heroSubtitle) {
      document.getElementById("heroSubtitlePreview").textContent =
        siteConfig.heroSubtitle;
      document.getElementById("contentHeroSubtitle").value =
        siteConfig.heroSubtitle;
    }
    if (siteConfig.featureLabel) {
      document.getElementById("heroLabelPreview").textContent =
        siteConfig.featureLabel;
      document.getElementById("contentHeroLabel").value =
        siteConfig.featureLabel;
    }
  }

  // --- Subscriptions ---
  function subscribeAll() {
    onSnapshot(collection(db, "programs"), (snap) => {
      programsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPrograms();
      renderStats();
    });
    onSnapshot(collection(db, "messages"), (snap) => {
      messagesList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMessages();
      renderStats();
    });
    onSnapshot(collection(db, "reservations"), (snap) => {
      reservationsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderReservations();
      renderStats();
    });
    onSnapshot(collection(db, "admins"), (snap) => {
      adminsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAdmins();
      renderStats();
    });
    onSnapshot(doc(db, "siteConfig", "hero"), (snap) => {
      if (snap.exists()) {
        siteConfig = snap.data();
        renderContent();
      }
    });
  }

  async function uploadProgramImage(file) {
    if (!file) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const imagePath = `programs/${Date.now()}-${safeName}`;
    const imageRef = ref(storage, imagePath);
    await uploadBytes(imageRef, file, { contentType: file.type });
    return { imagemURL: await getDownloadURL(imageRef), imagemPath: imagePath };
  }

  async function uploadHeroImage(file) {
    if (!file) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const imagePath = `site-content/${Date.now()}-${safeName}`;
    const imageRef = ref(storage, imagePath);
    await uploadBytes(imageRef, file, { contentType: file.type });
    return { imagemURL: await getDownloadURL(imageRef), imagemPath: imagePath };
  }

  function withTimeout(promise, milliseconds, message) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
    });

    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timeoutId),
    );
  }

  async function removeProgramImage(imagePath) {
    if (!imagePath) return;
    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      if (error.code !== "storage/object-not-found") throw error;
    }
  }

  async function removeHeroImage(imagePath) {
    if (!imagePath) return;
    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      if (error.code !== "storage/object-not-found") throw error;
    }
  }

  // --- Forms & Actions ---
  function setupForms() {
    // Programs Form Drawer
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
        const originalButtonContent = btn.innerHTML;
        btn.textContent = "A guardar...";
        btn.disabled = true;

        const id = document.getElementById("programId").value;
        const imageFile = document.getElementById("progImage").files[0];
        const existingProgram = programsList.find(
          (program) => program.id === id,
        );
        let uploadedImage = null;

        const data = {
          nome: document.getElementById("progName").value.trim(),
          slogan: document.getElementById("progSlogan").value.trim(),
          preco: document.getElementById("progPrice").value.trim(),
          duracao: document.getElementById("progDuration").value.trim(),
          categoria: document.getElementById("progCategory").value.trim(),
          descricao: document.getElementById("progDesc").value.trim(),
        };

        try {
          if (!id && !imageFile) {
            alert("Selecione uma imagem para criar o programa.");
            btn.innerHTML = 'Salvar <i class="fa-solid fa-check"></i>';
            btn.disabled = false;
            return;
          }

          if (imageFile) {
            uploadedImage = await withTimeout(
              uploadProgramImage(imageFile),
              30000,
              "O envio da imagem demorou demasiado. Verifique a ligação e as regras do Firebase Storage.",
            );
            Object.assign(data, uploadedImage);
          } else if (existingProgram) {
            data.imagemURL = existingProgram.imagemURL || "";
            data.imagemPath = existingProgram.imagemPath || "";
          }

          if (id) {
            await withTimeout(
              updateDoc(doc(db, "programs", id), data),
              15000,
              "A atualização do programa demorou demasiado. Verifique a ligação e as permissões da conta.",
            );
            if (imageFile && existingProgram?.imagemPath)
              await removeProgramImage(existingProgram.imagemPath);
          } else {
            await withTimeout(
              addDoc(collection(db, "programs"), data),
              15000,
              "A criação do programa demorou demasiado. Verifique a ligação e as permissões da conta.",
            );
          }
          programForm.classList.remove("is-open");
        } catch (err) {
          if (uploadedImage?.imagemPath) {
            await removeProgramImage(uploadedImage.imagemPath).catch(() => {});
          }
          console.error(err);
          alert(
            `Erro ao salvar programa: ${err.message || "operação não concluída."}`,
          );
        } finally {
          btn.innerHTML = originalButtonContent;
          btn.disabled = false;
        }
      });
    }

    // Admins
    const addAdminBtn = document.getElementById("addAdminBtn");
    const adminForm = document.getElementById("adminForm");
    const adminsLayout = document.querySelector(".admins-layout");
    const cancelAdminBtn = document.getElementById("cancelAdminBtn");

    if (adminForm && addAdminBtn) {
      addAdminBtn.addEventListener("click", () => {
        adminForm.reset();
        document.getElementById("adminId").value = "";
        document.getElementById("adminFormTitle").textContent = "Novo Admin";
        adminsLayout?.classList.add("is-form-open");
      });

      cancelAdminBtn.addEventListener("click", () => {
        adminsLayout?.classList.remove("is-form-open");
      });

      adminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("saveAdminBtn");
        btn.textContent = "A aguardar...";
        btn.disabled = true;

        const id = document.getElementById("adminId").value;
        const nome = document.getElementById("adminName").value;
        const email = document.getElementById("adminEmail").value;
        const password = document.getElementById("adminPassword").value;
        const role = document.getElementById("adminRole").value;
        const telefone = document.getElementById("adminPhone").value.trim();

        try {
          if (id) {
            await updateDoc(doc(db, "admins", id), {
              nome,
              email,
              role,
              telefone,
            });
          } else {
            if (!password || password.length < 6) {
              alert("Senha é obrigatória para novos admins (min 6 carateres).");
              return;
            }
            const secondaryApp = initializeApp(
              app.options,
              `AdminCreation-${Date.now()}`,
            );
            const secondaryAuth = getAuth(secondaryApp);
            try {
              const userCred = await createUserWithEmailAndPassword(
                secondaryAuth,
                email,
                password,
              );
              await setDoc(doc(db, "admins", userCred.user.uid), {
                email,
                nome,
                role,
                telefone,
                ativo: true,
              });
            } finally {
              await signOut(secondaryAuth).catch(() => {});
              await deleteApp(secondaryApp);
            }
          }
          adminForm.reset();
          document.getElementById("adminId").value = "";
          adminsLayout?.classList.remove("is-form-open");
        } catch (err) {
          console.error(err);
          alert("Erro ao salvar admin: " + err.message);
        } finally {
          btn.textContent = "Salvar";
          btn.disabled = false;
        }
      });
    }

    // Content
    const contentForm = document.getElementById("contentForm");
    if (contentForm) {
      const imageInput = document.getElementById("contentHeroImage");
      const imagePreview = document.getElementById("heroImagePreview");
      let previewObjectUrl = null;

      imageInput.addEventListener("change", () => {
        const file = imageInput.files?.[0];
        if (!file || !imagePreview) return;
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = URL.createObjectURL(file);
        imagePreview.src = previewObjectUrl;
      });

      contentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("saveContentBtn");
        btn.textContent = "A guardar...";
        btn.disabled = true;
        const previousImagePath = siteConfig.heroImagePath;
        let uploadedImagePath = null;
        const data = {
          featureLabel: document.getElementById("contentHeroLabel").value,
          heroTitle: document.getElementById("contentHeroTitle").value,
          heroSubtitle: document.getElementById("contentHeroSubtitle").value,
        };
        try {
          const imageFile = imageInput.files?.[0];
          if (imageFile) {
            const uploadedImage = await uploadHeroImage(imageFile);
            uploadedImagePath = uploadedImage.imagemPath;
            data.heroImageUrl = uploadedImage.imagemURL;
            data.heroImagePath = uploadedImage.imagemPath;
          }
          await setDoc(doc(db, "siteConfig", "hero"), data, { merge: true });
          siteConfig = { ...siteConfig, ...data };
          imageInput.value = "";
          if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
          previewObjectUrl = null;
          renderContent();

          if (
            previousImagePath &&
            uploadedImagePath &&
            previousImagePath !== uploadedImagePath
          ) {
            try {
              await removeHeroImage(previousImagePath);
            } catch (error) {
              console.warn(
                "Não foi possível remover a foto anterior do Hero.",
                error,
              );
            }
          }
        } catch (err) {
          console.error(err);
          if (uploadedImagePath) {
            try {
              await removeHeroImage(uploadedImagePath);
            } catch (cleanupError) {
              console.warn(
                "Não foi possível remover a foto não guardada.",
                cleanupError,
              );
            }
          }
          alert("Erro ao atualizar conteúdo.");
        } finally {
          btn.textContent = "Salvar Alterações no Site";
          btn.disabled = false;
        }
      });
    }
  }

  window.editProgram = function (id) {
    const prog = programsList.find((p) => p.id === id);
    if (!prog) return;
    document.getElementById("programId").value = prog.id;
    document.getElementById("progName").value = prog.nome || "";
    document.getElementById("progSlogan").value = prog.slogan || "";
    document.getElementById("progPrice").value = prog.preco || "";
    document.getElementById("progDuration").value = prog.duracao || "";
    document.getElementById("progCategory").value = prog.categoria || "";
    document.getElementById("progImage").value = ""; // não se carrega o ficheiro
    document.getElementById("progDesc").value = prog.descricao || "";
    document.getElementById("programFormTitle").textContent = "Editar Programa";
    document.getElementById("programForm").classList.add("is-open");
    window.location.hash = "#programas";
  };

  window.deleteProgram = async function (id) {
    if (confirm("Tem certeza que deseja eliminar este destino?")) {
      try {
        const program = programsList.find((item) => item.id === id);
        await deleteDoc(doc(db, "programs", id));
        if (program?.imagemPath) await removeProgramImage(program.imagemPath);
      } catch (err) {
        console.error(err);
      }
    }
  };

  window.editAdmin = function (id) {
    const adm = adminsList.find((a) => a.id === id);
    if (!adm) return;
    document.getElementById("adminId").value = adm.id;
    document.getElementById("adminName").value = adm.nome || "";
    document.getElementById("adminEmail").value = adm.email || "";
    document.getElementById("adminPhone").value = adm.telefone || "";
    document.getElementById("adminRole").value = adm.role || "Visualizador";
    document.getElementById("adminFormTitle").textContent = "Editar Admin";
    document.querySelector(".admins-layout")?.classList.add("is-form-open");
    window.location.hash = "#admins";
  };

  window.deleteAdmin = async function (id) {
    if (currentUser.uid === id) {
      alert("Não podes remover a tua própria conta aqui!");
      return;
    }
    if (confirm("Tem certeza que deseja revogar o acesso a este admin?")) {
      try {
        await deleteDoc(doc(db, "admins", id));
      } catch (err) {
        console.error(err);
      }
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
        const selectedView = link.dataset.view;
        navLinks.forEach((item) =>
          item.classList.toggle("is-active", item === link),
        );
        views.forEach((view) =>
          view.classList.toggle(
            "is-visible",
            view.dataset.view === selectedView,
          ),
        );
        closeAdminMenu();
      });
    });
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
