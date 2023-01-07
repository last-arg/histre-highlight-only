import type { HighlightLocation, LocalHighlightsObject} from "./common";

// TODO?: try, consider
// Could try to use Uint32Array to get more performance [start, end, index_to, ...]
// {start, end, index_to_id_color}[]
// {id, color}[]
// If I make {...}[] into Uint32Array I can't use JS native sort, have to write my own
// 
// Could turn {...} into a tuple (Uint32Array or [...])


export function findHighlightIndices(body_text: string, current_highlights: LocalHighlightsObject): HighlightLocation[] {
  console.assert(body_text !== null, "body_text can't be null");
  console.assert(body_text.length !== 0, "body_text can't be empty");
  let locations: HighlightLocation[] = [];
  // Find highlights
  for (const [i, value] of Object.values(current_highlights).entries()) {
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

export function getHighlightIndices(body_text: string, current_highlights: LocalHighlightsObject): HighlightLocation[] {
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

// hello middle world
//     o middle
//         ddle wor
//        id
// [{start: 4, end: 12, index: 0}, 
//  {start: 7, end: 9, index: 1},
//  {start: 8, end: 16, index: 2}]
//   ||
//   V
// [{start: 4, end: 7, index: 0}, 
//  {start: 7, end: 8, index: 1}, {start: 8, end: 8, index: 2}, 
//  {start: 8, end: 9, index: 1}, {start: 9, end: 16, index: 2}]
export function removeHighlightOverlaps(locations: HighlightLocation[]): HighlightLocation[] {
  // Split overlapping highlights
  let split_locations = new Array<HighlightLocation>();
  if (locations.length === 0) return split_locations;
  const end = locations.length;
  let last_end = locations[0].start;
  for (let index = 0; index < end; index += 1) {
    const curr = locations[index];
    let next_index = index + 1; 
    const curr_start = Math.max(curr.start, last_end);
    console.log("start", curr_start);

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
    for ( ; next_index < end; next_index += 1) {
      const range = locations[next_index];
      if (range.start >= curr.end) {
        break;
      }
      inside_curr.push({start: range.start, end: range.end, index: range.index});
    }

    if (inside_curr.length === 1) {
      split_locations.push({start: next_range.start, end: next_range.end, index: next_range.index});
      last_end = next_range.end;
      index += 1;
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
