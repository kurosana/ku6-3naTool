/**
 * トップページ演出・スクロール登場
 */
(function () {
  document.documentElement.classList.add("js-anim");

  function initTopImpact() {
    const app = document.getElementById("app");
    if (!app) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    app.classList.add("top-impact-shake");
    setTimeout(() => app.classList.remove("top-impact-shake"), 600);
  }

  function initRevealObserver() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-inview"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-inview");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
  }

  function initStaggerSlots(container) {
    if (!container) return;
    container.querySelectorAll(".data-slot-card").forEach((el, i) => {
      el.classList.add("slot-stagger");
      el.style.animationDelay = (i * 0.06) + "s";
    });
  }

  window.AnimService = {
    initTopImpact,
    initRevealObserver,
    initStaggerSlots,
    refreshReveal: function () {
      initRevealObserver();
    },
  };

  function ensureTopVisibleFallback() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.body.classList.add("top-anim-done");
      return;
    }
    setTimeout(() => document.body.classList.add("top-anim-done"), 1700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initTopImpact();
      initRevealObserver();
      ensureTopVisibleFallback();
    });
  } else {
    initTopImpact();
    initRevealObserver();
    ensureTopVisibleFallback();
  }
})();
