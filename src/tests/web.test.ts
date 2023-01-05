// import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import $ from "./assert";
const {$mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal} = $;
import { LocalHighlightsObject } from "../common";
import { findHighlightIndices } from "../highlight";
import { highlightDOM } from "../common_dom";

const local_highlights: LocalHighlightsObject = {
      "local-1": { 
        "text": "onl",
        "color": "yellow"
      },
      "local-2": { 
        "text": "ext",
        "color": "green"
      },
      "local-3": { 
        "text": " ins",
        "color": "purple"
      },
      "local-4": { 
        "text": "element",
        "color": "blue"
      },
}


const TEST_SUITE: (() => Promise<void> | void)[] = [
    function testHighlightDOM() {
        const body_text = document.body.textContent!;
        const locations = findHighlightIndices(body_text, local_highlights);

        const highlight_ids = Object.entries(local_highlights);
        console.time("Highlight DOM")
        highlightDOM(locations, highlight_ids);
        console.timeEnd("Highlight DOM")

        const marks = document.querySelectorAll("[data-hho-id]");
        assert_equal(4, marks.length);
        let i = 0;
        for (const key in local_highlights) {
            const elem = marks[i];
            const hl = local_highlights[key];
            assert_ok(elem.classList.contains("hho-mark"));
            assert_equal(key, elem.getAttribute("data-hho-id"));
            assert_equal(hl.color, elem.getAttribute("data-hho-color"));
            assert_equal(hl.text, elem.textContent);
            i += 1;
        }
    },
];

async function runTests() {
    console.info("Run tests")
    for (const func of TEST_SUITE) {
        console.group(`Running test: ${func.name}`);
        await func();
        console.groupEnd();
    }

    console.info("All tests passed")
}

runTests();
