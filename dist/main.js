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

  // src/main.ts
  var MIN_W = 320;
  var MIN_H = 400;
  var MAX_W = 1200;
  var MAX_H = 1400;
  var SELECTION_DEBOUNCE_MS = 150;
  figma.showUI(__html__, { width: 900, height: 640, themeColors: true });
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
