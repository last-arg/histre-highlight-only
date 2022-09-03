import { storage } from 'webextension-polyfill';
import type { Runtime } from 'webextension-polyfill';
import { Message, Action, HighlightAdd } from './common';

// Test import
import { test_local } from "./tests/test_data";

console.log("==== LOAD ./dist/background.js ====")


interface HistreResp<T> {
  data?: T,
  // TODO: Not sure if this has defined shape
  details?: any | undefined
  error: boolean,
  errcode: number,
  errmsg?: string | undefined,
  status: number
}

// access is valid for 15 minutes
// refresh is valid for 30 days
interface AuthData {
  access: string,
  refresh: string,
}
type AuthResp = HistreResp<Required<AuthData>>;
type AuthDataTime = { token: AuthData, created_at: number};

type HighlightData = {highlight_id: string, highlight_link: string};
type HighlightResp = HistreResp<HighlightData>;

interface UserData {
  username: string,
  password: string,
}

async function getLocalAuthData(): Promise<AuthDataTime | undefined> {
  const data = await storage.local.get(
    {token: {access: undefined, refresh: undefined}, created_at: undefined});
  if (data.token.access && data.token.refresh && data.created_at) {
    return data as AuthDataTime;
  }
  return undefined;
}

async function setLocalAuthData(auth_data: AuthDataTime) {
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

const histre = (function createHistre() {
  const host = 'https://histre.com';
  const api_v1 = `${host}/api/v1`;
  const authUrl = `${api_v1}/auth_token/`;
  const refreshAuthUrl = `${api_v1}/auth_token_refresh/`;
  const highlightUrl = `${api_v1}/highlight/`;
  let headers: any = { 
    "Host": host,
    "Content-Type": "application/json" 
  };

  function setHeaderAuthToken(access: string) {
    headers["Authorization"] = `Bearer ${access}`;
  }

  function removeHeaderAuthToken() { delete headers["Authorization"]; }

  async function authUser(user: UserData): Promise<AuthResp> {
    const body = JSON.stringify(user);
    const r = await fetch(authUrl, {
      headers: headers,
      method: 'POST',
      body: body,
    });
    const auth_resp = await r.json();
    // According to Histre API docs some responses might have 'status' field value as 'null'
    if (!auth_resp.status) {
      auth_resp.status = r.status;
    }
    return auth_resp as AuthResp
  };

  // Most endpoints return 403 (Forbidden) for auth errors.
  // Aquire and refresh endpoints return 401 for auth errors.
  async function refreshAuthToken(refresh: string): Promise<AuthResp> {
    const r = await fetch(refreshAuthUrl, {
      headers: headers,
      method: 'POST',
      body: `{"refresh": "${refresh}"}`,
    });
    const auth_resp = await r.json();
    // According to Histre API docs some responses might have 'status' field value as 'null'
    if (!auth_resp.status) {
      auth_resp.status = r.status;
    }
    return auth_resp as AuthResp
  };

  async function requestNewToken(curr_auth_data: AuthDataTime | undefined): Promise<AuthData | undefined> {
    if (__DEV__) {; 
      // Add test user data
      const user = await import("../tmp/.secret.dev");
      await setLocalUser(user.user)
    }

    let auth_data = curr_auth_data?.token;
    let err_msg: string | undefined = undefined;
    if (auth_data) {
      const now = new Date();
      // NOTE: If we auth_data is valid then curr_auth_data is valid.
      const created_date = new Date(curr_auth_data!.created_at);
      const access_date = new Date(created_date);
      access_date.setMinutes(access_date.getMinutes() + 15);
      const refresh_date = new Date(created_date);
      refresh_date.setDate(refresh_date.getDate() + 30);

      if (now > access_date) {
        if (now < refresh_date) {
          console.log("Refresh token", auth_data)
          const resp = await refreshAuthToken(auth_data.refresh);
          if (resp.error) {
            err_msg = "Failed to refresh access token."
            if (resp.details) {
              err_msg += ` Error: ${resp.details.detail}`;
            } else if (resp.errmsg) {
              err_msg += ` Error(${resp.errcode}): ${resp.errmsg}`;
            }
          } else if (resp.data) {
            auth_data = resp.data
          }
        } else {
          console.log("Tokens are invalid");
          // Existing tokens are invalid
          auth_data = undefined;
        }
      }
    }

    if (err_msg) {
      console.error(err_msg);
      console.info("Will try to authenticate with username and password");
    }

    if (!auth_data) {
      console.log("Authenticate with username and password")
      const user = await getLocalUser();
      if (user) {
        const resp = await authUser(user);
        if (resp.error) {
          err_msg = "Failed to authenticate user."
          if (resp.details) {
            err_msg += " Error: ";
            if (resp.details.detail) {
              err_msg += resp.details.detail;
            } else {
              if (resp.details.username) {
                err_msg += "'username' field may not be blank"
              } else if (resp.details.password) {
                if (resp.details.username) { err_msg += " and "; }
                err_msg += "'password' field may not be blank"
              }
            }
          }
        } else if (resp.data) {
          auth_data = resp.data
        }
      } else {
        err_msg = "Need to provide username and password"
      }
    }

    if (err_msg) {
      console.error(err_msg)
    } else if (auth_data === undefined) {
      console.error(`Have exhausted all options to authenticate you. Only advice would be to make sure that account credentials are right and keep trying from time to time.`);
    }
    return auth_data;
  }

  async function newToken(auth_data: AuthDataTime | undefined): Promise<AuthDataTime | undefined> {
    let new_token = await requestNewToken(auth_data);
    if (new_token) {
      auth_data = { created_at: Date.now(), token: new_token };
    }

    return auth_data;
  }

  function hasValidAccessToken(created_at: number) {
      const now = new Date();
      const created_date = new Date(created_at);
      const access_date = new Date(created_date);
      access_date.setMinutes(access_date.getMinutes() + 15);
      return now < access_date;
  }

  async function addHighlight(hl: HighlightAdd): Promise<HighlightData | undefined> {
    const body = JSON.stringify(hl);
    const resp = await fetch(highlightUrl, { headers: headers, method: "POST", body: body });
    const hl_resp = (await resp.json()) as HighlightResp;
    if (hl_resp.error) {
      let err_msg = "Failed to add highlight.";
      if (hl_resp.details) {
        err_msg += ` Error: ${hl_resp.details.detail}`;
      } else if (hl_resp.errmsg) {
        err_msg += ` Error(${hl_resp.errcode}): ${hl_resp.errmsg}`;
      }
      console.error(err_msg);
      return undefined;
    }
    return hl_resp.data;
  }

  // Body response when invalid id is provided:
  // Object { data: null, error: true, errcode: 400, errmsg: null, status: 200 }
  async function removeHighlight(id: string): Promise<boolean> {
    const body = JSON.stringify({highlight_id: id});
    const resp = await fetch(highlightUrl, { headers: headers, method: "DELETE", body: body });
    const hl_resp = (await resp.json()) as HighlightResp;
    if (hl_resp.error) {
      let err_msg = "Failed to remove highlight.";
      if (hl_resp.details) {
        err_msg += ` Error: ${hl_resp.details.detail}`;
      } else if (hl_resp.errmsg) {
        err_msg += ` Error(${hl_resp.errcode}): ${hl_resp.errmsg}`;
      }
      console.error(err_msg);
      return false;
    }
    return true;
  }

  return {
    newToken: newToken,
    hasValidAccessToken: hasValidAccessToken,
    addHighlight: addHighlight,
    removeHighlight: removeHighlight,
    setHeaderAuthToken: setHeaderAuthToken,
    removeHeaderAuthToken: removeHeaderAuthToken,
  };
})();

// TODO: on request (update, add, remove) failure store data locally

// TODO: Remove highlight 
// TODO: Update highlight 

// TODO: Save highlight 
// 1) Request to save new highlight
// 2) Is valid token? Get new token
// 3) Make request
async function init() {
  // storage.local.clear();
  let curr_auth_data = await getLocalAuthData();
  let new_auth_data = curr_auth_data;
  if (curr_auth_data === undefined || !histre.hasValidAccessToken(curr_auth_data.created_at)) {
    // Get new token
    const auth_data = await histre.newToken(curr_auth_data);
    if (auth_data) {
      await setLocalAuthData(auth_data);
      new_auth_data = auth_data;
    }
  }

  if (new_auth_data === undefined) {
    histre.removeHeaderAuthToken()
    console.error("Failed to get valid Histre user token");
    return;
  }
  histre.setHeaderAuthToken(new_auth_data.token.access);
  console.log("new_auth", new_auth_data)

  // {
  //   const hl = {
  //     url: "test_url",
  //     title: "test_title",
  //     text: "test_text",
  //     color: "yellow",
  //   };
  //   const add = await histre.addHighlight(hl)
  //   console.log("add", add)

  //   // const rm = await histre.removeHighlight(add!.highlight_id)
  //   const rm = await histre.removeHighlight("ddajk")
  //   console.log("remove", rm)
  // }
}

// init();

type SaveMessage = {id: string};
type MessageReturn = SaveMessage | boolean | undefined;

// Highlights in local storage use cases: 
// 1. Save highlights to Histre
// 2. Highlight page text
// 3. Delete highlight
//    If local id remove it from 'highlight.save'
// 4. Update highlight color. 
//    If local id change object in 'highlight.save.<local_id>.color'
// {
//   highlights_add: {
//       <local_id>: HighlighAdd
//   },
//   highlights_update: {
//     <id>: color
//   },
//   highlights_remove: [<id>],
// }
browser.runtime.onMessage.addListener((msg: Message, sender: Runtime.MessageSender): undefined | Promise<MessageReturn> => {
  console.log(msg, sender);
  switch (msg.action) {
    case Action.Save: {
      console.log("save", msg.data.local_id)
      return new Promise(async (resolve) => {
        if (sender.tab?.url === undefined) { 
          resolve(false); 
          return;
        }
        const url = sender.tab.url;
        let local = await storage.local.get({highlights_add: {[url]: { highlights: {} }}});
        console.log("store", local)
        local.highlights_add[url].title = sender.tab?.title || "";
        const local_id = msg.data.local_id;
        local.highlights_add[url].highlights[local_id] = { text: msg.data.text, color: msg.data.color };
        await storage.local.set(local);
        resolve(true);
      });
    }
    case Action.Update: {
      console.log("update")
      return new Promise(async (resolve) => {
        let local = await storage.local.get({highlights_update: {}});
        local.highlights_update[msg.data.local_id] = msg.data.color;
        await storage.local.set(local);
        resolve(true);
      });
    }
    case Action.Remove: {
      console.log("delete")
      return new Promise(async (resolve) => {
        let local = await storage.local.get({highlights_remove: []});
        local.highlights_remove.push(msg.data.id);
        await storage.local.set(local);
        resolve(true);
      });
    }
  }
});

if (__DEV__) {; 
  // Add test user data
  storage.local.set({highlights_add: test_local});
}


// console.log(browser.runtime.getURL("/"))

// browser.runtime.openOptionsPage()
// const bg_href = (await browser.runtime.getBackgroundPage()).location.href;
// console.log(bg_href)
