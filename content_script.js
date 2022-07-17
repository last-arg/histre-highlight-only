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
  const button_text = document.createTextNode("Save selection");
  button.appendChild(button_text);
  container.appendChild(button);
  document.body.appendChild(container)
  return container;
}

// NOTE: Not used at the moment. Use it if you need.
// This gets excat coordinates of selection start. Use this if you want
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
function saveSelection() {
  for (let i = 0; i < sel_obj.rangeCount; i++) {
    console.log(sel_obj.getRangeAt(i));
    console.log(sel_obj.getRangeAt(i).toString());
  }
}

function handleMouseUp(e) {
  console.log("Event: ", e.type)
  const sel_obj = window.getSelection();
  const len = Math.abs(sel_obj.anchorOffset - sel_obj.focusOffset);
  if (len <= MIN_SELECTION_LEN || sel_obj.anchorNode === null) return;
  const action_bar_rect = g.action_bar_elem.getBoundingClientRect();
  const new_pos = selectionNewPosition(sel_obj, action_bar_rect);
  console.log("selection obj pos: ", new_pos)
  g.action_bar_elem.style.setProperty("top", `${new_pos.top}px`);
  g.action_bar_elem.style.setProperty("left", `${new_pos.left}px`);

}

function selectionNewPosition(selection, action_bar_rect) {
  const box = selection.getRangeAt(0).getBoundingClientRect();
  const top = box.top + window.pageYOffset - action_bar_rect.height;
  const left = box.left + window.pageXOffset + (box.width / 2) - (action_bar_rect.width / 2);
  return { top: top, left: left };
}

// Use "selectstart" for initializing code.
// Stop listening "selectstart" event after initializing.
// TODO: selection changes size. Use throttle or debounce
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
  document.addEventListener("selectionchange", debounceSelectionChange);
}
document.addEventListener("selectstart", initSelectionCode)
