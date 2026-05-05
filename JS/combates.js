/* JS/combates.js */
const combatesData = {
  moreirachallenge: [
    {
      type: "img",
      src: "../img/combates/moreirachallenge/luanacosta.JPG",
      caption: "Preparativos",
    },
    {
      type: "img",
      src: "../img/combates/moreirachallenge/luanabalneario.JPG",
      caption: "Balneário",
    },
    {
      type: "video",
      src: "../img/combates/moreirachallenge/aquecimento.MP4",
      caption: "Aquecimento",
    },
  ],
  fighterEvolution7: [
    {
      type: "img",
      src: "../img/combates/fighterevolution7/maos.PNG",
      caption: "Ligaduras",
    },
    {
      type: "img",
      src: "../img/combates/fighterevolution7/paulinho.JPG",
      caption: "Foco",
    },
    {
      type: "video",
      src: "../img/combates/fighterevolution7/vitoria.MP4",
      caption: "A Vitória",
    },
    {
      type: "img",
      src: "../img/combates/fighterevolution7/fotofinal.JPG",
      caption: "Equipa",
    },
  ],
};

// Lógica Simples: Clique -> Abre Galeria
document.querySelectorAll(".item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.key; // Nota: mudei data-graduacao para data-key no HTML
    if (combatesData[key]) {
      window.Gallery.open(combatesData[key]);
    } else {
      console.warn("Galeria não encontrada para:", key);
    }
  });
});
