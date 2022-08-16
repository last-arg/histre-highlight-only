import { it, expect } from "bun:test";
import { readFileSync } from "fs";
import { LocalHighlightsObject } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import { test_local } from "./test_data";

// TODO: check out https://github.com/lusito/mockzilla-webextension
// TODO: Consider [jsdom](https://www.npmjs.com/package/jsdom) for testing DOM with node/bun
// jsdom not working with bun: https://github.com/oven-sh/bun/issues/198

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

  // const expected_split_string = [ "type ", "of ", "art m", "u", "sic that", " att", "empts t", "o rend", "er musically ", "an extra-musical" ];
  // expect(expected_split_string.length).toBe(split_locations.length);
  // for (const [i, loc] of split_locations.entries()) {
  //   expect(expected_split_string[i]).toBe(body_text.slice(loc.start, loc.end));
  // }
});
