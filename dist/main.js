"use strict";
(() => {
  // src/count/format.ts
  function graphemeCount(text) {
    if (!text) return 0;
    const Seg = globalThis.Intl && Intl.Segmenter;
    if (typeof Seg === "function") {
      try {
        const seg = new Seg(void 0, { granularity: "grapheme" });
        let n = 0;
        for (const _ of seg.segment(text)) n++;
        return n;
      } catch (e) {
      }
    }
    return Array.from(text).length;
  }

  // src/count/collect.ts
  function collect(frame, includeHidden = false) {
    const out = [];
    walk(frame, includeHidden, out);
    return out;
  }
  function walk(node, includeHidden, out) {
    if (!includeHidden && "visible" in node && node.visible === false) return;
    if (node.type === "TEXT") {
      const textNode = node;
      const raw = typeof textNode.characters === "string" ? textNode.characters : "";
      out.push({
        nodeId: textNode.id,
        label: pickLabel(textNode, raw),
        text: raw,
        charCount: graphemeCount(raw)
      });
      return;
    }
    if ("children" in node) {
      for (const child of node.children) {
        walk(child, includeHidden, out);
      }
    }
  }
  function pickLabel(node, text) {
    const name = (node.name || "").trim();
    if (name && !looksLikeDefaultName(name)) return name;
    const snippet = text.trim().slice(0, 40);
    return snippet || name || "Text";
  }
  function looksLikeDefaultName(name) {
    return /^text(\s*\d+)?$/i.test(name);
  }

  // src/translate/demo.ts
  var dict = {
    de: {
      // Common UI words
      open: "offen",
      closed: "geschlossen",
      welcome: "willkommen",
      hello: "hallo",
      search: "suche",
      until: "bis",
      more: "mehr",
      home: "startseite",
      membership: "mitgliedschaft",
      concierge: "concierge",
      benefits: "vorteile",
      all: "alle",
      international: "international",
      domestic: "inland",
      "view more": "mehr anzeigen",
      "sign up": "registrieren",
      "log in": "anmelden",
      settings: "einstellungen",
      cancel: "abbrechen",
      save: "speichern",
      edit: "bearbeiten",
      delete: "l\xF6schen",
      next: "weiter",
      back: "zur\xFCck",
      continue: "weiter",
      // Phrases specific to the travel-app demo screen
      "welcome to tripguide": "Willkommen bei Tripguide",
      "hello, emilia": "Hallo, Emilia",
      "sky lounge": "Sky Lounge",
      "plaza premier": "Plaza Premier",
      "fast track": "Schnellspur",
      "hnd terminal 1": "HND Terminal 1",
      "hnd terminal 3": "HND Terminal 3",
      "hnd terminal 4": "HND Terminal 4",
      "until 11:30 pm": "Bis 23:30 Uhr",
      "until 11:30": "Bis 23:30",
      "search by lounges, airport, city": "Suche nach Lounges, Flugh\xE4fen, St\xE4dten"
    },
    es: {
      open: "abierto",
      closed: "cerrado",
      welcome: "bienvenido",
      hello: "hola",
      search: "buscar",
      until: "hasta",
      more: "m\xE1s",
      home: "inicio",
      membership: "membres\xEDa",
      concierge: "conserjer\xEDa",
      benefits: "beneficios",
      all: "todos",
      international: "internacional",
      domestic: "nacional",
      "view more": "ver m\xE1s",
      "sign up": "registrarse",
      "log in": "iniciar sesi\xF3n",
      settings: "ajustes",
      cancel: "cancelar",
      save: "guardar",
      edit: "editar",
      delete: "eliminar",
      next: "siguiente",
      back: "atr\xE1s",
      continue: "continuar",
      "welcome to tripguide": "Bienvenido a Tripguide",
      "hello, emilia": "Hola, Emilia",
      "sky lounge": "Sky Lounge",
      "plaza premier": "Plaza Premier",
      "fast track": "V\xEDa R\xE1pida",
      "hnd terminal 1": "Terminal 1 HND",
      "hnd terminal 3": "Terminal 3 HND",
      "hnd terminal 4": "Terminal 4 HND",
      "until 11:30 pm": "Hasta las 11:30 PM",
      "search by lounges, airport, city": "Busca por salas, aeropuerto, ciudad"
    },
    ar: {
      open: "\u0645\u0641\u062A\u0648\u062D",
      closed: "\u0645\u063A\u0644\u0642",
      welcome: "\u0645\u0631\u062D\u0628\u0627",
      hello: "\u0645\u0631\u062D\u0628\u0627",
      search: "\u0628\u062D\u062B",
      until: "\u062D\u062A\u0649",
      more: "\u0627\u0644\u0645\u0632\u064A\u062F",
      home: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
      membership: "\u0627\u0644\u0639\u0636\u0648\u064A\u0629",
      concierge: "\u0627\u0644\u0643\u0648\u0646\u0633\u064A\u0631\u062C",
      benefits: "\u0627\u0644\u0645\u0632\u0627\u064A\u0627",
      all: "\u0627\u0644\u0643\u0644",
      international: "\u062F\u0648\u0644\u064A",
      domestic: "\u0645\u062D\u0644\u064A",
      "view more": "\u0639\u0631\u0636 \u0627\u0644\u0645\u0632\u064A\u062F",
      "sign up": "\u0627\u0644\u062A\u0633\u062C\u064A\u0644",
      "log in": "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
      settings: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A",
      cancel: "\u0625\u0644\u063A\u0627\u0621",
      save: "\u062D\u0641\u0638",
      edit: "\u062A\u0639\u062F\u064A\u0644",
      delete: "\u062D\u0630\u0641",
      next: "\u0627\u0644\u062A\u0627\u0644\u064A",
      back: "\u0631\u062C\u0648\u0639",
      continue: "\u0645\u062A\u0627\u0628\u0639\u0629",
      "welcome to tripguide": "\u0645\u0631\u062D\u0628\u064B\u0627 \u0628\u0643 \u0641\u064A Tripguide",
      "hello, emilia": "\u0645\u0631\u062D\u0628\u0627\u060C \u0625\u0645\u064A\u0644\u064A\u0627",
      "sky lounge": "\u0635\u0627\u0644\u0629 \u0633\u0643\u0627\u064A",
      "plaza premier": "\u0628\u0644\u0627\u0632\u0627 \u0628\u0631\u064A\u0645\u064A\u0631",
      "fast track": "\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0633\u0631\u064A\u0639",
      "hnd terminal 1": "\u0645\u0628\u0646\u0649 HND \u0631\u0642\u0645 1",
      "hnd terminal 3": "\u0645\u0628\u0646\u0649 HND \u0631\u0642\u0645 3",
      "hnd terminal 4": "\u0645\u0628\u0646\u0649 HND \u0631\u0642\u0645 4",
      "until 11:30 pm": "\u062D\u062A\u0649 11:30 \u0645\u0633\u0627\u0621\u064B",
      "search by lounges, airport, city": "\u0627\u0628\u062D\u062B \u062D\u0633\u0628 \u0627\u0644\u0635\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0645\u0637\u0627\u0631 \u0648\u0627\u0644\u0645\u062F\u064A\u0646\u0629"
    }
  };
  function restoreCase(template, translated) {
    if (template.length === 0) return translated;
    if (template.toUpperCase() === template) return translated.toUpperCase();
    if (template[0] === template[0].toUpperCase()) {
      return translated[0].toUpperCase() + translated.slice(1);
    }
    return translated;
  }
  function translateWord(word, target) {
    const lower = word.toLowerCase();
    const hit = dict[target][lower];
    if (!hit) return word;
    return restoreCase(word, hit);
  }
  function translateOne(source, target) {
    const trimmed = source.trim();
    if (!trimmed) return source;
    const phraseHit = dict[target][trimmed.toLowerCase()];
    if (phraseHit) return phraseHit;
    return source.replace(
      /\b[\p{L}\p{M}']+\b/gu,
      (match) => translateWord(match, target)
    );
  }
  var demoProvider = {
    async translate(strings, targetLang) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return strings.map((source) => ({
        source,
        translation: translateOne(source, targetLang)
      }));
    }
  };

  // src/main.ts
  var MIN_W = 320;
  var MIN_H = 400;
  var MAX_W = 1200;
  var MAX_H = 1400;
  var SELECTION_DEBOUNCE_MS = 150;
  figma.showUI(__html__, { width: 720, height: 760, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "resize": {
        const w = clamp(Math.round(msg.width), MIN_W, MAX_W);
        const h = clamp(Math.round(msg.height), MIN_H, MAX_H);
        figma.ui.resize(w, h);
        return;
      }
      case "refresh":
        await refreshFromSelection();
        return;
      case "translate": {
        try {
          const translations = await demoProvider.translate(
            msg.strings,
            msg.targetLang
          );
          send({ type: "translations", targetLang: msg.targetLang, translations });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Translation failed.";
          send({ type: "translation-error", message });
        }
        return;
      }
    }
  };
  function send(msg) {
    figma.ui.postMessage(msg);
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  async function refreshFromSelection() {
    const selection = figma.currentPage.selection;
    let frame = null;
    for (const node of selection) {
      const candidate = findFrameAncestor(node);
      if (candidate) {
        frame = candidate;
        break;
      }
    }
    if (!frame) {
      send({ type: "no-selection" });
      return;
    }
    const items = collect(frame, false);
    send({
      type: "count-result",
      frameId: frame.id,
      frameName: frame.name,
      items
    });
    try {
      const bytes = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "WIDTH", value: 480 }
      });
      send({ type: "frame-preview", frameId: frame.id, bytes });
    } catch (e) {
    }
  }
  function findFrameAncestor(node) {
    let current = node;
    while (current) {
      if (current.type === "FRAME") return current;
      current = current.parent;
    }
    return null;
  }
  var selectionTimer;
  figma.on("selectionchange", () => {
    if (selectionTimer) clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      selectionTimer = void 0;
      refreshFromSelection();
    }, SELECTION_DEBOUNCE_MS);
  });
  refreshFromSelection();
})();
