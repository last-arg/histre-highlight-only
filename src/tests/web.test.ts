// import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import $ from "./assert";
import { LocalHighlightsObject } from "../common";
import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import { highlightDOM } from "../common_dom";

const {$mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal, $mol_assert_like: assert_like} = $;

const simple: LocalHighlightsObject = {
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

const with_child: LocalHighlightsObject = {
    "local-1": {
        "text": "rt (child elem) pa",
        "color": "blue"
    },
    "local-2": {
        "text": "le (ano",
        "color": "green"
    },
    "local-3": {
        "text": "ild) par",
        "color": "yellow"
    },
};

const TEST_SUITE: (() => Promise<void> | void)[] = [
    function testHighlightDOMSimple() {
        const body_text = document.body.textContent!;
        const locations = findHighlightIndices(body_text, simple);
        let no_change = removeHighlightOverlaps(locations);
        assert_like(locations, no_change);
        const highlight_ids = Object.entries(simple);
        highlightDOM(locations, highlight_ids);

        const marks = document.querySelectorAll("#only-text .hho-mark");
        assert_equal(4, marks.length);
        let i = 0;
        for (const key in simple) {
            const elem = marks[i];
            const hl = simple[key];
            assert_ok(elem.classList.contains("hho-mark"));
            assert_equal(key, elem.getAttribute("data-hho-id"));
            assert_equal(hl.color, elem.getAttribute("data-hho-color"));
            assert_equal(hl.text, elem.textContent);
            i += 1;
        }
    },
    function testHighlightDOMWithChild() {
        const body_text = document.body.textContent!;
        let locations = findHighlightIndices(body_text, with_child);
        let no_change = removeHighlightOverlaps(locations);
        assert_like(locations, no_change);
        let i = 0;
        for (const hl of Object.values(with_child)) {
            const loc = locations[i];
            const loc_text = body_text.slice(loc.start, loc.end);
            assert_equal(hl.text, loc_text);
            i += 1;
        }
        const highlight_ids = Object.entries(with_child);
        highlightDOM(locations, highlight_ids);

        let total_marks = 0;
        for (const key in with_child) {
            const hl = with_child[key];
            const dom_hl = document.querySelectorAll(`#with-child [data-hho-id="${key}"]`);
            let text = "";
            for (const el of dom_hl) {
                text += el.textContent;
                assert_equal(hl.color, el.getAttribute("data-hho-color"));
                total_marks += 1;
            }
            assert_equal(hl.text, text);
        }
        assert_equal(7, total_marks);
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
