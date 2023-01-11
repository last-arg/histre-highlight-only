import { removeHighlightFromDom, removeHighlights } from '../common_dom';
import $ from "./assert";

const { $mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal, $mol_assert_like: assert_like } = $;

console.info("Running tests")

function testMark(hls: Record<string, { text: string, color: string }>, id: string) {
    const hl = hls[id as any];
    return `<span class="hho-mark" data-hho-id="${id}" data-hho-color="${hl.color}">${hl.text}</span>`;
}

const body = document.body;

{
    const hls = {
        "1": { text: "e te", color: "blue" },
        "2": { text: "lo wo", color: "blue" },
    }
    body.innerHTML = `
      <p>Som${testMark(hls, "1")}xt.</p>
      <p>Hel${testMark(hls, "2")}rld.</p>
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
}

console.info("All test passed")
