// AULAS
const horarios = {
  bogas: [
    "<span> Sede - </span> AV. da República 97, 2745-213 Queluz",
    "<span>Segunda-feira : </span> 19:00 - 20:30",
    "<span>Quarta-feira : </span> 19:00 - 20:30",
    "<span>Sexta-feira : </span> 19:00 - 20:30",
  ],
  tone: [
    "<span> Sede - </span> AV. da República 97, 2745-213 Queluz",
    "<span>Segunda-feira : </span> 20:40 - 21:50",
    "<span>Quarta-feira : </span> 20:40 - 21:50",
    "<span>Sexta-feira : </span> 20:40 - 21:50",
    "<span> ---------------------------------------------------------",
    "<span> Life Gymnasium - </span> R. Dom Pedro IV 26, 2745-200 Queluz",
    "<span>Terça-feira : </span> 21:00 - 22:00",
    "<span>Quinta-feira : </span> 21:00 - 22:00",
  ],
  paulinho: [
    "<span>Monster Gym - </span> Praceta Armada das Índias 6 loja A, Cacém",
    "<span>Segunda-feira : </span> 08:00 - 09:00 | 19:30 - 20:30",
    "<span>Quarta-feira : </span> 08:00 - 09:00 | 19:30 - 20:30",
    "<span>Sexta-feira : </span> 08:00 - 09:00 | 19:30 - 20:30",
    "<span> ---------------------------------------------------------",
    "<span> Life Gymnasium - </span> R. Vitor Cordon 2 D, Mafra",
    "<span>Terça-feira : </span> 20:45 - 21:45",
    "<span>Quinta-feira : </span> 20:45 - 21:45",
  ],
  mauro: [
    "<span>Monster Gym Cacém - </span>Segunda-feira: 17:00 - 18:00",
    "<span>Segunda-feira : </span> 20:40 - 21:50",
    "<span>Quarta-feira : </span> 20:40 - 21:50",
    "<span>Sexta-feira : </span> 20:40 - 21:50",
  ],
};

const imagens = document.querySelectorAll(".modalidades img");
const quadro = document.getElementById("quadro-horarios");
const conteudo = document.getElementById("horarios-content");

imagens.forEach((img) => {
  img.addEventListener("click", () => {
    const modalidade = img.dataset.modalidade;
    const listaHorarios = horarios[modalidade];

    if (listaHorarios) {
      conteudo.innerHTML = listaHorarios.map((h) => `<p>${h}</p>`).join("");
      quadro.classList.remove("escondido");
    }
  });
});
