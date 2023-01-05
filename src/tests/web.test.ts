// import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import $ from "./assert";
import { LocalHighlightsObject } from "../common";
import { getHighlightIndices } from "../highlight";
import { highlightDOM } from "../common_dom";

const {$mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal, $mol_assert_like: assert_like} = $;

function setAndGetBody(inner: string): string {
    document.body.innerHTML = inner;
    return document.body.textContent!;
}

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
        const body_text = setAndGetBody(`<p id="only-text">only text inside this element</p>`);
        let locations = getHighlightIndices(body_text, simple);
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
        const body_text = setAndGetBody(`
    <p id="with-child">parent start (<span>child elem</span>) parent middle (<span>another child</span>) parent end</p>
        `);
        let locations = getHighlightIndices(body_text, with_child);
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
    function testHighlightOverlapSimple() {
        const hls: LocalHighlightsObject = {
            "local-1": {
                "text": "text inside",
                "color": "blue"
            },
            "local-4": {
                "text": "inside",
                "color": "red"
            },
            "local-2": {
                "text": "inside this",
                "color": "yellow"
            },
            "local-3": {
                "text": "inside",
                "color": "green"
           },
            "local-0": {
                "text": "element",
                "color": "orange"
            },
        };
        const expect: Record<string, string[]> = {
            "local-1": ["text " ],
            "local-4": ["" ],
            "local-2": ["", " this"],
            "local-3": ["inside" ],
            "local-0": ["element" ],
        }

        const body_text = setAndGetBody(`<p id="overlap-simple">only text inside this element</p>`);
        let locations = getHighlightIndices(body_text, hls);
        const highlight_ids = Object.entries(hls);
        highlightDOM(locations, highlight_ids);
        let total_marks = 0;
        for (const [hl_key, hl_value] of highlight_ids) {
            const dom_hl = document.querySelectorAll(`#overlap-simple [data-hho-id="${hl_key}"]`);
            const hl_expect = expect[hl_key];
            let i = 0;
            for (const el of dom_hl) {
                assert_equal(hl_value.color, el.getAttribute("data-hho-color"));
                assert_equal(hl_expect[i], el.textContent);
                i += 1;
                total_marks += 1;
            }
        }
        assert_equal(6, total_marks);
    }
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

document.addEventListener("DOMContentLoaded", runTests);
