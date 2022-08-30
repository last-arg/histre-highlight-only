import type { HighlightLocation, LocalHighlightsObject} from "./common";

// TODO?: try, consider
// Could try to use Uint32Array to get more performance [start, end, index_to, ...]
// {start, end, index_to_id_color}[]
// {id, color}[]

export function findHighlightIndices(body_text: string, current_highlights: LocalHighlightsObject): HighlightLocation[] {
  let locations: HighlightLocation[] = [];
  if (body_text === null || body_text.length === 0) locations;
  // Find highlights
  for (const [i, value] of Object.values(current_highlights).entries()) {
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
      split_locations.push({start: loc.start, end: loc.end, index: loc.index});
      break;
    }
    let inner_loc = locations[inner_index];

    // This probably happens in most cases
    if (inner_loc.start >= loc.end) { 
      split_locations.push({start: loc.start, end: loc.end, index: loc.index});
      continue; 
    } else if (inner_loc.start < loc.end && inner_loc.end >= loc.end) {
      split_locations.push({start: loc.start, end: inner_loc.start, index: loc.index});
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
    let inner_pos_length = 0;
    // TODO: might needs this to fix a bug
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
    if (inner_pos_length === 0) {
      continue;
    }
    inner_positions.length = inner_pos_length;
    // Change outer loop index to skip already added items
    index += inner_pos_length;

    // Don't remove highlight if it is totally overlapped (nothing to show). 
    // Add <mark> where highlight should begin. Do this in case highlight on the
    // top is removed and need to highlight area underneath removed highlight.
    // Removed highlight area might have several highlight underneath it.
    // if (end_index >= loc.end) {
    //   // New end because other highlights overlap current highlights end
    //   loc.end = start_index;
    // }

    // Rest of inner_positions are inside current highlight. Till inner_pos_length

    // TODO: This has a bug. Will produce wrong result if inner_loc itself has 
    // overlapping highlights. Have to fix probably where inner_positions are added
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
      split_locations.push({start: inner_loc.start, end: inner_loc.end, index: inner_loc.index});

      // Make sure highlight end is 'visible'
      if (loc.end > inner_loc.end) {
        split_locations.push({start: inner_loc.end, end: Math.min(loc.end, start_index), index: loc.index});
      }
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
      if (curr.start <= max_end) {
        max_end = Math.max(max_end, curr.end);
        count += 1;
        continue;
      }
      splices.push(count);
      max_end = curr.end;
      count = 1;
    }

    for (const s of splices) {
      const partial_locations = removeHighlightOverlapsImpl(inner_positions.splice(0, s));
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

    if (loc.end > last_split.end) {
      split_locations.push({
        start: last_split.end,
        end: Math.min(loc.end, start_index),
        index: loc.index,
      });
    }
  }

  return split_locations;
}




// TODO: these 2 solutions for finding highlights still works
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

function testIterHighlight(current_highlights: [string, HighlightAdd][]) {
  const in_nodes = new Map<HighlightId, InNode>();
  const start_end_nodes = new Map<HighlightId, HighlightStartEnd>();
  const whole_nodes: HighlightWholeNode = new Map();
  const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, isNonVisibleTagFilter)
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

    const iter = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, isNonVisibleTagFilter)
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
    if (isNonVisibleTag(currentNode)) { continue; }

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
