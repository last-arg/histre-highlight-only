import {Action} from './common';
import './hho.css';
console.log("==== LOAD 'content_script.js' TD ====")

const isDev = true;

// TODO: How to handle selection action bar (context menu) position with 
// mobile native context menu?

// TODO: fix clicking on context menu
// TODO: fix context menu position

const prefix_local_id = "hho-local-";

type ActionBar = HTMLDivElement;
declare global {
  interface Window {
    g: {
      action_bar_elem?: ActionBar
    };
  }
}
window.g = {
  action_bar_elem: undefined
};

const MIN_SELECTION_LEN = 3;

// Histre colors
enum Color { yellow, orange, green, blue, purple, red };

function getActionBar(): ActionBar {
  if (!window.g?.action_bar_elem) {
    document.querySelector(".hho-context-menu")?.remove();
    const container = document.createElement("div");
    container.classList.add("hho-context-menu");
    container.setAttribute("aria-hidden", "true");
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
    window.g.action_bar_elem = document.querySelector(".hho-context-menu") as HTMLDivElement;
  }

  return window.g.action_bar_elem;
}

function contextMenuClick(e: Event) {
  // e.stopPropagation();
  const elem = e.target as Element;
  if (elem.classList.contains("hho-btn-color")) {
    console.log("save selection")
    const sel_obj = window.getSelection();
    if (!sel_obj || sel_obj.toString().length === 0) {
      console.info("No selection to save");
      return;
    }
    const len = sel_obj.toString().length;
    if (len <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
    const local_id = Math.random().toString(36).substring(2,10)
    const local_class_id = `${prefix_local_id}-${local_id}`;
    highlightSelectedText(sel_obj, local_class_id);
    sel_obj.removeAllRanges(); // This fires 'selectionchange' event

    const color = elem.getAttribute("data-hho-color");
    console.log("button click color: ", color)

    // TODO: implement saving selection
    // TODO: handle saving multiple selections

    // TODO: Send selection to background
    // const hl = await browser.runtime.sendMessage()
    // will be added either to histre or local (if request failed)
    // figure out how to display success and failure
    // success: replace local ids with histre ids


    // TODO: implement highlighting for multiselect text?
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
  const _rest = char.splitText(1);

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

function containsNonWhiteSpace(node: Node): number {
  if (node.textContent && /^\s*$/.test(node.textContent)) {
    return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT
}

function highlightSelectedText(sel_obj: Selection, local_id: string) {
  const r = sel_obj.getRangeAt(0);

  let start_container: Node | null = r.startContainer;
  let end_container: Node | null = r.endContainer;

  if (end_container == start_container) {
    r.surroundContents(mark_elem.cloneNode(true))
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
    const new_mark = mark_elem.cloneNode(true);
    (new_mark as Element).classList.add(local_id);
    tmp_range.surroundContents(new_mark);
  }
}

function selectionNewPosition(selection: Selection, action_bar_rect: DOMRect) {
  console.log("rect", action_bar_rect)
  console.log("selection", selection);
  console.log("range", selection.getRangeAt(0));
  const box = selection.getRangeAt(0).getBoundingClientRect();
  console.log("box", box)
  const top = box.top + window.pageYOffset - action_bar_rect.height;
  const left = box.left + window.pageXOffset + (box.width / 2) - (action_bar_rect.width / 2);
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
  console.log("selectionchange")
  const sel_obj = window.getSelection();
  if (!sel_obj || sel_obj?.toString().length === 0) {
    document.removeEventListener("selectionchange", selectionChangeListener);
    getActionBar().setAttribute("aria-hidden", "true");
    return;
  }
  if (sel_obj.toString().length <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
  const action_bar = getActionBar();
  const action_bar_rect = action_bar.getBoundingClientRect();
  const new_pos = selectionNewPosition(sel_obj, action_bar_rect);
  console.log("new_pos", new_pos)
  action_bar.setAttribute("aria-hidden", "false");
  action_bar.style.top = `${new_pos.top}px`;
  action_bar.style.left = `${new_pos.left}px`;
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
    if (e.shiftKey && [37, 38, 39, 40].some((val) => val === e.which)) {
      selectionChange();
      document.addEventListener("selectionchange", selectionChangeListener)
    }
  }, {once: true})
}

getActionBar();
document.addEventListener("selectstart", startSelection)

// async function init() {
//   const r = await browser.runtime.sendMessage(
//     "addon@histre-highlight-only.com", 
//     {action: Action.Save},
//   )
//   console.log("r", r);
// }
// init();

