/// <reference lib="dom" />
import { storage } from 'webextension-polyfill';
import { Action, HighlightLocation, LocalHighlight, LocalHighlightsObject } from './common';
import { findHighlightIndices, removeHighlightOverlaps, isNonVisibleTag } from './highlight';
import './hho.css';
console.log("==== LOAD 'content_script.js' TD ====")

const isDev = true;

// TODO: How to handle selection action bar (context menu) position with 
// mobile native context menu?

const prefix_local_id = "hho-local";

type ContextMenu = HTMLDivElement;
declare global {
  interface Window {
    g: {
      context_menu_elem?: ContextMenu
    };
  }
}
window.g = {
  context_menu_elem: undefined
};

const MIN_SELECTION_LEN = 3;

// Histre colors
enum Color { yellow, orange, green, blue, purple, red };

function getContextMenu(): ContextMenu {
  if (!window.g?.context_menu_elem) {
    document.querySelector(".hho-context-menu")?.remove();
    const container = document.createElement("div");
    container.classList.add("hho-context-menu");
    container.style.top = "0";
    container.style.left = "0";

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    // Cache busting for dev mode
    const css_version = isDev ? Date.now().toString() : "";
    style.href = browser.runtime.getURL("./dist/assets/hho.style.css?v=" + css_version);
    container.appendChild(style)

    const base_button = document.createElement("button");
    base_button.type = "button";
    base_button.classList.add("hho-btn-color");

    const base_button_text = document.createElement("span");
    base_button_text.classList.add("sr-only");

    let colors = Object.values(Color).filter((v) => isNaN(Number(v)));
    for (let color of colors) {
      const new_button = base_button.cloneNode(true) as HTMLButtonElement;
      new_button.setAttribute("data-hho-color", color as string);
      const text_elem = base_button_text.cloneNode(true);
      text_elem.textContent = `Save highlight with ${color} color`;
      new_button.appendChild(text_elem);
      container.appendChild(new_button);
    }

    container.addEventListener("click", contextMenuClick);
    document.body.appendChild(container)
    window.g.context_menu_elem = document.querySelector(".hho-context-menu") as HTMLDivElement;
  }

  return window.g.context_menu_elem;
}

async function contextMenuClick(e: Event) {
  console.log("save")
  const elem = e.target as Element;
  if (elem.classList.contains("hho-btn-color")) {
    const sel_obj = window.getSelection();
    const sel_string = sel_obj?.toString() || "";
    if (!sel_obj || sel_string.length === 0) {
      console.info("No selection to save");
      return;
    }
    if (sel_string.length <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
    const local_id = Math.random().toString(36).substring(2,10)
    const local_class_id = `${prefix_local_id}-${local_id}`;
    const color = elem.getAttribute("data-hho-color") || "yellow";
    console.log("button click color: ", color)
    highlightSelectedText(sel_obj, color, local_class_id);
    const data = { text: sel_string, color: color, local_id: local_class_id };
    console.log("data", data)
    sel_obj.removeAllRanges(); // This fires 'selectionchange' event
    const result = await browser.runtime.sendMessage(
      "addon@histre-highlight-only.com", 
      { action: Action.Save , data: data },
    )
    if (!result) {
      console.error("Failed to save highlight to Histre or local storage");
      return;
    }
    console.log("r", result);



    // TODO: implement saving selection
    // TODO?: handle saving multiple selections?

    // TODO: Send selection to background
    // const hl = await browser.runtime.sendMessage()
    // will be added either to histre or local (if request failed)
    // figure out how to display success and failure
    // success: replace local ids with histre ids


    // TODO?: implement highlighting for multiselect text?
    // for (let i = 0; i < sel_obj.rangeCount; i++) {
    //   console.log(sel_obj.getRangeAt(i));
    //   console.log(sel_obj.getRangeAt(i).toString());
    // }

  }
}

// NOTE: Not used at the moment. Use it if you need.
// This gets exact coordinates of selection start. Use this if you want
// exact location of 'left'.
function selectionStartClientRect(sel_obj: Selection) {
  // TODO: there is Range.insertNode which enters Node at the start of the range
  // https://developer.mozilla.org/en-US/docs/Web/API/Range/insertNode
  const node = sel_obj.anchorNode as Text;
  const parent = node.parentNode;
  const char = node.splitText(sel_obj.anchorOffset);
  // This makes an one character text node out of 'char'
  char.splitText(1);

  const range = document.createRange();
  range.selectNode(char);
  const box = range.getBoundingClientRect();
  // Restore text node as it was
  if (parent) parent.normalize();

  return box;
}

// Wrapping selected text with <mark>.
// Selection doesn't start or end at edges of nodes.
// Selection can contain children elements.
const mark_elem = document.createElement("mark");
mark_elem.classList.add("hho-mark");

function createMarkElement(color: string | undefined) {
  const elem = mark_elem.cloneNode(true);
  (elem as Element).setAttribute("data-hho-color", color || "yellow");
  return elem;
}

function containsNonWhiteSpace(node: Node): number {
  if (node.textContent && /^\s*$/.test(node.textContent)) {
    return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT
}

function highlightSelectedText(sel_obj: Selection, color: string, local_id: string) {
  const r = sel_obj.getRangeAt(0);

  let start_container: Node | null = r.startContainer;
  let end_container: Node | null = r.endContainer;

  if (end_container == start_container) {
    const new_mark = mark_elem.cloneNode(true) as Element;
    new_mark.setAttribute("data-hho-color", color);
    r.surroundContents(new_mark);
    return;
  }

  // Find start and end node parent siblings
  while (start_container) {
    if (start_container.parentNode === r.commonAncestorContainer) { break; }
    start_container = start_container.parentNode
  }
  while (end_container) {
    if (end_container.parentNode === r.commonAncestorContainer) { break; }
    end_container = end_container.parentNode
  }

  if (!start_container || !end_container)  {
    console.error("Failed to find common parent sibling for start and end node")
    return;
  }

  let valid_nodes = [];
  {
    // Add valid text nodes in start parent node
    const start_node = (r.startContainer as Text).splitText(r.startOffset);
    const iter = document.createNodeIterator(start_container, NodeFilter.SHOW_TEXT,  containsNonWhiteSpace)
    let currentNode;
    // Find start text node
    while (currentNode = iter.nextNode()) {
      if (currentNode === start_node) { break; }
    }
    if (currentNode !== null) valid_nodes.push(currentNode);
    while (currentNode = iter.nextNode()) {
      valid_nodes.push(currentNode);
    }
  }

  {
    // Add all valid text nodes, don't have to worry about start node or end node
    let nextNode = start_container.nextSibling;
    while (nextNode && nextNode !== end_container) {
      const iter = document.createNodeIterator(nextNode, NodeFilter.SHOW_TEXT,  containsNonWhiteSpace)
      let currentNode;
      while (currentNode = iter.nextNode()) {
        valid_nodes.push(currentNode);
      }
      nextNode = nextNode.nextSibling;
    }
  }

  {
    // Add valid text nodes in end parent node
    const end_node = (r.endContainer as Text).splitText(r.endOffset);
    const iter = document.createNodeIterator(end_container, NodeFilter.SHOW_TEXT,  containsNonWhiteSpace)
    let currentNode;
    while (currentNode = iter.nextNode()) {
      if (currentNode === end_node) { break; }
      valid_nodes.push(currentNode);
    }
  }

  let tmp_range = document.createRange();
  for (let node of valid_nodes) {
    tmp_range.selectNode(node);
    const new_mark = mark_elem.cloneNode(true) as Element;
    new_mark.classList.add(local_id);
    new_mark.setAttribute("data-hho-color", color);
    tmp_range.surroundContents(new_mark);
  }
}

function selectionNewPosition(selection: Selection, context_menu_rect: DOMRect) {
  const box = selection.getRangeAt(0).getBoundingClientRect();
  const top = box.top + window.pageYOffset - context_menu_rect.height;
  const left = box.left + window.pageXOffset + (box.width / 2) - (context_menu_rect.width / 2);
  return { top: top, left: left };
}

function debounce(f: any, delay: number) {
  let timeout: NodeJS.Timeout | undefined;
  return function() {
    if (timeout === undefined) {
      timeout = setTimeout(() => {
        clearTimeout(timeout)
        f.apply(null, Array.from(arguments))
        timeout = undefined;
      }, delay);
    }
  }
}

function selectionChange() {
  const sel_obj = window.getSelection();
  if (!sel_obj || sel_obj?.toString().length === 0) {
    document.removeEventListener("selectionchange", selectionChangeListener);
    getContextMenu().setAttribute("aria-hidden", "true");
    return;
  }
  if (sel_obj.toString().length <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
  const context_menu = getContextMenu();
  const context_menu_rect = context_menu.getBoundingClientRect();
  const new_pos = selectionNewPosition(sel_obj, context_menu_rect);
  context_menu.style.top = `${new_pos.top}px`;
  context_menu.style.left = `${new_pos.left}px`;
  context_menu.setAttribute("aria-hidden", "false");
}

const selectionChangeListener = debounce(selectionChange, 100);

// Experiment(s):
// Tried to start listening 'selectionchange' event after 'pointerup' event, 
// but keyboard might be used to fire 'selectstart' event.
//
// Can change selection size with:
// - touch device (most obvious)
// - keyboard (ctrl [+ shift] + arrow_keys)
// - mouse (ctrl/shift + mouse_click). 
//   'ctrl' starts another selection. 'shift' extends existing selection.
function startSelection(e: any) {
  console.log("Event(init): selectstart")

  let hasSelectionChangeListener = false;
  document.addEventListener("pointerup", () => {
    selectionChange();
    document.addEventListener("selectionchange", selectionChangeListener)
    hasSelectionChangeListener = true;
  }, {once: true});

  // If keyboard is used to start selection
  document.addEventListener("keyup", (e: KeyboardEvent) => {
    if (hasSelectionChangeListener) return;
    if (e.shiftKey && ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].some((val) => val === e.key)) {
      selectionChange();
      document.addEventListener("selectionchange", selectionChangeListener)
    }
  }, {once: true})
}

function isEmptyObject(object: Object) {
  for (const _ in object) {
    return false;
  }
  return true;
}


// Has two solution how to split text nodes and wrap them in HTML element.
// https://stackoverflow.com/questions/31275446/how-to-wrap-part-of-a-text-in-a-node-with-javascript
async function renderLocalHighlights1(current_url: string) {
  console.log("==== renderLocalHighlights() ====")
  if (isDev) document.body.normalize();
  const body_text = document.body.textContent
  if (body_text === null) { return; }

  const local = await storage.local.get({highlights_add: {[current_url]: undefined}});
  if (local.highlights_add[current_url] === undefined) { return; }
  const current_highlights = local.highlights_add[current_url].highlights as LocalHighlightsObject;
  if (isEmptyObject(current_highlights)) { return; }
  const current_entries = Object.entries(current_highlights);
  // console.log("highlights", current_entries)

  console.time("Indices")
  const overlapping_indices = findHighlightIndices(body_text, current_highlights);
  const indices = removeHighlightOverlaps(overlapping_indices);
  console.timeEnd("Indices")
  console.log(indices)


  console.time("Higlight DOM")
  const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, null);
  let currentNode: Node | null = null;

  let hl_loc_index = 0;
  let node_end = 0;
  let current_hl_loc: HighlightLocation | null = null;
  while (currentNode = iter.nextNode()) {
    const len = currentNode.textContent?.length || 0;
    let node_start = node_end;
    node_end += len;
    // console.log(node_end)

    if (isNonVisibleTag(currentNode)) { continue; }

    let active_node = currentNode;

    // Haven't finished current highlight
    if (current_hl_loc) {
      const color = current_entries[current_hl_loc.index][1].color;
      if (current_hl_loc.end <= node_end) {
        active_node = (active_node as Text).splitText(len);
        iter.nextNode();
        const range = document.createRange();
        range.selectNode(currentNode);
        range.surroundContents(createMarkElement(color));
        iter.nextNode();
        node_start += active_node.textContent?.length || 0;
        current_hl_loc = null;
      } else {
        const range = document.createRange();
        range.selectNode(currentNode);
        range.surroundContents(createMarkElement(color));
        iter.nextNode();
        continue;
      }
    }

    while (hl_loc_index < indices.length) {
      const hl_loc = indices[hl_loc_index];
      // console.log(hl_loc, node_start, node_end)
      if (hl_loc.start >= node_start && hl_loc.end <= node_end) {
        // Highlight is inside currentNode
        // console.log("text", current_entries[hl_loc.index][1])
        console.log(hl_loc, node_start)
        const tmp_node = active_node;
        const start_index = hl_loc.start - node_start;
        const hl_node = (active_node as Text).splitText(start_index);
        const len = hl_loc.end - hl_loc.start;
        node_start += len;
        // console.log("idnex", start_index, len)
        active_node = (hl_node as Text).splitText(len);
        iter.nextNode();
        iter.nextNode();

        console.log(hl_node)
        const range = document.createRange();
        range.selectNode(hl_node);
        range.surroundContents(createMarkElement(current_entries[hl_loc.index][1].color));
        iter.nextNode();
        // return;

        node_start += tmp_node.textContent?.length || 0;
        hl_loc_index += 1;
        continue;
        // console.log("rest", hl_node);
      } else if (hl_loc.start < node_end) {
        // Highlight starts inside this node. Ends in another node.

        // Make new node
        const start_index = hl_loc.start - node_start;
        console.log(hl_loc.start, node_start)
        active_node = (active_node as Text).splitText(start_index);
        const range = document.createRange();
        range.selectNode(currentNode);
        range.surroundContents(createMarkElement(current_entries[hl_loc.index][1].color));
        iter.nextNode();
        iter.nextNode();

        current_hl_loc = hl_loc;
        hl_loc_index += 1;
      }

      break;
    }

    if (hl_loc_index >= indices.length) {
      break;
    }
  }
  console.timeEnd("Higlight DOM")



  // {
  //   // for debug
  //   document.body.textContent?.normalize()
  //   const body_text = document.body.textContent;
  //   console.time("Indices")
  //   const result = testBodyTextContentSearch(body_text, current_highlights);
  //   console.timeEnd("Indices")
  //   // highlightLocations(result);
  // }

  // {
  //   const iter_time_start = performance.now();
  //   const result = testIterHighlight(current_highlights);
  //   const iter_time_end = performance.now();
  //   console.log(result);
  //   console.log(`time (outer iter): ${iter_time_end - iter_time_start}ms`)
  // }

  // {
  //   const iter_time_start = performance.now();
  //   const result = testHighlightIter(current_highlights);
  //   const iter_time_end = performance.now();
  //   console.log(result);
  //   console.log(`time (inner iter): ${iter_time_end - iter_time_start}ms`)
  // } 
}

function removeHighlights() {
  const marks = document.querySelectorAll(".hho-mark");
  for (const m of marks) {
    const text = m.textContent;
    m.replaceWith(text)
  }
  document.body.normalize();
}

async function renderLocalHighlights(current_url: string) {
  console.log("==== renderLocalHighlights() ====")
  if (isDev) {
    removeHighlights();
  }
  const body_text = document.body.textContent
  if (body_text === null) { return; }

  const local = await storage.local.get({highlights_add: {[current_url]: undefined}});
  if (local.highlights_add[current_url] === undefined) { 
    console.info(`No highlights for ${current_url}`);
    return; 
  }
  const current_highlights = local.highlights_add[current_url].highlights as LocalHighlightsObject;
  if (isEmptyObject(current_highlights)) { 
    console.info(`Found url ${current_url} doesn't contain any highlights`);
    // TODO?: remove url from webext 'storage.local'?
    return; 
  }
  const current_entries = Object.entries(current_highlights);

  console.time("Indices")
  const overlapping_indices = findHighlightIndices(body_text, current_highlights);
  const indices = removeHighlightOverlaps(overlapping_indices);
  console.timeEnd("Indices")

  const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, null);
  let current_node;
  let total_start = 0;
  let total_end = 0;
  const range = document.createRange();

  for (const hl_loc of indices) {
    if (hl_loc.start >= total_end) {
      while (current_node = iter.nextNode()) {
        total_start = total_end;
        total_end += current_node.textContent?.length || 0;
        if (hl_loc.start < total_end) {
          break;
        }
      }
    }
    if (!current_node) break;

    const node_start = hl_loc.start - total_start;
    total_start += node_start;
    let hl_node = (current_node as Text).splitText(node_start);
    iter.nextNode();
    const color = current_entries[hl_loc.index][1].color;

    if (hl_loc.end > total_end) {
      range.selectNode(hl_node);
      range.surroundContents(createMarkElement(color));
      total_end = total_start + (hl_node.textContent?.length || 0);

      while (current_node = iter.nextNode()) {
        total_start = total_end;
        total_end += current_node.textContent?.length || 0;
        if (hl_loc.end <= total_end) {
          const len = total_end - hl_loc.end;
          total_end = total_start + len;
          (current_node as Text).splitText(len);
          range.selectNode(current_node);
          range.surroundContents(createMarkElement(color));

          // skip new nodes made by splitText and surroundContents
          iter.nextNode();
          break;
        }

        range.selectNode(current_node);
        range.surroundContents(createMarkElement(color));
      }
    } else {
      const len = hl_loc.end - hl_loc.start;
      total_end = total_start + len;
      (hl_node as Text).splitText(len);
      range.selectNode(hl_node);
      range.surroundContents(createMarkElement(color));
      // skip new nodes made by splitText
      iter.nextNode();
    }

    console.assert(total_start <= total_end, "Start index is large than end index");
  }
}

function init() {
  const url = "http://localhost:8080/test.html";
  if(document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => renderLocalHighlights(url));
  } else {
    renderLocalHighlights(url)
  }  
  getContextMenu();
  document.addEventListener("selectstart", startSelection);
  // renderLocalHighlights("wrong_url");
}
init();

async function test() {
  const result = await browser.runtime.sendMessage(
    "addon@histre-highlight-only.com", 
    { action: Action.Save
    , data: { text: "my highlight text", color: "yellow", local_id: `${prefix_local_id}-s8a9asd`}
    },
  )
  if (!result) {
    console.error("Failed to save highlight to Histre or local storage");
  }
  console.log("r", result);

  const update = await browser.runtime.sendMessage(
    "addon@histre-highlight-only.com", 
    { action: Action.Update
    , data: { color: "blue", local_id: `${prefix_local_id}-s8a9asd`}
    },
  )
  console.log("update", update);

  const remove = await browser.runtime.sendMessage(
    "addon@histre-highlight-only.com", 
    { action: Action.Remove
    , data: { id: `${prefix_local_id}-remove`}
    },
  )
  console.log("remove", remove);


}
// test();


