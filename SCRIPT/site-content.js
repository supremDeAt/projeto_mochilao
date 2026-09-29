import {
  doc,
  onSnapshot,
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

onSnapshot(
  doc(db, "siteConfig", "hero"),
  (snapshot) => {
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
  },
  (error) => {
    console.warn("Não foi possível carregar o conteúdo da Home.", error);
  },
);
