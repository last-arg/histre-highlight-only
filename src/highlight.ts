import type { HighlightLocation, LocalHighlightsObject} from "./common";

// TODO?: try, consider
// Could try to use Uint32Array to get more performance [start, end, index_to, ...]
// {start, end, index_to_id_color}[]
// {id, color}[]

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

export function removeHighlightOverlaps(locations: HighlightLocation[]): HighlightLocation[] {
  locations.sort((a, b) => a.start - b.start);
  return removeHighlightOverlapsImpl(locations)
}

function removeHighlightOverlapsImpl(locations: HighlightLocation[]): HighlightLocation[] {
  // Split overlapping highlights
  let split_locations = new Array<HighlightLocation>();
  if (locations.length === 0) return split_locations;
  const end = locations.length;
  for (let index = 0; index < end; index += 1) {
    const curr = locations[index];
    let next_index = index + 1; 

    if (next_index >= locations.length) {
      split_locations.push({start: curr.start, end: curr.end, index: curr.index});
      break;
    }
    let next_range = locations[next_index];

    // This probably happens in most cases
    if (next_range.start >= curr.end) { 
      split_locations.push({start: curr.start, end: curr.end, index: curr.index});
      continue; 
    }

    // next_range.start is inside current range
    split_locations.push({start: curr.start, end: next_range.start, index: curr.index});

    if (next_range.end >= curr.end) {
      continue;
    }

    // next_range ends inside current range

    // See if more ranges start inside current range
    const inner_positions = [next_range];
    next_index += 1;
    for (;next_index < end; next_index += 1) {
      const tmp_inner = locations[next_index];
      if (tmp_inner.start >= curr.end) { break; }
      inner_positions.push(tmp_inner);
    }

    // Exclude continuous inner_positions that overlap current highglight to
    // the end or beyond end.
    let inner_pos_length = inner_positions.length;
    let end_index = next_range.end;
    for (let index = 1; index < inner_positions.length; index += 1) {
      const inner = inner_positions[index];
      if (inner.start <= end_index) {
        end_index = inner.end;
      } else {
        inner_pos_length = index + 1;
        end_index = inner.end;
      }
    }
    if (inner_pos_length === 0) {
      continue;
    }
    const ignore_pos = inner_positions.splice(inner_pos_length)
    // inner_positions.length = inner_pos_length;
    // Change outer loop index to skip already added items
    index += inner_pos_length;

    if (inner_positions.length === 1) {
      // Inner highlight goes beyond current highlight end. Start next 
      // outer loop with inner_loc.
      // if (inner_pos.end > loc.end) { continue; }
      split_locations.push({start: next_range.start, end: next_range.end, index: next_range.index});

      // Make sure highlight end is 'visible'
      if (curr.end > next_range.end) {
        split_locations.push({start: next_range.end, end: curr.end, index: curr.index});
      }
      // Make sure to skip this inner highlight on next outer loop
      continue;
    }

    // Have several inner higlights. These inner highlights might themselves overlap.

    let splices = [];
    let count = 1;
    let max_end = inner_positions[0].end;
    // NOTE: inner_positions length is larger than 1
    for (let i = 1; i < inner_positions.length; i += 1) {
      const curr = inner_positions[i];
      if (curr.start <= max_end) {
        max_end = Math.max(max_end, curr.end);
        count += 1;
        continue;
      }
      splices.push(count);
      max_end = curr.end;
      count = 1;
    }
    if (splices.length === 0) {
      splices.push(inner_positions.length)
    }

    for (const s of splices) {
      const partial_locations = removeHighlightOverlapsImpl(inner_positions.splice(0, s));
      const new_start = partial_locations[partial_locations.length - 1].end;
      const new_end = inner_positions.length > 0 ? inner_positions[0].start : curr.end;
      split_locations.push(...partial_locations, {
        start: new_start,
        end: new_end,
        index: curr.index,
      })
    }
    const partial_locations = removeHighlightOverlapsImpl(inner_positions.splice(0));
    split_locations.push(...partial_locations);

    const last_split = split_locations[split_locations.length - 1];

    if (curr.end > last_split.end) {
      const end_range = {
        start: last_split.end,
        end: curr.end,
        index: curr.index,
      }
      if (ignore_pos.length === 0) {
        split_locations.push(end_range);
      } else if (ignore_pos[0].start > last_split.end) {
        end_range.end = ignore_pos[0].start,
        split_locations.push(end_range);
      }
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
