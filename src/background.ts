import { storage, Runtime } from 'webextension-polyfill';
import { Message, Action, DataModify, DataRemove, DataCreate, local_id_prefix, HighlightAdd, HighlightUpdate, histreResponseSchema, UserData, UserSettings } from './common';
import { Histre, isValidResponse } from './histre';
import { z } from 'zod';

// TODO: When to add locally saved highlight to Histre?

// Test import
import { test_local } from "./tests/test_data";
import { getLocalAuthData, getLocalUser, setLocalAuthData, setLocalUser, setSettings } from './storage';

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

let histre: Histre = new Histre(); 

(async function initHistre() {
  if (__DEV__ && __user__?.username) {
    setLocalUser(__user__)
  }

  const user_data = await getLocalUser(); 
  if (user_data) {
    const token_data = await getLocalAuthData();
    if (token_data) {
      histre.tokens = token_data;
    }
    histre.setUser(user_data)
    const token = await histre.updateTokens()
    if (token) {
      await setLocalAuthData(token)
    }
    histre.setHeaderAuthToken()
  }
})();


type SaveMessage = string;
type MessageReturn = SaveMessage | boolean | undefined;

browser.runtime.onMessage.addListener((msg: Message, sender: Runtime.MessageSender): undefined | Promise<MessageReturn> => {
  switch (msg.action) {
    case Action.Create: {
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
          if (local.highlights_add[url] === undefined) {
            local.highlights_add[url] = { highlights: {} };
          }
          local.highlights_add[url].title = title;
          local.highlights_add[url].highlights[data.id] = { text: data.text, color: data.color };
          await storage.local.set(local);
        }

        resolve(result_id);
      });
    }
    case Action.Modify: {
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
    case Action.UpdateUser: {
      return new Promise(async (resolve) => {
        const curr = await getLocalUser();
        const user = msg.data as UserData;

        if (curr?.username === user.username && curr?.password === user.password) {
          resolve(true);
          return;
        }

        await setLocalUser(user);
        if (!histre) {
          resolve(false);
          return;
        }
        histre.setUser(user)
        histre.updateTokens()
        histre.setHeaderAuthToken()
        resolve(true);
      });
    }
    case Action.UpdateSettings: {
      return new Promise(async (resolve) => {
        const settings = msg.data as UserSettings;
        await setSettings(settings)
        const tabs = await browser.tabs.query({});
        for (const tab of tabs) {
          if (tab.id && tab.url?.startsWith("http")) {
              browser.tabs.sendMessage(tab.id, {settings: settings})
          }
        }
        resolve(true);
      })
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

  const test_popup = false;
  if (test_popup) {
    // For faster debugging popup.html
    browser.tabs.query({currentWindow: true})
    .then(async (tabs) => {
      const root_url = browser.runtime.getURL("/");
      const popup_url = root_url + "dist/popup.html";

      let has_popup_tab = false;
      // browser.tabs.reload won't ever fire because when web extension
      // is reloaded popup.html tab is also closed.
      for (const tab of tabs) {
        if (tab.url == popup_url) {
          browser.tabs.reload(tab.id)
          has_popup_tab = true;
          break;
        }
      }

      if (!has_popup_tab) {
        browser.tabs.create({ url: popup_url, active: false});
      }
    })
  }
}
