(() => {
  // Basic anti-clickjacking fallback (CSP frame-ancestors remains primary).
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  } catch (_error) {
    // Cross-origin frame access can throw; keep silent.
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const href = String(anchor.getAttribute("href") || "").trim();
    if (href.toLowerCase().startsWith("javascript:")) {
      event.preventDefault();
      return;
    }
    if (anchor.target === "_blank") {
      const currentRel = String(anchor.getAttribute("rel") || "");
      const relTokens = new Set(currentRel.split(/\s+/).filter(Boolean));
      relTokens.add("noopener");
      relTokens.add("noreferrer");
      anchor.setAttribute("rel", Array.from(relTokens).join(" "));
    }
  });
})();
