/* =====================================================
   O MOCHILÃO — datas.js  (script clássico)
   Datas de partida dos programas, escolhidas no painel.

   programs/{id}.datas = [{ inicio: "AAAA-MM-DD", fim: "AAAA-MM-DD" }]

   No card "Juntar-se" (programa.html):
   • sem datas no painel          → "Datas em breve" (botão desligado)
   • todas passadas ou esgotadas  → "Sem datas disponíveis" (botão desligado)
   • 1 data                       → mostra só a data (sem escolha)
   • 2 ou mais                    → o cliente escolhe uma
   As datas que já passaram não aparecem; as esgotadas aparecem riscadas.

   Escreve no formulário:
     <input name="dataViagem" value="AAAA-MM-DD" data-fim="AAAA-MM-DD">
     form.dataset.restantes  → lugares livres na data escolhida (se houver limite)
   O programa-cart.js lê isto ao adicionar à mochila.
   API: window.MochilaoDatas
   ===================================================== */

(function () {
  "use strict";

  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function parse(iso) {
    var p = String(iso || "").split("-").map(Number);
    return p.length === 3 && p[0] && p[1] && p[2] ? { y: p[0], m: p[1], d: p[2] } : null;
  }

  function todayISO() {
    var t = new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }

  /** "20 – 22 dez 2026" · "28 nov – 2 dez 2026" · "30 dez 2026 – 2 jan 2027" · "20 dez 2026" */
  function formatRange(inicio, fim) {
    var a = parse(inicio);
    var b = parse(fim);
    if (!a) return inicio ? String(inicio) : "Data a definir";
    var one = function (x, year) {
      return x.d + " " + MESES[x.m - 1] + (year ? " " + x.y : "");
    };
    if (!b || fim === inicio) return one(a, true);
    if (a.y !== b.y) return one(a, true) + " – " + one(b, true);
    if (a.m !== b.m) return one(a, false) + " – " + one(b, true);
    return a.d + " – " + one(b, true);
  }

  /** Datas válidas e futuras, por ordem */
  function upcoming(list) {
    var today = todayISO();
    var seen = {};
    return (Array.isArray(list) ? list : [])
      .map(function (x) {
        return { inicio: String((x && x.inicio) || ""), fim: String((x && x.fim) || (x && x.inicio) || "") };
      })
      .filter(function (x) {
        if (!parse(x.inicio) || x.inicio < today || seen[x.inicio]) return false;
        seen[x.inicio] = true;
        return true;
      })
      .sort(function (a, b) {
        return a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0;
      });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ── Estado do card ── */
  var state = { vagas: 0, ocupacao: {}, ready: false };

  function els() {
    return {
      form: document.getElementById("bookingForm"),
      list: document.querySelector("[data-datas-list]"),
      info: document.getElementById("bookingVagas"),
      btn: document.getElementById("addToCartBtn"),
    };
  }

  function restantes(inicio) {
    if (!state.vagas) return Infinity;
    return Math.max(0, state.vagas - (parseInt(state.ocupacao[inicio], 10) || 0));
  }

  function pessoasDoPacote(form) {
    var el = form && form.querySelector('input[name="pacote"]:checked');
    return (el && parseInt(el.dataset.pessoas, 10)) || 1;
  }

  /** Atualiza o aviso de vagas e o botão conforme a data + pacote escolhidos */
  function update() {
    var e = els();
    if (!e.form || !state.ready) return;
    var sel = e.form.querySelector('input[name="dataViagem"]:checked');
    if (!sel) {
      delete e.form.dataset.restantes;
      if (e.info) e.info.hidden = true;
      if (e.btn) e.btn.disabled = true;
      return;
    }
    var r = restantes(sel.value);
    var falta = r !== Infinity && pessoasDoPacote(e.form) > r;
    if (r === Infinity) delete e.form.dataset.restantes;
    else e.form.dataset.restantes = String(r);
    if (e.btn) e.btn.disabled = r === 0 || falta;
    if (!e.info) return;
    if (r === Infinity) {
      e.info.hidden = true;
      return;
    }
    e.info.hidden = false;
    e.info.className = "pkg-booking__vagas" + (r === 0 ? " is-full" : r <= 5 ? " is-low" : "");
    e.info.innerHTML =
      r === 0
        ? '<i class="fa-solid fa-circle-xmark"></i> Esgotado nesta data.'
        : '<i class="fa-solid fa-users"></i> ' +
          (r === 1 ? "Resta 1 lugar" : "Restam " + r + " lugares") +
          " nesta data" +
          (falta ? " — não chega para este pacote." : ".");
  }

  function setUnavailable(msg) {
    var e = els();
    if (e.list) e.list.innerHTML = '<p class="pkg-datas__empty"><i class="fa-regular fa-calendar"></i> ' + esc(msg) + "</p>";
    if (e.form) {
      e.form.classList.add("is-unavailable");
      delete e.form.dataset.restantes;
    }
    if (e.info) e.info.hidden = true;
    if (e.btn) e.btn.disabled = true;
  }

  /**
   * Desenha as datas no card.
   * @param {{datas: Array, vagas?: number, ocupacao?: Object}} opts
   *        ocupacao = { "AAAA-MM-DD": pessoas já reservadas }
   */
  function render(opts) {
    opts = opts || {};
    var e = els();
    if (!e.list) return;
    state.vagas = parseInt(opts.vagas, 10) || 0;
    state.ocupacao = opts.ocupacao || {};
    state.ready = true;

    var all = Array.isArray(opts.datas) ? opts.datas : [];
    var list = upcoming(all);
    if (e.form) e.form.classList.remove("is-unavailable");

    if (!all.length) return setUnavailable("Datas em breve");
    var livres = list.filter(function (d) {
      return restantes(d.inicio) > 0;
    });
    if (!livres.length) return setUnavailable("Sem datas disponíveis");

    var firstFree = livres[0].inicio;
    var single = list.length === 1;
    e.list.classList.toggle("is-single", single);
    e.list.innerHTML = list
      .map(function (d) {
        var r = restantes(d.inicio);
        var full = r === 0;
        var sub = full
          ? "Esgotado"
          : r !== Infinity && r <= 5
            ? r === 1
              ? "Resta 1 lugar"
              : "Restam " + r + " lugares"
            : "";
        return (
          '<label class="pkg-data' + (full ? " is-full" : "") + '">' +
          '<input type="radio" name="dataViagem" class="pkg-data__input"' +
          ' value="' + esc(d.inicio) + '" data-fim="' + esc(d.fim) + '"' +
          (d.inicio === firstFree ? " checked" : "") +
          (full ? " disabled" : "") +
          " />" +
          '<span class="pkg-data__icon" aria-hidden="true"><i class="fa-regular fa-calendar"></i></span>' +
          '<span class="pkg-data__text">' +
          '<strong class="pkg-data__range">' + esc(formatRange(d.inicio, d.fim)) + "</strong>" +
          (sub ? '<small class="pkg-data__sub">' + esc(sub) + "</small>" : "") +
          "</span>" +
          "</label>"
        );
      })
      .join("");
    update();
  }

  /* Muda a data ou o pacote → atualiza vagas e botão */
  document.addEventListener("change", function (ev) {
    var n = ev.target && ev.target.name;
    if (n === "dataViagem" || n === "pacote") update();
  });

  window.MochilaoDatas = {
    render: render,
    update: update,
    upcoming: upcoming,
    formatRange: formatRange,
    todayISO: todayISO,
  };
})();
