import { it, expect } from 'bun:test';
import { isValidResponse, Histre } from '../histre'
import * as user_content from "../../tmp/.secret.dev";

it("histre API requests", async () => {
  console.log("=== Start Histre API tests ===");

  const user = user_content.user;
  if (user === undefined) {
    console.error("Authetication failed. Need to provide valid Histre username and password.")
    return;
  }
  const h = new Histre();
  h.setUser(user);
  const token = await h.updateTokens();
  expect(token !== undefined).toBe(true);
  h.setHeaderAuthToken();

  const test_url = "test_url";
  const add = {
    url: test_url,
    title: "test_title",
    text: "test_text",
    color: "yellow"
  }

  let test_id = "";
  {
    console.log("Histre request: add highlight")
    const resp = await h.addHighlight(add);
    expect(isValidResponse(resp)).toBe(true);
    const body = await resp.json();
    expect(Histre.hasError(body) ).toBe(false)
    expect(body.data.highlight_id.length > 0).toBe(true)
    test_id = body.data.highlight_id;
  }

  {
    console.log("Histre request: update highlight color")
    const resp = await h.updateHighlight({highlight_id: test_id, color: "blue"})
    expect(isValidResponse(resp) ).toBe(true);
    const body = await resp.json();
    expect(Histre.hasError(body) ).toBe(false)
  }

  {
    console.log("Histre request: get highlight by url")
    const resp = await h.getHighlightByUrl(test_url)
    expect(isValidResponse(resp) ).toBe(true);
    const body = await resp.json();
    expect(Histre.hasError(body) ).toBe(false)
    expect(body.count === 1 ).toBe(true)
    expect(body.data[0].color === "blue" ).toBe(true)
  }

  {
    console.log("Histre request: remove highlight")
    const resp = await h.removeHighlight(test_id)
    expect(isValidResponse(resp) ).toBe(true);
    const body = await resp.json();
    expect(Histre.hasError(body) ).toBe(false)
  }

  {
    console.log("Histre request: get highlight by url")
    const resp = await h.getHighlightById(test_id)
    expect(isValidResponse(resp) ).toBe(true);
    const body = await resp.json();
    expect(Histre.hasError(body)).toBe(false)
    expect(body.count === 0).toBe(true)
  }
  console.log("=== Finished Histre API tests ===");
});

