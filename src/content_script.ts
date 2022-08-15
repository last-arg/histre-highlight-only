/// <reference lib="dom" />
import { storage } from 'webextension-polyfill';
import { Action, HighlightAdd, HighlightId } from './common';
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
    if (e.shiftKey && [37, 38, 39, 40].some((val) => val === e.which)) {
      selectionChange();
      document.addEventListener("selectionchange", selectionChangeListener)
    }
  }, {once: true})
}

getContextMenu();
document.addEventListener("selectstart", startSelection)


type HighlightColor = string;
type InNode = { node: Node, indices: number[], length: number, color: HighlightColor };
// TODO: rename to EdgeNode
type StartOrEndNode = { index: number, node: Node };
// TODO: might have several matches on page
type HighlightStartEnd = {start: StartOrEndNode, end: StartOrEndNode, color: HighlightColor};
type HighlightWholeNode = Map<HighlightId, Node[]>;

function checkNodesForMatch(iter: any, start_node: Node, value_text: string, value_start_index: number) {
  let result: { end_node: StartOrEndNode | undefined, hls: Node[], index: number } = { end_node: undefined, hls: [], index: value_start_index };
  let next_node: Node | null = start_node;
  while (next_node) {
    if (!next_node.textContent) { 
      next_node = iter.nextNode();
      continue; 
    }
    const value_tail = value_text.slice(result.index);
    if (value_tail.length > next_node.textContent.length) {
      if (value_tail.startsWith(next_node.textContent)) {
        result.index += next_node.textContent.length;
        result.hls.push(next_node)
        next_node = iter.nextNode();
        continue;
      }
    }

    // End of highlight
    if (next_node.textContent.startsWith(value_tail)) {
      result.end_node = { index: value_tail.length, node: next_node };
    }
    break;
  }
  return result;
}

const ignore_node_names = ["SCRIPT", "STYLE"];
function isNonVisibleTag(node: Node) {
  if (node.parentNode && ignore_node_names.includes(node.parentNode.nodeName)) {
    return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT

}

function testIterHighlight(current_highlights: [string, HighlightAdd][]) {
  const in_nodes = new Map<HighlightId, InNode>();
  const start_end_nodes = new Map<HighlightId, HighlightStartEnd>();
  const whole_nodes: HighlightWholeNode = new Map();
  const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, isNonVisibleTag)
  let currentNode: Node | null = null;
  let debug_count = 0;
  while (currentNode = iter.nextNode()) {
    let current_text = currentNode.textContent;
    if (!current_text) { continue; }
    {
      if (debug_count === 1000) {
        console.error("exceeded debug count")
        break;
      }
      debug_count += 1;
    }
    // Can't filter them because need whitespace character symbols in text comparison  
    // Although highlight text might start with whitespace character. Could trim 
    // whitespace from highlight text when adding or checking (here) highlight.
    if (current_text.trim().length === 0) continue

    for (const hl of current_highlights) {
      const key = hl[0];
      const value = hl[1];

      if (current_text.length >= value.text.length) {
        // Simple case when highlighted text is inside one text node
        let found_highlights = false;
        let splits = [];
        let value_index = current_text.indexOf(value.text, 0);
        while (value_index !== -1) {
          splits.push(value_index);
          found_highlights = true;
          const position = value_index + value.text.length;
          // console.log(current_text.slice(value_index, position))
          value_index = current_text.indexOf(value.text, position);
        }

        if (found_highlights) {
          in_nodes.set(key, 
            { node: currentNode, indices: splits, length: value.text.length, color: value.color! })
        }
      }

      // Highlighted text encompasses several text nodes.
      if (current_text.length > value.text.length) {
        // TODO: this code causes infinite loop in NodeIterator
        // Check if current_text ends with any value.text start substr
        let position = current_text.length - value.text.length + 1;
        let value_index = current_text.indexOf(value.text[0], position)
        // console.log("NEW")
        while (value_index !== -1) {
          position = value_index + 1;
          const end_index = current_text.length - position + 1;
          const possible_end = value.text.slice(1, end_index);
          if (current_text.endsWith(possible_end)) {
            const anchor_node = iter.nextNode();
            if (!anchor_node) break;
            const match = checkNodesForMatch(iter, anchor_node, value.text, possible_end.length + 1);

            if (match.end_node) {
              const start_end: HighlightStartEnd = {
                start: { index: current_text.length - match.index + 1, node: currentNode },
                end: match.end_node,
                color: value.color || "yellow",
              }
              start_end_nodes.set(key, start_end)
              console.assert(
                value.text == 
                (start_end.start.node.textContent!.slice(start_end.start.index) +
                 match.hls.reduce((prev, curr) => prev + curr.textContent, "") +
                 start_end.end.node.textContent!.slice(0, start_end.end.index)),
                "Found highlight content doesn't match"
              );
              addWholeNodes(key, match.hls, whole_nodes);
            } else {
              while (anchor_node !== iter.previousNode()) {}
            }

          }
          value_index = current_text.indexOf(value.text[0], position)
        }
        // "node text longer" > "noger"
      } else {
        let value_index = current_text.indexOf(value.text[0], 0)
        while (value_index !== -1) {
          const end_index = Math.min(value.text.length, current_text.length - value_index);
          const possible_end = value.text.slice(1, end_index);

          if (current_text.endsWith(possible_end)) {
            const anchor_node = iter.nextNode();
            if (!anchor_node) break;
            const match = checkNodesForMatch(iter, anchor_node, value.text, possible_end.length + 1);

            if (match.end_node) {
              const start_end: HighlightStartEnd = {
                start: { index: current_text.length - end_index, node: currentNode },
                end: match.end_node,
                color: value.color || "yellow"
              };
              start_end_nodes.set(key, start_end)
              console.assert(
                value.text == 
                (start_end.start.node.textContent!.slice(start_end.start.index) +
                 match.hls.reduce((prev, curr) => prev + curr.textContent, "") +
                 start_end.end.node.textContent!.slice(0, start_end.end.index)),
                "Found highlight content doesn't match"
              );
              addWholeNodes(key, match.hls, whole_nodes);
            } else {
              while (anchor_node !== iter.previousNode()) {}
            }
          }
          value_index = current_text.indexOf(value.text[0], value_index + 1)
        }
      }
    }
  }

  return { in_nodes, start_end_nodes, whole_nodes };
}

function addWholeNodes(key: string, nodes: Node[], whole_nodes: any) {
  // TODO: remove '\n' nodes?
  if (nodes.length > 0) {
    const whole_key = key;
    const curr_nodes = whole_nodes.get(whole_key) || []
    curr_nodes.push(...nodes)
    whole_nodes.set(whole_key, curr_nodes);
  }
}

function testHighlightIter(current_highlights: [string, HighlightAdd][]) {
  const in_nodes = new Map<HighlightId, InNode>();
  const start_end_nodes = new Map<HighlightId, HighlightStartEnd>();
  const whole_nodes: HighlightWholeNode = new Map();
  for (const hl of current_highlights) {
    const key = hl[0];
    const value = hl[1];

    const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, isNonVisibleTag)
    let currentNode: Node | null = null;
    let debug_count = 0;
    while (currentNode = iter.nextNode()) {
      let current_text = currentNode.textContent;
      if (!current_text) { continue; }
      {
        if (debug_count === 2000) {
          console.error("exceeded debug count")
          break;
        }
        debug_count += 1;
      }
      if (current_text.trim().length === 0) continue

      if (current_text.length >= value.text.length) {
        // Simple case when highlighted text is inside one text node
        let found_highlights = false;
        let splits = [];
        let value_index = current_text.indexOf(value.text, 0);
        while (value_index !== -1) {
          splits.push(value_index);
          found_highlights = true;
          const position = value_index + value.text.length;
          // console.log(current_text.slice(value_index, position))
          value_index = current_text.indexOf(value.text, position);
        }

        if (found_highlights) {
          in_nodes.set(key, 
            { node: currentNode, indices: splits, length: value.text.length, color: value.color! })
        }
      }

      // Highlighted text encompasses several text nodes.
      if (current_text.length > value.text.length) {
        // Check if current_text ends with any value.text start substr
        let position = current_text.length - value.text.length + 1;
        let value_index = current_text.indexOf(value.text[0], position)
        // console.log("NEW")
        while (value_index !== -1) {
          position = value_index + 1;
          const end_index = current_text.length - position + 1;
          const possible_end = value.text.slice(1, end_index);
          if (current_text.endsWith(possible_end)) {
            const anchor_node = iter.nextNode();
            if (!anchor_node) break;
            const match = checkNodesForMatch(iter, anchor_node, value.text, possible_end.length + 1);

            if (match.end_node) {
              const start_end: HighlightStartEnd = {
                start: { index: current_text.length - match.index + 1, node: currentNode },
                end: match.end_node,
                color: value.color || "yellow",
              }
              start_end_nodes.set(key, start_end)
              console.assert(
                value.text == 
                (start_end.start.node.textContent!.slice(start_end.start.index) +
                 match.hls.reduce((prev, curr) => prev + curr.textContent, "") +
                 start_end.end.node.textContent!.slice(0, start_end.end.index)),
                "Found highlight content doesn't match"
              );
              addWholeNodes(key, match.hls, whole_nodes);
            } else {
              // console.log("restore anchor node")
              while (anchor_node !== iter.previousNode()) {}
            }

          }
          value_index = current_text.indexOf(value.text[0], position)
        }
        // "node text longer" > "noger"
      } else {
        let value_index = current_text.indexOf(value.text[0], 0)
        while (value_index !== -1) {
          const end_index = Math.min(value.text.length, current_text.length - value_index);
          const possible_end = value.text.slice(1, end_index);

          if (current_text.endsWith(possible_end)) {
            const anchor_node = iter.nextNode();
            if (!anchor_node) break;
            const match = checkNodesForMatch(iter, anchor_node, value.text, possible_end.length + 1);

            if (match.end_node) {
              const start_end: HighlightStartEnd = {
                start: { index: current_text.length - end_index, node: currentNode },
                end: match.end_node,
                color: value.color || "yellow"
              };
              start_end_nodes.set(key, start_end)
              console.assert(
                value.text == 
                (start_end.start.node.textContent!.slice(start_end.start.index) +
                 match.hls.reduce((prev, curr) => prev + curr.textContent, "") +
                 start_end.end.node.textContent!.slice(0, start_end.end.index)),
                "Found highlight content doesn't match"
              );
              addWholeNodes(key, match.hls, whole_nodes);
            } else {
              while (anchor_node !== iter.previousNode()) {}
            }
          }
          value_index = current_text.indexOf(value.text[0], value_index + 1)
        }
      }
    }
  }

  return { in_nodes, start_end_nodes, whole_nodes };

}

// TODO: find search term index in body.textContent.
// Use NodeIterator to find text node position
function highlightLocations(locations: HighlightLocation[]) {
  if (locations.length === 0) return;
  // Can't filter, would throw off location indices.
  const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, null)
  let currentNode: Node | null = null;
  let end_index = 0;
  let location_index = 0;
  console.log(NodeFilter.FILTER_ACCEPT)
  console.log(NodeFilter.FILTER_REJECT)
  while (currentNode = iter.nextNode()) {
    const node_len = currentNode.textContent?.length || 0;
    if (node_len === 0) { continue; }
    const start_index = end_index;
    end_index += node_len;
    if (currentNode.textContent!.trim().length === 0) { continue; }
    if (isNonVisibleTag(currentNode) === NodeFilter.FILTER_REJECT) { continue; }

    let location = locations[location_index];
    while (location.index < end_index) {
      // console.log("highlight start", location_index, location)

      // TODO: highlight text
      // const hl_end = location.index + location.length;
      // if (hl_end <= end_index) {
      //   // console.log("simple")
      //   console.log("expect: ", document.body.textContent.slice(location.index, location.index + location.length))
      //   // console.log("node text: ", currentNode.textContent)
      //   const hl_start = location.index - start_index;
      //   const hl_end = hl_start + location.length;
      //   // console.log("start: ", hl_start)
      //   console.log("got: ", currentNode.textContent.slice(hl_start, hl_end))
      //   if (hl_start > 0) {
      //     const rest_node = (currentNode as Text).splitText(hl_start);
      //     iter.nextNode();
      //   console.log("start", rest_node)
      //   }

      //   if (hl_start > 0) {
      //     const rest_node = (currentNode as Text).splitText(hl_start);
      //     iter.nextNode();
      //     console.log("end", rest_node)
      //   }





      //   // highlight is inside this node
      // } else {
      //   // highlight goes beyond this node
      // }

      location_index += 1;
      if (location_index >= locations.length) {  break;  }
      location = locations[location_index];

      // highlight starts in this node 
    }
    if (location_index >= locations.length) {  break;  }

  }
}

async function renderLocalHighlights(current_url: string) {
  console.log("==== renderLocalHighlights() ====")
  const local = await storage.local.get({highlights_add: undefined});
  if (!local.highlights_add) { return; }
  const current_highlights = Object.entries<HighlightAdd>(local.highlights_add)
    .filter(([_, value]) => value.url === current_url);
  if (current_highlights.length === 0) { return; }
  console.log(current_highlights)

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

// renderLocalHighlights("https://en.wikipedia.org/wiki/Program");
// renderLocalHighlights("wrong_url");


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


