/* =====================================================
   O MOCHILÃO — cart.js
   Carrinho ("Mochila") com localStorage
   Chave: "mochilao-cart"

   Script clássico (não-module) para funcionar em
   index.html e PAGES/*.html. Expõe a API em:
     window.MochilaoCart  e  window.addToCart(...) etc.
   ===================================================== */

(function () {
  "use strict";

  /* ─────────────────────────────────────────
     1. CONFIGURAÇÃO
     ───────────────────────────────────────── */
  const STORAGE_KEY = "mochilao-cart";
  const PAX_MIN = 1;
  const PAX_MAX = 20;

  // Caminho do checkout relativo à página actual
  const IN_PAGES = window.location.pathname.includes("/PAGES/");
  const CHECKOUT_URL = IN_PAGES ? "checkout.html" : "PAGES/checkout.html";
  const PACKAGES_URL = IN_PAGES ? "../index.html#packages" : "#packages";

  /* ─────────────────────────────────────────
     2. UTILITÁRIOS
     ───────────────────────────────────────── */

  // "1.225.000 Kz" → 1225000 | "A consultar" → 0 | 90000 → 90000
  function parseKz(value) {
    if (typeof value === "number") return isFinite(value) ? value : 0;
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  // 1225000 → "1.225.000 Kz" (mesmo formato usado no site)
  function formatKz(n) {
    const num = Math.round(Number(n) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";
  }

  // "2026-10-15" → "15 out. 2026"
  function formatDate(iso) {
    if (!iso) return "Data a definir";
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Protege contra HTML injectado (nomes virão do Firestore)
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clampPax(n) {
    const v = parseInt(n, 10) || PAX_MIN;
    return Math.min(PAX_MAX, Math.max(PAX_MIN, v));
  }

  /* ─────────────────────────────────────────
     3. PERSISTÊNCIA (localStorage)
     ───────────────────────────────────────── */
  function getCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn("[cart] Não foi possível ler o carrinho:", err);
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.warn("[cart] Não foi possível gravar o carrinho:", err);
    }
    updateCartUI();
  }

  /* ─────────────────────────────────────────
     4. API DO CARRINHO
     ───────────────────────────────────────── */

  /**
   * Adiciona uma experiência à mochila.
   * Se já existir o mesmo programa NA MESMA DATA, soma os pax.
   *
   * @param {Object} item
   *   programaId  {string}  ex: "malanje"          (obrigatório)
   *   nome        {string}  ex: "Malanje Tour"     (obrigatório)
   *   data        {string}  ex: "2026-10-15"        (obrigatório)
   *   pax         {number}  ex: 2
   *   precoUnit   {number|string} preço por pessoa ex: 760000 ou "760.000 Kz"
   *   img         {string}  caminho da imagem (opcional)
   * @returns {Object|null} item gravado
   */
  function addToCart(item) {
    if (!item || !item.programaId || !item.nome || !item.data) {
      console.error("[cart] addToCart: faltam programaId, nome ou data.", item);
      return null;
    }

    const cart = getCart();
    const id = item.programaId + "__" + item.data;
    const pax = clampPax(item.pax);
    const existing = cart.find(function (i) {
      return i.id === id;
    });

    let saved;
    if (existing) {
      existing.pax = clampPax(existing.pax + pax);
      saved = existing;
    } else {
      saved = {
        id: id,
        programaId: String(item.programaId),
        nome: String(item.nome),
        data: String(item.data),
        pax: pax,
        precoUnit: parseKz(item.precoUnit),
        img: item.img || "",
        addedAt: Date.now(),
      };
      cart.push(saved);
    }

    saveCart(cart);
    pulseBadge();
    return saved;
  }

  function removeFromCart(id) {
    const cart = getCart().filter(function (i) {
      return i.id !== id;
    });
    saveCart(cart);
  }

  // change: +1 ou -1
  function updatePax(id, change) {
    const cart = getCart();
    const item = cart.find(function (i) {
      return i.id === id;
    });
    if (!item) return;
    item.pax = clampPax(item.pax + Number(change || 0));
    saveCart(cart);
  }

  function getCartTotal() {
    return getCart().reduce(function (sum, i) {
      return sum + (Number(i.precoUnit) || 0) * (Number(i.pax) || 0);
    }, 0);
  }

  // Nº de experiências na mochila (usado no badge)
  function getCartCount() {
    return getCart().length;
  }

  function clearCart() {
    saveCart([]);
  }

  /* ─────────────────────────────────────────
     5. DOM — referências (carregadas no init)
     ───────────────────────────────────────── */
  let els = {};

  function cacheEls() {
    els = {
      fab: document.getElementById("cartFab"),
      badge: document.getElementById("cartBadge"),
      drawer: document.getElementById("cartDrawer"),
      overlay: document.getElementById("cartOverlay"),
      closeBtn: document.getElementById("cartCloseBtn"),
      items: document.getElementById("cartItems"),
      footer: document.getElementById("cartFooter"),
      total: document.getElementById("cartTotal"),
      checkout: document.getElementById("cartCheckoutBtn"),
    };
  }

  /* ─────────────────────────────────────────
     6. RENDER
     ───────────────────────────────────────── */
  function renderEmpty() {
    return [
      '<div class="cart-drawer__empty">',
      '  <span class="cart-drawer__empty-icon"><i class="fa-solid fa-person-hiking"></i></span>',
      '  <h3 class="cart-drawer__empty-title">A sua mochila está vazia</h3>',
      '  <p class="cart-drawer__empty-text">Ainda não escolheu a próxima aventura? Angola inteira está à sua espera.</p>',
      '  <a href="' + PACKAGES_URL + '" class="btn btn--outline-dark btn--sm cart-drawer__empty-link" data-cart-close>',
      "    Explorar viagens",
      "  </a>",
      "</div>",
    ].join("");
  }

  function renderItem(item) {
    const id = escapeHtml(item.id);
    const subtotal = (Number(item.precoUnit) || 0) * item.pax;
    const preco =
      item.precoUnit > 0 ? formatKz(subtotal) : "Preço a consultar";
    const media = item.img
      ? '<img src="' + escapeHtml(item.img) + '" alt="" class="cart-item__img" loading="lazy">'
      : '<span class="cart-item__ph"><i class="fa-solid fa-mountain-sun"></i></span>';

    return [
      '<article class="cart-item" data-id="' + id + '">',
      '  <div class="cart-item__media">' + media + "</div>",
      '  <div class="cart-item__info">',
      '    <h3 class="cart-item__title">' + escapeHtml(item.nome) + "</h3>",
      '    <p class="cart-item__date"><i class="fa-regular fa-calendar"></i> ' +
        escapeHtml(formatDate(item.data)) +
        "</p>",
      '    <div class="cart-item__row">',
      '      <div class="cart-item__pax" role="group" aria-label="Número de pessoas">',
      '        <button type="button" class="cart-item__pax-btn" data-action="dec" data-id="' + id + '" aria-label="Menos uma pessoa"' +
        (item.pax <= PAX_MIN ? " disabled" : "") +
        '><i class="fa-solid fa-minus"></i></button>',
      '        <span class="cart-item__pax-val">' + item.pax + " " + (item.pax === 1 ? "Pax" : "Pax") + "</span>",
      '        <button type="button" class="cart-item__pax-btn" data-action="inc" data-id="' + id + '" aria-label="Mais uma pessoa"' +
        (item.pax >= PAX_MAX ? " disabled" : "") +
        '><i class="fa-solid fa-plus"></i></button>',
      "      </div>",
      '      <strong class="cart-item__price">' + preco + "</strong>",
      "    </div>",
      "  </div>",
      '  <button type="button" class="cart-item__remove" data-action="remove" data-id="' + id + '" aria-label="Remover ' + escapeHtml(item.nome) + '">',
      '    <i class="fa-regular fa-trash-can"></i>',
      "  </button>",
      "</article>",
    ].join("");
  }

  function updateCartUI() {
    const cart = getCart();
    const count = cart.length;

    // Badge flutuante
    if (els.badge) {
      els.badge.textContent = count > 9 ? "9+" : String(count);
      els.badge.hidden = count === 0;
    }
    if (els.fab) {
      els.fab.setAttribute(
        "aria-label",
        count ? "Abrir mochila (" + count + " itens)" : "Abrir mochila",
      );
    }

    // Lista de itens
    if (els.items) {
      els.items.innerHTML = count
        ? cart.map(renderItem).join("")
        : renderEmpty();
    }

    // Rodapé
    if (els.footer) els.footer.hidden = count === 0;
    if (els.total) els.total.textContent = formatKz(getCartTotal());
    if (els.checkout) {
      els.checkout.setAttribute("href", CHECKOUT_URL);
      els.checkout.setAttribute("aria-disabled", count === 0 ? "true" : "false");
    }
  }

  function pulseBadge() {
    if (!els.badge) return;
    els.badge.classList.remove("is-pulsing");
    void els.badge.offsetWidth; // reinicia a animação
    els.badge.classList.add("is-pulsing");
  }

  /* ─────────────────────────────────────────
     7. ABRIR / FECHAR DRAWER
     ───────────────────────────────────────── */
  let lastFocus = null;

  function isCartOpen() {
    return !!(els.drawer && els.drawer.classList.contains("is-open"));
  }

  function openCart() {
    if (!els.drawer) return;
    lastFocus = document.activeElement;
    els.drawer.classList.add("is-open");
    els.drawer.setAttribute("aria-hidden", "false");
    if (els.overlay) els.overlay.classList.add("is-open");
    if (els.fab) els.fab.setAttribute("aria-expanded", "true");
    document.body.classList.add("cart-is-open");
    // foco no botão fechar após a animação começar
    setTimeout(function () {
      if (els.closeBtn) els.closeBtn.focus();
    }, 50);
  }

  function closeCart() {
    if (!els.drawer) return;
    els.drawer.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    if (els.overlay) els.overlay.classList.remove("is-open");
    if (els.fab) els.fab.setAttribute("aria-expanded", "false");
    document.body.classList.remove("cart-is-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  /* ─────────────────────────────────────────
     8. EVENTOS
     ───────────────────────────────────────── */
  function bindEvents() {
    if (els.fab) els.fab.addEventListener("click", openCart);
    if (els.closeBtn) els.closeBtn.addEventListener("click", closeCart);
    if (els.overlay) els.overlay.addEventListener("click", closeCart);

    // Delegação: + / − / remover / links que fecham o drawer
    if (els.drawer) {
      els.drawer.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-action]");
        if (btn) {
          const id = btn.getAttribute("data-id");
          const action = btn.getAttribute("data-action");
          if (action === "inc") updatePax(id, +1);
          if (action === "dec") updatePax(id, -1);
          if (action === "remove") removeFromCart(id);
          return;
        }
        if (e.target.closest("[data-cart-close]")) closeCart();
      });
    }

    // Bloquear checkout com mochila vazia
    if (els.checkout) {
      els.checkout.addEventListener("click", function (e) {
        if (getCartCount() === 0) e.preventDefault();
      });
    }

    // Escape fecha
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isCartOpen()) closeCart();
    });

    // Sincronizar entre separadores do browser
    window.addEventListener("storage", function (e) {
      if (e.key === STORAGE_KEY) updateCartUI();
    });
  }

  /* ─────────────────────────────────────────
     9. INIT
     ───────────────────────────────────────── */
  function init() {
    cacheEls();
    bindEvents();
    updateCartUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ─────────────────────────────────────────
     10. API PÚBLICA
     ───────────────────────────────────────── */
  const api = {
    STORAGE_KEY: STORAGE_KEY,
    getCart: getCart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    updatePax: updatePax,
    getCartTotal: getCartTotal,
    getCartCount: getCartCount,
    clearCart: clearCart,
    updateCartUI: updateCartUI,
    openCart: openCart,
    closeCart: closeCart,
    formatKz: formatKz,
    parseKz: parseKz,
    formatDate: formatDate,
  };

  window.MochilaoCart = api;
  window.addToCart = addToCart;
  window.removeFromCart = removeFromCart;
  window.updatePax = updatePax;
  window.getCartTotal = getCartTotal;
  window.updateCartUI = updateCartUI;
})();