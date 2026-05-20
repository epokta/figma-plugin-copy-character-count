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
  figma.showUI(__html__, { width: 360, height: 560, themeColors: true });
  figma.ui.onmessage = async (msg) => {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "resize": {
        const w = clamp(Math.round(msg.width), MIN_W, MAX_W);
        const h = clamp(Math.round(msg.height), MIN_H, MAX_H);
        figma.ui.resize(w, h);
        return;
      }
      case "list-frames":
        await listFrames();
        return;
      case "count-frame":
        await countFrame(msg.frameId);
        return;
    }
  };
  function send(msg) {
    figma.ui.postMessage(msg);
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  async function listFrames() {
    const frames = [];
    collectFrames(figma.currentPage, frames, []);
    send({ type: "frames", frames });
  }
  function collectFrames(parent, out, path) {
    if (!parent.children) return;
    for (const child of parent.children) {
      if (child.type === "FRAME") {
        out.push({
          id: child.id,
          name: child.name,
          path: path.length > 0 ? path.slice() : void 0
        });
      } else if (child.type === "SECTION") {
        const section = child;
        collectFrames(section, out, [...path, section.name]);
      }
    }
  }
  async function countFrame(frameId) {
    let frame = null;
    try {
      if (typeof figma.getNodeByIdAsync === "function") {
        frame = await figma.getNodeByIdAsync(frameId);
      } else {
        frame = figma.getNodeById(frameId);
      }
    } catch (e) {
      frame = null;
    }
    if (!frame || frame.type !== "FRAME") {
      figma.notify("That frame is no longer available. Pick another.");
      send({ type: "count-result", frameId, frameName: "", items: [] });
      return;
    }
    const frameNode = frame;
    const items = collect(frameNode, false);
    send({
      type: "count-result",
      frameId,
      frameName: frameNode.name,
      items
    });
    try {
      const bytes = await frameNode.exportAsync({
        format: "PNG",
        constraint: { type: "WIDTH", value: 480 }
      });
      send({ type: "frame-preview", frameId, bytes });
    } catch (e) {
    }
  }
})();
