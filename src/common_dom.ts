// Wrapping selected text with <mark>.
// Selection doesn't start or end at edges of nodes.

import { HighlightLocation, LocalHighlightsObject } from "./common";
import { findHighlightIndices, removeHighlightOverlaps } from "./highlight";

// Selection can contain children elements.
const mark_elem = document.createElement("mark");
mark_elem.classList.add("hho-mark");

export function createMarkElement(id: string, color: string | undefined) {
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

