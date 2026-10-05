/* =====================================================
   O MOCHILÃO — programa-cart.js
   Formulário "Adicionar à Mochila" (programa.html)

   Lê os dados directamente do DOM já preenchido
   (por programas.js ou programa-firestore.js), por isso
   funciona com qualquer uma das fontes de dados.

   Grava em localStorage("mochilao-cart"):
   { id, programId, nome, imagem, data, pax, precoUnitario, total }
   e dispara window "cartUpdated".
   ===================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "mochilao-cart";
  const PAX_MIN = 1;
  const PAX_MAX = 20;

  const params = new URLSearchParams(window.location.search);
  const programId = params.get("d") || "malanje"; // mesmo default do programas.js

  const els = {
    form: document.getElementById("bookingForm"),
    date: document.getElementById("tourDate"),
    dateError: document.getElementById("tourDateError"),
    minus: document.getElementById("paxMinus"),
    plus: document.getElementById("paxPlus"),
    paxValue: document.getElementById("paxValue"),
    unit: document.getElementById("bookingUnit"),
    total: document.getElementById("bookingTotal"),
    btn: document.getElementById("addToCartBtn"),
    precos: document.querySelector(".pkg-precos__list"),
  };

  if (!els.form) return;

  let pax = PAX_MIN;

  /* ── Utilitários ── */
  function toNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatKz(n) {
    return (
      Math.round(Number(n) || 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz"
    );
  }

  function toISODate(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  /* ── Data mínima: amanhã ── */
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const MIN_DATE = toISODate(tomorrow);
  els.date.min = MIN_DATE;

  /* ── Preços ──
     Lê a tabela ".pkg-precos__list":
       <li><span>2 Pax</span><strong>760.000 Kz</strong></li>
     Escolhe o escalão com o maior nº de pax ≤ pax escolhido.
     (ex: 5 pessoas no Malanje → usa o preço de "3 Pax") */
  function getPriceTiers() {
    if (!els.precos) return [];
    return Array.from(els.precos.querySelectorAll("li"))
      .map(function (li) {
        const label = (li.querySelector("span") || {}).textContent || "";
        const valor = toNumber((li.querySelector("strong") || {}).textContent);
        const match = label.match(/(\d+)/);
        return { pax: match ? parseInt(match[1], 10) : null, valor: valor };
      })
      .filter(function (t) {
        return t.valor > 0;
      });
  }

  function getUnitPrice(p) {
    const tiers = getPriceTiers();

    if (!tiers.length) {
      // Fallback: "A partir de 760.000 Kz" no card de detalhes
      const det = document.querySelector(".pkg-detail--preco .pkg-detail__value");
      return det ? toNumber(det.textContent) : 0;
    }

    const numbered = tiers
      .filter(function (t) {
        return t.pax !== null;
      })
      .sort(function (a, b) {
        return a.pax - b.pax;
      });

    // Preço único ("Por Pax")
    if (!numbered.length) return tiers[0].valor;

    let chosen = numbered[0];
    numbered.forEach(function (t) {
      if (t.pax <= p) chosen = t;
    });
    return chosen.valor;
  }

  /* ── Dados do programa (do DOM) ── */
  function getProgramName() {
    const t = document.querySelector(".pkg-hero__title");
    const name = t ? t.textContent.trim() : "";
    if (!name || /carregando|não encontrado/i.test(name)) return "";
    return name;
  }

  function getProgramImage() {
    const img =
      document.querySelector(".pkg-img-box img") ||
      document.querySelector(".pkg-gallery__img");
    return img ? img.getAttribute("src") : "";
  }

  /* ── Render ── */
  function render() {
    els.paxValue.textContent = pax + (pax === 1 ? " Pessoa" : " Pessoas");
    els.minus.disabled = pax <= PAX_MIN;
    els.plus.disabled = pax >= PAX_MAX;

    const unit = getUnitPrice(pax);
    els.unit.textContent = unit > 0 ? formatKz(unit) : "A consultar";
    els.total.textContent = unit > 0 ? formatKz(unit * pax) : "A consultar";
  }

  function setError(msg) {
    els.dateError.textContent = msg || "";
    els.date.classList.toggle("is-invalid", !!msg);
    els.date.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  /* ── Carrinho ── */
  function readCart() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function addToCart(item) {
    const cart = readCart();
    const existing = cart.find(function (i) {
      return i.id === item.id;
    });

    if (existing) {
      // Mesmo programa na mesma data → soma pessoas e recalcula
      existing.pax = Math.min(PAX_MAX, existing.pax + item.pax);
      existing.precoUnitario = getUnitPrice(existing.pax);
      existing.total = existing.precoUnitario * existing.pax;
    } else {
      cart.push(item);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));
  }

  function flashButton() {
    const text = els.btn.querySelector(".pkg-cta-card__btn-text");
    els.btn.classList.add("is-added");
    if (text) text.textContent = "Adicionado à Mochila";
    setTimeout(function () {
      els.btn.classList.remove("is-added");
      if (text) text.textContent = "Adicionar à Mochila";
    }, 1800);
  }

  /* ── Eventos ── */
  els.minus.addEventListener("click", function () {
    pax = Math.max(PAX_MIN, pax - 1);
    render();
  });

  els.plus.addEventListener("click", function () {
    pax = Math.min(PAX_MAX, pax + 1);
    render();
  });

  els.date.addEventListener("change", function () {
    if (els.date.value) setError("");
  });

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();

    const data = els.date.value;
    if (!data) {
      setError("Escolha a data da viagem.");
      els.date.focus();
      return;
    }
    if (data < MIN_DATE) {
      setError("Escolha uma data a partir de amanhã.");
      els.date.focus();
      return;
    }
    setError("");

    const nome = getProgramName();
    if (!nome) {
      setError("O programa ainda está a carregar. Tente de novo.");
      return;
    }

    const precoUnitario = getUnitPrice(pax);

    addToCart({
      id: programId + "__" + data,
      programId: programId,
      nome: nome,
      imagem: getProgramImage(),
      data: data,
      pax: pax,
      precoUnitario: precoUnitario,
      total: precoUnitario * pax,
    });

    flashButton();
    if (window.MochilaoCart) window.MochilaoCart.openCart();
  });

  /* ── Re-render quando os preços chegam (Firestore é assíncrono) ── */
  if (els.precos && "MutationObserver" in window) {
    new MutationObserver(render).observe(els.precos, { childList: true });
  }

  render();
})();