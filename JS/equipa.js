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
          dias: "Terças e Quintas",
          hora: "21:00 - 22:00",
        },
      ],
    },
    {
      nome: "Francisco António",
      foto: "./img/PRETO2.png",
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
          ginasio: "MonsterGym",
          modalidade: "Kickboxing",
          dias: "Segunda, Quarta e Sexta",
          hora: "08:00 - 09:00",
          dias2: "Terças e Quintas", // 🥊 GOLPE: Criámos a variável dias2 e hora2
          hora2: "13:00 - 14:00",
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
          dias: "Terças e Quintas",
          hora: "20:00 - 21:30",
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
