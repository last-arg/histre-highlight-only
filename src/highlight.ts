import type { HighlightLocation, HistreHighlight, LocalHighlightsObject} from "./common";

// TODO?: try, consider
// Could try to use Uint32Array to get more performance [start, end, index_to, ...]
// {start, end, index_to_id_color}[]
// {id, color}[]
// If I make {...}[] into Uint32Array I can't use JS native sort, have to write my own
// 
// Could turn {...} into a tuple (Uint32Array or [...])


export function findHighlightIndices(body_text: string, current_highlights: Array<HistreHighlight>): HighlightLocation[] {
  console.assert(body_text !== null, "body_text can't be null");
  console.assert(body_text.length !== 0, "body_text can't be empty");
  let locations: HighlightLocation[] = [];
  // Find highlights
  for (const [i, value] of current_highlights.entries()) {
    let current_index = body_text.indexOf(value.text, 0);
    while (current_index !== -1) {
      const end = current_index + value.text.length;
      locations.push({ 
        start: current_index,
        end: end,
        index: i,
      });
      current_index = body_text?.indexOf(value.text, end)
    }
  }
  return locations;
}

export function getHighlightIndices(body_text: string, current_highlights: Array<HistreHighlight>): HighlightLocation[] {
  let locs = findHighlightIndices(body_text, current_highlights);
  locs.sort((a, b) => {
    if (a.start === b.start) {
      const a_len = a.end - a.start;
      const b_len = b.end - b.start;
      return b_len - a_len;
    }
    return a.start - b.start;
  })
  return removeHighlightOverlaps(locs);
}

export function removeHighlightOverlaps(locations: HighlightLocation[]): HighlightLocation[] {
  // Split overlapping highlights
  if (locations.length <= 1) return locations;
  let split_locations = new Array<HighlightLocation>();
  const end = locations.length;
  let last_end = locations[0].start;
  for (let index = 0; index < end; index += 1) {
    const curr = locations[index];
    let next_index = index + 1; 
    const curr_start = Math.max(curr.start, last_end);

    if (next_index >= locations.length) {
      split_locations.push({start: curr_start, end: curr.end, index: curr.index});
      last_end = curr.end;
      break;
    }
    let next_range = locations[next_index];

    // This probably happens in most cases
    if (next_range.start >= curr.end) { 
      split_locations.push({start: curr_start, end: curr.end, index: curr.index});
      last_end = curr.end;
      continue; 
    }

    split_locations.push({start: curr_start, end: next_range.start, index: curr.index});

    let inside_curr = [next_range];
    next_index += 1;
    let max_end = Math.max(next_range.end, curr.end)
    for ( ; next_index < end; next_index += 1) {
      const range = locations[next_index];
      if (range.start >= max_end) {
        break;
      }
      inside_curr.push(range);
      max_end = Math.max(max_end, range.end);
    }

    index = next_index - 1;

    const no_overlaps = removeHighlightOverlaps(inside_curr);
    let slice_start = 0;
    for (let i = 1; i < no_overlaps.length; i += 1) {
      const range = no_overlaps[i];
      const prev_end = no_overlaps[i - 1].end;
      // Have a gap
      if (range.start > prev_end) {
        Array.prototype.push.apply(split_locations, no_overlaps.slice(slice_start, i));
        split_locations.push({start: prev_end, end: range.start, index: curr.index});
        slice_start = i;
      }
    }
    Array.prototype.push.apply(split_locations, no_overlaps.slice(slice_start))
    last_end = no_overlaps[no_overlaps.length - 1].end;
    if (curr.end > last_end) {
      split_locations.push({start: last_end, end: curr.end, index: curr.index});
      last_end = curr.end
    }
  }
  return split_locations;
}

export function isNonVisibleTag(node: Node) {
  const p = node.parentNode;
  return p && ["SCRIPT", "STYLE"].includes(p.nodeName);
}

export function isNonVisibleTagFilter(node: Node) {
  if (isNonVisibleTag(node)) {
    return NodeFilter.FILTER_REJECT;
  }
  return NodeFilter.FILTER_ACCEPT;
}
