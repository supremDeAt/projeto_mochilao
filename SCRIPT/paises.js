/* =====================================================
   O MOCHILÃO — paises.js  (ES module)
   Lista de países para o campo "Nacionalidade" do checkout.

   Sem API externa: guardamos só os códigos ISO (AO, PT, BR…) e é o
   próprio browser que escreve o nome em português (Intl.DisplayNames).
   Não depende de nenhum serviço de fora e não há nomes para manter.
   ===================================================== */

const CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW " +
  "BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI " +
  "FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN " +
  "IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME " +
  "MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF " +
  "PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV " +
  "SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK " +
  "YE YT ZA ZM ZW"
).split(" ");

// Territórios sem nacionalidade própria (ilhas desabitadas, bases…) ficam de fora
const SKIP = new Set(["AQ", "BV", "HM", "TF", "UM", "GS", "IO"]);

export const PAIS_PADRAO = "Angola";

let cache = null;

/** [{ code, nome }] por ordem alfabética, com nomes em português */
export function listaPaises() {
  if (cache) return cache;
  let names = null;
  try {
    names = new Intl.DisplayNames(["pt-PT", "pt"], { type: "region" });
  } catch {
    names = null; // browser muito antigo → mostra o código
  }
  const collator = new Intl.Collator("pt", { sensitivity: "base" });
  cache = CODES.filter((c) => !SKIP.has(c))
    .map((code) => {
      let nome = code;
      try {
        nome = (names && names.of(code)) || code;
      } catch {
        /* código desconhecido neste browser */
      }
      return { code, nome };
    })
    .filter((p) => p.nome && p.nome !== p.code)
    .sort((a, b) => collator.compare(a.nome, b.nome));
  if (!cache.length) cache = [{ code: "AO", nome: PAIS_PADRAO }];
  return cache;
}

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/** Nome oficial da lista que corresponde ao que foi escrito (ou "" se não existir) */
export function paisValido(valor) {
  const v = norm(valor);
  if (!v) return "";
  const hit = listaPaises().find((p) => norm(p.nome) === v || norm(p.code) === v);
  return hit ? hit.nome : "";
}

/** Cria (uma vez) o <datalist id="listaPaises"> usado pelos campos de nacionalidade */
export function garantirDatalist() {
  let dl = document.getElementById("listaPaises");
  if (dl) return dl;
  dl = document.createElement("datalist");
  dl.id = "listaPaises";
  dl.innerHTML = listaPaises()
    .map((p) => `<option value="${p.nome.replace(/"/g, "&quot;")}"></option>`)
    .join("");
  document.body.appendChild(dl);
  return dl;
}
