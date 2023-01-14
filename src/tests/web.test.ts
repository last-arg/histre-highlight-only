// import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import $ from "./assert";
import { HistreHighlight } from "../common";
import { getHighlightIndices } from "../highlight";
import { highlightDOM } from "../common_dom";

const {$mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal, $mol_assert_like: assert_like} = $;

function setAndGetBody(inner: string): string {
    document.body.innerHTML = inner;
    return document.body.textContent!;
}

const simple: Array<HistreHighlight> = [
      { 
        "highlight_id": "local-1", 
        "text": "onl",
        "color": "yellow"
      },
      { 
        "highlight_id": "local-2", 
        "text": "ext",
        "color": "green"
      },
      { 
        "highlight_id": "local-3", 
        "text": " ins",
        "color": "purple"
      },
      { 
        "highlight_id": "local-4", 
        "text": "element",
        "color": "blue"
      },
]

const with_child: Array<HistreHighlight> = [
    {
        "highlight_id": "local-1",
        "text": "rt (child elem) pa",
        "color": "blue"
    },
    {
        "highlight_id": "local-2",
        "text": "le (ano",
        "color": "green"
    },
    {
        "highlight_id": "local-3",
        "text": "ild) par",
        "color": "yellow"
    },
];

const TEST_SUITE = {
    testRemoveOverlaps() {
        const hls = [
            { highlight_id: "1", text: "t ov", color: "yellow" },
            { highlight_id: "3", text: "ve", color: "blue" },
            { highlight_id: "2", text: "erlapi", color: "red" },
            { highlight_id: "4", text: "erl", color: "purple" },
            { highlight_id: "5", text: "p", color: "green" },
        ];
        const body_text = setAndGetBody(`
            <p>test overlapi</p>
        `);

        let locations = getHighlightIndices(body_text, hls);
        // console.log(locations)
        const expected = [
          { "start": 16, "end": 19, "index": 0 },
          { "start": 19, "end": 20, "index": 1 },
          { "start": 20, "end": 20, "index": 2 },
          { "start": 20, "end": 23, "index": 3 },
          { "start": 23, "end": 24, "index": 2 },
          { "start": 24, "end": 25, "index": 4 },
          { "start": 25, "end": 26, "index": 2 }
        ]
        highlightDOM(locations, hls)
        assert_like(locations, expected)
    },
    testHighlightDOMSimple() {
        const body_text = setAndGetBody(`<p id="only-text">only text inside this element</p>`);
        let locations = getHighlightIndices(body_text, simple);
        highlightDOM(locations, simple);

        const marks = document.querySelectorAll("#only-text .hho-mark");
        assert_equal(4, marks.length);
        let i = 0;
        for (const hl of simple) {
            const elem = marks[i];
            assert_ok(elem.classList.contains("hho-mark"));
            assert_equal(hl.highlight_id, elem.getAttribute("data-hho-id"));
            assert_equal(hl.color, elem.getAttribute("data-hho-color"));
            assert_equal(hl.text, elem.textContent);
            i += 1;
        }
    },
    testHighlightDOMWithChild() {
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
        highlightDOM(locations, with_child);

        let total_marks = 0;
        for (const hl of with_child) {
            const dom_hl = document.querySelectorAll(`#with-child [data-hho-id="${hl.highlight_id}"]`);
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
    testHighlightOverlapSimple() {
        const hls: Array<HistreHighlight> = [
            {
                "highlight_id": "local-1", 
                "text": "text inside",
                "color": "blue"
            },
            {
                "highlight_id": "local-4", 
                "text": "inside",
                "color": "red"
            },
            {
                "highlight_id": "local-2", 
                "text": "inside this",
                "color": "yellow"
            },
            {
                "highlight_id": "local-3", 
                "text": "inside",
                "color": "green"
           },
            {
                "highlight_id": "local-0", 
                "text": "element",
                "color": "orange"
            },
        ];
        const expect: Record<string, string[]> = {
            "local-1": ["text " ],
            "local-4": ["" ],
            "local-2": ["", " this"],
            "local-3": ["inside" ],
            "local-0": ["element" ],
        }

        const body_text = setAndGetBody(`<p id="overlap-simple">only text inside this element</p>`);
        let locations = getHighlightIndices(body_text, hls);
        highlightDOM(locations, hls);
        let total_marks = 0;
        for (const hl of hls) {
            const dom_hl = document.querySelectorAll(`#overlap-simple [data-hho-id="${hl.highlight_id}"]`);
            const hl_expect = expect[hl.highlight_id];
            let i = 0;
            for (const el of dom_hl) {
                assert_equal(hl.color, el.getAttribute("data-hho-color"));
                assert_equal(hl_expect[i], el.textContent);
                i += 1;
                total_marks += 1;
            }
        }
        assert_equal(6, total_marks);
    },

    testHighlightOverlapAdvanced() {
        const hls = [
            {
                "highlight_id": "local-3", 
                "text": "text (inside",
                "color": "green"
           },
            {
                "highlight_id": "local-2", 
                "text": "ide) this",
                "color": "yellow"
           },
            // TODO: maybe change overlapping rules
            // Want to show whole 'si' because next highlight is longer
            {
                "highlight_id": "local-1", 
                "text": "si",
                "color": "red"
           },

        ];
        const body_text = setAndGetBody(`
    <p id="overlap-simple">
        only text (<span>inside</span>) this element
    </p>`
        );
        let locations = getHighlightIndices(body_text, hls);
        highlightDOM(locations, hls);
        console.log(locations);
    }
};

// TEST_SUITE["testHighlightOverlapSimple"]();

async function runTests() {
    console.info("Run tests")
    for (const func of Object.values(TEST_SUITE)) {
        console.group(`Running test: ${func.name}`);
        func();
        console.groupEnd();
    }

    console.info("All tests passed")
}

document.addEventListener("DOMContentLoaded", runTests);
