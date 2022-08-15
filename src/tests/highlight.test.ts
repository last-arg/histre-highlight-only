import { it, expect } from "bun:test";
import { readFileSync } from "fs";
import { LocalHighlightsObject } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";

// TODO: check out https://github.com/lusito/mockzilla-webextension
// TODO: Consider [jsdom](https://www.npmjs.com/package/jsdom) for testing DOM with node/bun
// jsdom not working with bun: https://github.com/oven-sh/bun/issues/198

it("highlight indices and removing overlaps", () => {
  // Test source: https://seirdy.one/posts/2020/11/23/website-best-practices/
  // Currently using document.body.textContent from site.
  // When jsdom starts working with bun will switch to html
  // TODO: When jsdom start working with bun replace text.txt with test.html
  const body_text = readFileSync("./src/tests/test.txt", "utf-8");
  const current_highlights: LocalHighlightsObject = {
    "hho-local-6nazstnm": { 
      "text": "t does not apply to websites that have a lot of non-textual content. It also does not apply to websites that focus more on generating revenue or pleasing investors than",
      "color": "yellow" 
    },
    "hho-local-bjcczyzj": { 
      "text": "not apply to websites that",
      "color": "orange" 
    },
    "hho-local-4twzo1f2": { 
      "text": "apply to websites",
      "color": "green" 
    },
    "hho-local-7292ap92": { 
      "text": "ply to",
      "color": "blue" 
    },
    "hho-local-cvlm97wh": { 
      "text": "hat have a lot",
      "color": "purple" 
    },
    "hho-local-wq4elqm4": { 
      "text": "investors than being incl",
      "color": "red" 
    },
    "hho-local-jeuib9on": { 
      "text": "revenue or pleasing ",
      "color": "green" 
    },
    "hho-local-zvsaa2zb": { 
      "text": "does not apply to",
      "color": "blue" 
    },
    "hho-local-ipm5qe3c": { 
      "text": "that focus more",
      "color": "green" 
    },
    "hho-local-adj8wtbd": { 
      "text": "entire page at a glance with a screenreader - you have to listen to the structure of it carefully and remember all that, or read through the entire",
      "color": "yellow" 
    },
    "hho-local-8x21bbro": { 
      "text": "xceptions, there are only two times I feel comfortable overriding default st",
      "color": "green" 
    },
    "hho-local-fgbsq2nx": { 
      "text": "     doing this when the defaults are truly inaccessible, or clash with another accessibility enhancement I made.\n\nMy previous advice regarding line spacing and maximum line length fell in the fir",
      "color": "purple" 
    },
    "hho-local-81adxnn2": { 
      "text": "what ",
      "color": "red" 
    },
    "hho-local-o4hizrvw": { 
      "text": "poor",
      "color": "green" 
    },
    "hho-local-rm3gmbmw": { 
      "text": "more harmful to screen readers than “no ARIA”. Only use ARIA to fill in gaps left by POSH.\n\nAgain: avoid catering to",
      "color": "orange" 
    },
    "hho-local-lkodvlal": { 
      "text": "Finding this range is difficult. The best way to resolve such difficult and subjective",
      "color": "purple" 
    }
};

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
