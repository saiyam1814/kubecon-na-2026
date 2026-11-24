(() => {
  const appearance = document.querySelector("#appearance");
  if (appearance) {
    appearance.value = document.documentElement.dataset.colorMode || "system";
    appearance.parentElement.hidden = false;
    appearance.addEventListener("change", () => {
      const mode = appearance.value;
      if (mode === "system") delete document.documentElement.dataset.colorMode;
      else document.documentElement.dataset.colorMode = mode;
      try { localStorage.setItem("kubecon-color-mode", mode); } catch (_) { /* Optional preference. */ }
    });
  }

  const controls = document.querySelector("#browse-controls");
  if (!controls) return;
  const search = document.querySelector("#search");
  const cards = [...document.querySelectorAll("[data-talk]")].map(element => ({
    element,
    search: element.dataset.search.toLocaleLowerCase(),
    track: element.dataset.track,
    themes: JSON.parse(element.dataset.themes),
  }));
  const buttons = [...controls.querySelectorAll("button[data-track], button[data-theme]")];
  const map = document.querySelector("#map-regions");
  const regions = [...document.querySelectorAll("[data-island]")];
  const dots = [...document.querySelectorAll("[data-map-dot]")].map(element => ({
    element, search: element.dataset.search.toLocaleLowerCase(),
    track: element.dataset.track, region: element.dataset.region,
  }));
  const preview = document.querySelector("#map-preview");
  let activeDot = null;
  let touchSelected = null;

  function showPreview(dot) {
    if (!preview) return;
    activeDot = dot;
    document.querySelector("#preview-title").textContent = dot.dataset.title;
    document.querySelector("#preview-speakers").textContent = dot.dataset.speakers;
    document.querySelector("#preview-track").textContent = dot.dataset.track;
    document.querySelector("#preview-link").setAttribute("href", dot.getAttribute("href"));
    preview.hidden = false;
  }

  function closePreview(restoreFocus = false) {
    if (!preview) return;
    if (restoreFocus && activeDot) activeDot.focus();
    preview.hidden = true;
    touchSelected = null;
  }

  for (const { element: dot } of dots) {
    let pointerType = "";
    dot.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") showPreview(dot); });
    dot.addEventListener("focus", () => showPreview(dot));
    dot.addEventListener("pointerdown", event => { pointerType = event.pointerType; });
    dot.addEventListener("click", event => {
      // A first finger tap previews; a second tap or the explicit link opens it.
      // Mouse clicks, modifier clicks and keyboard activation retain native links.
      if (pointerType === "touch" && event.detail !== 0 && touchSelected !== dot) {
        event.preventDefault();
        touchSelected = dot;
        showPreview(dot);
      }
    });
  }
  if (preview) {
    document.querySelector("#preview-close").addEventListener("click", () => closePreview(true));
    window.addEventListener("keydown", event => { if (event.key === "Escape") closePreview(true); });
    window.addEventListener("pointerdown", event => {
      if (!event.target.closest("[data-map-dot], #map-preview")) closePreview();
    });
  }
  const state = { track: "", theme: "" };

  function render(updateURL = true) {
    const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const matches = (!state.track || state.track === card.track)
        && (!state.theme || card.themes.includes(state.theme))
        && words.every(word => card.search.includes(word));
      card.element.hidden = !matches;
      if (matches) visible += 1;
    }
    for (const button of buttons) {
      const kind = button.hasAttribute("data-track") ? "track" : "theme";
      button.setAttribute("aria-pressed", String(button.dataset[kind] === state[kind]));
    }
    if (map) {
      map.dataset.filtered = String(words.length > 0 || !!state.track);
      map.dataset.focused = String(!!state.theme);
      for (const region of regions) region.dataset.active = String(!state.theme || region.dataset.island === state.theme);
      let highlighted = 0;
      for (const dot of dots) {
        const matches = (!state.track || state.track === dot.track) && words.every(word => dot.search.includes(word));
        dot.element.dataset.match = String(matches);
        if (matches && (!state.theme || state.theme === dot.region)) highlighted += 1;
      }
      document.querySelector("#map-status").textContent = words.length || state.track || state.theme
        ? `${highlighted} of ${dots.length} mapped talks highlighted`
        : `${dots.length} dots across ${regions.length} islands`;
      closePreview();
    }
    document.querySelector("#result-count").textContent = `${visible} of ${cards.length} talks`;
    document.querySelector("#no-results").hidden = visible !== 0 || cards.length === 0;
    if (updateURL) {
      const url = new URL(location.href);
      for (const [key, value] of Object.entries({ q: search.value, ...state })) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      // file:// previews and restrictive browsers may not allow history writes.
      try { history.replaceState(null, "", url); } catch (_) { /* Filtering is still local. */ }
    }
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    search.value = params.get("q") || "";
    for (const kind of ["track", "theme"]) {
      const value = params.get(kind) || "";
      state[kind] = buttons.some(button => button.dataset[kind] === value) ? value : "";
    }
    render(false);
  }

  controls.hidden = false;
  controls.addEventListener("submit", event => event.preventDefault());
  search.addEventListener("input", () => render());
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const kind = button.hasAttribute("data-track") ? "track" : "theme";
      state[kind] = button.dataset[kind];
      render();
    });
  }
  controls.addEventListener("reset", () => {
    search.value = "";
    state.track = state.theme = "";
    render();
  });
  window.addEventListener("popstate", readURL);
  readURL();
})();
