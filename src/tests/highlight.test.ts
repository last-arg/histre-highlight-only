import { it, expect } from "bun:test";
import { readFileSync } from "fs";
import { LocalHighlightsObject } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import { test_local, test_locations_single, test_locations_multi } from "./test_data";

// TODO: check out https://github.com/lusito/mockzilla-webextension
// TODO: Consider [jsdom](https://www.npmjs.com/package/jsdom) for testing DOM with node/bun
// jsdom not working with bun: https://github.com/oven-sh/bun/issues/198
// jsdom alternative? [domino](https://www.npmjs.com/package/domino)


it("remove highlight overlaps single", () => {
  const split_locations = removeHighlightOverlaps(test_locations_single);
  let prev = split_locations[0];
  expect(prev.start <= prev.end).toBe(true);
  for (let i = 1; i < split_locations.length; i++) {
    const loc = split_locations[i];
    expect(loc.start <= loc.end).toBe(true);
    expect(loc.start >= prev.end).toBe(true);
    prev = loc;
  }
})

it("remove highlight overlaps multi", () => {
  const split_locations = removeHighlightOverlaps(test_locations_multi);
  let prev = split_locations[0];
  expect(prev.start <= prev.end).toBe(true);
  for (let i = 1; i < split_locations.length; i++) {
    const loc = split_locations[i];
    expect(loc.start <= loc.end).toBe(true);
    expect(loc.start >= prev.end).toBe(true);
    prev = loc;
  }
})

it("highlight indices and removing overlaps", () => {
  // Test source: https://seirdy.one/posts/2020/11/23/website-best-practices/
  // Currently using document.body.textContent from site.
  // When jsdom starts working with bun will switch to html
  // TODO: When jsdom start working with bun replace text.txt with test.html
  const body_text = readFileSync("./src/tests/test.txt", "utf-8");
  const current_highlights: LocalHighlightsObject = test_local["http://localhost:8080/test.html"].highlights;

  console.time("indices")
  const locations = findHighlightIndices(body_text, current_highlights);
  console.timeEnd("indices")
  expect(locations.length).toBe(57);

  console.time("highlight overlap")
  const split_locations = removeHighlightOverlaps(locations);
  console.timeEnd("highlight overlap")

  let prev = split_locations[0];
  expect(prev.start <= prev.end).toBe(true);
  for (let i = 1; i < split_locations.length; i++) {
    const loc = split_locations[i];
    // console.log(i, loc, prev.end);
    expect(loc.start <= loc.end).toBe(true);
    expect(loc.start >= prev.end).toBe(true);
    prev = loc;
  }
});
