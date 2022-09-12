import { storage } from 'webextension-polyfill';
import { ValidToken, UserData } from './common';
import { isValidResponse, Histre } from './background'

// TODO: move storage related functions
async function getLocalAuthData(): Promise<ValidToken | undefined> {
  const data = await storage.local.get(
    {token: {access: undefined, refresh: undefined}, created_at: undefined});
  // TODO: use zod to validate data?
  if (data.token.access && data.token.refresh && data.created_at) {
    return data as ValidToken;
  }
  return undefined;
}

async function setLocalAuthData(auth_data: ValidToken) {
  await storage.local.set(auth_data);
}

async function getLocalUser(): Promise<UserData | undefined> {
  const data = await storage.local.get({username: undefined, password: undefined});
  if (data.username && data.password) {
    return data as UserData;
  }
  return undefined;
}

async function setLocalUser(user: UserData): Promise<void> {
  await storage.local.set(user);
}

function assert(b: boolean, msg: string) {
  if (!b) {
    throw Error(msg);
  }
}

export async function histreTests() {
  console.log("Start Histre API tests");
  if (__DEV__) { 
    // Add test user data
    const user = await import("../tmp/.secret.dev");
    await setLocalUser(user.user)
  }

  const user = await getLocalUser();
  if (user === undefined) {
    console.error("Authetication failed. Need to provide valid Histre username and password.")
    return;
  }
  const token_data = await getLocalAuthData();
  const h = new Histre(user, token_data);
  const tokens = await h.updateTokens();
  if (tokens) {
    await setLocalAuthData(tokens);
    h.setHeaderAuthToken();
  } else {
    console.error("Failed to set Histre 'Authorization' token");
    return;
  }

  const test_url = "test_url";
  const add = {
    url: test_url,
    title: "test_title",
    text: "test_text",
    color: "yellow"
  }

  let test_id = "";
  {
    const resp = await h.addHighlight(add);
    assert(isValidResponse(resp), "Histre request returned invalid response status");
    const body = await resp.json();
    assert(!Histre.hasError(body), "Histre response failed due to error")
    assert(body.data.highlight_id.length > 0, "Invalid higlight ID")
    test_id = body.data.highlight_id;
  }

  {
    const resp = await h.updateHighlight({highlight_id: test_id, color: "blue"})
    assert(isValidResponse(resp), "Histre request returned invalid response status");
    const body = await resp.json();
    assert(!Histre.hasError(body), "Histre response failed due to error")
  }

  {
    const resp = await h.getHighlightByUrl(test_url)
    assert(isValidResponse(resp), "Histre request returned invalid response status");
    const body = await resp.json();
    assert(!Histre.hasError(body), "Histre response failed due to error")
    assert(body.count === 1, "Response must contain 1 item (highlight)")
    assert(body.data[0].color === "blue", "Highlight color must be 'blue'")
  }

  {
    const resp = await h.removeHighlight(test_id)
    assert(isValidResponse(resp), "Histre request returned invalid response status");
    const body = await resp.json();
    assert(!Histre.hasError(body), "Histre response failed due to error")
  }

  {
    const resp = await h.getHighlightById(test_id)
    assert(isValidResponse(resp), "Histre request returned invalid response status");
    const body = await resp.json();
    assert(!Histre.hasError(body), "Histre response failed due to error")
    assert(body.count === 0, "Response must contain item (highlight)")
  }
  console.log("Finished Histre API tests");
}
