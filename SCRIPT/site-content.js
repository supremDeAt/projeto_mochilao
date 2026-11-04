import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const contentElements = {
  hero: document.getElementById("hero"),
  featureLabel: document.getElementById("heroBadge"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
};

function setContent(element, value) {
  if (!element || typeof value !== "string" || !value.trim()) return;
  element.textContent = value;
  element.style.whiteSpace = "pre-line";
}

// Leitura única (não fica a "ouvir" o Firestore): gasta menos leituras do plano
getDoc(doc(db, "siteConfig", "hero"))
  .then((snapshot) => {
    if (!snapshot.exists()) return;

    const content = snapshot.data();
    if (
      contentElements.hero &&
      typeof content.heroImageUrl === "string" &&
      content.heroImageUrl.trim()
    ) {
      contentElements.hero.style.setProperty(
        "--hero-image",
        `url("${content.heroImageUrl}")`,
      );
    }
    setContent(contentElements.featureLabel, content.featureLabel);
    setContent(contentElements.heroTitle, content.heroTitle);
    setContent(contentElements.heroSubtitle, content.heroSubtitle);
  })
  .catch((error) => {
    console.warn("Não foi possível carregar o conteúdo da Home.", error);
  });
