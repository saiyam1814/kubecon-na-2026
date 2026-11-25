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

  const technologyControls = document.querySelector("#technology-controls");
  if (technologyControls) {
    const technologySearch = document.querySelector("#technology-search");
    const technologies = [...document.querySelectorAll("[data-technology]")];
    function renderTechnologies(updateURL = true) {
      const words = technologySearch.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let count = 0;
      for (const technology of technologies) {
        technology.hidden = !words.every(word => technology.dataset.search.toLocaleLowerCase().includes(word));
        if (!technology.hidden) count += 1;
      }
      document.querySelector("#technology-count").textContent = `${count} of ${technologies.length} technologies`;
      document.querySelector("#technology-empty").hidden = count !== 0 || technologies.length === 0;
      if (updateURL) {
        const url = new URL(location.href);
        if (technologySearch.value) url.searchParams.set("q", technologySearch.value);
        else url.searchParams.delete("q");
        try { history.replaceState(null, "", url); } catch (_) { /* Local search still works. */ }
      }
    }
    function readTechnologyURL() {
      technologySearch.value = new URLSearchParams(location.search).get("q") || "";
      renderTechnologies(false);
    }
    technologyControls.hidden = false;
    technologyControls.addEventListener("submit", event => event.preventDefault());
    technologySearch.addEventListener("input", () => renderTechnologies());
    technologyControls.addEventListener("reset", () => { technologySearch.value = ""; renderTechnologies(); });
    window.addEventListener("popstate", readTechnologyURL);
    readTechnologyURL();
  }

  const controls = document.querySelector("#browse-controls");
  if (!controls) return;
  const search = document.querySelector("#search");
  const cards = [...document.querySelectorAll("[data-talk]")].map(element => ({
    element,
    search: element.dataset.search.toLocaleLowerCase(),
    track: element.dataset.track,
    themes: JSON.parse(element.dataset.themes),
    technologies: JSON.parse(element.dataset.technologies || "[]").map(value => value.toLocaleLowerCase()),
    demo: element.dataset.demo,
    length: element.dataset.length || "",
    level: element.dataset.level || "",
    type: element.dataset.type || "",
  }));
  const buttons = [...controls.querySelectorAll("button[data-track], button[data-theme]")];
  const selects = [...controls.querySelectorAll("select[data-filter]")];
  const cardsByID = new Map(cards.map(card => [card.element.dataset.talk, card]));
  const map = document.querySelector("#map-regions");
  const regions = [...document.querySelectorAll("[data-island]")];
  const dots = [...document.querySelectorAll("[data-map-dot]")].map(element => ({
    element, search: element.dataset.search.toLocaleLowerCase(),
    track: element.dataset.track, region: element.dataset.region,
    card: cardsByID.get(element.dataset.mapDot),
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
  const state = { track: "", theme: "", technology: "", demo: "", length: "", level: "", type: "" };

  function matchesBase(talk, words) {
    if (!talk) return false;
    const length = !talk.length ? "unknown" : Number(talk.length) <= 15 ? "short"
      : Number(talk.length) <= 30 ? "standard" : "long";
    return (!state.track || state.track === talk.track)
      && (!state.technology || talk.technologies.includes(state.technology.toLocaleLowerCase()))
      && (!state.demo || state.demo === talk.demo)
      && (!state.length || state.length === length)
      && (!state.level || state.level === (talk.level || "unknown"))
      && (!state.type || state.type === (talk.type || "unknown"))
      && words.every(word => talk.search.includes(word));
  }

  function render(updateURL = true, push = false) {
    const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const matches = matchesBase(card, words) && (!state.theme || card.themes.includes(state.theme));
      card.element.hidden = !matches;
      if (matches) visible += 1;
    }
    for (const button of buttons) {
      const kind = button.hasAttribute("data-track") ? "track" : "theme";
      button.setAttribute("aria-pressed", String(button.dataset[kind] === state[kind]));
    }
    for (const select of selects) select.value = state[select.dataset.filter];
    if (map) {
      map.dataset.filtered = String(words.length > 0 || Object.entries(state).some(([kind, value]) => kind !== "theme" && !!value));
      map.dataset.focused = String(!!state.theme);
      for (const region of regions) region.dataset.active = String(!state.theme || region.dataset.island === state.theme);
      let highlighted = 0;
      for (const dot of dots) {
        const matches = matchesBase(dot.card, words);
        dot.element.dataset.match = String(matches);
        if (matches && (!state.theme || state.theme === dot.region)) highlighted += 1;
      }
      document.querySelector("#map-status").textContent = words.length || Object.values(state).some(Boolean)
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
      try {
        if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
      } catch (_) { /* Filtering is still local. */ }
    }
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    search.value = params.get("q") || "";
    for (const kind of ["track", "theme"]) {
      const value = params.get(kind) || "";
      state[kind] = buttons.some(button => button.dataset[kind] === value) ? value : "";
    }
    for (const select of selects) {
      const kind = select.dataset.filter;
      const value = params.get(kind) || "";
      const option = [...select.options].find(option => option.value === value || (kind === "technology" &&
        [option.value, ...JSON.parse(option.dataset.aliases || "[]")].some(alias => alias.toLocaleLowerCase() === value.toLocaleLowerCase())));
      state[kind] = option?.value || "";
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
      render(true, true);
    });
  }
  for (const select of selects) select.addEventListener("change", () => {
    state[select.dataset.filter] = select.value;
    render(true, true);
  });
  controls.addEventListener("reset", event => {
    // We own the explicit All state; native reset may restore navigation defaults
    // after this listener and make the visible choices disagree with the results.
    event.preventDefault();
    search.value = "";
    for (const kind of Object.keys(state)) state[kind] = "";
    render(true, true);
  });
  window.addEventListener("popstate", readURL);
  readURL();
})();
