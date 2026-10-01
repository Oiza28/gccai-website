// Mobile menu
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("site-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
  });
}

// Photo lightbox
const box = document.querySelector(".lightbox");
if (box && typeof box.showModal === "function") {
  const img = box.querySelector("img");
  const cap = box.querySelector(".lightbox-caption");
  document.querySelectorAll(".gallery-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      img.src = btn.dataset.full;
      img.alt = btn.dataset.caption || "";
      cap.textContent = btn.dataset.caption || "";
      box.showModal();
    });
  });
  box.querySelector(".lightbox-close").addEventListener("click", () => box.close());
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
}
