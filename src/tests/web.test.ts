// import { findHighlightIndices, removeHighlightOverlaps } from "../highlight";
import $ from "./assert";
const {$mol_assert_ok: assert_ok, $mol_assert_equal: assert_equal} = $;

console.log(assert_equal, assert_ok);
const TEST_SUITE = [
    function testAddHighlight() {
        
    },

    async function testAsyncAddHighlight() {

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

runTests();
