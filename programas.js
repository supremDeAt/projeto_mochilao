/* =====================================================
   O MOCHILÃO — programa.js
   Dados de todos os programas + renderer dinâmico
   ===================================================== */

const PROGRAMAS = {
  malanje: {
    nome: "Malanje Tour",
    slogan: "Malanje espera por si.",
    duracao: "2 Dias",
    preco: "A partir de 760.000 Kz",
    partida: "Luanda",
    heroImg: "imagens/malanje_kiari.jpeg",
    fotoSecundaria: "imagens/malanje2.webp",
    descricao: `Terra de paisagens monumentais, rios imponentes, quedas de água deslumbrantes e formações rochosas que contam a história de milhões de anos, Malanje é um dos destinos mais fascinantes de Angola. Um lugar onde a natureza revela toda a sua grandiosidade e cada quilómetro percorrido reserva uma nova descoberta.<br><br>
    Em apenas 2 dias, convidamo-lo a mergulhar na essência desta província extraordinária, através de um roteiro cuidadosamente preparado para que viva o melhor que Malanje tem para oferecer.`,
    roteiro: [
      "Luanda",
      "Ndalatando (KN)",
      "City Tour",
      "Jardim Botânico / Kilombo",
      "Pedras Negras de Pungo a Ndongo",
      "Quedas de Kalandula",
      "Quedas de Musseleji",
    ],
    itinerario: [
      {
        dia: "Dia 1",
        titulo: "Luanda → Pedras Negras",
        texto:
          "Recepção e embarque num ponto a definir. Partida rumo a Malanje por Ndalatando com paragem pontual para almoço e visita ao Kilombo/Hortobotânico. Seguir rumo às Pedras Negras de Pungo a Ndongo. Após visita, partida rumo à cidade. Jantar e pernoita.",
        alojamento: "Hotel em Malanje",
      },
      {
        dia: "Dia 2",
        titulo: "Quedas de Kalandula + Musseleji → Regresso",
        texto:
          "Após pequeno-almoço, partimos para as Quedas de Kalandula com paragem pela área dos Eucaliptos. Vista superior e inferior das Quedas. Partida para as Quedas de Musseleji onde será feito o almoço à beira do rio. Após o almoço, regresso a Luanda.",
        alojamento: null,
      },
    ],
    precos: [
      { pax: "1 Pax", valor: "985.000 Kz" },
      { pax: "2 Pax", valor: "760.000 Kz" },
      { pax: "3 Pax", valor: "685.000 Kz" },
    ],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Transporte 4×4 / Autocarro ou Van + Combustível",
      "Recolha no ponto de encontro",
      "1 Noite em Hotel em quartos duplos",
      "Estrutura para Higiene e Necessidades",
      "Taxa de entrada em parques e sítios",
      "Todas as refeições de acordo ao itinerário",
      "Bebidas de cápsula: 2 refrigerantes ou cervejas por refeição + água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  "malanje-camping": {
    nome: "Malanje Tour — Camping",
    slogan: "Uma noite sob as estrelas em Pungo a Ndongo.",
    duracao: "2 Dias",
    preco: "A partir de 925.000 Kz",
    partida: "Luanda",
    heroImg: "imagens/malanje-camping.webp",
    fotoSecundaria: "imagens/malanje-camping2.webp",
    descricao: `A mesma grandiosidade de Malanje, mas com uma noite de acampamento em meio às imponentes Pedras Negras de Pungo a Ndongo ou nas maravilhosas Quedas de Kalandula. Veja o nascer e o pôr do sol em cenários de rara beleza, respire ar puro, desconecte da rotina.<br><br>
    Porque há lugares que se visitam… e há lugares que se vivem.`,
    roteiro: [
      "Luanda",
      "Dondo (KN)",
      "Quedas de Caculo e Cabaça",
      "Pedras Negras de Pungo a Ndongo",
      "Quedas de Kalandula",
      "Quedas de Musseleji",
    ],
    itinerario: [
      {
        dia: "Dia 1",
        titulo: "Luanda → Acampamento nas Pedras Negras",
        texto:
          "Recepção e embarque. Partida rumo a Malanje pelo Dondo com passagem pelas Quedas de Caculo e Cabaça. Almoço no percurso. Chegada ao nosso acampamento e interação com os locais nas Pedras Negras de Pungo a Ndongo. Jantar e acampamento.",
        alojamento: "Camping — Pedras Negras de Pungo a Ndongo",
      },
    ],
    precos: [
      { pax: "1 Pax", valor: "1.225.000 Kz" },
      { pax: "2 Pax", valor: "1.075.000 Kz" },
      { pax: "3 Pax", valor: "925.000 Kz" },
    ],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Transporte 4×4 / Autocarro ou Van + Combustível",
      "Recolha no ponto de encontro",
      "2 dias e 1 Noite em Camping + Equipamento",
      "Estrutura para Higiene e Necessidades",
      "Taxa de entrada em parques e sítios",
      "Todas as refeições de acordo ao itinerário",
      "Bebidas de cápsula: 2 refrigerantes ou cervejas por refeição + água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  "cabo-ledo": {
    nome: "Cabo Ledo Sobre Rodas",
    slogan: "A estrada é o caminho. A experiência é o destino.",
    duracao: "1 Dia",
    preco: "A partir de 90.000 Kz",
    partida: "Luanda",
    heroImg: "imagens/caboledo.webp",
    fotoSecundaria: "imagens/cabo-ledo2.webp",
    descricao: `Há dias em que a estrada deixa de ser apenas o caminho e passa a fazer parte da experiência.<br><br>
    Em um dia sobre rodas, partimos à descoberta de alguns dos cenários mais fascinantes da nossa costa: começamos pelo <strong>Miradouro da Lua</strong>, onde a paisagem parece ter saído de outro planeta; seguimos até à <strong>Gruta das Sereias</strong>, entre o mistério e a força do mar; e terminamos na <strong>Praia dos Surfistas</strong>, onde o azul do Atlântico encontra a energia descontraída de Cabo Ledo.<br><br>
    Vem viver Cabo Ledo de uma forma diferente.`,
    roteiro: [
      "Luanda",
      "Miradouro da Lua",
      "Gruta das Sereias",
      "Praia dos Surfistas (Carpe Diem)",
    ],
    itinerario: [
      {
        dia: "1 Dia",
        titulo: "Luanda → Cabo Ledo → Regresso 17h30",
        texto:
          "Recepção e embarque. Partida nas primeiras horas da manhã rumo a Cabo Ledo com breve paragem no Miradouro da Lua e passagem pela ponte sobre o Rio Kwanza. Exploração da Gruta das Sereias. Momentos tranquilos beira-mar em Carpe Diem. Regresso às 17h30.",
        alojamento: null,
      },
    ],
    precos: [
      { pax: "1 Pax", valor: "200.000 Kz" },
      { pax: "2 Pax", valor: "135.000 Kz" },
      { pax: "3 Pax", valor: "90.000 Kz" },
    ],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Autocarro ou Van + Combustível",
      "Recolha no ponto de encontro",
      "Equipamento de Exploração",
      "Bebidas de cápsula: 2 refrigerantes ou cervejas por refeição + água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Refeição",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  "huambo-aguas-frias": {
    nome: "Águas Frias — Huambo",
    slogan: "Um refúgio no coração do Huambo.",
    duracao: "3 Dias",
    preco: "A partir de 761.000 Kz",
    partida: "Luanda",
    heroImg: "imagens/huambo.webp",
    fotoSecundaria: "imagens/huambo2.webp",
    descricao: `Longe da agitação, existe um lugar onde o tempo parece passar mais devagar. No Alto Hama, Huambo, as Águas Frias convidam-nos a trocar o ruído da cidade pelo som da água a correr, o stress pela tranquilidade e a rotina por momentos de verdadeira conexão com a natureza.<br><br>
    Aqui pode escolher entre alojamento rústico ou camping, acordar ao som da natureza, passar o dia junto à água, explorar os arredores ou simplesmente não fazer nada e deixar que esse seja o plano.<br><br>
    Águas Frias não é apenas um lugar para visitar. É um lugar para desacelerar.`,
    roteiro: [
      "Luanda",
      "Dondo (KN)",
      "Waku Kungu",
      "Monte Luvili",
      "Águas Quentes do Alto Hama",
      "Águas Frias",
      "City Tour (opcional)",
    ],
    itinerario: [
      {
        dia: "Dia 1",
        titulo: "Luanda → Alto Hama",
        texto:
          "Recepção e embarque. Partida rumo a Huambo pelo Dondo com paragem na Quibala ou Waku Kungu para almoço. Seguir rumo ao Alto Hama com paragem para conhecer o Monte Luvili e as Águas Quentes. Jantar e pernoita.",
        alojamento: "Hotel / Bungalow no Alto Hama",
      },
      {
        dia: "Dia 2",
        titulo: "Águas Frias — Aventura e Exploração",
        texto:
          "Com energias renovadas e após o pequeno-almoço, começamos a nossa experiência de aventura e exploração. Almoço ao som do riacho acompanhado de prato típico local. Jantar e acampamento.",
        alojamento: "Camping — Águas Frias",
      },
      {
        dia: "Dia 3",
        titulo: "City Tour → Regresso a Luanda",
        texto:
          "Acordar ao som das águas. Pequeno-almoço antes de nos fazermos à estrada rumo à cidade para um breve City Tour. Regresso a Luanda.",
        alojamento: null,
      },
    ],
    precos: [
      { pax: "1 Pax", valor: "1.095.000 Kz" },
      { pax: "2 Pax", valor: "845.000 Kz" },
      { pax: "3 Pax", valor: "761.000 Kz" },
    ],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Transporte 4×4 / Autocarro ou Van + Combustível",
      "Recolha no ponto de encontro",
      "2 Dias e 1 Noite em Hotel / Bungalow ou Tenda",
      "Estrutura para Higiene e Necessidades",
      "Taxa de entrada em parques e sítios",
      "Todas as refeições de acordo ao itinerário",
      "Bebidas de cápsula: 2 refrigerantes ou cervejas por refeição + água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  "morro-do-moco": {
    nome: "Morro do Moço — Huambo",
    slogan: "O ponto mais alto de Angola espera por si.",
    duracao: "3 Dias",
    preco: "A partir de 920.000 Kz",
    partida: "Luanda",
    heroImg: "imagens/morro-moco.webp",
    fotoSecundaria: "imagens/morro-moco2.webp",
    descricao: `No coração do Huambo, ergue-se o Morro do Moço, o ponto mais alto de Angola. Um cenário de montanhas, vales, vegetação e paisagens que se transformam a cada passo do caminho.<br><br>
    Aqui, a viagem começa muito antes de chegar ao topo. É caminhar, superar cada subida, sentir o frio da altitude, contemplar o horizonte e descobrir, quilómetro após quilómetro, uma Angola selvagem e extraordinária.`,
    roteiro: [
      "Luanda",
      "Dondo (KN)",
      "Waku Kungu",
      "Monte Luvili",
      "Águas Quentes do Alto Hama",
      "Águas Frias",
      "Morro do Moço (2620m)",
    ],
    itinerario: [
      {
        dia: "Dia 1",
        titulo: "Luanda → Alto Hama",
        texto:
          "Recepção e embarque. Partida rumo a Huambo pelo Dondo com paragem na Quibala ou Waku Kungu para almoço. Seguir rumo ao Alto Hama com paragem para conhecer o Monte Luvili e as Águas Quentes. Jantar e pernoita.",
        alojamento: "Hotel / Bungalow no Alto Hama",
      },
      {
        dia: "Dia 2",
        titulo: "Subida ao Morro do Moço — 2.620m",
        texto:
          "Com energias renovadas, partimos rumo ao Morro do Moço. Pequeno-almoço pelo caminho. Visita aos dois Sobas Guardiões do Morro. Subida e descida dependem da dinâmica do grupo — a trilha testa os limites, mas não deixe de aproveitar a vista. Jantar e acampamento.",
        alojamento: "Camping — Morro do Moço",
      },
      {
        dia: "Dia 3",
        titulo: "Águas Frias → Regresso a Luanda",
        texto:
          "Acordar ao som sinfónico das águas — a recompensa ideal para quem desafiou os seus limites a 2620 metros de altitude. Pequeno-almoço antes de partir rumo a Luanda.",
        alojamento: null,
      },
    ],
    precos: [
      { pax: "1 Pax", valor: "1.320.000 Kz" },
      { pax: "2 Pax", valor: "1.020.000 Kz" },
      { pax: "3 Pax", valor: "920.000 Kz" },
    ],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Transporte 4×4 / Autocarro ou Van + Combustível",
      "Recolha no ponto de encontro",
      "2 Dias e 1 Noite em Bungalow ou Tenda",
      "Estrutura para Higiene e Necessidades",
      "Taxa de entrada em parques e sítios",
      "Todas as refeições de acordo ao itinerário",
      "Bebidas de cápsula: 2 refrigerantes ou cervejas por refeição + água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  namibe: {
    nome: "Namibe Tour — Deserto e Praia",
    slogan: "Silêncio do deserto, frescura do mar.",
    duracao: "3 Dias",
    preco: "1.000.000 Kz / Pax",
    partida: "Namibe (voo por conta própria)",
    heroImg: "imagens/namibe.webp",
    fotoSecundaria: "imagens/namibe2.webp",
    descricao: `Nesta viagem, vamos atravessar cenários que parecem pertencer a mundos diferentes. Sentir a força e o silêncio do deserto, percorrer estradas entre paisagens áridas e terminar junto ao mar, onde a areia encontra as ondas e o horizonte parece não ter fim.<br><br>
    É uma experiência de contrastes: calor e frescura, areia e água, silêncio e movimento. Um tour para quem quer descobrir um Namibe que não se explica apenas em fotografias — vive-se.`,
    roteiro: [
      "Transfer Aeroporto / Hotel",
      "Camelos (Caraculo)",
      "Piscinas Naturais do Piambo",
      "Praia do Soba",
      "Welwitschia Mirabilis",
      "Lagoa do Arco",
      "Colinas do Curoca",
    ],
    itinerario: [
      {
        dia: "Dia 1",
        titulo: "Chegada ao Namibe — Welwitschia + Colinas do Curoca",
        texto:
          "Recepção no Aeroporto Welwitschia Mirabilis. Mochilas nos carros e directo para o hotel. Lanche e visita à Welwitschia, ao Arco e às Colinas do Curoca. Almoço nas gigantes sombras das Colinas enquanto contemplamos o pôr do sol. Hotel e vida noturna de Moçâmedes.",
        alojamento: "Hotel em Moçâmedes",
      },
      {
        dia: "Dia 2",
        titulo: "Piscinas Naturais + Praia do Soba",
        texto:
          "Após pequeno-almoço, aventura rumo às Piscinas Naturais do Piambo e Praia do Soba. Almoço na magnífica Praia do Soba.",
        alojamento: "Hotel em Moçâmedes",
      },
      {
        dia: "Dia 3",
        titulo: "Camelos do Caraculo → Aeroporto",
        texto:
          "Após pequeno-almoço, mochilas feitas e partida para Caraculo para conhecer e passear com os famosos Camelos do Namibe. Regresso ao Aeroporto Welwitschia Mirabilis.",
        alojamento: null,
      },
    ],
    precos: [{ pax: "Por Pax", valor: "1.000.000 Kz" }],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Transporte 4×4 + Combustível (local)",
      "Recolha no ponto de encontro",
      "3 Dias e 2 Noites em Hotel em quartos duplos",
      "Taxa de entrada em parques e sítios",
      "Todas as refeições de acordo ao itinerário",
      "Bebidas de cápsula: 2 refrigerantes ou cervejas por refeição + água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Voos domésticos ou autocarro",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  "namibe-dia": {
    nome: "Namibe por 1 Dia",
    slogan: "Os encantos do Namibe em poucas horas.",
    duracao: "Meio Dia",
    preco: "190.000 Kz / Pax",
    partida: "Moçâmedes",
    heroImg: "imagens/namibe-dia.webp",
    fotoSecundaria: "imagens/namibe-dia2.webp",
    descricao: `Neste programa será possível conhecer os principais encantos da Província em apenas algumas horas. Parta do Namibe e inicie a sua viagem panorâmica pela paisagem desértica.<br><br>
    Um tour para quem quer descobrir um Namibe que não se explica apenas em fotografias — vive-se.`,
    roteiro: [
      "Welwitschia Mirabilis",
      "Lagoa do Arco",
      "Colinas do Curoca",
      "City Tour",
      "Regresso",
    ],
    itinerario: [
      {
        dia: "Dia 1",
        titulo: "Namibe — Tour Panorâmico",
        texto:
          "Welwitschia Mirabilis — uma das plantas mais antigas do mundo, com exemplares de mais de 2.000 anos. Lagoa do Arco rodeada por impressionantes formações rochosas. Colinas do Curoca, esculpidas pelo vento e pelo tempo. Breve City Tour por Moçâmedes. Regresso ao ponto de partida.",
        alojamento: null,
      },
    ],
    precos: [{ pax: "Por Pax", valor: "190.000 Kz" }],
    inclui: [
      "Guias + Motoristas",
      "Transporte 4×4 + Combustível (local)",
      "Recolha no ponto de encontro",
      "Água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Voos domésticos ou autocarro",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  "tuk-tuk": {
    nome: "Tuk Tuk City Tour — Luanda",
    slogan: "A Luanda histórica vista de um ângulo diferente.",
    duracao: "3 Horas",
    preco: "25.000 Kz / Pax",
    partida: "A definir",
    heroImg: "imagens/tuk-tuk.webp",
    fotoSecundaria: "imagens/tuk-tuk2.webp",
    descricao: `Neste tour teremos um passeio com vista panorâmica e cheia de aventura que os tuk tuks nos proporcionam. Vamos circular por entre a Luanda velha, antiga e histórica e acompanhar a vida do Luandense.`,
    roteiro: [
      "Primeiro de Maio",
      "Palácio Presidencial",
      "Assembleia Nacional",
      "Memorial António A. Neto",
      "Fortaleza de São Miguel",
      "Rua dos Mercadores",
      "Largo Rainha Njinga",
      "Baía e Ilha de Luanda",
      "Chicala de Luanda",
    ],
    itinerario: [
      {
        dia: "Tour",
        titulo: "Luanda Histórica de Tuk Tuk",
        texto:
          "Percurso panorâmico pelos principais pontos históricos e culturais de Luanda a bordo de tuk tuk. Uma forma divertida e única de conhecer a cidade.",
        alojamento: null,
      },
    ],
    precos: [{ pax: "Por Pax", valor: "25.000 Kz" }],
    inclui: [
      "Guias",
      "Transporte (Tuk Tuk)",
      "Recolha no ponto de encontro",
      "Taxa de entrada em parques e sítios",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Tudo o que não consta da lista dos incluídos",
      "Entradas, sobremesas e bebidas em restaurantes e bares",
    ],
  },

  quicama: {
    nome: "Safari na Quiçama",
    slogan: "Um dia inteiro à procura da vida selvagem angolana.",
    duracao: "1 Dia",
    preco: "A consultar",
    partida: "Luanda",
    heroImg: "imagens/quicama.webp",
    fotoSecundaria: "imagens/quicama2.webp",
    descricao: `O Parque Nacional da Quiçama é o maior parque nacional de Angola e um dos mais ricos em biodiversidade do continente. Um dia inteiro dedicado a explorar esta reserva natural única, onde a fauna e a flora angolana se mostram em todo o seu esplendor.`,
    roteiro: ["Luanda", "Parque Nacional da Quiçama", "Safari 4×4", "Regresso"],
    itinerario: [
      {
        dia: "1 Dia",
        titulo: "Safari no Parque Nacional da Quiçama",
        texto:
          "Partida de Luanda nas primeiras horas da manhã. Entrada no parque e safari 4×4 guiado pela reserva. Observação de fauna e flora angolana. Almoço no percurso. Regresso a Luanda ao final do dia.",
        alojamento: null,
      },
    ],
    precos: [{ pax: "Preço", valor: "A consultar" }],
    inclui: [
      "Guias + Motoristas + Assistência 24/24h",
      "Transporte 4×4 + Combustível",
      "Recolha no ponto de encontro",
      "Taxa de entrada no parque",
      "Água",
    ],
    naoInclui: [
      "Seguros de viagens",
      "Refeições",
      "Tudo o que não consta da lista dos incluídos",
    ],
  },
};

/* ─────────────────────────────────────────
   RENDERER — lê ?d= e popula a página
   ───────────────────────────────────────── */
(function () {
  "use strict";

  /* 1. Ler o parâmetro ?d= do URL */
  const params = new URLSearchParams(window.location.search);
  const id = params.get("d") || "malanje";
  const prog = PROGRAMAS[id];

  /* 2. Fallback se o id não existir */
  if (!prog) {
    document.querySelector(".pkg-hero__title").textContent =
      "Programa não encontrado";
    return;
  }

  /* 3. Atualizar <title> da página */
  document.title = prog.nome + " — O Mochilão Aventuras";

  /* 4. Hero */
  const heroSection = document.querySelector(".pkg-hero");
  if (prog.heroImg) {
    const heroFallback = "imagens/assis.webp";
    const heroImage = new Image();
    heroImage.onload = function () {
      heroSection.style.backgroundImage =
        'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%), url("' +
        prog.heroImg +
        '")';
    };
    heroImage.onerror = function () {
      heroSection.style.backgroundImage =
        'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%), url("' +
        heroFallback +
        '")';
    };
    heroImage.src = prog.heroImg;
    heroSection.style.backgroundSize = "cover";
    heroSection.style.backgroundPosition = "center";
  }
  document.querySelector(".pkg-breadcrumb span").textContent = prog.nome;
  document.querySelector(".pkg-hero__title").textContent = prog.nome;
  document.querySelector(".pkg-hero__desc").textContent = prog.slogan;

  /* 5. Título intro + foto secundária */
  const introTitle = document.getElementById("pkgTitle");
  if (introTitle) introTitle.textContent = prog.nome;

  const imgBox = document.querySelector(".pkg-img-box");
  if (imgBox && prog.fotoSecundaria) {
    imgBox.innerHTML =
      '<img src="' +
      prog.fotoSecundaria +
      '" alt="' +
      prog.nome +
      '" class="pkg-img-box__img">';
  }

  /* 6. Descrições */
  document.querySelector(".pkg-descricao").innerHTML = prog.descricao;
  const descCta = document.querySelector(".pkg-descricao-cta");
  if (descCta) descCta.innerHTML = prog.descricao;

  /* 7. Roteiro */
  const roteiroEl = document.querySelector(".pkg-roteiro__list");
  roteiroEl.innerHTML = prog.roteiro
    .map(function (stop) {
      return '<li><i class="fa-solid fa-circle-dot"></i>' + stop + "</li>";
    })
    .join("");

  /* 8. Detalhes */
  document.querySelector(".pkg-detail--dur .pkg-detail__value").textContent =
    prog.duracao;
  document.querySelector(".pkg-detail--preco .pkg-detail__value").textContent =
    prog.preco;
  document.querySelector(
    ".pkg-detail--partida .pkg-detail__value",
  ).textContent = prog.partida;

  /* 9. Galeria — placeholders se não houver fotos extra */
  const galleryGrid = document.getElementById("pkgGallery");
  if (galleryGrid) {
    if (prog.galeria && prog.galeria.length) {
      galleryGrid.innerHTML = prog.galeria
        .map(function (src, i) {
          return (
            '<div class="pkg-gallery__item' +
            (i === 0 ? " pkg-gallery__item--tall" : "") +
            '">' +
            '<img src="' +
            src +
            '" alt="" class="pkg-gallery__img"></div>'
          );
        })
        .join("");
    } else {
      /* Placeholders enquanto não há fotos */
      var ph = "";
      for (var i = 0; i < 5; i++) {
        ph +=
          '<div class="pkg-gallery__item' +
          (i === 0 ? " pkg-gallery__item--tall" : "") +
          '">' +
          '<div class="pkg-gallery__ph"><i class="fa-regular fa-image"></i></div></div>';
      }
      galleryGrid.innerHTML = ph;
    }
  }

  /* 9. Tabela de preços por pax */
  const precosEl = document.querySelector(".pkg-precos__list");
  precosEl.innerHTML = prog.precos
    .map(function (p) {
      return (
        "<li><span>" + p.pax + "</span><strong>" + p.valor + "</strong></li>"
      );
    })
    .join("");

  /* 10. Inclui / Não Inclui */
  document.querySelector(".pkg-inclui__list").innerHTML = prog.inclui
    .map(function (item) {
      return '<li><i class="fa-solid fa-check"></i>' + item + "</li>";
    })
    .join("");
  document.querySelector(".pkg-nao-inclui__list").innerHTML = prog.naoInclui
    .map(function (item) {
      return '<li><i class="fa-solid fa-xmark"></i>' + item + "</li>";
    })
    .join("");

  /* 11. Itinerário — accordion */
  const accordionEl = document.querySelector(".pkg-accordion");
  accordionEl.innerHTML = prog.itinerario
    .map(function (item, i) {
      const aloj = item.alojamento
        ? '<p class="pkg-accordion__note"><i class="fa-solid fa-moon"></i> Alojamento: ' +
          item.alojamento +
          "</p>"
        : "";
      return [
        '<div class="pkg-accordion__item">',
        '  <button class="pkg-accordion__trigger" aria-expanded="' +
          (i === 0 ? "true" : "false") +
          '">',
        '    <span class="pkg-accordion__day">' + item.dia + "</span>",
        '    <span class="pkg-accordion__label">' + item.titulo + "</span>",
        '    <i class="fa-solid fa-chevron-down pkg-accordion__icon"></i>',
        "  </button>",
        '  <div class="pkg-accordion__body" ' + (i === 0 ? "" : "hidden") + ">",
        "    <p>" + item.texto + "</p>",
        aloj,
        "  </div>",
        "</div>",
      ].join("\n");
    })
    .join("\n");

  /* 12. Accordion — toggle */
  accordionEl.addEventListener("click", function (e) {
    const trigger = e.target.closest(".pkg-accordion__trigger");
    if (!trigger) return;
    const isOpen = trigger.getAttribute("aria-expanded") === "true";
    const body = trigger.nextElementSibling;

    /* Fechar todos */
    accordionEl
      .querySelectorAll(".pkg-accordion__trigger")
      .forEach(function (t) {
        t.setAttribute("aria-expanded", "false");
        t.nextElementSibling.hidden = true;
      });

    /* Abrir o clicado (se estava fechado) */
    if (!isOpen) {
      trigger.setAttribute("aria-expanded", "true");
      body.hidden = false;
    }
  });

  /* 13. Outros programas — excluir o actual e mostrar até 3 */
  const outrosGrid = document.querySelector(".pkg-more .packages__grid");
  if (outrosGrid) {
    const outros = Object.keys(PROGRAMAS)
      .filter(function (k) {
        return k !== id;
      })
      .slice(0, 3);

    outrosGrid.innerHTML = outros
      .map(function (k) {
        const p = PROGRAMAS[k];
        const iconMap = {
          malanje: "fa-water",
          "malanje-camping": "fa-campground",
          "cabo-ledo": "fa-car-side",
          "huambo-aguas-frias": "fa-droplet",
          "morro-do-moco": "fa-mountain",
          namibe: "fa-sun",
          "namibe-dia": "fa-sun",
          "tuk-tuk": "fa-truck-pickup",
          quicama: "fa-paw",
        };
        const icon = iconMap[k] || "fa-map-location-dot";
        return [
          '<article class="package-card">',
          '  <div class="package-card__media">',
          p.heroImg
            ? '<img src="' +
              p.heroImg +
              '" alt="' +
              p.nome +
              '" class="package-card__img">'
            : '<div class="package-card__ph"><i class="fa-solid ' +
              icon +
              '"></i></div>',
          "  </div>",
          '  <div class="package-card__body">',
          '    <h3 class="package-card__title">' + p.nome + "</h3>",
          '    <p class="package-card__desc">' + p.slogan + "</p>",
          '    <div class="package-card__meta">',
          '      <div class="package-card__meta-item">',
          '        <span class="package-card__meta-label">Preço/Pax</span>',
          '        <span class="package-card__meta-value">' +
            p.preco +
            "</span>",
          "      </div>",
          '      <div class="package-card__meta-item">',
          '        <span class="package-card__meta-label">Duração</span>',
          '        <span class="package-card__meta-value">' +
            p.duracao +
            "</span>",
          "      </div>",
          "    </div>",
          '    <div class="package-card__actions">',
          '      <a href="programa.html?d=' +
            k +
            '" class="btn btn--primary btn--sm pkg-btn">Saber Mais</a>',
          "    </div>",
          "  </div>",
          "</article>",
        ].join("\n");
      })
      .join("\n");
  }

  /* 14. Navbar scroll (reutiliza lógica do site principal) */
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener(
      "scroll",
      function () {
        navbar.classList.toggle("scrolled", window.scrollY > 60);
      },
      { passive: true },
    );
  }

  /* 15. Burger menu */
  const burgerBtn = document.getElementById("burgerBtn");
  const navLinksBar = document.getElementById("navLinks");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("closeBtn");

  if (burgerBtn && navLinksBar) {
    burgerBtn.addEventListener("click", function () {
      const open = navLinksBar.classList.toggle("is-open");
      burgerBtn.classList.toggle("is-active", open);
      if (sidebar)
        sidebar.classList.toggle("is-open", open && window.innerWidth <= 640);
      if (sidebarOverlay)
        sidebarOverlay.classList.toggle(
          "is-open",
          open && window.innerWidth <= 640,
        );
    });
    if (closeBtn)
      closeBtn.addEventListener("click", function () {
        navLinksBar.classList.remove("is-open");
        burgerBtn.classList.remove("is-active");
        if (sidebar) sidebar.classList.remove("is-open");
        if (sidebarOverlay) sidebarOverlay.classList.remove("is-open");
      });
  }
})();