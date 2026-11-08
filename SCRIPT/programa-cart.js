/* =====================================================
   O MOCHILÃO — programa-cart.js
   Formulário "Embarcar" da página do programa (programa.html)

   O cliente escolhe o PACOTE (Individual, Casal, Kamba…) e uma das
   DATAS definidas no painel (desenhadas pelo datas.js como rádios
   <input name="dataViagem" value="partida" data-fim="regresso">).
   Os pacotes são desenhados pelo pacotes.js como rádios:
     <input name="pacote" value="casal" data-nome="Casal"
            data-pessoas="2" data-valor="600000">
   (o preço do pacote é fechado: o Casal cobre as 2 pessoas)

   Grava em localStorage("mochilao-cart"):
   { id, programId, nome, imagem, data (partida), dataFim (regresso),
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
    dateError: document.getElementById("tourDateError"),
    btn: document.getElementById("addToCartBtn"),
    list: document.querySelector(".pkg-pacotes__list"),
  };

  if (!els.form) return;

  /** Data escolhida (datas.js): { inicio, fim } ou null */
  function getSelectedDate() {
    const input = els.form.querySelector('input[name="dataViagem"]:checked');
    if (!input) return null;
    return { inicio: input.value, fim: input.dataset.fim || input.value };
  }

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
    const src = img ? img.getAttribute("src") || "" : "";
    // Foto em Base64 (programas antigos) é enorme: não vai para a mochila
    return /^data:/.test(src) ? "" : src;
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
    if (els.dateError) els.dateError.textContent = msg || "";
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

  /** Grava a mochila. Se o browser recusar (memória cheia, modo privado),
      tenta de novo sem as fotos, que são o que ocupa mais espaço. */
  function writeCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      return true;
    } catch (e) {
      try {
        const light = cart.map(function (i) {
          return Object.assign({}, i, { imagem: /^data:/.test(i.imagem || "") ? "" : i.imagem });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
        return true;
      } catch (e2) {
        console.warn("[mochila] Não foi possível gravar:", e2);
        return false;
      }
    }
  }

  /** Mostra logo a mochila atualizada (contador + gaveta) */
  function refreshCart() {
    window.dispatchEvent(new Event("cartUpdated"));
    if (window.MochilaoCart && typeof window.MochilaoCart.updateCartUI === "function") {
      window.MochilaoCart.updateCartUI();
    }
  }

  /** true = novo · false = já estava · null = não gravou */
  function addToCart(item) {
    const cart = readCart();
    const existing = cart.find(function (i) {
      return i.id === item.id;
    });
    if (existing) {
      // Mesmo programa + data + pacote já na mochila: a quantidade muda-se no checkout
      existing.precoUnitario = item.precoUnitario;
      existing.total = item.precoUnitario * (parseInt(existing.qtd, 10) || 1);
      // dados novos do programa (nome, foto, regresso) sem mexer na quantidade
      existing.nome = item.nome;
      existing.imagem = item.imagem || existing.imagem;
      existing.dataFim = item.dataFim;
    } else {
      cart.push(item);
    }
    if (!writeCart(cart)) return null;
    refreshCart();
    return !existing;
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

  /* ── "Saber mais" (Detalhes da Viagem) → desce suavemente até ao card ── */
  document.querySelectorAll("[data-scroll-booking]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      const card = document.getElementById("reservar");
      if (!card) return;
      e.preventDefault();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      // Realça o card por um instante, quando lá chegar
      card.classList.remove("is-highlight");
      setTimeout(function () {
        card.classList.add("is-highlight");
        const first = card.querySelector('input[name="pacote"]:checked, input[name="pacote"]');
        if (first) first.focus({ preventScroll: true });
      }, reduce ? 0 : 700);
      setTimeout(function () {
        card.classList.remove("is-highlight");
      }, 2600);
    });
  });

  /* ── Eventos ── */
  els.form.addEventListener("change", function (e) {
    if (e.target.name === "dataViagem" || e.target.name === "pacote") setError("");
  });

  els.form.addEventListener("submit", function (e) {
    e.preventDefault();

    const pkg = getSelectedPackage();
    if (!pkg) {
      setError("Escolha um pacote.");
      els.list?.querySelector("input")?.focus();
      return;
    }

    const datas = getSelectedDate();
    if (!datas) {
      setError(
        els.form.classList.contains("is-unavailable")
          ? "Este programa não tem datas disponíveis."
          : "Escolha a data da viagem.",
      );
      return;
    }
    const data = datas.inicio;
    setError("");

    // Vagas (preenchido pelo datas.js quando o programa tem limite)
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
      data: data, // dia de partida
      dataFim: datas.fim, // dia de regresso
      pacote: pkg.nome,
      pacoteId: pkg.tipo,
      pessoasPorPacote: pkg.pessoas,
      qtd: 1,
      pax: pkg.pessoas,
      precoUnitario: pkg.valor,
      total: pkg.valor,
    });

    if (added === null) {
      setError("Não foi possível guardar na mochila. Verifique se o browser não está em modo privado.");
      return;
    }
    flashButton(added ? "Adicionado à Mochila" : "Já está na Mochila");
    if (window.MochilaoCart) window.MochilaoCart.openCart();
  });
})();
