// Dados estruturados (Schema.org / JSON-LD) para o Google: nome, morada, horário, redes.
// Ajuda o ginásio a aparecer com mais informação na pesquisa e no Maps.
// Fica num ficheiro JS (e não num <script> no HTML) por causa da regra do projeto;
// o Google lê JSON-LD injetado por JavaScript.
// O horário vem de JS/horario-dados.js (fonte única), que tem de ser carregado antes.
(() => {
  "use strict";

  const SITE = "https://www.bogasteamkickboxing.pt";

  const DIAS = {
    "Segunda-feira": "Monday",
    "Terça-feira": "Tuesday",
    "Quarta-feira": "Wednesday",
    "Quinta-feira": "Thursday",
    "Sexta-feira": "Friday",
    Sábado: "Saturday",
    Domingo: "Sunday",
  };

  // Por dia: abre na primeira aula e fecha no fim da última ("HH:MM" compara bem como texto).
  const HORARIO = (window.HORARIO_AULAS || []).flatMap(({ day, classes }) => {
    const horas = classes.map((c) => c.time.split("-").map((h) => h.trim()));
    if (!DIAS[day] || !horas.length) return [];
    return [{
      dias: [DIAS[day]],
      abre: horas.map(([inicio]) => inicio).sort()[0],
      fecha: horas.map(([, fim]) => fim).sort().pop(),
    }];
  });

  const ginasio = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    "@id": `${SITE}/#ginasio`,
    name: "Bogas Team Fight Center",
    alternateName: "Bogas Team Kickboxing",
    description:
      "Escola de Kickboxing e Boxe em Queluz. Aulas para todas as idades e níveis, da iniciação à competição.",
    url: `${SITE}/`,
    logo: `${SITE}/img/icones/icon-512.png`,
    image: `${SITE}/img/PRETO.webp`,
    email: "geral@bogasteam.pt",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. da República 97",
      addressLocality: "Queluz",
      addressRegion: "Lisboa",
      addressCountry: "PT",
    },
    hasMap: "https://www.google.com/maps/search/?api=1&query=Bogas+Team+Fight+Academy+Queluz&query_place_id=ChIJw_IebAjNHg0RfTVDK-bnATE",
    sameAs: ["https://www.instagram.com/bogasteam.kickboxing/"],
    openingHoursSpecification: HORARIO.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.dias,
      opens: h.abre,
      closes: h.fecha,
    })),
  };

  const el = document.createElement("script");
  el.type = "application/ld+json";
  el.textContent = JSON.stringify(ginasio);
  document.head.appendChild(el);
})();
