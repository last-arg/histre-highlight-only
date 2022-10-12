import { it, expect } from "bun:test";
import { readFileSync } from "fs";
import { LocalHighlightsObject } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import { test_local, test_data } from "./test_data";

// TODO: check out https://github.com/lusito/mockzilla-webextension
// 
// TODO: If I want to use bun for testing node DOM have to wait or find library
// that works with 'bun wiptest'. Issue: https://github.com/oven-sh/bun/issues/198
// Libraries: jsdom domino 

function expectRanges(input: any[], expect: any[]): void {
  if (input.length !== expect.length) {
    const expect_str = JSON.stringify(expect);
    const received_str = JSON.stringify(input);
    throw Error(`Expected: ${expect_str}\n       Received: ${received_str}\n`); 
  }

  let is_success = true;
  for (let i = 0; i < input.length; i += 1) {
    const range = input[i];
    const expect_range = expect[i];
    if (range.start !== expect_range.start ||
        range.end !== expect_range.end ||
        range.index !== expect_range.index) {
        is_success = false;
        break;
    }
  }

  if (!is_success) {
    const expect_str = JSON.stringify(expect);
    const received_str = JSON.stringify(input);
    throw Error(`Expected: ${expect_str}\n       Received: ${received_str}\n`); 
  }
}

it("remove highlight overlaps multi", () => {
  for (const d of test_data) {
    const result = removeHighlightOverlaps(d.input);
    expectRanges(result, d.expect)
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
