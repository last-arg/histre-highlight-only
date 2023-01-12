// Wrapping selected text with <mark>.
// Selection doesn't start or end at edges of nodes.

import { HighlightLocation, LocalHighlightsObject } from "./common";
import { findHighlightIndices, removeHighlightOverlaps } from "./highlight";

// Selection can contain children elements.
const mark_elem = document.createElement("mark");
mark_elem.classList.add("hho-mark");

export function createMarkElement(id: string, color: string | undefined): Element {
  const elem = mark_elem.cloneNode(true) as Element;
  elem.setAttribute("data-hho-color", color || "yellow");
  elem.setAttribute("data-hho-id", id);
  return elem;
}

export function highlightDOM(ranges: HighlightLocation[], current_entries: any) {
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

    const node_start = hl_loc.start - total_start;
    total_start += node_start;
    let hl_node = (current_node as Text).splitText(node_start);
    iter.nextNode();
    const color = current_entries[hl_loc.index][1].color;
    const hl_id = current_entries[hl_loc.index][0];

    if (hl_loc.end > total_end) {
      range.selectNode(hl_node);
      range.surroundContents(createMarkElement(hl_id, color));
      iter.nextNode();
      total_end = total_start + (hl_node.textContent?.length || 0);

      while (current_node = iter.nextNode()) {
        total_start = total_end;
        const node_text_len = current_node.textContent?.length || 0;
        total_end += node_text_len;
        if (hl_loc.end <= total_end) {
          // End of highlight
          const len = node_text_len - (total_end - hl_loc.end);
          total_end = total_start + len;
          (current_node as Text).splitText(len);
          range.selectNode(current_node);
          range.surroundContents(createMarkElement(hl_id, color));

          // skip new nodes made by splitText and surroundContents
          iter.nextNode();
          break;
        }

        // middle of highlight
        range.selectNode(current_node);
        range.surroundContents(createMarkElement(hl_id, color));
        iter.nextNode();
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

export function renderLocalHighlights(body_text: string, current_highlights: LocalHighlightsObject) {
  console.log("==== renderLocalHighlights() ====")

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

export function removeHighlights(hl_id?: string) {
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

export function removeHighlightFromDom(highlights: LocalHighlightsObject, elems: NodeListOf<Element>) {
  // TODO: have to hold on to histre highlights and local highlights.
  // Or get local highlight when needed?
  for (const fill_elem of elems) {
    const rem_text = fill_elem.textContent || "";
    const rem_len = rem_text.length;
    if (rem_len === 0) {
      fill_elem.remove();
      continue;
    }
    let prev = fill_elem.previousSibling;
    const prev_map = new Map<string, number>(); // strings is highlight id
    let total_len = 0;
    while (prev) {
      // nodeType:
      // 1 - Element node
      // 3 - Text node
      if (prev.nodeType === 3) {
        const text_len = prev.textContent?.length || 0;
        if (text_len === 0) {
          prev = prev.previousSibling;
          continue;
        }
        break;
      } else if (prev.nodeType === 1 && !(prev as Element).classList.contains("hho-mark")) {
        break;
      }

      total_len += prev.textContent?.length || 0;
      const id = (prev as Element).getAttribute("data-hho-id");
      if (!id) {
        // Should not happen unless 'data-hho-id' is removed somehow
        continue;
      }

      prev_map.set(id, total_len)
      prev = prev.previousSibling;
    }

    if (prev_map.size === 0) {
      fill_elem.replaceWith(fill_elem.textContent!);
      continue;
    }

    for (const [key, value] of prev_map) {
      if (value === highlights[key].text.length) {
        prev_map.delete(key);
      }
    }

    if (prev_map.size === 0) {
      fill_elem.replaceWith(fill_elem.textContent!);
      continue;
    }

    // rem_len
    let childs = [];
    let text_node = fill_elem.firstChild!;
    let slice_start = 0;
    for (const [prev_id, prev_len] of prev_map) {
      const hl = highlights[prev_id];
      const new_rem_len = hl.text.length - prev_len;
      if (childs.length === 0 && new_rem_len >= rem_len) {
        fill_elem.setAttribute("data-hho-id", prev_id)
        fill_elem.setAttribute("data-hho-color", hl.color || "yellow")
        break;
      }

      if (text_node.textContent) {
        const mark_node = createMarkElement(prev_id, hl.color) as Node;
        mark_node.textContent = text_node.textContent.slice(slice_start, new_rem_len);
        childs.push(mark_node);
        slice_start = new_rem_len; 
      }
    }

    if (childs.length > 0) {
      if (slice_start < text_node.textContent!.length) {
        childs.push(text_node.textContent!.slice(slice_start));
      }
      fill_elem.replaceWith(...childs);
    }

  }
}
