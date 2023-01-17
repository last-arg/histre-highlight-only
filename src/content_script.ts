/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { Color, Action, Position, local_id_prefix, isEmptyObject, UserSettings, HistreHighlight, randomString } from './common';
import { getSettings } from './storage';
import { createMarkElement, removeHighlightFromDom, renderLocalHighlights } from './common_dom';
import { settings_default, ext_id } from './config';
import {act} from '@artalar/act';
import './hho.css';
// import browser from 'webextension-polyfill';
console.log("==== LOAD 'content_script.js' TD ====")
    // console.log(browser.storage)

type ContextMenuElem = HTMLDivElement;
enum ContextMenuState { none, create, modify }

const MIN_SELECTION_LEN = 3;

class ContextMenu {
  elem: ContextMenuElem;
  modify_elem: Element | null = null;
  state: ContextMenuState = ContextMenuState.none;
  highlight_id: string | null = null;
  settings = act(settings_default);

  constructor() {
    this.elem = ContextMenu.renderContextMenu();
    document.addEventListener("click", ContextMenu.handleClick(this));
    getSettings().then((settings) => { 
      if (settings) {
        this.settings(settings);
        this.updateMenuOrigin();
      }
    })
  }

  isState(state: ContextMenuState) { return this.state === state; }

  updateMenuOrigin = act(() => {
    console.log("updatemenuorigin:", this.settings().origin)
    this.elem.setAttribute("data-origin", this.settings().origin);
  })

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
        const new_pos = selectionNewPosition(arg as Selection, rect, this.settings() as UserSettings);
        this.elem.setAttribute("style", "");
        for (const key in new_pos) {
          const value = new_pos[key];
          // @ts-ignore
          this.elem.style[key] = typeof value === "number" ? `${new_pos[key]}px` : value;
        }
        this.elem.setAttribute("aria-hidden", "false");
        break;
      }
      case ContextMenuState.modify: {
        const elem = (arg || this.modify_elem) as Element | null;
        if (!elem) {
          return;
        }
        this.modify_elem = elem;
        this.highlight_id = elem.getAttribute("data-hho-id");
        const rect = this.elem.getBoundingClientRect();
        const settings = this.settings() as UserSettings;
        let new_pos: CssPosition | undefined = undefined;
        if (settings.origin === "viewport") {
          new_pos = viewportPosition(settings.location, rect.width);
        } else if (settings.origin === "selection") {
          new_pos = elemPosition(elem.getBoundingClientRect(), rect, settings);
        }
        if (!new_pos) {
          return;
        }
        this.elem.setAttribute("style", "");
        for (const key in new_pos) {
          const value = new_pos[key];
          this.elem.style[key as any] = typeof value === "number" ? `${new_pos[key]}px` : value;
        }
        this.elem.setAttribute("aria-hidden", "false");
        break;
      }
    }
    this.state = state; 
  }

  static renderContextMenu() {
    // document.querySelector(".hho-context-menu")?.remove();
    const container = document.createElement("div");
    container.classList.add("hho-context-menu");
    container.style.top = "0";
    container.style.left = "0";

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

      const button_text = document.createElement("span");
      button_text.classList.add("sr-only");
      button_text.textContent = `Remove`;

      const new_img = document.createElement("img");
      new_img.src = `/assets/delete.svg`;

      new_button.appendChild(button_text);
      new_button.appendChild(new_img);
      container.appendChild(new_button);
    }

    container.setAttribute("data-hho-state", ContextMenuState[ContextMenuState.none]);
    container.setAttribute("data-hho-state", settings_default.origin);
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
            const result_id = await browser.runtime.sendMessage(
              ext_id, { action: Action.Create, data: data },
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

            const result = await browser.runtime.sendMessage(
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

            let text = undefined;
            let hl_index = -1;
            if (id.startsWith("histre")) {
              hl_index = global.histre_highlights.findIndex(({highlight_id}) => id === highlight_id);
              if (hl_index !== -1) {
                text = global.histre_highlights[hl_index].text;
              } else {
                console.error(`Failed to delete histre higlight. Could not find histre highlight with id ${id}`);
                return;
              }
            }
            const result = await browser.runtime.sendMessage(
              "addon@histre-highlight-only.com", 
              { action: Action.Remove , data: {id: id, text: text} },
            )

            if (!result) {
              console.error(`Failed to remove highlight '${id}'`)
              return;
            }

            if (hl_index !== -1) { 
              global.histre_highlights.splice(hl_index, 1);
            }
            removeHighlight(id, document.location.href);
          }
          break;
        }
      }
    }
    return handleClickImpl;
  }
}

const global = {
  menu: new ContextMenu(),
  histre_highlights: [] as Array<HistreHighlight>,
};

async function getLocalHighlights(current_url: string): Promise<Array<HistreHighlight> | undefined> {
    const local = await browser.storage.local.get(["highlights_add"]);
    if (local.highlights_add[current_url] === undefined) { 
        console.info(`No highlights for ${current_url}`);
        return; 
    }
    const current_highlights = local.highlights_add[current_url].highlights as Array<HistreHighlight>;
    if (isEmptyObject(current_highlights)) { 
        console.info(`Found url ${current_url} doesn't contain any highlights`);
        return; 
    }
    return current_highlights;
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
    const new_mark = createMarkElement(local_id, color);
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
    const new_mark = createMarkElement(local_id, color);
    tmp_range.surroundContents(new_mark);
  }
}

type CssPosition = Record<string, number | string>;
const viewport_positions: Record<string, CssPosition> = {
  "tl": {top: 0, left: 0},
  "tc": {top: 0, left: 0}, // left will be modified by fn
  "tr": {top: 0, right: 0},
  "bl": {bottom: 0, left: 0},
  "bc": {bottom: 0, left: 0}, // left will be modified by fn
  "br": {bottom: 0, right: 0},
};

function viewportPosition(loc: Position, menu_width: number): CssPosition {
  let result = viewport_positions[loc];
  if (loc === "tc" || loc === "bc") {
      result.left = `calc(50% - ${menu_width / 2}px)`;
  }
  return result;
}

function selectionPosition(selection: Selection, context_menu_rect: DOMRect, settings: UserSettings): CssPosition {
  const box = selection.getRangeAt(0).getBoundingClientRect();
  return elemPosition(box, context_menu_rect, settings);
}

function elemPosition(elem_rect: DOMRect, context_menu_rect: DOMRect, settings: UserSettings): CssPosition {
  const body_rect = document.body.getBoundingClientRect();
  let top = 0;
  let left = 0;
  const margin = 10;

  if (settings.location[0] === "t") {
    top = elem_rect.top + window.pageYOffset - context_menu_rect.height - margin;
  } else if (settings.location[0] === "b") {
    top = elem_rect.bottom + window.pageYOffset + margin;
  }
  
  if (settings.location[1] === "c") {
    left = elem_rect.left + window.pageXOffset + - body_rect.x + (elem_rect.width / 2) - (context_menu_rect.width / 2);
  } else if (settings.location[1] === "l") {
    left = elem_rect.left + window.pageXOffset;
  } else if (settings.location[1] === "r") {
    left = elem_rect.right + window.pageXOffset - context_menu_rect.width;
  }

  // Make sure context menu doesn't go out of bounds horizontally
  if (left < 0) {
    left = 0;
  } else if ((elem_rect.left + (context_menu_rect.width)) > body_rect.right) {
    left = body_rect.right - context_menu_rect.width - body_rect.x + window.pageXOffset;
  }

  return {top: top, left: left};
}

function selectionNewPosition(selection: Selection, context_menu_rect: DOMRect, settings: UserSettings): CssPosition {
  switch (settings.origin) {
    case "viewport": {
      return viewportPosition(settings.location, context_menu_rect.width); 
    }
    case "selection": {
      return selectionPosition(selection, context_menu_rect, settings); 
    }
  }
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
  console.log(selection_str)
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

async function removeHighlight(id: string, url: string) {
  const local = await browser.storage.local.get({highlights_add: {[url]: undefined}});
  const highlights = local.highlights_add[url].highlights;
  const elems = document.querySelectorAll(`[data-hho-id="${id}"]`);
  removeHighlightFromDom(highlights, elems);
}

async function getAndRenderHighlights(url: string) {
    const body_text = document.body.textContent
    if (body_text === null) { 
        console.warn("Didn't find 'document.body'. Nothing to highlight.");
        return; 
    }

    const histre_async = browser.runtime.sendMessage(ext_id, { action: Action.GetHighlights });

    const local_highlights = await getLocalHighlights(url);
    const highlights: Array<HistreHighlight> = (await histre_async) || [];
    global.histre_highlights = highlights;
    if (local_highlights) {
      for (const local of local_highlights) {
        highlights.push(local)
      }
    }
    if (highlights.length > 0) {
      renderLocalHighlights(body_text, highlights);
    }
}

function init() {
  console.log("init")
  const url = window.location.href;
  if(document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", () => getAndRenderHighlights(url));
  } else {
    getAndRenderHighlights(url)
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

  browser.runtime.onMessage.addListener((msg: {settings: UserSettings}) => {
    global.menu.settings(msg.settings);
    global.menu.updateMenuOrigin();
    const win_selection = window.getSelection();
    if (global.menu.isState(ContextMenuState.create) && win_selection) {
      global.menu.update(global.menu.state, win_selection)
    } else if (global.menu.isState(ContextMenuState.modify)) {
      global.menu.update(global.menu.state, undefined)
    }
  })
}
init();
