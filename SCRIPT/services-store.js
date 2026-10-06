/* =====================================================
   O MOCHILÃO — services-icons.js  (ES module)
   Ícones de linha para os cards de Serviços.
   O admin escolhe um destes nomes no campo "Ícone".
   Para acrescentar um ícone novo: juntar uma entrada aqui.
   ===================================================== */

export const SERVICE_ICONS = {
  transfer: {
    label: "Transfer (carro)",
    paths: `
      <path d="M6 40V31l7-11h26l11 11h6a2 2 0 0 1 2 2v7"/>
      <path d="M6 40h5M21 40h20M51 40h7"/>
      <circle cx="16" cy="41" r="5"/><circle cx="46" cy="41" r="5"/>
      <path d="M11 31h39M28 20v11"/>
      <path d="M36 52h18M50 48l4 4-4 4"/>`,
  },
  hotel: {
    label: "Hotel",
    paths: `
      <path d="M14 56V12h24v44M38 24h12v32M8 56h48"/>
      <path d="M20 20h4M28 20h4M20 28h4M28 28h4M20 36h4M28 36h4M43 32h2M43 40h2"/>
      <path d="M23 56v-8h6v8"/>`,
  },
  autocarro: {
    label: "Autocarro",
    paths: `
      <rect x="14" y="8" width="36" height="42" rx="5"/>
      <path d="M18 14h28v14H18zM14 32h36"/>
      <circle cx="21" cy="41" r="2"/><circle cx="43" cy="41" r="2"/><path d="M28 41h8"/>
      <path d="M18 50v5h6v-5M40 50v5h6v-5M14 18h-4v8M50 18h4v8"/>`,
  },
  tuktuk: {
    label: "Tuk-tuk",
    paths: `
      <path d="M14 42V28c0-9 7-16 16-16h12c6 0 10 4 10 10v20"/>
      <path d="M14 42h1M25 42h18M52 42h4"/>
      <circle cx="20" cy="43" r="5"/><circle cx="48" cy="43" r="5"/>
      <path d="M27 18h13a4 4 0 0 1 4 4v10H27z"/>
      <path d="M14 30H7M7 26v8"/>`,
  },
  mapa: {
    label: "Mapa / Roteiro",
    paths: `
      <path d="M8 14l14-6 20 8 14-6v40l-14 6-20-8-14 6z"/>
      <path d="M22 8v40M42 16v40"/>`,
  },
  camera: {
    label: "Fotografia",
    paths: `
      <rect x="8" y="18" width="48" height="32" rx="4"/>
      <path d="M22 18l4-6h12l4 6"/>
      <circle cx="32" cy="34" r="9"/><circle cx="48" cy="25" r="1"/>`,
  },
  tenda: {
    label: "Campismo",
    paths: `
      <path d="M4 52h56M10 52l22-36 22 36"/>
      <path d="M26 6l6 10 6-10M24 52l8-13 8 13"/>`,
  },
  bussola: {
    label: "Aventura / Guia",
    paths: `
      <circle cx="32" cy="32" r="24"/>
      <path d="M41 23l-5 13-13 5 5-13z"/><circle cx="32" cy="32" r="1.5"/>`,
  },
  barco: {
    label: "Barco",
    paths: `
      <path d="M6 42h52l-6 10H12z"/>
      <path d="M32 42V8l16 26H32M28 14L16 34h12"/>
      <path d="M4 58c4 0 4-2 8-2s4 2 8 2 4-2 8-2 4 2 8 2 4-2 8-2 4 2 8 2"/>`,
  },
  placa: {
    label: "Destinos (placa)",
    paths: `
      <path d="M30 6v52M22 58h18"/>
      <path d="M30 14h18l6 5-6 5H30M30 30H14l-6 5 6 5h16"/>`,
  },
};

export const DEFAULT_ICON = "bussola";

/** Devolve o <svg> do ícone (ou o ícone por defeito). */
export function serviceIconSVG(key, className = "") {
  const icon = SERVICE_ICONS[key] || SERVICE_ICONS[DEFAULT_ICON];
  return `<svg${className ? ` class="${className}"` : ""} viewBox="0 0 64 64" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.paths}</svg>`;
}