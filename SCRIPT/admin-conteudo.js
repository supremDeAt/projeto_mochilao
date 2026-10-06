/* =====================================================
   O MOCHILÃO — admin-conteudo.js  (ES module)
   Ecrã "Site Web": textos e foto do hero, números da
   secção "Sobre" e contactos/redes sociais do site.

   siteConfig/hero      → featureLabel, heroTitle, heroSubtitle, heroImageUrl
   siteConfig/sobre     → contadores { viagens, clientes, satisfacao }
   siteConfig/contactos → telefone, email, whatsapp, instagram, tiktok, facebook
   (os dois últimos são aplicados ao index pelo site-extras.js)
   ===================================================== */

import {
  doc,
  onSnapshot,
  setDoc,
  deleteField,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { compressToDataURL } from "./image-store.js";
import { toast } from "./admin-utils.js";

const DEFAULT_HERO_IMG = "../imagens/fundo_kifuka2.jpeg";
const $ = (id) => document.getElementById(id);

function errorMessage(err) {
  if (err?.code === "permission-denied") return "Sem permissão para alterar o site.";
  if (err?.code?.startsWith("image/")) return err.message;
  return err?.message || "Operação não concluída.";
}

export function initContentAdmin({ db, canEdit = false }) {
  const root = $("conteudo");
  if (!root) return;

  /* ─────────────────────────────────────────
     SEPARADORES
     ───────────────────────────────────────── */
  const tabs = root.querySelectorAll("[data-content-tab]");
  const panes = root.querySelectorAll("[data-content-pane]");
  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      tabs.forEach((x) => {
        x.classList.toggle("is-active", x === t);
        x.setAttribute("aria-selected", String(x === t));
      });
      panes.forEach((p) => (p.hidden = p.dataset.contentPane !== t.dataset.contentTab));
    }),
  );

  // Sem permissão → tudo só de leitura
  if (!canEdit) {
    root.querySelectorAll("input, textarea, select, button[type=submit], .content-reset").forEach((el) => {
      if (!el.matches("[data-content-tab]")) el.disabled = true;
    });
    $("contentReadonly")?.removeAttribute("hidden");
  }

  /* ─────────────────────────────────────────
     1. HERO
     ───────────────────────────────────────── */
  const hero = {
    form: $("contentForm"),
    label: $("contentHeroLabel"),
    title: $("contentHeroTitle"),
    subtitle: $("contentHeroSubtitle"),
    image: $("contentHeroImage"),
    removeImg: $("contentHeroImageReset"),
    save: $("saveContentBtn"),
    dirty: $("heroDirty"),
    pBg: $("heroPreview"),
    pLabel: $("heroLabelPreview"),
    pTitle: $("heroTitlePreview"),
    pSub: $("heroSubtitlePreview"),
  };
  let heroData = {};
  let heroFile = null;
  let heroResetImg = false;
  let heroUrl = null;
  let heroLoaded = false;

  function heroPreview() {
    const img = heroUrl || (heroResetImg ? DEFAULT_HERO_IMG : heroData.heroImageUrl || DEFAULT_HERO_IMG);
    hero.pBg.style.backgroundImage = `linear-gradient(rgba(13,10,6,.25), rgba(13,10,6,.55)), url("${img}")`;
    hero.pLabel.textContent = hero.label.value || "BEM-VINDO AO MOCHILÃO";
    hero.pTitle.innerHTML = (hero.title.value || "Título do hero")
      .split("\n")
      .map((l) => l.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`))
      .join("<br>");
    hero.pSub.textContent = hero.subtitle.value || "";
    root.querySelectorAll("[data-count-for]").forEach((c) => {
      const input = $(c.dataset.countFor);
      if (input) c.textContent = `${input.value.length}/${input.maxLength}`;
    });
    const dirty =
      heroFile ||
      heroResetImg ||
      hero.label.value !== (heroData.featureLabel || "") ||
      hero.title.value !== (heroData.heroTitle || "") ||
      hero.subtitle.value !== (heroData.heroSubtitle || "");
    if (hero.dirty) hero.dirty.hidden = !dirty;
    if (hero.removeImg) hero.removeImg.hidden = !(heroData.heroImageUrl || heroFile) || heroResetImg;
  }

  function heroFill() {
    hero.label.value = heroData.featureLabel || "";
    hero.title.value = heroData.heroTitle || "";
    hero.subtitle.value = heroData.heroSubtitle || "";
    heroFile = null;
    heroResetImg = false;
    if (heroUrl) URL.revokeObjectURL(heroUrl);
    heroUrl = null;
    hero.image.value = "";
    heroPreview();
  }

  onSnapshot(doc(db, "siteConfig", "hero"), (snap) => {
    const isFirst = !heroLoaded;
    heroLoaded = true;
    heroData = snap.exists() ? snap.data() : {};
    // Não apagar o que o admin está a escrever
    if (isFirst || hero.dirty?.hidden !== false) heroFill();
  });

  [hero.label, hero.title, hero.subtitle].forEach((el) => el?.addEventListener("input", heroPreview));

  hero.image?.addEventListener("change", () => {
    const f = hero.image.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast("Escolha um ficheiro de imagem.", "error");
      hero.image.value = "";
      return;
    }
    if (heroUrl) URL.revokeObjectURL(heroUrl);
    heroUrl = URL.createObjectURL(f);
    heroFile = f;
    heroResetImg = false;
    heroPreview();
  });

  hero.removeImg?.addEventListener("click", () => {
    if (heroUrl) URL.revokeObjectURL(heroUrl);
    heroUrl = null;
    heroFile = null;
    hero.image.value = "";
    heroResetImg = true;
    heroPreview();
  });

  root.querySelector("[data-reset='hero']")?.addEventListener("click", heroFill);

  hero.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit || hero.save.disabled) return;
    const original = hero.save.innerHTML;
    hero.save.disabled = true;
    hero.save.textContent = "A guardar...";
    try {
      const data = {
        featureLabel: hero.label.value.trim(),
        heroTitle: hero.title.value.trim(),
        heroSubtitle: hero.subtitle.value.trim(),
        atualizadoEm: serverTimestamp(),
      };
      if (heroFile) {
        hero.save.textContent = "A otimizar a imagem...";
        data.heroImageUrl = await compressToDataURL(heroFile, { maxPx: 1920, maxChars: 800000 });
      } else if (heroResetImg) {
        data.heroImageUrl = deleteField(); // volta à imagem padrão do site
      }
      await setDoc(doc(db, "siteConfig", "hero"), data, { merge: true });
      heroFile = null;
      heroResetImg = false;
      if (heroUrl) URL.revokeObjectURL(heroUrl);
      heroUrl = null;
      hero.image.value = "";
      if (hero.dirty) hero.dirty.hidden = true;
      toast("Hero atualizado no site.");
    } catch (err) {
      console.error("[conteúdo] hero:", err);
      toast("Erro ao guardar: " + errorMessage(err), "error");
    } finally {
      hero.save.disabled = false;
      hero.save.innerHTML = original;
    }
  });

  /* ─────────────────────────────────────────
     2. NÚMEROS ("Sobre")
     ───────────────────────────────────────── */
  const stats = {
    form: $("contentStatsForm"),
    viagens: $("statTrips"),
    clientes: $("statClients"),
    satisfacao: $("statSatisfaction"),
  };
  onSnapshot(doc(db, "siteConfig", "sobre"), (snap) => {
    const c = (snap.exists() && snap.data().contadores) || {};
    if (document.activeElement?.closest("#contentStatsForm")) return;
    stats.viagens.value = c.viagens ?? 120;
    stats.clientes.value = c.clientes ?? 300;
    stats.satisfacao.value = c.satisfacao ?? 98;
  });

  stats.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const n = (el) => Math.max(0, parseInt(el.value, 10) || 0);
    const btn = stats.form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await setDoc(
        doc(db, "siteConfig", "sobre"),
        {
          contadores: {
            viagens: n(stats.viagens),
            clientes: n(stats.clientes),
            satisfacao: Math.min(100, n(stats.satisfacao)),
          },
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );
      toast("Números atualizados no site.");
    } catch (err) {
      console.error("[conteúdo] números:", err);
      toast("Erro ao guardar: " + errorMessage(err), "error");
    } finally {
      btn.disabled = false;
    }
  });

  /* ─────────────────────────────────────────
     3. CONTACTOS E REDES
     ───────────────────────────────────────── */
  const contactFields = ["telefone", "email", "whatsapp", "instagram", "tiktok", "facebook"];
  const contactForm = $("contentContactsForm");
  const cInput = (k) => $(`contact_${k}`);

  onSnapshot(doc(db, "siteConfig", "contactos"), (snap) => {
    if (document.activeElement?.closest("#contentContactsForm")) return;
    const d = snap.exists() ? snap.data() : {};
    contactFields.forEach((k) => {
      if (cInput(k)) cInput(k).value = d[k] || "";
    });
  });

  contactForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const data = {};
    const errors = [];
    contactFields.forEach((k) => (data[k] = (cInput(k)?.value || "").trim()));
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push("Email inválido.");
    ["instagram", "tiktok", "facebook"].forEach((k) => {
      if (data[k] && !/^https?:\/\//i.test(data[k])) errors.push(`O link do ${k} tem de começar por https://`);
    });
    if (data.whatsapp && data.whatsapp.replace(/\D/g, "").length < 9) errors.push("Número de WhatsApp inválido.");
    if (errors.length) return toast(errors.join(" "), "error");

    const btn = contactForm.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await setDoc(doc(db, "siteConfig", "contactos"), { ...data, atualizadoEm: serverTimestamp() }, { merge: true });
      toast("Contactos atualizados no site.");
    } catch (err) {
      console.error("[conteúdo] contactos:", err);
      toast("Erro ao guardar: " + errorMessage(err), "error");
    } finally {
      btn.disabled = false;
    }
  });
}