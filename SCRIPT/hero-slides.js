/* =====================================================
   O MOCHILÃO — hero-slides.js  (ES module)
   Fundo do hero do index a passar fotos, com transição suave.

   siteConfig/hero-slides = {
     slides:   [{ id, url }],   ← pela ordem do painel
     intervalo: 7                ← segundos de cada foto (4–15)
   }
   Sem fotos → fica a foto normal do hero. Com 1 foto → mostra só essa.
   ===================================================== */

export const HS_DOC = "hero-slides";
export const HS_DEFAULT_INTERVAL = 7;

/* Fotos do Cloudinary: pede a foto INTEIRA (sem recorte), num tamanho que
   chegue para cobrir o hero em píxeis reais do ecrã (c_mfit = "cover" sem
   cortar). O enquadramento fica igual ao da foto original; só deixa de ser
   esticada pelo browser (era isto que a desfocava nos telemóveis). */
const CLD_RE = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;
const MAX_PX = 2560;
const step = (n) => Math.ceil(n / 200) * 200; // poucos tamanhos diferentes (cache)
export function heroImageUrl(url, hero) {
  if (!CLD_RE.test(url)) return url;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = Math.round((hero?.clientWidth || window.innerWidth) * dpr);
  let h = Math.round((hero?.clientHeight || window.innerHeight) * dpr);
  const k = Math.min(1, MAX_PX / Math.max(w, h));
  w = step(w * k);
  h = step(h * k);
  const [base, rest] = url.split("/image/upload/");
  const path = rest.replace(/^(?:[a-z]{1,3}_[^/]+\/)+/, ""); // tira o tamanho antigo
  // c_mfit: a foto inteira, com largura ≥ w E altura ≥ h (sem recorte)
  return `${base}/image/upload/f_auto,q_auto:best,c_mfit,w_${w},h_${h}/${path}`;
}

const safeUrl = (u) => (/^(https:\/\/|data:image\/)/.test(String(u || "")) ? String(u) : "");

/** Liga o slide a um elemento .hero. Devolve uma função para parar. */
export function startHeroSlides(hero, data = {}) {
  if (!hero) return () => {};
  hero.querySelector(".hero__slides")?.remove();
  hero.classList.remove("has-slides");

  const urls = (Array.isArray(data.slides) ? data.slides : []).map((s) => safeUrl(s.url)).filter(Boolean);
  if (!urls.length) return () => {};
  const secs = Math.min(15, Math.max(4, parseInt(data.intervalo, 10) || HS_DEFAULT_INTERVAL));

  const box = document.createElement("div");
  box.className = "hero__slides";
  box.setAttribute("aria-hidden", "true");
  const layers = urls.map((url) => {
    const el = document.createElement("div");
    el.className = "hero__slide";
    el.dataset.src = heroImageUrl(url, hero);
    box.appendChild(el);
    return el;
  });
  hero.prepend(box);
  hero.classList.add("has-slides");

  // Carrega uma foto antes de a mostrar (nunca aparece "a meio")
  const loaded = new Set();
  const load = (i) =>
    new Promise((res) => {
      const el = layers[i];
      if (loaded.has(i)) return res(true);
      const img = new Image();
      img.onload = () => {
        el.style.backgroundImage = `url("${el.dataset.src.replace(/"/g, "%22")}")`;
        loaded.add(i);
        res(true);
      };
      img.onerror = () => res(false);
      img.src = el.dataset.src;
    });

  let current = -1;
  let timer = null;
  let stopped = false;

  async function show(i) {
    if (stopped) return;
    const ok = await load(i);
    if (stopped) return;
    if (ok) {
      layers.forEach((l, k) => l.classList.toggle("is-active", k === i));
      current = i;
    }
    if (layers.length > 1) {
      load((i + 1) % layers.length); // prepara já a seguinte
      timer = setTimeout(() => show((current + 1) % layers.length), secs * 1000);
    }
  }

  // Separador escondido → pausa (poupa bateria e dados)
  const onVisibility = () => {
    if (document.hidden) {
      clearTimeout(timer);
      timer = null;
    } else if (!timer && layers.length > 1 && !stopped) {
      timer = setTimeout(() => show((current + 1) % layers.length), secs * 1000);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  show(0);

  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    box.remove();
    hero.classList.remove("has-slides");
  };
}

async function load() {
  const hero = document.querySelector("#hero.hero");
  if (!hero) return;
  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ]);
    const snap = await getDoc(doc(db, "siteConfig", HS_DOC));
    if (snap.exists()) startHeroSlides(hero, snap.data());
  } catch (err) {
    console.warn("[hero] Sem fotos do slide:", err);
  }
}

if (!document.querySelector(".admin-page")) load();
