// ===========================================================
// 👕 outfit_system_single_sprite.js — Layered dress-up system
// ===========================================================
// Reads everything from window.OUTFIT_CONFIG (see outfit_config.js) — one
// plain-JS source of truth, loaded synchronously (no fetch, can't glitch).
//
// To ADD CLOTHES you only edit outfit_config.js. This file just renders and
// applies that config: the Dress Up panel (with image thumbnails), the colour
// tinting, the layering by z, and the girl/boy clothing rules.
//
// Rules preserved from before:
// - Pet 1 is the girl: top underwear + bottom underwear, or a one-piece.
// - Pet 2 is the boy: bottom underwear / boxers only (no top/one-piece).
// - Girl one-piece clears top/bottom underwear.
// - Girl top/bottom underwear clears one-piece and auto-pairs the matching
//   set number.
// - Dress clears top + bottom; top or bottom clears dress.
(() => {
  const DEFAULT_COLOR = "Original";
  const COLORS = {
    Original: null,
    Red: "#ff3b30", Orange: "#ff9500", Yellow: "#ffcc00",
    Green: "#34c759", Cyan: "#32ade6", Blue: "#007aff",
    Purple: "#af52de", Pink: "#ff2d55",
  };

  // ---- Built-in fallback so the game still runs if the config is missing ----
  const FALLBACK_CONFIG = {
    categories: [
      { key: "topUnderwear", label: "Top Underwear", z: 60 },
      { key: "bottomUnderwear", label: "Bottom Underwear / Boxers", z: 50 },
      { key: "onepieceUnderwear", label: "One-Piece Underwear", z: 65 },
      { key: "top", label: "Top", z: 120 },
      { key: "bottom", label: "Pants / Skirt", z: 110 },
      { key: "dress", label: "Dress", z: 130 },
      { key: "shoes", label: "Shoes", z: 90 },
      { key: "hat", label: "Hat", z: 180 },
    ],
    pet1: {}, pet2: {},
    defaults: { pet1: {}, pet2: {} },
  };

  // ---- Helpers --------------------------------------------------------------
  function img(src) {
    const im = new Image();
    im._failed = false;
    im.onerror = () => { im._failed = true; };
    im.src = src; // asset_path_fix.js rewrites bare names to images/<name>
    return im;
  }

  // "top2" -> "Top 2", "top1_2" -> "Top 1", "boxers1_2" -> "Boxers 1"
  function humanize(id) {
    const base = String(id).replace(/_\d+$/, "");
    const m = base.match(/^([a-zA-Z]+?)(\d+)$/);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1) + " " + m[2];
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // Accept either "top1" or { id, label, prefix }.
  function normItem(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === "string" || typeof entry === "number") {
      const id = String(entry);
      return { id, label: humanize(id), prefix: id };
    }
    const id = entry.id || entry.prefix;
    if (!id) return null;
    return {
      id: String(id),
      label: entry.label || humanize(id),
      prefix: String(entry.prefix || id),
    };
  }

  function emptyCat(def) {
    return {
      label: def.label || def.key,
      z: Number(def.z) || 100,
      items: { 0: { id: 0, label: "None", img: null } },
    };
  }

  // ---- Build the catalog from the config (synchronous) ----------------------
  const cfg = (window.OUTFIT_CONFIG && Array.isArray(window.OUTFIT_CONFIG.categories))
    ? window.OUTFIT_CONFIG
    : FALLBACK_CONFIG;

  const cats = cfg.categories.map(c => ({
    key: c.key, label: c.label || c.key, z: Number(c.z) || 100,
  }));

  function buildCatalog() {
    const catalog = { 0: {}, 1: {} };
    [0, 1].forEach(p => cats.forEach(c => { catalog[p][c.key] = emptyCat(c); }));
    const wardrobes = { 0: cfg.pet1 || {}, 1: cfg.pet2 || {} };
    [0, 1].forEach(p => {
      cats.forEach(c => {
        const list = wardrobes[p][c.key];
        if (!Array.isArray(list)) return;
        list.forEach(entry => {
          const it = normItem(entry);
          if (it) catalog[p][c.key].items[it.id] = { id: it.id, label: it.label, img: img(`${it.prefix}.png`) };
        });
      });
    });
    return catalog;
  }

  const defaults = (() => {
    const out = { 0: {}, 1: {} };
    const src = { 0: (cfg.defaults && cfg.defaults.pet1) || {}, 1: (cfg.defaults && cfg.defaults.pet2) || {} };
    [0, 1].forEach(p => cats.forEach(c => { out[p][c.key] = src[p][c.key] != null ? src[p][c.key] : 0; }));
    return out;
  })();

  window.dressUpCatalog = buildCatalog();
  if (typeof window.activePetIndex !== "number") window.activePetIndex = 0;

  function makeSelected() {
    return [0, 1].map(p => {
      const o = {};
      cats.forEach(c => o[c.key] = defaults[p][c.key] != null ? defaults[p][c.key] : 0);
      return o;
    });
  }
  function makeColors() {
    return [0, 1].map(() => {
      const o = {};
      cats.forEach(c => o[c.key] = DEFAULT_COLOR);
      return o;
    });
  }

  window.selectedClothes = window.selectedClothes || makeSelected();
  window.clothingColors = window.clothingColors || makeColors();
  window.currentOutfits = [0, 0];
  window.currentOutfit = 0;

  function activePet() {
    const n = Number(window.activePetIndex);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, Math.floor(n))) : 0;
  }

  function catKeys(p = activePet()) {
    const catalog = window.dressUpCatalog[p] || window.dressUpCatalog[0] || {};
    return cats.map(c => c.key).filter(k => {
      if (!catalog[k]) return false;
      // Pet 2 (boy) has no top underwear / one-piece underwear.
      if (p === 1 && (k === "topUnderwear" || k === "onepieceUnderwear")) return false;
      return true;
    });
  }

  function normalizeState() {
    const sel = makeSelected();
    const cols = makeColors();
    [0, 1].forEach(p => {
      window.selectedClothes[p] = window.selectedClothes[p] || {};
      window.clothingColors[p] = window.clothingColors[p] || {};
      cats.forEach(c => {
        if (window.selectedClothes[p][c.key] === undefined) window.selectedClothes[p][c.key] = sel[p][c.key];
        if (window.clothingColors[p][c.key] === undefined) window.clothingColors[p][c.key] = cols[p][c.key];
      });
    });
  }

  // ---- Clothing rules -------------------------------------------------------
  function setNumberFromId(id) {
    const m = String(id || "").match(/(\d+)(?:_\d+)?$/);
    return m ? m[1] : null;
  }
  function findItemBySetNumber(p, category, n) {
    if (!n) return 0;
    const items = (window.dressUpCatalog[p] && window.dressUpCatalog[p][category] && window.dressUpCatalog[p][category].items) || {};
    const ids = Object.keys(items).filter(id => id !== "0");
    return ids.find(id => setNumberFromId(id) === String(n)) || 0;
  }
  function applyUnderwearRules(p, category, id) {
    if (p !== 0) return;                 // girl-only pairing
    if (id === 0 || id === "0") return;
    if (category === "onepieceUnderwear") {
      window.selectedClothes[p].topUnderwear = 0;
      window.selectedClothes[p].bottomUnderwear = 0;
      return;
    }
    if (category === "topUnderwear" || category === "bottomUnderwear") {
      const n = setNumberFromId(id);
      window.selectedClothes[p].onepieceUnderwear = 0;
      const topMatch = findItemBySetNumber(p, "topUnderwear", n);
      const bottomMatch = findItemBySetNumber(p, "bottomUnderwear", n);
      if (topMatch) window.selectedClothes[p].topUnderwear = topMatch;
      if (bottomMatch) window.selectedClothes[p].bottomUnderwear = bottomMatch;
    }
  }
  function applyDressRules(p, category, id) {
    if (id === 0 || id === "0") return;
    if (category === "dress") {
      window.selectedClothes[p].top = 0;
      window.selectedClothes[p].bottom = 0;
      return;
    }
    if (category === "top" || category === "bottom") {
      window.selectedClothes[p].dress = 0;
    }
  }
  function applyClothingRules(p, category, id) {
    applyUnderwearRules(p, category, id);
    applyDressRules(p, category, id);
  }

  // ---- Colour tinting -------------------------------------------------------
  const tintCache = new Map();
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }
  function tintedImage(source, hex) {
    if (!hex || !source || source._failed || !source.complete || !source.naturalWidth) return source;
    const key = `${source.src}|${hex}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const rgb = hexToRgb(hex);
    if (!rgb) return source;
    const cv = document.createElement("canvas");
    cv.width = source.naturalWidth;
    cv.height = source.naturalHeight;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    try {
      cx.drawImage(source, 0, 0);
      const imageData = cx.getImageData(0, 0, cv.width, cv.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        const shade = Math.max(0.18, Math.min(1.25, lum * 1.35));
        d[i] = Math.min(255, rgb.r * shade);
        d[i + 1] = Math.min(255, rgb.g * shade);
        d[i + 2] = Math.min(255, rgb.b * shade);
      }
      cx.putImageData(imageData, 0, 0);
    } catch (_) {
      return source;
    }
    const out = new Image();
    out.src = cv.toDataURL("image/png");
    tintCache.set(key, out);
    return out;
  }
  function safeDraw(ctx, image, x, y, w, h) {
    if (!image || image._failed || !image.complete || !image.naturalWidth) return false;
    ctx.drawImage(image, x, y, w, h);
    return true;
  }

  // ---- UI: button + panel ---------------------------------------------------
  let selectedCategory = catKeys()[0] || (cats[0] && cats[0].key) || "top";

  const btnCss = "border:0;border-radius:9px;padding:7px 10px;margin:3px;background:rgba(0,0,0,.08);cursor:pointer;font-size:13px;white-space:nowrap;";
  function btn(text) {
    const b = document.createElement("button");
    b.textContent = text;
    b.style.cssText = btnCss;
    return b;
  }

  let dressBtn = document.getElementById("dressup-btn");
  if (!dressBtn) {
    dressBtn = document.createElement("button");
    dressBtn.id = "dressup-btn";
    dressBtn.style.cssText = "position:fixed;right:10px;bottom:calc(65px + env(safe-area-inset-bottom));z-index:9998;padding:6px 12px;font-size:clamp(11px,2.5vw,14px);cursor:pointer;border-radius:8px;border:none;background:rgba(255,255,255,.92);box-shadow:0 2px 8px rgba(0,0,0,.15);white-space:nowrap;";
    document.body.appendChild(dressBtn);
  }
  window.clothesBtn = dressBtn;

  let panel = document.getElementById("dressup-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "dressup-panel";
    panel.style.cssText = "position:fixed;right:10px;bottom:calc(108px + env(safe-area-inset-bottom));width:min(360px,calc(100vw - 20px));max-height:54vh;overflow:auto;display:none;z-index:9999;padding:10px;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 6px 24px rgba(0,0,0,.22);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    document.body.appendChild(panel);
  }

  function updateButtonLabel() {
    const p = activePet();
    const count = catKeys(p).map(k => window.selectedClothes[p] && window.selectedClothes[p][k]).filter(v => v !== 0 && v !== "0" && v != null).length;
    dressBtn.textContent = `👗 Dress Up (Pet ${p + 1}: ${count} item${count === 1 ? "" : "s"})`;
  }

  // A clothing item shown as an image thumbnail (falls back to text/emoji).
  function itemThumb(it, active, onClick) {
    const b = document.createElement("button");
    b.title = it.label || String(it.id);
    b.style.cssText =
      "display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;" +
      "width:66px;height:78px;padding:5px;cursor:pointer;border-radius:10px;" +
      `border:2px solid ${active ? "#f59e0b" : "rgba(0,0,0,.12)"};` +
      `background:${active ? "#fff7e6" : "#fff"};`;

    const isNone = it.id === 0 || it.id === "0";
    if (isNone) {
      const icon = document.createElement("div");
      icon.textContent = "🚫";
      icon.style.cssText = "flex:1;display:flex;align-items:center;font-size:24px;opacity:.7;";
      b.appendChild(icon);
    } else if (it.img && !it.img._failed) {
      const im = document.createElement("img");
      im.src = it.img.src;
      im.alt = it.label || "";
      im.draggable = false;
      im.style.cssText = "flex:1;width:48px;height:48px;object-fit:contain;";
      im.onerror = () => { im.replaceWith(emojiFallback()); };
      b.appendChild(im);
    } else {
      b.appendChild(emojiFallback());
    }

    const lab = document.createElement("div");
    lab.textContent = it.label || String(it.id);
    lab.style.cssText = "font-size:10px;line-height:1.1;text-align:center;max-width:62px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    b.appendChild(lab);

    b.onclick = onClick;
    return b;

    function emojiFallback() {
      const d = document.createElement("div");
      d.textContent = "👕";
      d.style.cssText = "flex:1;display:flex;align-items:center;font-size:24px;opacity:.55;";
      return d;
    }
  }

  function renderPanel() {
    const p = activePet();
    const catalog = window.dressUpCatalog[p] || window.dressUpCatalog[0] || {};
    const keys = catKeys(p);
    if (!keys.includes(selectedCategory)) selectedCategory = keys[0] || (cats[0] && cats[0].key);
    panel.innerHTML = "";

    // Title + close
    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;";
    title.innerHTML = `<span>Pet ${p + 1} Dress Up</span>`;
    const close = btn("✕");
    close.style.padding = "4px 8px";
    close.onclick = () => { panel.style.display = "none"; };
    title.appendChild(close);
    panel.appendChild(title);

    // Category tabs
    const row = document.createElement("div");
    row.style.cssText = "display:flex;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;";
    keys.forEach(k => {
      const b = btn(catalog[k].label || k);
      if (k === selectedCategory) b.style.cssText += "background:rgba(0,0,0,.22);font-weight:700;";
      b.onclick = () => { selectedCategory = k; renderPanel(); };
      row.appendChild(b);
    });
    panel.appendChild(row);

    const cat = catalog[selectedCategory];
    if (!cat) return;

    // Items as thumbnails
    const itemTitle = document.createElement("div");
    itemTitle.textContent = "Item";
    itemTitle.style.cssText = "font-weight:600;margin:4px 0;";
    panel.appendChild(itemTitle);

    const items = document.createElement("div");
    items.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;";
    Object.entries(cat.items || {}).forEach(([id, it]) => {
      const active = String(window.selectedClothes[p] && window.selectedClothes[p][selectedCategory]) === String(id);
      const b = itemThumb(it, active, () => {
        window.selectedClothes[p][selectedCategory] = id === "0" ? 0 : id;
        applyClothingRules(p, selectedCategory, window.selectedClothes[p][selectedCategory]);
        renderPanel();
        updateButtonLabel();
      });
      items.appendChild(b);
    });
    panel.appendChild(items);

    // Colours
    const colorTitle = document.createElement("div");
    colorTitle.textContent = "Color";
    colorTitle.style.cssText = "font-weight:600;margin:8px 0 4px;";
    panel.appendChild(colorTitle);

    const colorRow = document.createElement("div");
    colorRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
    Object.entries(COLORS).forEach(([name, hex]) => {
      const active = ((window.clothingColors[p] && window.clothingColors[p][selectedCategory]) || DEFAULT_COLOR) === name;
      const b = btn(name === DEFAULT_COLOR ? DEFAULT_COLOR : "");
      b.title = name;
      b.style.cssText += `min-width:${name === DEFAULT_COLOR ? "72px" : "30px"};height:30px;border:${active ? "2px solid #111" : "1px solid rgba(0,0,0,.2)"};background:${hex || "linear-gradient(45deg,#fff,#ddd)"};`;
      b.onclick = () => { window.clothingColors[p][selectedCategory] = name; renderPanel(); };
      colorRow.appendChild(b);
    });
    panel.appendChild(colorRow);

    const note = document.createElement("div");
    note.textContent = "Tip: add new clothes in outfit_config.js — drop the image in images/ and add its name to the list.";
    note.style.cssText = "font-size:11px;opacity:.6;margin-top:8px;";
    panel.appendChild(note);
    updateButtonLabel();
  }

  dressBtn.onclick = () => {
    if (window._modeName === "shower") return;
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    renderPanel();
  };

  // ---- Public draw + lifecycle API (used by every mode) ---------------------
  window.drawOutfitOverlay = function (ctx, state, x, y, w, h, petIndex) {
    if (window._modeName === "shower") return false;
    const p = typeof petIndex === "number" ? petIndex : activePet();
    const catalog = window.dressUpCatalog[p] || window.dressUpCatalog[0] || {};
    let drew = false;
    catKeys(p).slice().sort((a, b) => (catalog[a].z || 0) - (catalog[b].z || 0)).forEach(k => {
      const id = (window.selectedClothes[p] && window.selectedClothes[p][k]) ?? 0;
      if (id === 0 || id === "0") return;
      const it = catalog[k] && catalog[k].items && catalog[k].items[id];
      if (!it || !it.img || it.img._failed) return;
      const hex = COLORS[(window.clothingColors[p] && window.clothingColors[p][k]) || DEFAULT_COLOR] || null;
      const drawImg = hex ? tintedImage(it.img, hex) : it.img;
      if (safeDraw(ctx, drawImg, x, y, w, h)) drew = true;
    });
    return drew;
  };

  window.enterShowerClothesRules = function () {
    if (!Array.isArray(window._prevDressUpBeforeShower)) {
      window._prevDressUpBeforeShower = window.selectedClothes.map(p => ({ ...p }));
    }
    window.selectedClothes = window.selectedClothes.map(p => {
      const next = { ...p };
      Object.keys(next).forEach(k => next[k] = 0);
      return next;
    });
    dressBtn.style.display = "none";
    panel.style.display = "none";
    updateButtonLabel();
  };

  window.exitShowerClothesRules = function () {
    if (Array.isArray(window._prevDressUpBeforeShower)) {
      window.selectedClothes = window._prevDressUpBeforeShower.map(p => ({ ...p }));
      delete window._prevDressUpBeforeShower;
    }
    dressBtn.style.display = "block";
    updateButtonLabel();
  };

  window.setActivePet = function (idx) {
    const n = Number(idx);
    if (!Number.isFinite(n)) return;
    window.activePetIndex = Math.max(0, Math.min(1, Math.floor(n)));
    renderPanel();
    updateButtonLabel();
  };

  // ---- Init -----------------------------------------------------------------
  normalizeState();
  renderPanel();
  updateButtonLabel();
})();
