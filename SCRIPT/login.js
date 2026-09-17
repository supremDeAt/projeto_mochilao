import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");

  if (!loginForm) return;

  onAuthStateChanged(auth, async function (user) {
    if (!user) return;

    try {
      const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
      if (adminSnapshot.exists()) {
        window.location.href = "admin.html";
      } else {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Erro ao validar a conta administrativa:", error);
      await signOut(auth);
    }
  });

  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", async function (event) {
      event.preventDefault();
      const email = document.getElementById("email").value.trim();
      if (!email) {
        alert(
          "Por favor, preencha o seu email no campo acima antes de pedir a recuperação.",
        );
        return;
      }
      try {
        await sendPasswordResetEmail(auth, email);
        alert(
          "Email de recuperação enviado! Verifique a sua caixa de entrada.",
        );
      } catch (error) {
        console.error("Erro na recuperação:", error);
        alert(
          "Ocorreu um erro. Verifique se o email está correto ou se existe uma conta associada.",
        );
      }
    });
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Preencha o email e a senha para continuar.");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;
      const adminSnapshot = await getDoc(doc(db, "admins", user.uid));

      if (!adminSnapshot.exists()) {
        await signOut(auth);
        throw new Error("ADMIN_PROFILE_NOT_FOUND");
      }

      const adminData = adminSnapshot.data();

      localStorage.setItem(
        "omochilao-demo-auth",
        JSON.stringify({
          email: user.email,
          uid: user.uid,
          name: adminData.nome || user.displayName || "Admin",
          role: adminData.role || "Visualizador",
          loggedAt: new Date().toISOString(),
        }),
      );

      window.location.href = "admin.html";
    } catch (error) {
      console.error("Erro no login:", error);
      alert(
        error.message === "ADMIN_PROFILE_NOT_FOUND"
          ? "Acesso negado. Esta conta não está autorizada para o painel."
          : "Email ou senha inválidos. Verifique as credenciais.",
      );
    }
  });
});
