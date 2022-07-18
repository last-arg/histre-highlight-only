console.log("==== LOAD 'content_script.js' ====")
const g = {
  action_bar_elem: undefined
};

const MIN_SELECTION_LEN = 3;

function initActionBar() {
  const container = document.createElement("div");
  container.style.setProperty("position", "absolute");
  container.style.setProperty("top", "0");
  container.style.setProperty("left", "0");
  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener("click", saveSelection);
  const button_text = document.createTextNode("Save selection");
  button.appendChild(button_text);
  container.appendChild(button);
  document.body.appendChild(container)
  return container;
}

// NOTE: Not used at the moment. Use it if you need.
// This gets exact coordinates of selection start. Use this if you want
// exact location of 'left'.
function selectionStartClientRect(sel_obj) {
  // TODO: there is Range.insertNode which enters Node at the start of the range
  // https://developer.mozilla.org/en-US/docs/Web/API/Range/insertNode
  const node = sel_obj.anchorNode;
  const parent = node.parentNode;
  const char = node.splitText(sel_obj.anchorOffset);
  // This makes an one character text node out of 'char'
  const _rest = char.splitText(1);

  const range = document.createRange();
  range.selectNode(char);
  const box = range.getBoundingClientRect();
  // Restore text node as it was
  parent.normalize();

  return box;
}

// TODO: implement saving selection
// TODO: handle saving multiple selections
function saveSelection() {
  const sel_obj = window.getSelection();
  const len = sel_obj.toString().length;
  if (len <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
  highlightSelectedText(sel_obj);
  sel_obj.collapseToStart();

  // TODO: implement highlighting for multiselect text?
  // for (let i = 0; i < sel_obj.rangeCount; i++) {
  //   console.log(sel_obj.getRangeAt(i));
  //   console.log(sel_obj.getRangeAt(i).toString());
  // }
}

// Wrapping selected text with <mark>.
// Selection doesn't start or end at edges of nodes.
// Selection can contain children elements.
const mark_elem = document.createElement("mark");
mark_elem.classList.add("hle-mark");

function isNodeWhiteSpaceOnly(node) {
  if (/^\s*$/.test(node.textContent)) {
    return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT
}

function highlightSelectedText(sel_obj) {
  const r = sel_obj.getRangeAt(0);

  let start_container = r.startContainer;
  let end_container = r.endContainer;

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
    const start_node = r.startContainer.splitText(r.startOffset);
    const iter = document.createNodeIterator(start_container, NodeFilter.SHOW_TEXT,  isNodeWhiteSpaceOnly)
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
    while (nextNode !== end_container) {
      const iter = document.createNodeIterator(nextNode, NodeFilter.SHOW_TEXT,  isNodeWhiteSpaceOnly)
      let currentNode;
      while (currentNode = iter.nextNode()) {
        valid_nodes.push(currentNode);
      }
      nextNode = nextNode.nextSibling;
    }
  }

  {
    // Add valid text nodes in end parent node
    const end_node = r.endContainer.splitText(r.endOffset);
    const iter = document.createNodeIterator(end_container, NodeFilter.SHOW_TEXT,  isNodeWhiteSpaceOnly)
    let currentNode;
    while (currentNode = iter.nextNode()) {
      if (currentNode === end_node) { break; }
      valid_nodes.push(currentNode);
    }
  }

  let tmp_range = document.createRange();
  for (let node of valid_nodes) {
    tmp_range.selectNode(node);
    tmp_range.surroundContents(mark_elem.cloneNode(true))
  }
}

function handleMouseUp(e) {
  console.log("Event: ", e.type)
  const sel_obj = window.getSelection();
  const len = sel_obj.toString().length;
  if (len <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
  const action_bar_rect = g.action_bar_elem.getBoundingClientRect();
  const new_pos = selectionNewPosition(sel_obj, action_bar_rect);
  g.action_bar_elem.style.setProperty("top", `${new_pos.top}px`);
  g.action_bar_elem.style.setProperty("left", `${new_pos.left}px`);
  document.addEventListener("selectionchange", debounceSelectionChange);
}

function selectionNewPosition(selection, action_bar_rect) {
  const box = selection.getRangeAt(0).getBoundingClientRect();
  const top = box.top + window.pageYOffset - action_bar_rect.height;
  const left = box.left + window.pageXOffset + (box.width / 2) - (action_bar_rect.width / 2);
  return { top: top, left: left };
}

// Can change selection size with:
// - touch device (most obvious)
// - keyboard (ctrl [+ shift] + arrow_keys)
// - mouse (ctrl/shift + mouse_click). 
//   'ctrl' starts another selection. 'shift' extends existing selection.
function initSelectionChange(e) {
  console.log("Event: ", e.type)
  const sel_obj = window.getSelection();
  const action_bar_rect = g.action_bar_elem.getBoundingClientRect();
  const new_pos = selectionNewPosition(sel_obj, action_bar_rect);
  console.log(new_pos.top, action_bar_rect.top)
  if (new_pos.top != action_bar_rect.top) {
    g.action_bar_elem.style.setProperty("top", `${new_pos.top}px`);
    g.action_bar_elem.style.setProperty("left", `${new_pos.left}px`);
  }
}

function debounce(f, delay) {
  let timeout;
  return function() {
    if (timeout === undefined) {
      timeout = setTimeout(() => {
        timeout = clearTimeout(timeout)
        f.apply(null, Array.from(arguments))
      }, delay);
    }
  }
}

const debounceSelectionChange = debounce(initSelectionChange, 100);
function deinitSelectionChange() {
  document.removeEventListener("selectionchange", debounceSelectionChange);
}


function initSelectionCode() {
  console.log("Event(init): selectstart")
  g.action_bar_elem = initActionBar();
  document.removeEventListener("selectstart", initSelectionCode);
  document.addEventListener("mouseup", handleMouseUp)
  document.addEventListener("touchend", handleMouseUp)
  document.addEventListener("mousedown", deinitSelectionChange)
  document.addEventListener("touchstart", deinitSelectionChange)
}
document.addEventListener("selectstart", initSelectionCode)
