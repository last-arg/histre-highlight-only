import type {HighlightAdd, HighlightId} from "./common";

type HighlightLocation = {
  start: number,
  end: number,
  index: number,
}

// TODO?: try, consider
// Could try to use Uint32Array to get more performance [start, end, index_to, ...]
// {start, end, index_to_id_color}[]
// {id, color}[]

export function findHighlightIndices(body_text: string, current_highlights: [HighlightId, HighlightAdd][]): HighlightLocation[] {
  let locations: HighlightLocation[] = [];
  if (body_text === null || body_text.length === 0) locations;
  // Find highlights
  for (const [i, [_, value]] of current_highlights.entries()) {
    let current_index = body_text?.indexOf(value.text, 0);
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
    const loc = locations[index];
    let inner_index = index + 1; 
    if (inner_index >= locations.length) {
      split_locations.push({start: loc.start, end: loc.end, index: index});
      break;
    }
    let inner_loc = locations[inner_index];
    // This probably happens in most cases
    if (inner_loc.start >= loc.end) { 
      split_locations.push({start: loc.start, end: loc.end, index: index});
      continue; 
    }

    const inner_positions = [inner_loc];
    inner_index += 1;
    for (;inner_index < end; inner_index += 1) {
      const tmp_inner = locations[inner_index];
      if (tmp_inner.start >= loc.end) { break; }
      inner_positions.push(tmp_inner);
    }

    // Exclude continuous inner_positions that overlap current highglight to
    // the end or beyond end.
    let inner_pos_length = inner_positions.length;
    let start_index = inner_loc.start;
    let end_index = inner_loc.end;
    for (let index = 1; index < inner_positions.length; index += 1) {
      const inner = inner_positions[index];
      if (inner.start <= end_index) {
        end_index = inner.end;
      } else {
        inner_pos_length = index;
        start_index = inner.start;
        end_index = inner.end;
      }
    }
    inner_positions.length = inner_pos_length;
    // Change outer loop index to skip already added items
    index += inner_pos_length;

    // Don't remove highlight if it is totally overlapped (nothing to show). 
    // Add <mark> where highlight should begin. Do this in case highlight on the
    // top is removed and need to highlight area underneath removed highlight.
    // Removed highlight area might have several highlight underneath it.
    if (end_index >= loc.end) {
      // New end because other highlights overlap current highlights end
      loc.end = start_index;
    }

    // Rest of inner_positions are inside current highlight. Till inner_pos_length

    if (inner_positions.length === 1) {
      // Need to always have start of highlight even if start and end are same.
      // This is needed if another highlight is removed and need to check if current
      // highlight needs to highlight removed area. 
      split_locations.push({
        start: loc.start,
        end: inner_loc.start,
        index: loc.index,
      });

      // Inner highlight goes beyond current highlight end. Start next 
      // outer loop with inner_loc.
      // if (inner_pos.end > loc.end) { continue; }
      split_locations.push({start: inner_loc.start, end: inner_loc.end, index: loc.index + 1});

      // We know this highlight is inside current highlight
      split_locations.push({start: inner_loc.end, end: loc.end, index: loc.index});
      // Make sure to skip this inner highlight on next outer loop
      continue;
    }

    // Have several inner higlights. These inner highlights might themselves overlap.
    split_locations.push({
      start: loc.start,
      end: inner_loc.start,
      index: loc.index
    });


    let splices = [];
    let count = 1;
    let max_end = inner_positions[0].end;
    // NOTE: inner_positions length is larger than 1
    for (let i = 1; i < inner_positions.length; i += 1) {
      const curr = inner_positions[i];
      if (curr.start < max_end) {
        max_end = Math.max(max_end, curr.end);
        count += 1;
        continue;
      }
      splices.push(count);
      count = 0;
    }

    for (const s of splices) {
      const partial_locations = removeHighlightOverlapsImpl(inner_positions.splice(0, s));
      // console.log("splices first: ", )
      const new_start = partial_locations[partial_locations.length - 1].end;
      const new_end = inner_positions.length > 0 ? inner_positions[0].start : loc.end;
      split_locations.push(...partial_locations, {
        start: new_start,
        end: new_end,
        index: loc.index,
      })
    }
    const partial_locations = removeHighlightOverlapsImpl(inner_positions.splice(0));
    split_locations.push(...partial_locations);

    const last_split = split_locations[split_locations.length - 1];
    split_locations.push({
      start: last_split.end,
      end: loc.end,
      index: loc.index,
    });
  }

  return split_locations;
}
