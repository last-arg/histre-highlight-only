import { it, expect } from "bun:test";
import { readFileSync } from "fs";
import { HighlightAdd } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";

// Consider [jsdom](https://www.npmjs.com/package/jsdom) for testing DOM with node/bun

it("highlight indices and removing overlaps", () => {
  const body_text = readFileSync("./src/tests/test.html", "utf-8");
  const current_highlights: [string, HighlightAdd][] = [["hho-local-02biitif",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"nerating music electron","color":"purple"}],["hho-local-gyghlmhh",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"type of art music that attempts to render musically an extra","color":"yellow"}],["hho-local-izeay27j",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"of art music","color":"orange"}],["hho-local-ot6dv0nk",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"art m","color":"green"}],["hho-local-5ezswlnw",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"sic that","color":"blue"}],["hho-local-biu028d5",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"an extra-musical","color":"red"}],["hho-local-jwn8cxgf",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"er musically ","color":"purple"}],["hho-local-ng702dlp",{"title":"Program - Wikipedia","url":"https://en.wikipedia.org/wiki/Program","text":"empts t","color":"green"}]];

  console.time("indices")
  const locations = findHighlightIndices(body_text, current_highlights);
  console.timeEnd("indices")
  expect(locations.length).toBe(7);

  console.time("highlight overlap")
  const split_locations = removeHighlightOverlaps(locations);
  const expected_split_string = [ "type ", "of ", "art m", "u", "sic that", " att", "empts t", "o rend", "er musically ", "an extra-musical" ];
  console.timeEnd("highlight overlap")

  expect(expected_split_string.length).toBe(split_locations.length);
  for (const [i, loc] of split_locations.entries()) {
    expect(expected_split_string[i]).toBe(body_text.slice(loc.start, loc.end));
  }
});
