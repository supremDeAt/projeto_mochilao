/* =====================================================
   O MOCHILÃO — pacotes.js  (script clássico, partilhado)
   Pacotes dos programas: Individual, Casal, Kamba…

   • Cada programa guarda os pacotes que tem, com preço FECHADO:
       programs/{id}.pacotes = [{ tipo: "casal", nome: "Casal", pessoas: 2, valor: 600000 }]
     (o preço do Casal já cobre as 2 pessoas)
   • Os tipos de pacote e as explicações ("Qual pacote escolher?")
     editam-se no painel: Site Web → Pacotes
       siteConfig/pacotes = { titulo, intro, tipos: [{ id, nome, pessoas, descricao }] }
   • Programas antigos (precos por pessoa) continuam a funcionar:
     são convertidos em pacotes só para mostrar.

   Usado por: programa.html (programas.js, programa-firestore.js,
   programa-cart.js) e admin.html (formulário de programas).
   API em window.MochilaoPacotes
   ===================================================== */

(function () {
  "use strict";

  var DEFAULT_CATALOG = {
    titulo: "Qual pacote escolher?",
    intro: "Escolha o pacote que combina com a sua forma de viajar.",
    tipos: [
      {
        id: "individual",
        nome: "Individual",
        pessoas: 1,
        descricao: "Para quem viaja sozinho e quer o quarto só para si.",
      },
      {
        id: "casal",
        nome: "Casal",
        pessoas: 2,
        descricao: "Para duas pessoas que partilham o quarto. O preço do pacote já cobre as duas.",
      },
      {
        id: "kamba",
        nome: "Kamba",
        pessoas: 1,
        descricao:
          "Partilha o quarto com outro viajante que também escolheu o Kamba. A forma mais económica de embarcar.",
      },
    ],
  };

  /* ── Utilitários ── */
  function toNumber(v) {
    if (typeof v === "number") return isFinite(v) ? Math.round(v) : 0;
    var d = String(v == null ? "" : v).replace(/[^\d]/g, "");
    return d ? parseInt(d, 10) : 0;
  }

  function formatKz(n) {
    return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slug(s) {
    return (
      String(s || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "pacote"
    );
  }

  function pessoasLabel(n) {
    n = parseInt(n, 10) || 1;
    return n + (n === 1 ? " pessoa" : " pessoas");
  }

  function peopleIcon(n) {
    n = parseInt(n, 10) || 1;
    return n === 1 ? "fa-user" : n === 2 ? "fa-user-group" : "fa-people-group";
  }

  /* ── Catálogo de tipos ── */
  var catalog = normalizeCatalog(null);
  var listeners = [];

  function normalizeCatalog(data) {
    var src = data && typeof data === "object" ? data : DEFAULT_CATALOG;
    var tipos = Array.isArray(src.tipos) ? src.tipos : DEFAULT_CATALOG.tipos;
    return {
      titulo: typeof src.titulo === "string" ? src.titulo : DEFAULT_CATALOG.titulo,
      intro: typeof src.intro === "string" ? src.intro : DEFAULT_CATALOG.intro,
      tipos: tipos
        .filter(function (t) {
          return t && String(t.nome || "").trim();
        })
        .map(function (t) {
          return {
            id: String(t.id || slug(t.nome)),
            nome: String(t.nome).trim(),
            pessoas: Math.max(1, parseInt(t.pessoas, 10) || 1),
            descricao: String(t.descricao || "").trim(),
          };
        }),
    };
  }

  function setCatalog(data) {
    catalog = normalizeCatalog(data);
    listeners.forEach(function (fn) {
      try {
        fn(catalog);
      } catch (e) {
        console.error("[pacotes]", e);
      }
    });
    if (current) renderInfo();
  }

  function onCatalog(fn) {
    listeners.push(fn);
    fn(catalog);
  }

  function findTipo(pkg) {
    var id = String(pkg.tipo || "");
    var nome = String(pkg.nome || "").toLowerCase();
    return (
      catalog.tipos.find(function (t) {
        return id && t.id === id;
      }) ||
      catalog.tipos.find(function (t) {
        return t.nome.toLowerCase() === nome;
      }) ||
      null
    );
  }

  /* ── Pacotes de um programa ── */

  /** Programas antigos: precos [{pax:"2 Pax", valor:"300.000 Kz"}] (por pessoa) */
  function fromLegacy(precos, preco) {
    var list = Array.isArray(precos) ? precos : [];
    var out = list
      .map(function (x) {
        var m = String((x && x.pax) || "").match(/(\d+)/);
        var n = m ? parseInt(m[1], 10) : 1;
        var porPessoa = toNumber(x && x.valor);
        return {
          tipo: m ? n + "p" : "pessoa",
          nome: m ? pessoasLabel(n) : "Por pessoa",
          pessoas: n,
          valor: porPessoa * n,
        };
      })
      .filter(function (p) {
        return p.valor > 0;
      });
    if (!out.length && toNumber(preco)) {
      out = [{ tipo: "pessoa", nome: "Por pessoa", pessoas: 1, valor: toNumber(preco) }];
    }
    return out;
  }

  /** Lista de pacotes de um programa (novo ou antigo) */
  function fromProgram(p) {
    p = p || {};
    if (Array.isArray(p.pacotes) && p.pacotes.length) {
      return p.pacotes
        .map(function (x) {
          return {
            tipo: String(x.tipo || slug(x.nome)),
            nome: String(x.nome || "").trim() || "Pacote",
            pessoas: Math.max(1, parseInt(x.pessoas, 10) || 1),
            valor: toNumber(x.valor),
          };
        })
        .filter(function (x) {
          return x.nome;
        });
    }
    return fromLegacy(p.precos, p.preco);
  }

  function minPrice(pkgs) {
    var vals = (pkgs || [])
      .map(function (p) {
        return p.valor;
      })
      .filter(function (v) {
        return v > 0;
      });
    return vals.length ? Math.min.apply(null, vals) : 0;
  }

  /** "A partir de 300.000 Kz" (vários) · "300.000 Kz" (um) · "A consultar" */
  function priceText(pkgs) {
    var min = minPrice(pkgs);
    if (!min) return "A consultar";
    return pkgs.length > 1 ? "A partir de " + formatKz(min) : formatKz(min);
  }

  /* ── Render na página do programa ── */
  var current = null;

  function render(pkgs) {
    current = Array.isArray(pkgs) ? pkgs : [];
    renderOptions();
    renderInfo();
    document.dispatchEvent(new CustomEvent("pacotes:render", { detail: current }));
  }

  // Opções do card de reserva (rádios)
  function renderOptions() {
    var box = document.querySelector(".pkg-pacotes__list");
    if (!box) return;
    if (!current.length) {
      box.innerHTML = '<p class="pkg-pacotes__empty">Preço a consultar.</p>';
      return;
    }
    box.innerHTML = current
      .map(function (p, i) {
        return (
          '<label class="pkg-pacote">' +
          '<input type="radio" name="pacote" class="pkg-pacote__input"' +
          ' value="' + esc(p.tipo) + '"' +
          ' data-nome="' + esc(p.nome) + '"' +
          ' data-pessoas="' + p.pessoas + '"' +
          ' data-valor="' + p.valor + '"' +
          (i === 0 ? " checked" : "") +
          " />" +
          '<span class="pkg-pacote__radio" aria-hidden="true"></span>' +
          '<span class="pkg-pacote__text">' +
          '<strong class="pkg-pacote__nome">' + esc(p.nome) + "</strong>" +
          (p.nome === pessoasLabel(p.pessoas)
            ? ""
            : '<small class="pkg-pacote__pessoas"><i class="fa-solid ' + peopleIcon(p.pessoas) + '"></i> ' +
              pessoasLabel(p.pessoas) +
              "</small>") +
          "</span>" +
          '<strong class="pkg-pacote__valor">' + (p.valor > 0 ? formatKz(p.valor) : "A consultar") + "</strong>" +
          "</label>"
        );
      })
      .join("");
  }

  // Secção "Qual pacote escolher?" ao lado do card
  function renderInfo() {
    var box = document.querySelector("[data-pacotes-info]");
    if (!box) return;
    var list = current || [];
    box.hidden = !list.length;
    if (!list.length) return;

    var t = box.querySelector("[data-pacotes-titulo]");
    var intro = box.querySelector("[data-pacotes-intro]");
    var ul = box.querySelector("[data-pacotes-lista]");
    if (t) t.textContent = catalog.titulo || DEFAULT_CATALOG.titulo;
    if (intro) {
      intro.textContent = catalog.intro || "";
      intro.hidden = !catalog.intro;
    }
    if (ul) {
      ul.innerHTML = list
        .map(function (p) {
          var tipo = findTipo(p);
          var desc = tipo ? tipo.descricao : "";
          return (
            '<li class="pkg-pacotes-info__item">' +
            '<span class="pkg-pacotes-info__icon"><i class="fa-solid ' + peopleIcon(p.pessoas) + '"></i></span>' +
            "<div>" +
            '<strong class="pkg-pacotes-info__nome">' + esc(p.nome) + "</strong>" +
            (p.nome === pessoasLabel(p.pessoas)
              ? ""
              : '<span class="pkg-pacotes-info__pessoas">' + pessoasLabel(p.pessoas) + "</span>") +
            (desc ? '<p class="pkg-pacotes-info__desc">' + esc(desc) + "</p>" : "") +
            "</div>" +
            "</li>"
          );
        })
        .join("");
    }
  }

  /* ── Catálogo do Firestore ── */
  function loadCatalog() {
    Promise.all([
      import("./firebase-config.js"),
      import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
    ])
      .then(function (mods) {
        var db = mods[0].db;
        var fs = mods[1];
        var ref = fs.doc(db, "siteConfig", "pacotes");
        var onErr = function (err) {
          console.warn("[pacotes] A usar os tipos de pacote por defeito:", err);
        };
        if (document.querySelector(".admin-page")) {
          // Painel: em tempo real (o separador "Pacotes" pode mudar os tipos)
          fs.onSnapshot(ref, function (snap) {
            setCatalog(snap.exists() ? snap.data() : null);
          }, onErr);
        } else {
          // Site: leitura única (gasta menos leituras do plano)
          fs.getDoc(ref)
            .then(function (snap) {
              setCatalog(snap.exists() ? snap.data() : null);
            })
            .catch(onErr);
        }
      })
      .catch(function (err) {
        console.warn("[pacotes] Sem ligação ao Firestore:", err);
      });
  }

  window.MochilaoPacotes = {
    DEFAULT_CATALOG: DEFAULT_CATALOG,
    toNumber: toNumber,
    formatKz: formatKz,
    slug: slug,
    pessoasLabel: pessoasLabel,
    peopleIcon: peopleIcon,
    fromProgram: fromProgram,
    fromLegacy: fromLegacy,
    minPrice: minPrice,
    priceText: priceText,
    render: render,
    getCatalog: function () {
      return catalog;
    },
    setCatalog: setCatalog,
    onCatalog: onCatalog,
    findTipo: findTipo,
    normalizeCatalog: normalizeCatalog,
  };

  loadCatalog();
})();
