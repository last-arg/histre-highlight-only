import { Message, Action, DataModify, DataRemove, DataCreate, local_id_prefix, HighlightAdd, HighlightUpdate, histreResponseSchema, UserData, UserSettings, getDataSchema, HistreHighlight, randomString, addDataSchema, DataBadge } from './common';
import { Histre, isValidResponse } from './histre';
import { getLocalAuthData, getLocalUser, setLocalAuthData, setLocalUser, setSettings } from './storage';
import type { Runtime } from 'webextension-polyfill';
import browser from "webextension-polyfill";

// TODO: update badge text when higlight is added or removed

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

(async function init() {
  if (__DEV__ && __user__?.username) {
    await setLocalUser(__user__)
  }

  // Authenticate histre
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

  // Add local highlights to histre
  syncLocalToHistre();

  browser.browserAction.setBadgeBackgroundColor({color: [61, 53, 53, 255]})
  browser.browserAction.setBadgeTextColor({color: "white"})
})();

let sync_timeout: number = 0;

async function syncLocalToHistre() {
  if (!navigator.onLine) {
    console.warn("Can't sync local changes to Histre with no internet connection.");
    return;
  }

  let no_local_highlights = true;
  const local = await browser.storage.local.get(["highlights_remove", "highlights_add", "highlights_update"]);
  if (local.highlights_add) {
    for (const url in local.highlights_add) {
      const hl_info = local.highlights_add[url];
      const title = hl_info.title;
      const hls = hl_info.highlights;

      const reqs: Promise<Awaited<ReturnType<typeof histreAddHighlight>> | HighlightAdd>[] = [];
      for (const hl of hls as HighlightAdd[]) {
        reqs.push(histreAddHighlight(histre, {
           url: url,
           title: title,
           text: hl.text,
           color: hl.color
        }).catch((_) => hl));
      }

      const failed: HighlightAdd[] = [];
      const resps = await Promise.all(reqs);
      for (const resp of resps) {
        if (typeof resp === "object") {
          console.warn(`Failed to add local highlight to Histre.`, resp);
          failed.push(resp);
        }
      }

      if (failed.length > 1) {
        local.highlights_add[url].higlights = failed;
        no_local_highlights = false;
      } else {
        delete local.highlights_add[url];
      }
    }
  }

  if (local.highlights_remove) {
    const reqs: Promise<Awaited<ReturnType<typeof histreRemoveHighlight> | string>>[] = [];
    for (const hl_id of local.highlights_remove) {
      reqs.push(histreRemoveHighlight(histre, hl_id).catch((_) => hl_id));
    }
    const failed: string[] = [];
    const resps = await Promise.all(reqs);
    for (const resp of resps) {
      if (typeof resp === "string") {
        console.warn(`Failed to remove local highlight form Histre.`, resp);
        failed.push(resp);
      }
    }

    if (failed.length > 1) {
      local.highlights_remove.higlights = failed;
      no_local_highlights = false;
    } else {
      local.highlights_remove = undefined;
    }
  }

  if (local.highlights_update) {
    const reqs: Promise<Awaited<ReturnType<typeof histreUpdateHighlight> | string>>[] = [];
    for (const hl_id in local.highlights_update) {
      const color = local.highlights_update[hl_id];
      reqs.push(histreUpdateHighlight(histre, { highlight_id: hl_id, color: color }).catch((_) => hl_id));
    }
    const resps = await Promise.all(reqs);
    for (const resp of resps) {
      if (typeof resp === "string") {
        console.warn(`Failed to update local highlight in Histre.`, resp);
        delete local.highlights_remove[resp];
        no_local_highlights = false;
      }
    }
  }

  await browser.storage.local.set(local);
  if (no_local_highlights) {
    clearTimeout(sync_timeout);
  } else {
    startSyncInterval();
  }
}

function startSyncInterval() {
  if (sync_timeout === 0) {
    sync_timeout = window.setInterval(syncLocalToHistre, 5 * 60 * 1000);
  }
}

async function addLocalHighlight(url: string, data: DataCreate, title: string) {
  let local = await browser.storage.local.get({highlights_add: {[url]: { highlights: [] }}});
  if (local.highlights_add[url] === undefined) {
    local.highlights_add[url] = { highlights: [] };
  }
  local.highlights_add[url].title = title;
  local.highlights_add[url].highlights.push({ highlight_id: data.id, text: data.text, color: data.color });
  await browser.storage.local.set(local);
}

type SaveMessage = string;
type MessageReturn = SaveMessage | Array<HistreHighlight> | boolean | undefined;

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
          await addLocalHighlight(url, data, title);
          startSyncInterval();
        }
        if (sender.tab.id) {
          updateBadgeText(sender.tab.id, undefined, 1);
        }

        resolve(result_id);
      });
    }
    case Action.Modify: {
      return new Promise(async (resolve) => {
        // TODO: have to do the same dance and song as in Action.Remove.
        // Don't have real Histre highlight id
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
            let local = await browser.storage.local.get({highlights_add: {}});
            local.highlights_add[url].highlights[data.id].color = data.color;
            await browser.storage.local.set(local);
            resolve(true); 
            return;
          }
        }

        // Is histre highlight but request failed
        if (!added_to_histre) {
          let local = await browser.storage.local.get({highlights_update: {}});
          local.highlights_update[data.id] = data.color;
          await browser.storage.local.set(local);
          startSyncInterval();
          resolve(true)
          return;
        }

        resolve(false);
      });
    }
    case Action.Remove: {
      return new Promise(async (resolve) => {
        const data = msg.data as DataRemove;
        let hl_id: string | undefined = data.id;
        const is_local_id = hl_id.startsWith(local_id_prefix);

        if (is_local_id) {
          if (sender.tab?.url) {
            const url = sender.tab.url;
            let local = await browser.storage.local.get({highlights_add: {}});
            delete local.highlights_add[url].highlights[hl_id];
            await browser.storage.local.set(local);
            if (sender.tab.id) {
              updateBadgeText(sender.tab.id, undefined, -1);
            }
            resolve(true); 
            return;
          }
        } else if (data.id.startsWith("histre")) {
          // NOTE: if histre highlight, have to re-add it to get its ID.
          // Then I can use the ID to delete the highlight. 
          if (sender.tab?.url) {
            const data = msg.data as DataCreate;
            const url = sender.tab.url;
            const title = sender.tab?.title || "";

            hl_id = await histreAddHighlight(histre, {
               url: url,
               title: title,
               text: data.text,
            })
          }
        }

        let added_to_histre = false;
        if (hl_id) {
          added_to_histre = await histreRemoveHighlight(histre, hl_id);
          if (!added_to_histre) {
            let local = await browser.storage.local.get({highlights_remove: []});
            local.highlights_remove.push(data.id);
            await browser.storage.local.set(local);
            startSyncInterval();
          }
          if (sender.tab?.id) {
            updateBadgeText(sender.tab.id, undefined, -1);
          }
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
        await histre.updateTokens()
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
    case Action.GetHighlights: {
      return new Promise(async (resolve) => {
        if (sender.tab?.url === undefined) { 
          resolve(undefined); 
          return;
        }

        const highlights = await histreGetHighlights(histre, sender.tab.url);
        if (highlights) {
          // NOTE: histre API doesn't return highlight_id field. Have to make
          // my own.
          for (const index in highlights) {
            let histre_id = `histre-${randomString()}`;
            highlights[index].highlight_id = histre_id;
          }
        }
        resolve(highlights);
      });
    }
    case Action.UpdateBadge: {
        if (sender.tab?.id === undefined) { 
          return;
        }
        const data = msg.data as DataBadge;
        updateBadgeText(sender.tab.id, data.hl_len.toString());
    }
  }
});

async function updateBadgeText(tab_id: number, text?: string, change: number = 0) {
  if (text) {
    browser.browserAction.setBadgeText({tabId: tab_id, text: text});
    return;
  }
  text = await browser.browserAction.getBadgeText({tabId: tab_id});
  let count = text.length === 0 ? 0 : Number(text);
  count += change;
  if (count <= 0) {
    browser.browserAction.setBadgeText({tabId: tab_id, text: ""});
    return;
  }
  browser.browserAction.setBadgeText({tabId: tab_id, text: count.toString()});
}

async function histreGetHighlights(histre: Histre | undefined, url: string): Promise<Array<HistreHighlight> | undefined> {
  if (histre === undefined) {
    return undefined;
  }

  const resp = await histre.getHighlightByUrl(url);
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

  const parsed_data = getDataSchema.safeParse(parsed.data.data);
  if (!parsed_data.success) {
    for (const issue of parsed_data.error.issues) {
      console.error(`Failed to validate 'data.${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
    }
    return undefined;
  }

  return parsed_data.data;
}
