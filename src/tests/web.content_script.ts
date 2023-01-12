import { removeHighlightFromDom, removeHighlights } from '../common_dom';
import $ from "./assert";

const { $mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal, $mol_assert_like: assert_like } = $;

console.info("Running tests")

function testMark(id: string, text: string, color: string) {
    return `<span class="hho-mark" data-hho-id="${id}" data-hho-color="${color}">${text}</span>`;
}

const body = document.body;

const TEST_SUITE = {
    testRemoveSimple() {
        const hls = {
            "1": { text: "e te", color: "blue" },
            "2": { text: "lo wo", color: "green" },
        }
        body.innerHTML = `
          <p>Som${testMark("1", "e te", "blue")}xt.</p>
          <p>Hel${testMark("2", "lo wo", "green")}rld.</p>
        `;
        const all = document.querySelectorAll(".hho-mark");
        assert_equal(all.length, 2);
        const elems = document.querySelectorAll(".hho-mark[data-hho-id='1']");
        assert_equal(elems.length, 1);
        removeHighlightFromDom(hls, elems)
        assert_equal(document.querySelectorAll(".hho-mark[data-hho-id='1']").length, 0);
        assert_equal(document.querySelectorAll(".hho-mark").length, 1);
        removeHighlights();
        assert_equal(document.querySelectorAll(".hho-mark").length, 0);
    },

    testRemoveOverlapAfter() {
        const hls = {
            "1": { text: "lo wo", color: "blue" },
            "2": { text: "world", color: "green" },
        }

        // After is under before highlight
        {
            console.group("after is under")
            body.innerHTML = `
              <p>Hel${testMark("1", "lo ", "blue")}${testMark("2", "", "green")}${testMark("1", "wo", "blue")}${testMark("2", "rld", "green")}.</p>
            `;
            const all = document.querySelectorAll(".hho-mark");
            assert_equal(all.length, 4);
            const elems = document.querySelectorAll(".hho-mark[data-hho-id='2']");
            assert_equal(elems.length, 2);
            removeHighlightFromDom(hls, elems)
            assert_equal(document.querySelectorAll(".hho-mark[data-hho-id='2']").length, 0);
            console.groupEnd();
        }

        // After is over before highlight
        {
            console.group("after is over")
            body.innerHTML = `
              <p>Hel${testMark("1", "lo ", "blue")}${testMark("2", "world", "green")}.</p>
            `;
            const all = document.querySelectorAll(".hho-mark");
            assert_equal(all.length, 2);
            const elems = document.querySelectorAll(".hho-mark[data-hho-id='2']");
            assert_equal(elems.length, 1);
            removeHighlightFromDom(hls, elems)
            assert_equal(document.querySelectorAll(".hho-mark[data-hho-id='2']").length, 0);
            assert_equal(document.querySelectorAll(".hho-mark[data-hho-id='1']").length, 2);
            console.groupEnd();
        }
    }
}

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
