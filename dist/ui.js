"use strict";
(() => {
  // src/count/format.ts
  function applyRounding(count, mode) {
    if (mode === "down5") return Math.floor(count / 5) * 5;
    if (mode === "up5") return Math.ceil(count / 5) * 5;
    return count;
  }
  function displayText(text, maxLen = 60) {
    const single = text.replace(/\s+/g, " ").trim();
    if (!single) return "(empty)";
    if (single.length <= maxLen) return single;
    return single.slice(0, maxLen) + "\u2026";
  }
  function buildPreview(rows, format) {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return "";
    const lines = [];
    for (const r of selected) {
      const rounded = applyRounding(r.item.charCount, r.rounding);
      const text = displayText(r.item.text);
      lines.push(formatLine(text, rounded, format));
    }
    return lines.join("\n");
  }
  function formatLine(text, count, format) {
    switch (format) {
      case "markdown":
        return `- ${text}: ${count} chars`;
      case "keyvalue":
        return `${text}: ${count}`;
      case "plain":
      default:
        return `${text}: ${count} chars`;
    }
  }

  // src/ui.ts
  function send(msg) {
    parent.postMessage({ pluginMessage: msg }, "*");
  }
  var copy = {
    currentFrameId: null,
    currentFrameName: "",
    items: [],
    rowState: /* @__PURE__ */ new Map(),
    format: "plain"
  };
  document.addEventListener("DOMContentLoaded", () => {
    wireControls();
    wireResizeGrip();
  });
  window.onmessage = (event) => {
    const msg = event.data && event.data.pluginMessage;
    if (!msg) return;
    switch (msg.type) {
      case "no-selection":
        onNoSelection();
        return;
      case "count-result":
        onCountResult(msg.frameId, msg.frameName, msg.items);
        return;
      case "frame-preview":
        onFramePreview(msg.frameId, msg.bytes);
        return;
    }
  };
  function wireControls() {
    byId("bulk-rounding").addEventListener("change", (e) => {
      const mode = e.target.value;
      for (const item of copy.items) {
        const st = copy.rowState.get(item.nodeId);
        if (st) st.rounding = mode;
      }
      renderCountTable();
      renderPreview();
    });
    byId("bulk-select-all").addEventListener("change", (e) => {
      const checked = e.target.checked;
      for (const item of copy.items) {
        const st = copy.rowState.get(item.nodeId);
        if (st) st.selected = checked;
      }
      renderCountTable();
      renderPreview();
    });
    byId("format-select").addEventListener("change", (e) => {
      copy.format = e.target.value;
      renderPreview();
    });
    byId("copy-now-btn").addEventListener("click", onCopyNow);
  }
  function onNoSelection() {
    copy.currentFrameId = null;
    copy.currentFrameName = "";
    copy.items = [];
    copy.rowState.clear();
    show("no-selection-state");
    hide("frame-chosen");
    const img = byId("frame-preview-img");
    if (img.src && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    img.removeAttribute("src");
    img.classList.add("hidden");
  }
  function onCountResult(frameId, frameName, items) {
    const sameFrame = copy.currentFrameId === frameId;
    copy.currentFrameId = frameId;
    copy.currentFrameName = frameName;
    copy.items = items;
    if (sameFrame) {
      const existingIds = new Set(items.map((i) => i.nodeId));
      for (const id of Array.from(copy.rowState.keys())) {
        if (!existingIds.has(id)) copy.rowState.delete(id);
      }
      for (const item of items) {
        if (!copy.rowState.has(item.nodeId)) {
          copy.rowState.set(item.nodeId, { selected: true, rounding: "none" });
        }
      }
    } else {
      copy.rowState.clear();
      for (const item of items) {
        copy.rowState.set(item.nodeId, { selected: true, rounding: "none" });
      }
      byId("bulk-select-all").checked = true;
      byId("bulk-rounding").value = "none";
      const img = byId("frame-preview-img");
      if (img.src && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
    setText("chosen-frame-name", frameName || "Frame");
    setText(
      "chosen-frame-sub",
      `${items.length} text layer${items.length === 1 ? "" : "s"}`
    );
    hide("no-selection-state");
    show("frame-chosen");
    renderCountTable();
    renderPreview();
    syncBulkSelectAll();
  }
  function onFramePreview(frameId, bytes) {
    if (copy.currentFrameId !== frameId) return;
    const blob = new Blob([bytes], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = byId("frame-preview-img");
    if (img.src && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    img.src = url;
    img.classList.remove("hidden");
  }
  function renderCountTable() {
    const tbody = byId("count-tbody");
    tbody.innerHTML = "";
    if (copy.items.length === 0) {
      hide("count-table");
      show("no-text-state");
      return;
    }
    show("count-table");
    hide("no-text-state");
    for (const item of copy.items) {
      const st = copy.rowState.get(item.nodeId);
      if (!st) continue;
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td class="col-check"><input type="checkbox" data-id="${escapeAttr(item.nodeId)}" ${st.selected ? "checked" : ""} /></td>
      <td class="cell-label" title="${escapeAttr(item.label)}&#10;${escapeAttr(item.text)}">${escapeHtml(displayText(item.text))}</td>
      <td class="col-raw">${item.charCount}</td>
      <td class="col-rounded">${applyRoundingClient(item.charCount, st.rounding)}</td>
      <td class="col-mode">
        <select data-id="${escapeAttr(item.nodeId)}">
          <option value="none" ${st.rounding === "none" ? "selected" : ""}>None</option>
          <option value="down5" ${st.rounding === "down5" ? "selected" : ""}>Round down to nearest 5</option>
          <option value="up5" ${st.rounding === "up5" ? "selected" : ""}>Round up to nearest 5</option>
        </select>
      </td>
    `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.getAttribute("data-id") || "";
        const st = copy.rowState.get(id);
        if (st) st.selected = cb.checked;
        syncBulkSelectAll();
        renderPreview();
      });
    });
    tbody.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.getAttribute("data-id") || "";
        const st = copy.rowState.get(id);
        if (st) st.rounding = sel.value;
        renderCountTable();
        renderPreview();
      });
    });
  }
  function applyRoundingClient(count, mode) {
    if (mode === "down5") return Math.floor(count / 5) * 5;
    if (mode === "up5") return Math.ceil(count / 5) * 5;
    return count;
  }
  function syncBulkSelectAll() {
    const cb = byId("bulk-select-all");
    const allSelected = copy.items.length > 0 && copy.items.every((item) => {
      var _a;
      return (_a = copy.rowState.get(item.nodeId)) == null ? void 0 : _a.selected;
    });
    cb.checked = allSelected;
  }
  function renderPreview() {
    const rows = copy.items.map((item) => {
      const st = copy.rowState.get(item.nodeId) || { selected: true, rounding: "none" };
      return { item, selected: st.selected, rounding: st.rounding };
    });
    const text = buildPreview(rows, copy.format);
    byId("preview-area").value = text;
  }
  async function onCopyNow() {
    const ta = byId("preview-area");
    const text = ta.value;
    if (!text) {
      toast("Nothing to copy \u2014 select at least one row.");
      return;
    }
    const lines = text.split("\n").length;
    const btn = byId("copy-now-btn");
    const originalLabel = btn.textContent;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no-clipboard-api");
      }
      btn.textContent = "Copied \u2713";
      toast(`Copied ${lines} line${lines === 1 ? "" : "s"} to clipboard`);
      setTimeout(() => {
        btn.textContent = originalLabel || "Copy now";
      }, 1500);
    } catch (e) {
      try {
        ta.focus();
        ta.select();
        const ok = document.execCommand && document.execCommand("copy");
        if (ok) {
          btn.textContent = "Copied \u2713";
          toast(`Copied ${lines} line${lines === 1 ? "" : "s"} to clipboard`);
          setTimeout(() => {
            btn.textContent = originalLabel || "Copy now";
          }, 1500);
        } else {
          throw new Error("exec-failed");
        }
      } catch (e2) {
        ta.focus();
        ta.select();
        toast("Couldn't copy automatically \u2014 preview is selected, press \u2318C.");
      }
    }
  }
  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element: ${id}`);
    return el;
  }
  function setText(id, text) {
    byId(id).textContent = text;
  }
  function show(id) {
    byId(id).classList.remove("hidden");
  }
  function hide(id) {
    byId(id).classList.add("hidden");
  }
  function escapeHtml(s) {
    return s.replace(
      /[&<>"]/g,
      (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
    );
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/\n/g, " ");
  }
  var toastTimer;
  function toast(message) {
    const el = byId("toast");
    el.textContent = message;
    el.classList.remove("hidden");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.classList.add("hidden");
    }, 2200);
  }
  var MIN_W = 320;
  var MIN_H = 400;
  var MAX_W = 1200;
  var MAX_H = 1400;
  function wireResizeGrip() {
    const grip = byId("resize-grip");
    let resizing = false;
    let rafPending = false;
    let pendingW = 0;
    let pendingH = 0;
    function flush() {
      rafPending = false;
      send({ type: "resize", width: pendingW, height: pendingH });
    }
    grip.addEventListener("mousedown", (e) => {
      resizing = true;
      e.preventDefault();
      document.body.style.userSelect = "none";
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      pendingW = Math.max(MIN_W, Math.min(MAX_W, e.clientX + 8));
      pendingH = Math.max(MIN_H, Math.min(MAX_H, e.clientY + 8));
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(flush);
      }
    });
    window.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.userSelect = "";
    });
  }
})();
