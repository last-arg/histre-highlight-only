/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { storage, runtime } from 'webextension-polyfill';
import { Action, LocalHighlightsObject, HighlightLocation, Position, local_id_prefix } from './common';
import { findHighlightIndices, removeHighlightOverlaps } from './highlight';
import './hho.css';
import { getPosition } from './storage';
console.log("==== LOAD 'content_script.js' TD ====")

type ContextMenuElem = HTMLDivElement;
enum ContextMenuState { none, create, modify }
// Histre colors
enum Color { yellow, orange, green, blue, purple, red };

const isDev = true;

const MIN_SELECTION_LEN = 3;

class ContextMenu {
  elem: ContextMenuElem;
  state: ContextMenuState = ContextMenuState.none;
  highlight_id: string | null = null;
  pos: Position = "top";

  constructor() {
    this.elem = ContextMenu.renderContextMenu();
    document.addEventListener("click", ContextMenu.handleClick(this));
    getPosition().then((pos) => { this.pos = pos || "top"; })
  }

  isState(state: ContextMenuState) { return this.state === state; }

  update(state: ContextMenuState, arg?: Selection | Element) { 
    this.elem.setAttribute("data-hho-state", ContextMenuState[state]);
    switch(state) {
      case ContextMenuState.none: {
        this.elem.setAttribute("aria-hidden", "true");
        break;
      }
      case ContextMenuState.create: {
        console.assert(arg, "Context menu state 'create' requires second function argument 'arg'")
        const rect = this.elem.getBoundingClientRect();
        const new_pos = selectionNewPosition(arg as Selection, rect, this.pos);
        this.elem.style.top = `${new_pos.top}px`;
        this.elem.style.left = `${new_pos.left}px`;
        this.elem.setAttribute("aria-hidden", "false");
        break;
      }
      case ContextMenuState.modify: {
        console.assert(arg, "Context menu state 'modify' requires second function argument 'arg'")
        const elem = arg as Element;
        this.highlight_id = elem.getAttribute("data-hho-id");
        const menu_rect = this.elem.getBoundingClientRect();
        const elem_rect = elem.getBoundingClientRect();
        const top = elem_rect.top + window.pageYOffset - menu_rect.height;
        const body_rect = document.body.getBoundingClientRect();
        const left = elem_rect.left + window.pageXOffset - body_rect.x + (elem_rect.width / 2) - (menu_rect.width / 2);
        this.elem.style.top = `${top}px`;
        this.elem.style.left = `${left}px`;
        this.elem.setAttribute("aria-hidden", "false");
        break;
      }
    }
    this.state = state; 
  }

  static renderContextMenu() {
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
    // TODO: style remove button
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

    {
      const new_button = document.createElement("button");
      new_button.type = "button";
      new_button.classList.add("hho-btn-remove");
      new_button.textContent = `Rem`;
      container.appendChild(new_button);
    }

    container.setAttribute("data-hho-state", ContextMenuState[ContextMenuState.none]);
    document.body.appendChild(container)
    return document.querySelector(".hho-context-menu") as ContextMenuElem;
  }

  static handleClick(ctx_menu: ContextMenu) {
    async function handleClickImpl(e: Event) {
      const elem = e.target as Element;
      switch(ctx_menu.state) {
        case ContextMenuState.create: {
          if (elem.classList.contains("hho-btn-color")) {
            const sel_obj = window.getSelection();
            if (!hasSelection(sel_obj)) {
              console.info("No selection to save");
              return;
            }
            const sel_string = sel_obj.toString();
            if (sel_string.length <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
            const color = elem.getAttribute("data-hho-color") || "yellow";
            let local_id = `${local_id_prefix}-${randomString()}`;
            highlightSelectedText(sel_obj, color, local_id);
            sel_obj.removeAllRanges(); // This fires 'selectionchange' event
            const data = { text: sel_string, color: color, id: local_id };
            const result_id = await runtime.sendMessage(
              "addon@histre-highlight-only.com", 
              { action: Action.Create, data: data },
            )
            if (!result_id) {
              // TODO: display failure somewhere, somehow?
              console.error("Failed to save highlight to Histre or local storage");
              return;
            }

            const marks = document.querySelectorAll(`.hho-mark[data-hho-id="${local_id}"]`)
            for (const mark of marks) {
              mark.setAttribute("data-hho-id", result_id)
            }

            // TODO: swap generated local id with histre id if histre id was returned


            // TODO?: save multiple selections/ranges?
            // Each selection/range would be separate highlight
            // for (let i = 0; i < sel_obj.rangeCount; i++) {
            //   console.log(sel_obj.getRangeAt(i));
            //   console.log(sel_obj.getRangeAt(i).toString());
            // }
          }
          break;
        }
        case ContextMenuState.modify: {
          if (elem.classList.contains("hho-btn-color")) {
            const id = ctx_menu.highlight_id;
            const color = elem.getAttribute("data-hho-color");
            if (id === null || color === null) {
              return;
            }

            for (const hl of document.querySelectorAll(`[data-hho-id="${id}"]`)) {
              hl.setAttribute("data-hho-color", color)
            }

            const result = await runtime.sendMessage(
              "addon@histre-highlight-only.com", 
              { action: Action.Modify , data: {id: id, color: color} },
            )

            if (!result) {
              console.error(`Failed to change highlight '${id}' to color '${color}'`)
              return;
            }
          } else if (elem.classList.contains("hho-btn-remove")) {
            const id = ctx_menu.highlight_id;
            if (id === null) {
              return;
            }

            // const result = await runtime.sendMessage(
            //   "addon@histre-highlight-only.com", 
            //   { action: Action.Remove , data: {id: id} },
            // )

            // if (!result) {
            //   console.error(`Failed to remove highlight '${id}'`)
            //   return;
            // }

            // TODO: check if any highlight is revealed under removed highlight
            // Get all highlight DOM elements to be deleted
            // Find if removed highlight has any other highlights 
            const elems = document.querySelectorAll(`[data-hho-id="${id}"]`);
            console.log(elems)

            // removeHighlights(id)
          }
          break;
        }
      }
    }
    return handleClickImpl;
  }
}

function randomString() {
  return Math.random().toString(36).substring(2,10)
}

const global = {
  menu: new ContextMenu(),
};

// Wrapping selected text with <mark>.
// Selection doesn't start or end at edges of nodes.
// Selection can contain children elements.
const mark_elem = document.createElement("mark");
mark_elem.classList.add("hho-mark");

function createMarkElement(id: string, color: string | undefined) {
  const elem = mark_elem.cloneNode(true) as Element;
  elem.setAttribute("data-hho-color", color || "yellow");
  elem.setAttribute("data-hho-id", id);
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
    new_mark.setAttribute("data-hho-id", local_id);
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

function selectionNewPosition(selection: Selection, context_menu_rect: DOMRect, pos: Position) {
  const box = selection.getRangeAt(0).getBoundingClientRect();
  const body_rect = document.body.getBoundingClientRect();
  let top = 0;
  const margin = 10;
  if (pos === "top") {
    top = box.top + window.pageYOffset - context_menu_rect.height - margin;
  } else if (pos === "bottom") {
    top = box.bottom + window.pageYOffset + margin;
  }
  let left = box.left + window.pageXOffset + - body_rect.x + (box.width / 2) - (context_menu_rect.width / 2);

  // Make sure context menu doesn't go out of bounds horizontally
  if (left < 0) {
    left = 0;
  } else if ((box.left + (context_menu_rect.width)) > body_rect.right) {
    left = body_rect.right - context_menu_rect.width - body_rect.x + window.pageXOffset;
  }

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

function hasSelection(sel: Selection | null): sel is Selection {
  return sel !== null && sel.toString().length >= 0
}

function selectionChange() {
  console.log("Event: selectionchange")
  const win_selection = window.getSelection();
  if (!hasSelection(win_selection)) {
    document.removeEventListener("selectionchange", selectionChangeListener);
    global.menu.update(ContextMenuState.none);
    return;
  }
  const selection_str = win_selection.toString();
  if (selection_str.length <= MIN_SELECTION_LEN || win_selection.anchorNode === null) {
    if (selection_str.length === 0) {
      document.removeEventListener("selectionchange", selectionChangeListener);
    }
    global.menu.update(ContextMenuState.none);
    return;
  }
  global.menu.update(ContextMenuState.create, win_selection);
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
function startSelection() {
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

function removeHighlights(hl_id?: string) {
  let hl_selector = ".hho-mark";
  if (hl_id) {
    hl_selector += `[data-hho-id="${hl_id}"]`;
  }
  const marks = document.querySelectorAll(hl_selector);
  for (const m of marks) {
    const text = m.textContent;
    if (text === null) continue;
    m.replaceWith(text)
  }
  document.body.normalize();
}

function highlightDOM(ranges: HighlightLocation[], current_entries: any) {
  const indices = ranges;
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

    // TODO: I think this should be done in findHighlightIndices or removeHighlightOverlaps
    if (hl_loc.start > hl_loc.end) {
      continue;
    }
    const node_start = hl_loc.start - total_start;
    total_start += node_start;
    let hl_node = (current_node as Text).splitText(node_start);
    iter.nextNode();
    const color = current_entries[hl_loc.index][1].color;
    const hl_id = current_entries[hl_loc.index][0];

    if (hl_loc.end > total_end) {
      range.selectNode(hl_node);
      range.surroundContents(createMarkElement(hl_id, color));
      total_end = total_start + (hl_node.textContent?.length || 0);

      while (current_node = iter.nextNode()) {
        total_start = total_end;
        total_end += current_node.textContent?.length || 0;
        if (hl_loc.end <= total_end) {
          const len = total_end - hl_loc.end;
          total_end = total_start + len;
          (current_node as Text).splitText(len);
          range.selectNode(current_node);
          range.surroundContents(createMarkElement(hl_id, color));

          // skip new nodes made by splitText and surroundContents
          iter.nextNode();
          break;
        }

        range.selectNode(current_node);
        range.surroundContents(createMarkElement(hl_id, color));
      }
    } else {
      const len = hl_loc.end - hl_loc.start;
      if (len >= 0) {
        total_end = total_start + len;
        (hl_node as Text).splitText(len);
        range.selectNode(hl_node);
        range.surroundContents(createMarkElement(hl_id, color));
        iter.nextNode();
      }
    }

    console.assert(total_start <= total_end, "Start index is large than end index");
  }
}

async function renderLocalHighlights(current_url: string) {
  console.log("==== renderLocalHighlights() ====")
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
    return; 
  }
  const current_entries = Object.entries(current_highlights);

  console.time("Iter all text nodes")
  const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, null);
  while (iter.nextNode()) {}
  console.timeEnd("Iter all text nodes")

  console.time("Generate ranges")
  const overlapping_indices = findHighlightIndices(body_text, current_highlights);
  const indices = removeHighlightOverlaps(overlapping_indices);
  console.timeEnd("Generate ranges")

  console.time("Highlight DOM")
  highlightDOM(indices, current_entries)
  console.timeEnd("Highlight DOM")
}

// TODO: Find if removed highlight was covering other highlights
// Find all previous <mark> elements with class 'hho-mark'. The elements
// have to be contiguous. Might find duplicates. Want last found elements,
// those elements will be where highlight begins.
async function removeHighlight(id: string, url: string) {
  const local = await storage.local.get({highlights_add: {[url]: undefined}});
  console.log(local)
  const highlights: LocalHighlightsObject = local.highlights_add[url].highlights;
  const elems = document.querySelectorAll(`[data-hho-id="${id}"]`);
  removeHighlightFromDom(highlights, elems);
}

function removeHighlightFromDom(highlights: LocalHighlightsObject, elems: NodeListOf<Element>) {
  // TODO: have to hold on to histre highlights and local highlights.
  // Or get local highlight when needed?
  for (const fill_elem of elems) {
    let prev = fill_elem.previousSibling;
    const prev_elems: [Element, number][] = [];
    let total_len = 0;
    while (prev) {
      if (prev.nodeType === 3) {
        const text_len = prev.textContent?.length || 0;
        if (text_len === 0) {
          prev = prev.previousSibling;
          continue;
        } else if (text_len > 0) {
          break;
        }
      }
      if (prev.nodeType === 1 && !(prev as Element).classList.contains("hho-mark")) {
        break;
      }

      total_len += prev.textContent?.length || 0;
      prev_elems.push([prev as Element, total_len]);
      prev = prev.previousSibling;
    }

    if (prev_elems.length === 0) {
      fill_elem.replaceWith(fill_elem.textContent!);
      continue;
    }

    const filtered_elems = prev_elems.filter(([elem, _], elem_index, arr) => {
      const id = elem.getAttribute("data-hho-id");
      // TODO: also filter based on length?
      const index = arr.findLastIndex(([el, _]) => el.getAttribute("data-hho-id") === id);
      return elem_index === index;
    })

    let fill_len = fill_elem.textContent?.length || 0;
    let fill_text_node: Node | undefined = undefined;
    let used_fill_len = 0;
    for (const [filter_elem, filter_len] of filtered_elems) {
      const curr_id = filter_elem.getAttribute("data-hho-id")!;
      const {text, color} = highlights[curr_id];
      // TODO: make sure f_elem is start of highlight?  

      const used_filter_len = filter_len + used_fill_len;
      const total_len = used_filter_len + fill_len;
      if (text.length >= total_len && fill_text_node === undefined) {
        fill_elem.setAttribute("data-hho-id", curr_id);
        fill_elem.setAttribute("data-hho-color", color!);
        break;
      } else if (text.length > used_filter_len) {
        if (fill_text_node === undefined) {
          fill_text_node = fill_elem.firstChild!;
          fill_elem.replaceWith(fill_text_node);
        }

        let text_end = fill_text_node as Text;
        let split_len = text.length - used_filter_len;
        split_len = Math.min(split_len, fill_len)
        if (split_len < total_len) {
          text_end = (fill_text_node as Text).splitText(split_len);
        }
        console.assert(split_len === fill_text_node.textContent!.length, "Text node (text_start) length should match splitText offset (split_len)");
        used_fill_len += split_len;

        const r = document.createRange();
        r.selectNode(fill_text_node);
        const new_mark = mark_elem.cloneNode(true) as Element;
        new_mark.setAttribute("data-hho-id", curr_id);
        new_mark.setAttribute("data-hho-color", color!);
        r.surroundContents(new_mark)
        fill_text_node = text_end;
        fill_len = fill_len - used_fill_len;
      }
    }
  }
}

function init() {
  const url = window.location.href;
  if(document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => renderLocalHighlights(url));
  } else {
    renderLocalHighlights(url)
  }  
  document.addEventListener("selectstart", startSelection);
  document.addEventListener("click", (e: Event) => {
    const elem = e.target as Element;
    if (elem.classList.contains("hho-mark")) {
      if (global.menu.isState(ContextMenuState.create)) {
        return;
      }
      global.menu.update(ContextMenuState.modify, elem);
    } else if (global.menu.isState(ContextMenuState.modify)) {
      global.menu.update(ContextMenuState.none);
    }
  })

  runtime.onMessage.addListener((msg: {pos: Position}) => {
    if (global.menu.pos !== msg.pos) {
      global.menu.pos = msg.pos;
      const win_selection = window.getSelection();
      if (global.menu.state !== ContextMenuState.none && win_selection) {
        global.menu.update(global.menu.state, win_selection)
      }
    }
  })

}
init();

test();
async function test() {
  const console_expect = (expect: any, got: any) => console.assert(expect === got, `\n  Expected: ${expect}\n  Got: ${got}`);
  console.log("==== Running tests ====")
  if (window.location.href === "http://localhost:8080/highlights.html") {
      // Setup
      const test_highlights = {
        "1": { text: "et iure velit", color: "yellow"},
        "2": { text: "iure", color: "blue"},
        "3": { text: "Ut consequatur voluptatum con", color: "yellow"},
        "4": { text: "consequatur voluptatum", color: "blue"},
        "5": { text: "tatum conse", color: "green"},
        "6": { text: "Dignissimos officiis qui odio", color: "yellow"},
        "7": { text: "officiis", color: "blue"},
        "8": { text: " qui ", color: "orange"},
        "9": { text: "Aliquam", color: "yellow"},
        "10": { text: "Aliquam illum", color: "blue"},

      };
      removeHighlights();
      const overlapping_indices = findHighlightIndices(document.body.textContent!, test_highlights);
      const indices = removeHighlightOverlaps(overlapping_indices);
      const current_entries = Object.entries(test_highlights);
      highlightDOM(indices, current_entries)

      // Tests
      {
        console.group(`Test highlight '${test_highlights["1"].text}'`);
        const before_elems = document.querySelectorAll(`[data-hho-id="2"]`);
        console_expect(1, before_elems.length)
        console_expect(2, document.querySelectorAll(`[data-hho-id="1"]`).length);
        removeHighlightFromDom(test_highlights, before_elems)
        console_expect(0, document.querySelectorAll(`[data-hho-id="2"]`).length);
        console_expect(3, document.querySelectorAll(`[data-hho-id="1"]`).length);
        console.groupEnd()
      }

      {
        console.group(`Test highlight '${test_highlights["3"].text}'`);
        const before_elems = document.querySelectorAll(`[data-hho-id="5"]`);
        console_expect(1, before_elems.length)
        console_expect(1, document.querySelectorAll(`[data-hho-id="3"]`).length);
        console_expect(1, document.querySelectorAll(`[data-hho-id="4"]`).length);
        removeHighlightFromDom(test_highlights, before_elems)
        console_expect(0, document.querySelectorAll(`[data-hho-id="5"]`).length)
        console_expect(2, document.querySelectorAll(`[data-hho-id="3"]`).length);
        console_expect(2, document.querySelectorAll(`[data-hho-id="4"]`).length);
        console.groupEnd()
      }

      {
        console.group(`Test highlight '${test_highlights["10"].text}'`);
        const before_elems = document.querySelectorAll(`[data-hho-id="10"]`);
        console_expect(1, before_elems.length)
        console_expect(1, document.querySelectorAll(`[data-hho-id="9"]`).length);
        removeHighlightFromDom(test_highlights, before_elems)
        console_expect(0, document.querySelectorAll(`[data-hho-id="10"]`).length);
        console_expect(2, document.querySelectorAll(`[data-hho-id="9"]`).length)
        console.groupEnd()
      }

      {
        console.group(`Test highlight '${test_highlights["8"].text}'`);
        const before_elems = document.querySelectorAll(`[data-hho-id="8"]`);
        console_expect(1, before_elems.length)
        console_expect(2, document.querySelectorAll(`[data-hho-id="6"]`).length);
        console_expect(1, document.querySelectorAll(`[data-hho-id="7"]`).length);
        removeHighlightFromDom(test_highlights, before_elems)
        console_expect(0, document.querySelectorAll(`[data-hho-id="8"]`).length);
        console_expect(3, document.querySelectorAll(`[data-hho-id="6"]`).length);
        console_expect(1, document.querySelectorAll(`[data-hho-id="7"]`).length)
        console.groupEnd()
      }

      {
        console.group(`Test highlight '${test_highlights["9"].text}'`);
        const before_elems = document.querySelectorAll(`[data-hho-id="9"]`);
        console_expect(2, before_elems.length)
        removeHighlightFromDom(test_highlights, before_elems)
        console_expect(0, document.querySelectorAll(`[data-hho-id="9"]`).length);
        console.groupEnd()
      }
  }
}
