import { it, expect } from "bun:test";
import { readFileSync } from "fs";
import { LocalHighlightsObject, removeHighlightFromDom } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import { test_local, test_data } from "./test_data";

// TODO: check out https://github.com/lusito/mockzilla-webextension
// 
// TODO: Consider [jsdom](https://www.npmjs.com/package/jsdom) for testing DOM with node/bun
// jsdom not working with bun: https://github.com/oven-sh/bun/issues/198
// 
// jsdom alternative? [domino](https://www.npmjs.com/package/domino)
// domino crashed and has an thread panic

import { parse } from 'node-html-parser';
// import {parse} from 'parse5';
it("remove highlight from DOM", () => {
  const test_highlights = {
    "1": { text: "et iure velit", color: "yellow"},
    "2": { text: "iure", color: "blue"},
    "3": { text: "Ut consequatur voluptatum consectetur placeat", color: "yellow"},
    "4": { text: "consequatur voluptatum", color: "blue"},
    "5": { text: "tatum conse", color: "green"},
  };
  const highlights_file = readFileSync("./src/tests/highlights.html", "utf-8");
  const document = parse(highlights_file);
  {
    const before_elems = document.querySelectorAll(`[data-hho-id="2"]`);
    expect(before_elems.length).toBe(1);
    expect(document.querySelectorAll(`[data-hho-id="1"]`).length).toBe(2);
    removeHighlightFromDom(test_highlights, before_elems)
    expect(document.querySelectorAll(`[data-hho-id="2"]`).length).toBe(0);
    expect(before_elems[0].getAttribute("data-hho-id")).toBe("1");
    expect(before_elems[0].getAttribute("data-hho-color")).toBe("yellow");
  }
})

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
