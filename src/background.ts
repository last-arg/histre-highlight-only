import { storage, Runtime } from 'webextension-polyfill';
import { Message, Action, DataModify, DataRemove, DataCreate, local_id_prefix, HighlightAdd, HighlightUpdate, histreResponseSchema, UserData, localUserSchema, ValidToken, localAuthSchema } from './common';
import { Histre, isValidResponse } from './histre';
import { z } from 'zod';

// Test import
import { test_local } from "./tests/test_data";

console.log("==== LOAD ./dist/background.js ====")

// TODO: move storage related functions
async function getLocalAuthData(): Promise<ValidToken | undefined> {
  const data = await storage.local.get(
    {token: {access: undefined, refresh: undefined}, created_at: undefined});
  const token = localAuthSchema.safeParse(data);
  if (token.success) {
    return token.data
  }
  return undefined;
}

async function setLocalAuthData(auth_data: ValidToken) {
  await storage.local.set(auth_data);
}

async function getLocalUser(): Promise<UserData | undefined> {
  const data = await storage.local.get({username: undefined, password: undefined});
  const user = localUserSchema.safeParse(data);
  if (user.success) {
    return user.data
  }
  return undefined;
}

async function setLocalUser(user: UserData): Promise<void> {
  await storage.local.set(user);
}

function randomString() {
  return Math.random().toString(36).substring(2,10)
};

const addDataSchema = z.object({
  highlight_id: z.string(),
  highlight_link: z.string(),
})

async function histreAddHighlight(histre: Histre | undefined, hl: HighlightAdd): Promise<string | undefined> {
  if (histre === undefined) {
    return undefined;
  }

  const resp = await histre.addHighlight(hl);
  if (!isValidResponse(resp)) {
    return undefined;
  }
  const body = await resp.json();
  const parsed = histreResponseSchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(`Failed to validate '${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
    }
    return undefined;
  }
  if (Histre.hasError(body)) {
    return undefined;
  }

  const parsed_data = addDataSchema.safeParse(parsed.data.data);
  if (!parsed_data.success) {
    for (const issue of parsed_data.error.issues) {
      console.error(`Failed to validate 'data.${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
    }
    return undefined;
  }

  return parsed_data.data.highlight_id;
}

async function histreUpdateHighlight(histre: Histre | undefined, hl: HighlightUpdate): Promise<boolean> {
  if (histre === undefined) {
    return false;
  }

  const resp = await histre.updateHighlight(hl);
  if (!isValidResponse(resp)) {
    return false;
  }
  const body = await resp.json();
  const parsed = histreResponseSchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(`Failed to validate '${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
    }
    return false;
  }
  if (Histre.hasError(body)) {
    return false;
  }

  return true;
}

async function histreRemoveHighlight(histre: Histre | undefined, hl_id: string): Promise<boolean> {
  if (histre === undefined) {
    return false;
  }

  const resp = await histre.removeHighlight(hl_id);
  if (!isValidResponse(resp)) {
    return false;
  }
  const body = await resp.json();
  const parsed = histreResponseSchema.safeParse(body);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      console.error(`Failed to validate '${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
    }
    return false;
  }
  if (Histre.hasError(body)) {
    return false;
  }

  return true;
}

let histre: Histre | undefined = undefined; 

(async function initHistre() {
  if (__DEV__) {
    const secret = await import("../tmp/.secret.dev");
    setLocalUser(secret.user)
  }

  const user_data = await getLocalUser(); 
  if (user_data) {
    const token_data = await getLocalAuthData();
    histre = new Histre(user_data, token_data);
    const token = await histre.updateTokens()
    if (token) {
      await setLocalAuthData(token)
      histre.setHeaderAuthToken()
    }
    return histre;
  }
  return undefined;
})();


type SaveMessage = string;
type MessageReturn = SaveMessage | boolean | undefined;

browser.runtime.onMessage.addListener((msg: Message, sender: Runtime.MessageSender): undefined | Promise<MessageReturn> => {
  // console.log(msg, sender);
  switch (msg.action) {
    case Action.Create: {
      console.log("save", msg.data)
      return new Promise(async (resolve) => {
        if (sender.tab?.url === undefined) { 
          resolve(false); 
          return;
        }
        let result_id: string | undefined = undefined; 
        const data = msg.data as DataCreate;
        const url = sender.tab.url;
        const title = sender.tab?.title || "";

        result_id = await histreAddHighlight(histre, {
           url: url,
           title: title,
           text: data.text,
           color: data.color
        })

        if (!result_id) {
          let local = await storage.local.get({highlights_add: {[url]: { highlights: {} }}});
          console.log("store local", local)
          local.highlights_add[url].title = title;
          result_id = `${local_id_prefix}-${randomString()}`;
          local.highlights_add[url].highlights[result_id] = { text: data.text, color: data.color };
          await storage.local.set(local);
        }

        resolve(result_id);
      });
    }
    case Action.Modify: {
      console.log("update", msg.data)
      return new Promise(async (resolve) => {
        const data = msg.data as DataModify;
        const is_local_id = data.id.startsWith(local_id_prefix);

        let added_to_histre = false;
        if (!is_local_id) {
          added_to_histre = await histreUpdateHighlight(histre, { highlight_id: data.id, color: data.color });
          if (added_to_histre) {
            resolve(true)
            return;
          }
        } else {
          if (sender.tab?.url) {
            const url = sender.tab.url;
            let local = await storage.local.get({highlights_add: {}});
            local.highlights_add[url].highlights[data.id].color = data.color;
            await storage.local.set(local);
            resolve(true); 
            return;
          }
        }

        // Is histre highlight but request failed
        if (!added_to_histre) {
          let local = await storage.local.get({highlights_update: {}});
          local.highlights_update[data.id] = data.color;
          await storage.local.set(local);
          resolve(true)
          return;
        }

        resolve(false);
      });
    }
    case Action.Remove: {
      console.log("delete", msg.data)
      return new Promise(async (resolve) => {
        const data = msg.data as DataRemove;
        const is_local_id = data.id.startsWith(local_id_prefix);

        let added_to_histre = false;
        if (!is_local_id) {
          added_to_histre = await histreRemoveHighlight(histre, data.id);
          if (added_to_histre) {
            resolve(true)
            return;
          }
        } else {
          if (sender.tab?.url) {
            const url = sender.tab.url;
            let local = await storage.local.get({highlights_add: {}});
            delete local.highlights_add[url].highlights[data.id];
            await storage.local.set(local);
            resolve(true); 
            return;
          }
        }

        if (!added_to_histre) {
          let local = await storage.local.get({highlights_remove: []});
          local.highlights_remove.push(data.id);
          await storage.local.set(local);
          resolve(true);
          return;
        }

        resolve(false);
      });
    }
  }
});

if (__DEV__) {
  // Add test user data
  const data = {
    ...test_local,
    "http://localhost:8080/another.html": {
      title: "Page title",
      highlights: {
        "local-6nazstnm": { 
          "text": "some text",
          "color": "yellow" 
        },
      }
    }
  }

  storage.local.set({highlights_add: data});
}


// console.log(browser.runtime.getURL("/"))

// browser.runtime.openOptionsPage()
// const bg_href = (await browser.runtime.getBackgroundPage()).location.href;
// console.log(bg_href)

