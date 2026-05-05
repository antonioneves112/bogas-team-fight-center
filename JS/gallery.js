/* JS/gallery.js */
class GallerySystem {
  constructor() {
    this.modal = document.querySelector(".slider-section");
    this.wrapper = document.querySelector(".slider-stage");
    this.caption = document.querySelector(".slider-caption");
    this.prevBtn = document.querySelector(".slider-btn.prev");
    this.nextBtn = document.querySelector(".slider-btn.next");
    this.closeBtn = document.querySelector(".close-slider");

    this.items = [];
    this.currentIndex = 0;

    this.initEvents();
  }

  initEvents() {
    if (!this.modal) return;

    this.closeBtn.addEventListener("click", () => this.close());
    this.prevBtn.addEventListener("click", () => this.nav(-1));
    this.nextBtn.addEventListener("click", () => this.nav(1));

    // Teclado
    document.addEventListener("keydown", (e) => {
      if (!this.modal.classList.contains("active")) return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowLeft") this.nav(-1);
      if (e.key === "ArrowRight") this.nav(1);
    });

    // Mobile Swipe
    let touchStartX = 0;
    this.wrapper.addEventListener(
      "touchstart",
      (e) => (touchStartX = e.changedTouches[0].screenX),
      { passive: true },
    );
    this.wrapper.addEventListener(
      "touchend",
      (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) this.nav(1);
        if (touchEndX - touchStartX > 50) this.nav(-1);
      },
      { passive: true },
    );
  }

  open(items, index = 0) {
    if (!items || items.length === 0) return;
    this.items = items;
    this.currentIndex = index;
    this.modal.classList.add("active");
    document.body.classList.add("no-scroll");
    this.render();
  }

  close() {
    this.modal.classList.remove("active");
    document.body.classList.remove("no-scroll");
    const video = this.wrapper.querySelector("video");
    if (video) video.pause();
  }

  nav(direction) {
    this.currentIndex =
      (this.currentIndex + direction + this.items.length) % this.items.length;
    this.render();
  }

  render() {
    const item = this.items[this.currentIndex];
    this.wrapper.innerHTML = "";
    this.caption.textContent = item.caption || "";

    let mediaEl;
    if (item.type === "video") {
      mediaEl = document.createElement("video");
      mediaEl.src = item.src;
      mediaEl.controls = true;
      mediaEl.autoplay = true;
      mediaEl.className = "slider-media";
    } else {
      mediaEl = document.createElement("img");
      mediaEl.src = item.src;
      mediaEl.className = "slider-media";
    }
    this.wrapper.appendChild(mediaEl);
  }
}

// Inicializa globalmente
window.Gallery = new GallerySystem();
