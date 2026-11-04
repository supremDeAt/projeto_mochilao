/* =====================================================
   O MOCHILÃO — programa-cart.js
   Formulário "Embarcar" da página do programa (programa.html)

   O cliente escolhe o PACOTE (Individual, Casal, Kamba…) e a data.
   Os pacotes são desenhados pelo pacotes.js como rádios:
     <input name="pacote" value="casal" data-nome="Casal"
            data-pessoas="2" data-valor="600000">
   (o preço do pacote é fechado: o Casal cobre as 2 pessoas)

   Grava em localStorage("mochilao-cart"):
   { id, programId, nome, imagem, data,
     pacote, pacoteId, pessoasPorPacote, qtd, pax,
     precoUnitario, total }
   e dispara window "cartUpdated".
   A quantidade de pacotes ajusta-se no checkout.
   Vagas: se o programa tiver limite, não deixa adicionar mais
   pessoas do que os lugares que restam (o checkout volta a confirmar).
   ===================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "mochilao-cart";

  const params = new URLSearchParams(window.location.search);
  const programId = params.get("d") || "malanje"; // mesmo default do programas.js

  const els = {
    form: document.getElementById("bookingForm"),
    date: document.getElementById("tourDate"),
    dateError: document.getElementById("tourDateError"),
    btn: document.getElementById("addToCartBtn"),
    list: document.querySelector(".pkg-pacotes__list"),
  };

  if (!els.form) return;

  /* ── Utilitários ── */
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

  /* ── Dados do programa (do DOM) ── */
  function getProgramName() {
    const t = document.querySelector(".pkg-hero__title");
    const name = t ? t.textContent.trim() : "";
    if (!name || /carregando|não encontrado/i.test(name)) return "";
    return name;
  }

  function getProgramImage() {
    // Programas do Firestore: miniatura leve (não guardar a foto grande no carrinho)
    const thumb = document.querySelector(".pkg-img-box")?.dataset.cartImg;
    if (thumb) return thumb;
    const img =
      document.querySelector(".pkg-img-box img") ||
      document.querySelector(".pkg-gallery__img");
    return img ? img.getAttribute("src") : "";
  }

  /** Pacote escolhido: { tipo, nome, pessoas, valor } ou null */
  function getSelectedPackage() {
    const input = els.list && els.list.querySelector('input[name="pacote"]:checked');
    if (!input) return null;
    return {
      tipo: input.value,
      nome: input.dataset.nome || "Pacote",
      pessoas: parseInt(input.dataset.pessoas, 10) || 1,
      valor: parseInt(input.dataset.valor, 10) || 0,
    };
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
      // Mesmo programa + data + pacote já na mochila: a quantidade muda-se no checkout
      existing.precoUnitario = item.precoUnitario;
      existing.total = item.precoUnitario * (parseInt(existing.qtd, 10) || 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      window.dispatchEvent(new Event("cartUpdated"));
      return false;
    }
    cart.push(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("cartUpdated"));
    return true;
  }

  function flashButton(label) {
    const text = els.btn.querySelector(".pkg-cta-card__btn-text");
    els.btn.classList.add("is-added");
    const original = text ? text.textContent : "";
    if (text) text.textContent = label || "Adicionado à Mochila";
    setTimeout(function () {
      els.btn.classList.remove("is-added");
      if (text) text.textContent = original;
    }, 1800);
  }

  /* ── Eventos ── */
  els.date.addEventListener("change", function () {
    if (els.date.value) setError("");
  });

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();

    const pkg = getSelectedPackage();
    if (!pkg) {
      setError("Escolha um pacote.");
      els.list?.querySelector("input")?.focus();
      return;
    }

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

    // Vagas (preenchido pelo programa-firestore.js quando o programa tem limite)
    const restantes = els.form.dataset.restantes;
    if (restantes !== undefined && pkg.pessoas > Number(restantes)) {
      setError(
        Number(restantes) === 0
          ? "Esta data está esgotada. Escolha outra data."
          : "Só restam " + restantes + " lugar(es) nesta data.",
      );
      return;
    }

    const nome = getProgramName();
    if (!nome) {
      setError("O programa ainda está a carregar. Tente de novo.");
      return;
    }

    const added = addToCart({
      id: programId + "__" + data + "__" + pkg.tipo,
      programId: programId,
      nome: nome,
      imagem: getProgramImage(),
      data: data,
      pacote: pkg.nome,
      pacoteId: pkg.tipo,
      pessoasPorPacote: pkg.pessoas,
      qtd: 1,
      pax: pkg.pessoas,
      precoUnitario: pkg.valor,
      total: pkg.valor,
    });

    flashButton(added ? "Adicionado à Mochila" : "Já está na Mochila");
    if (window.MochilaoCart) window.MochilaoCart.openCart();
  });
})();
