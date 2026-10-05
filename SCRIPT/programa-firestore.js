import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value !== undefined && value !== null && String(value).trim()) {
    element.textContent = value;
  }
}

function setHtml(selector, value) {
  const element = document.querySelector(selector);
  if (element && value !== undefined && value !== null && String(value).trim()) {
    element.innerHTML = value;
  }
}

function renderProgram(program) {
  document.title = `${program.nome || "Programa"} — O Mochilão Aventuras`;
  setText(".pkg-hero__title", program.nome);
  setText(".pkg-hero__desc", program.slogan);
  setHtml(".pkg-descricao", program.descricao);
  setHtml(".pkg-descricao-cta", program.descricao);
  setText(".pkg-detail--dur .pkg-detail__value", program.duracao);
  setText(".pkg-detail--preco .pkg-detail__value", program.preco);
  setText(".pkg-detail--partida .pkg-detail__value", program.partida || "Luanda");

  const hero = document.querySelector(".pkg-hero");
  if (hero && program.imagemURL) {
    hero.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%), url("${program.imagemURL}")`;
  }

  const imageBox = document.querySelector(".pkg-img-box");
  if (imageBox && program.imagemURL) {
    imageBox.innerHTML = `<img src="${program.imagemURL}" alt="${program.nome || "Programa"}" class="pkg-img-box__img">`;
  }
}

const id = new URLSearchParams(window.location.search).get("d");
if (id) {
  getDoc(doc(db, "programs", id))
    .then((snapshot) => {
      if (snapshot.exists()) renderProgram({ id: snapshot.id, ...snapshot.data() });
    })
    .catch((error) => console.warn("Não foi possível carregar o programa do Firestore.", error));
}
