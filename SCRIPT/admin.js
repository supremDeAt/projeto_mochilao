import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
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

  const secondaryApp = initializeApp(app.options, "Secondary");
  const secondaryAuth = getAuth(secondaryApp);

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

  const applyRBAC = () => applyPermissions(currentUserRole);

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

    // Sub-labels contextuais
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
        desc: "Clientes à espera de resposta na secção de Mensagens.",
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
        const mod = statusDot[m.status] || "";
        entries.push({
          dot: mod,
          title: m.nome || "Cliente",
          desc: m.assunto || "Nova mensagem",
          badge: m.status || "Pendente",
          badgeMod: mod,
        });
      });

    [...reservationsList]
      .slice(-4)
      .reverse()
      .forEach((r) => {
        const mod = statusDot[r.status] || "";
        entries.push({
          dot: mod,
          title: r.nome || "Cliente",
          desc: `Reserva → ${r.destino || "destino"}`,
          badge: r.status || "Pendente",
          badgeMod: mod,
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

    list.innerHTML = programsList
      .map(
        (program) => `
      <tr>
        <td>${program.nome || ""}</td>
        <td>${program.categoria || ""}</td>
        <td>${program.duracao || ""}</td>
        <td>${program.preco || ""}</td>
        <td>
          ${
            perms.canEditPrograms
              ? `<button class="table-action table-action--muted btn-edit-program" data-id="${program.id}">Editar</button>
                                     <button class="table-action table-action--danger btn-delete-program" data-id="${program.id}" style="color:var(--danger)">Eliminar</button>`
              : "-"
          }
        </td>
      </tr>
    `,
      )
      .join("");

    document.querySelectorAll(".btn-edit-program").forEach((btn) => {
      btn.addEventListener("click", () => editProgram(btn.dataset.id));
    });
    document.querySelectorAll(".btn-delete-program").forEach((btn) => {
      btn.addEventListener("click", () => deleteProgram(btn.dataset.id));
    });
  }

  function renderMessages() {
    const list = document.getElementById("messagesList");
    if (!list) return;
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    if (!messagesList.length) {
      list.innerHTML = `<tr><td colspan="6" class="admin-empty-state">Sem mensagens de clientes.</td></tr>`;
      return;
    }

    list.innerHTML = messagesList
      .map((msg) => {
        const statusClass = (msg.status || "")
          .toLowerCase()
          .replace(/\s+/g, "-");

        // Próximo status no ciclo: Pendente → Respondido → Arquivado → Pendente
        const statusCycle = {
          Pendente: "Respondido",
          Respondido: "Arquivado",
          Arquivado: "Pendente",
        };
        const nextStatus = statusCycle[msg.status] || "Respondido";

        // Botão de ação de status
        const statusActionLabel =
          msg.status === "Pendente"
            ? '<i class="fa-solid fa-check"></i> Marcar Respondido'
            : msg.status === "Respondido"
              ? '<i class="fa-solid fa-box-archive"></i> Arquivar'
              : '<i class="fa-solid fa-rotate-left"></i> Reabrir';

        const statusBtn = perms.canManageReservations
          ? `<button class="table-action table-action--muted btn-msg-status" data-id="${msg.id}" data-next="${nextStatus}" title="${nextStatus}">${statusActionLabel}</button>`
          : "";

        // Contactar via WhatsApp com o número do cliente (se disponível)
        const wppHref = msg.telefone
          ? `https://wa.me/${msg.telefone.replace(/\D/g, "")}`
          : `https://wa.me/244926509821`;

        const dataStr = msg.data
          ? msg.data.toDate
            ? msg.data.toDate().toLocaleDateString("pt-PT")
            : msg.data
          : "–";

        return `
        <tr>
          <td><strong>${msg.nome || "–"}</strong></td>
          <td>${msg.assunto || "–"}</td>
          <td>
            <div style="font-size:0.85rem;">${msg.email || "–"}</div>
            <div style="font-size:0.78rem; color: var(--clr-text-muted);">${msg.telefone || ""}</div>
          </td>
          <td style="white-space:nowrap;">${dataStr}</td>
          <td><span class="status-badge status-badge--${statusClass}">${msg.status || "Pendente"}</span></td>
          <td style="white-space:nowrap; display:flex; gap:0.4rem; flex-wrap:wrap;">
            ${statusBtn}
            <a href="mailto:${msg.email}" class="table-action table-action--primary" title="Email">
              <i class="fa-solid fa-envelope"></i>
            </a>
            <a href="${wppHref}" target="_blank" class="table-action table-action--success" title="WhatsApp">
              <i class="fa-brands fa-whatsapp"></i>
            </a>
          </td>
        </tr>
      `;
      })
      .join("");

    // Eventos dos botões de mudança de status
    document.querySelectorAll(".btn-msg-status").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = btn.dataset.id;
        const next = btn.dataset.next;
        btn.disabled = true;
        try {
          await updateDoc(doc(db, "messages", id), {
            status: next,
            lido: true,
          });
        } catch (err) {
          console.error("[admin] Erro ao atualizar status da mensagem:", err);
          btn.disabled = false;
        }
      });
    });
  }

  function renderReservations() {
    const list = document.getElementById("reservationsList");
    if (!list) return;
    const perms =
      rolesPermissions[currentUserRole] || rolesPermissions["Visualizador"];

    if (!reservationsList.length) {
      list.innerHTML = `<tr><td colspan="7" class="admin-empty-state">Sem pedidos de reserva.</td></tr>`;
      return;
    }

    list.innerHTML = reservationsList
      .map((res) => {
        const statusClass = (res.status || "")
          .toLowerCase()
          .replace(/\s+/g, "-");

        // Data formatada (suporta Timestamp do Firestore ou string ISO)
        const dataStr = res.data
          ? res.data.toDate
            ? res.data.toDate().toLocaleDateString("pt-PT")
            : res.data
          : "–";

        // Select de status (apenas para quem tem permissão)
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

        // WhatsApp direto para o cliente
        const wppHref = res.telefone
          ? `https://wa.me/${res.telefone.replace(/\D/g, "")}`
          : `https://wa.me/244926509821`;

        // Botão de ação (contactar)
        const actionCell = perms.canManageReservations
          ? `<a href="${wppHref}" target="_blank" class="table-action table-action--success" title="WhatsApp cliente">
               <i class="fa-brands fa-whatsapp"></i>
             </a>`
          : "–";

        return `
        <tr>
          <td><strong>${res.nome || "–"}</strong></td>
          <td>${res.destino || "–"}</td>
          <td style="white-space:nowrap;">${dataStr}</td>
          <td style="text-align:center;">${res.pessoas || "–"}</td>
          <td>${res.telefone || "–"}</td>
          <td>${statusCell}</td>
          <td>${actionCell}</td>
        </tr>
      `;
      })
      .join("");

    // Listener do select de status → updateDoc imediato
    document.querySelectorAll(".status-select").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = sel.dataset.id;
        const newStatus = sel.value;
        sel.disabled = true;
        try {
          await updateDoc(doc(db, "reservations", id), { status: newStatus });
        } catch (err) {
          console.error("[admin] Erro ao atualizar status da reserva:", err);
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
        <td>${admin.nome || ""}</td>
        <td>${admin.email || ""}</td>
        <td>${admin.role || ""}</td>
        <td>
          ${
            perms.canEditAdmins
              ? `<button class="table-action table-action--muted btn-edit-admin" data-id="${admin.id}">Editar</button>
                                   <button class="table-action table-action--danger btn-delete-admin" data-id="${admin.id}" style="color:var(--danger)">Remover</button>`
              : "-"
          }
        </td>
      </tr>
    `,
      )
      .join("");

    document.querySelectorAll(".btn-edit-admin").forEach((btn) => {
      btn.addEventListener("click", () => editAdmin(btn.dataset.id));
    });
    document.querySelectorAll(".btn-delete-admin").forEach((btn) => {
      btn.addEventListener("click", () => deleteAdmin(btn.dataset.id));
    });
  }

  function renderContent() {
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
    const imagePath = `programs/${currentUser.uid}/${Date.now()}-${safeName}`;
    const imageRef = ref(storage, imagePath);

    await uploadBytes(imageRef, file, {
      contentType: file.type,
    });

    return {
      imagemURL: await getDownloadURL(imageRef),
      imagemPath: imagePath,
    };
  }

  async function removeProgramImage(imagePath) {
    if (!imagePath) return;

    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      if (error.code !== "storage/object-not-found") {
        throw error;
      }
    }
  }

  // --- Forms & Actions ---
  function setupForms() {
    // Programs
    const addProgramBtn = document.getElementById("addProgramBtn");
    const programForm = document.getElementById("programForm");
    const cancelProgramBtn = document.getElementById("cancelProgramBtn");

    if (addProgramBtn && programForm) {
      addProgramBtn.addEventListener("click", () => {
        programForm.reset();
        document.getElementById("programId").value = "";
        document.getElementById("programFormTitle").textContent =
          "Novo Programa";
        programForm.style.display = "block";
      });
      cancelProgramBtn.addEventListener("click", () => {
        programForm.style.display = "none";
      });
      programForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("programId").value;
        const imageFile = document.getElementById("progImage").files[0];
        const existingProgram = programsList.find(
          (program) => program.id === id,
        );
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
            return;
          }

          if (imageFile) {
            const uploadedImage = await uploadProgramImage(imageFile);
            Object.assign(data, uploadedImage);
          } else if (existingProgram) {
            data.imagemURL = existingProgram.imagemURL || "";
            data.imagemPath = existingProgram.imagemPath || "";
          }

          if (id) {
            await updateDoc(doc(db, "programs", id), data);
            if (imageFile && existingProgram?.imagemPath) {
              await removeProgramImage(existingProgram.imagemPath);
            }
            alert("Programa atualizado!");
          } else {
            await addDoc(collection(db, "programs"), data);
            alert("Programa criado!");
          }
          programForm.style.display = "none";
        } catch (err) {
          console.error(err);
          alert("Erro ao salvar programa.");
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
        const id = document.getElementById("adminId").value;
        const nome = document.getElementById("adminName").value;
        const email = document.getElementById("adminEmail").value;
        const password = document.getElementById("adminPassword").value;
        const role = document.getElementById("adminRole").value;

        try {
          if (id) {
            await updateDoc(doc(db, "admins", id), { nome, email, role });
            alert("Admin atualizado!");
          } else {
            if (!password || password.length < 6) {
              alert("Senha é obrigatória para novos admins (min 6 carateres).");
              return;
            }
            // Create via secondary app to avoid logging out
            const userCred = await createUserWithEmailAndPassword(
              secondaryAuth,
              email,
              password,
            );
            await setDoc(doc(db, "admins", userCred.user.uid), {
              email,
              nome,
              role,
              ativo: true,
            });
            await secondaryAuth.signOut();
            alert("Admin criado com sucesso!");
          }
          adminForm.reset();
          document.getElementById("adminId").value = "";
          adminsLayout?.classList.remove("is-form-open");
        } catch (err) {
          console.error(err);
          alert("Erro ao salvar admin: " + err.message);
        }
      });
    }

    // Content
    const contentForm = document.getElementById("contentForm");
    if (contentForm) {
      contentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
          featureLabel: document.getElementById("contentHeroLabel").value,
          heroTitle: document.getElementById("contentHeroTitle").value,
          heroSubtitle: document.getElementById("contentHeroSubtitle").value,
        };
        try {
          await setDoc(doc(db, "siteConfig", "hero"), data, { merge: true });
          alert("Conteúdo atualizado!");
        } catch (err) {
          console.error(err);
          alert("Erro ao atualizar conteúdo.");
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
    document.getElementById("progImage").value = prog.imagem || "";
    document.getElementById("progDesc").value = prog.descricao || "";
    document.getElementById("programFormTitle").textContent = "Editar Programa";
    document.getElementById("programForm").style.display = "block";
    window.location.hash = "#programas";
  };

  window.deleteProgram = async function (id) {
    if (confirm("Tem certeza que deseja eliminar este programa?")) {
      try {
        const program = programsList.find((item) => item.id === id);
        await deleteDoc(doc(db, "programs", id));
        if (program?.imagemPath) {
          await removeProgramImage(program.imagemPath);
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao eliminar o programa e a imagem.");
      }
    }
  };

  window.editAdmin = function (id) {
    const adm = adminsList.find((a) => a.id === id);
    if (!adm) return;
    document.getElementById("adminId").value = adm.id;
    document.getElementById("adminName").value = adm.nome || "";
    document.getElementById("adminEmail").value = adm.email || "";
    document.getElementById("adminRole").value = adm.role || "Visualizador";
    document.getElementById("adminFormTitle").textContent = "Editar Admin";
    document.querySelector(".admins-layout")?.classList.add("is-form-open");
    window.location.hash = "#admins";
  };

  window.deleteAdmin = async function (id) {
    if (currentUser.uid === id) {
      alert("Não podes remover a ti próprio!");
      return;
    }
    if (
      confirm(
        "Tem certeza que deseja remover este admin do painel (não apaga a conta Firebase Auth)?",
      )
    ) {
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
