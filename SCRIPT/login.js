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

function getAuthErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Email ou senha inválidos. Confirme o email usado no Firebase Authentication.",
    "auth/invalid-login-credentials": "Email ou senha inválidos. Confirme o email usado no Firebase Authentication.",
    "auth/user-not-found": "Não existe uma conta Firebase com este email.",
    "auth/wrong-password": "A senha está incorreta. Use a senha mais recente definida no Firebase.",
    "auth/invalid-email": "O formato do email não é válido.",
    "auth/user-disabled": "Esta conta foi desativada no Firebase Authentication.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Não foi possível contactar o Firebase. Verifique a ligação à internet.",
  };

  return messages[error?.code] || "Não foi possível iniciar sessão. Consulte o console para mais detalhes.";
}

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
        alert(getAuthErrorMessage(error));
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

      let adminSnapshot;
      try {
        adminSnapshot = await getDoc(doc(db, "admins", user.uid));
      } catch (error) {
        console.error("Login aceito, mas não foi possível consultar o perfil admin:", error);
        await signOut(auth);
        throw new Error("ADMIN_PROFILE_READ_FAILED");
      }

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
      const message =
        error.message === "ADMIN_PROFILE_NOT_FOUND"
          ? "Acesso negado. Esta conta não está autorizada para o painel."
          : error.message === "ADMIN_PROFILE_READ_FAILED"
            ? "A senha está correta, mas não foi possível validar o perfil administrativo. Verifique as regras do Firestore."
            : getAuthErrorMessage(error);
      alert(
        message,
      );
    }
  });
});
