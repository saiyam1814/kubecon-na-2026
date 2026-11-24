// Apply a saved preference before rendering; otherwise CSS follows the system.
(() => {
  try {
    const mode = localStorage.getItem("kubecon-color-mode");
    if (mode === "light" || mode === "dark") {
      document.documentElement.dataset.colorMode = mode;
    }
  } catch (_) {
    // Browsing still works when storage is disabled (including local files).
  }
})();
