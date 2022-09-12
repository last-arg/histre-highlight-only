import { storage } from 'webextension-polyfill';
import { ValidToken, UserData } from './common';
import { isValidResponse, Histre } from './background'

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

export async function histreTests() {
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
  const add_resp = await h.addHighlight(add);
  if (isValidResponse(add_resp)) {
    const j = await add_resp.json();
    console.log("add", j)
    // TODO: validate json with zod
    if (Histre.hasError(j)) {
      // TODO: Histre API error
    }
    test_id = j.data.highlight_id;
  }

  {
    const resp = await h.updateHighlight({highlight_id: test_id, color: "blue"})
    if (isValidResponse(resp)) {
      const resp_json = await resp.json();
      // TODO: validate json with zod
      console.log("update", resp_json)
      if (Histre.hasError(resp_json)) {
        // TODO: Histre API error
      }
    }
  }

  {
    const resp = await h.getHighlightByUrl(test_url)
    if (isValidResponse(resp)) {
      const resp_json = await resp.json();
      // TODO: validate json with zod
      console.log("getByUrl", resp_json)
      if (Histre.hasError(resp_json)) {
        // TODO: Histre API error
      }
    }
  }

  {
    const rm_resp = await h.removeHighlight(test_id)
    if (isValidResponse(rm_resp)) {
      const resp_json = await rm_resp.json();
      // TODO: validate json with zod
      console.log("remove", resp_json)
      if (Histre.hasError(resp_json)) {
        // TODO: Histre API error
      }
    }
  }

  {
    const resp = await h.getHighlightById(test_id)
    if (isValidResponse(resp)) {
      const resp_json = await resp.json();
      // TODO: validate json with zod
      console.log("getById", resp_json)
      if (Histre.hasError(resp_json)) {
        // TODO: Histre API error
      }
    }
  }
}
