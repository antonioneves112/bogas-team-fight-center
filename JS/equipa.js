// JS/equipa.js - Gestão de Exibição da Equipa com Modalidade por Aula

document.addEventListener("DOMContentLoaded", () => {
  // 🥊 BASE DE DADOS LOCAL (Atualizada com modalidade por aula)
  const equipa = [
    {
      nome: "José 'Bogas' Oliveira",
      foto: "./img/equipa_bogas2.png",
      locais: [
        {
          ginasio: "Bogas Team Sede (Queluz)",
          modalidade: "Kickboxing",
          dias: "Segunda, Quarta e Sexta",
          hora: "19:15 - 20:30",
        },
      ],
    },
    {
      nome: "António Neves",
      foto: "./img/equipa_tone.png",
      locais: [
        {
          ginasio: "Bogas Team Sede (Queluz)",
          modalidade: "Kickboxing",
          dias: "Segunda, Quarta e Sexta",
          hora: "20:40 - 21:50",
        },
        {
          ginasio: "Life Gymnasium",
          modalidade: "Kickboxing",
          dias: "Terça e Quinta",
          hora: "21:00 - 22:00",
        },
      ],
    },
    {
      nome: "Francisco António",
      foto: "./img/equipa_chiquinho.jpg",
      locais: [
        {
          ginasio: "Bogas Team Sede (Queluz)",
          modalidade: "Boxe",
          dias: "Segunda, Quarta e Sexta",
          hora: "18:00 - 19:10",
        },
      ],
    },
    {
      nome: "Paulo Caro",
      foto: "./img/equipa_paulinho.png",
      locais: [
        {
          ginasio: "MonsterGym (Cacém)",
          modalidade: "Kickboxing",
          dias: "Segunda, Quarta e Sexta",
          hora: "08:00 - 09:00 <br> 19:30 - 20:30",
          dias2: "Terça e Quinta",
          hora2: "13:00 - 14:00",
        },
        // --- NOVO: ACADEMIA OCUPACIONAL (KIDS) ---
        {
          ginasio: "Academia Ocupacional (Mira Sintra)",
          modalidade: "Kickboxing Kids (6 aos 12)",
          dias: "Terça",
          hora: "19:00 - 19:45",
          dias2: "Quinta",
          hora2: "19:45 - 20:30",
        },
        // --- NOVO: ACADEMIA OCUPACIONAL (ADULTOS) ---
        {
          ginasio: "Academia Ocupacional  (Mira Sintra)",
          modalidade: "Kickboxing",
          dias: "Terça",
          hora: "19:45 - 20:45",
          dias2: "Quinta",
          hora2: "20:30 - 21:30",
        },
      ],
    },
    {
      nome: "Mauro Nunes",
      foto: "./img/equipa_mauro.png",
      locais: [
        {
          ginasio: "XL Gym (Pontinha)",
          modalidade: "Kickboxing",
          dias: "Terça e Quinta",
          hora: "20:00 - 21:30",
        },
        {
          ginasio: "Ginásio Super Tónico (Ajuda)",
          modalidade: "Kickboxing",
          dias: "Segunda, Quarta e Sexta",
          hora: "20:30 - 21:30",
        },
      ],
    },
  ];

  const grelha = document.getElementById("grelhaTreinadores");

  function renderizarEquipa() {
    if (!grelha) return;

    grelha.innerHTML = equipa
      .map(
        (treinador) => `
            <div class="treinador-card">
                <img src="${treinador.foto}" alt="${treinador.nome}" class="treinador-foto">
                <div class="treinador-info">
                    <h2 class="treinador-nome">${treinador.nome}</h2>
                    
                    <div class="treinador-horarios">
                        ${treinador.locais
                          .map(
                            (local) => `
                            <div class="local-aula">
                                <div class="local-nome">
                                    <i class='bx bx-map-pin'></i> ${local.ginasio}
                                </div>
                                <div class="local-mod-tag">${local.modalidade}</div>
                                
                                <div class="local-dias">
                                    <span>${local.dias}</span>
                                    <span class="hora-badge">${local.hora}</span>
                                </div>
                                
                                ${
                                  local.dias2
                                    ? `
                                <div class="local-dias" style="margin-top: 10px;">
                                    <span>${local.dias2}</span>
                                    <span class="hora-badge">${local.hora2}</span>
                                </div>
                                `
                                    : ""
                                }
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            </div>
        `,
      )
      .join("");
  }

  renderizarEquipa();
});
