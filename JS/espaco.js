/* JS/espaco.js - PREMIUM UPDATE */

const imagesEspaco = [
  {
    type: "img",
    src: "../img/espaco.webp",
    caption: "Sala De Treino",
  },
  { type: "img", src: "../img/escritorios.jpg", caption: "Escritório" },
  { type: "img", src: "../img/vestiario.jpg", caption: "Vestiários" },
];

const trigger = document.querySelector(".js-open-gallery");
const slider = document.querySelector(".slider-section");

if (trigger && slider) {
  trigger.addEventListener("click", () => {
    // Ativa o sistema de galeria do teu gallery.js
    if (window.Gallery) {
      window.Gallery.open(imagesEspaco);
    }

    // Abre o contentor visual com animação
    slider.classList.add("is-active");
    document.body.style.overflow = "hidden"; // Trava o site
  });
}

// Função de fecho refinada
const closePremiumModal = () => {
  slider.style.opacity = "0";
  setTimeout(() => {
    slider.classList.remove("is-active");
    slider.style.opacity = "1";
    document.body.style.overflow = "auto";
  }, 300);
};

document
  .querySelector(".close-slider")
  ?.addEventListener("click", closePremiumModal);

// Fechar ao clicar fora da imagem
slider.addEventListener("click", (e) => {
  if (e.target === slider) closePremiumModal();
});

// Suporte para teclado
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePremiumModal();
});
