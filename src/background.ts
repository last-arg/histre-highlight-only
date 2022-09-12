import { storage } from 'webextension-polyfill';
import type { Runtime } from 'webextension-polyfill';
import { Message, ValidToken, AuthResp, UserData, Action, HighlightAdd, HighlightUpdate, DataModify, DataRemove, DataCreate, local_id_prefix } from './common';

// Test import
import { test_local } from "./tests/test_data";
import { histreTests } from './test_background';

const runTests = true;


console.log("==== LOAD ./dist/background.js ====")

// type HighlightData = {highlight_id: string, highlight_link: string};
// type HighlightResp = HistreResp<HighlightData>;

export class Histre {
  static host = 'https://histre.com';
  static api_v1 = `${Histre.host}/api/v1`;
  static url = {
    auth:      `${Histre.api_v1}/auth_token/`,
    refresh:   `${Histre.api_v1}/auth_token_refresh/`,
    highlight: `${Histre.api_v1}/highlight/`,
  };
  headers: any = { 
    "Host": Histre.host,
    "Content-Type": "application/json" 
  };
  user: UserData;
  tokens?: ValidToken = undefined;

  constructor(user: UserData, tokens?: ValidToken) {
    this.user = user;
    this.tokens = tokens;
  }

  // Most endpoints return 403 (Forbidden) for auth errors.
  // Aquire and refresh endpoints return 401 for auth errors.
  async refreshAuthToken(refresh: string): Promise<AuthResp> {
    const r = await fetch(Histre.url.refresh, {
      headers: this.headers,
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

  async updateTokens() {
    let result_tokens = this.tokens;
    let err_msg: string | undefined = undefined;
    if (result_tokens) {
      const is_valid_token = Histre.hasValidTokens(result_tokens.created_at);

      if (!is_valid_token.access) {
        if (is_valid_token.refresh) {
          const resp = await this.refreshAuthToken(this.tokens!.token.refresh);
          if (resp.error) {
            err_msg = "Failed to refresh access token."
            if (resp.details) {
              err_msg += ` Error: ${resp.details.detail}`;
            } else if (resp.errmsg) {
              err_msg += ` Error(${resp.errcode}): ${resp.errmsg}`;
            }
          } else if (resp.data) {
            this.tokens = { token: resp.data, created_at: Date.now() }
            return this.tokens;
          }
        } else {
          console.log("Tokens have expired. Will try to get new tokens.");
        }
      }
    }

    if (err_msg) {
      console.error(err_msg);
      console.info("Will try to authenticate with username and password");
    }

    if (!result_tokens) {
      console.log("Authenticate with username and password")
      if (this.user) {
        const resp = await this.authUser();
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
          this.tokens = { token: resp.data, created_at: Date.now() };
          return this.tokens;
        } else {
          err_msg = "Failed to authenticate user. Didn't recieve token."
        }
      } else {
        err_msg = "Need to provide username and password"
      }
    }

    if (err_msg) {
      console.error(err_msg)
    } else if (result_tokens === undefined) {
      console.error(`Have exhausted all options to authenticate you. Make sure Histre username and password are correct.`);
    }

    return this.tokens;
  }

  async authUser(): Promise<AuthResp> {
    const body = JSON.stringify(this.user);
    const r = await fetch(Histre.url.auth, {
      headers: this.headers,
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

  setHeaderAuthToken() {
    console.assert(this.tokens?.token.access, "Don't have a access token to set HTTP header 'Authorization'");
    this.headers["Authorization"] = `Bearer ${this.tokens?.token.access}`;
  }

  static hasValidTokens(created_at: number) {
    const now = new Date();
    const created_date = new Date(created_at);
    const access_date = new Date(created_date);
    access_date.setMinutes(access_date.getMinutes() + 15);

    const refresh_date = new Date(created_date);
    refresh_date.setDate(refresh_date.getDate() + 30);

    return { access: now < access_date, refresh: now < refresh_date };
  }

  async addHighlight(hl: HighlightAdd): Promise<Response> {
    const body = JSON.stringify(hl);
    return await fetch(Histre.url.highlight, { headers: this.headers, method: "POST", body: body });
  }

  async updateHighlight(input: HighlightUpdate): Promise<Response> {
    const body = JSON.stringify(input);
    return await fetch(Histre.url.highlight, { headers: this.headers, method: "PATCH", body: body });
  }

  async getHighlightById(id: string): Promise<Response> {
    const params = new URLSearchParams({highlight_id: id});
    return await fetch(Histre.url.highlight + `?${params}`, { headers: this.headers, method: "GET" });
  }

  async getHighlightByUrl(url: string): Promise<Response> {
    const params = new URLSearchParams({url: url});
    return await fetch(Histre.url.highlight + `?${params}`, { headers: this.headers, method: "GET" });
  }

  // Body response when invalid id is provided:
  // Object { data: null, error: true, errcode: 400, errmsg: null, status: 200 }
  // If all highlights are deleted from url it will leave behind a note. If note is empty
  // and want to delete it have to make more requests.
  async removeHighlight(id: string): Promise<Response> {
    const body = JSON.stringify({highlight_id: id});
    return await fetch(Histre.url.highlight, { headers: this.headers, method: "DELETE", body: body });
  }

  // TODO: add type (remove any type)
  static hasError(histre_json: any) {
    if (histre_json.error) {
      let msg = "Histre API error";
      if (histre_json.errcode) {
        msg += ` (${histre_json.errcode})`;
      }
      msg += ": ";
      msg += histre_json.errmsg ? histre_json.errmsg : "<no error message>";
      console.error(msg);
      return true;
    }
    return false;
  }
}

export function isValidResponse(resp: Response): boolean {
  if (resp.status === 200) {
    return true;
  }

  console.error(`Got invalid HTTP response ${resp.status} ${resp.statusText}`);
  return false;
}


function randomString() {
  return Math.random().toString(36).substring(2,10)
};

type SaveMessage = string;
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
    case Action.Create: {
      console.log("save", msg.data)
      return new Promise(async (resolve) => {
        if (sender.tab?.url === undefined) { 
          resolve(false); 
          return;
        }
        let result_id: string | undefined = undefined; 
        const data = msg.data as DataCreate;
        let is_failed_request = true;
        const url = sender.tab.url;

        // TODO: histre request
        // const add = await histre.addHighlight(hl)

        if (is_failed_request) {
          let local = await storage.local.get({highlights_add: {[url]: { highlights: {} }}});
          console.log("store local", local)
          local.highlights_add[url].title = sender.tab?.title || "";
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

        let is_failed_request = true;
        if (!is_local_id) {
          is_failed_request = false;
          // TODO: histre request
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

        if (is_failed_request) {
          let local = await storage.local.get({highlights_update: {}});
          local.highlights_update[data.id] = data.color;
          await storage.local.set(local);
        }

        resolve(true);
      });
    }
    case Action.Remove: {
      console.log("delete", msg.data)
      return new Promise(async (resolve) => {
        const data = msg.data as DataRemove;
        const is_local_id = data.id.startsWith(local_id_prefix);

        let is_failed_request = true;
        if (!is_local_id) {
          // TODO: histre request
          // const rm = await histre.removeHighlight("ddajk")
          is_failed_request = false;
          resolve(true); 
          return;
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

        if (is_failed_request) {
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

if (__DEV__) {; 
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

  if (runTests) {
    histreTests()
  }
}


// console.log(browser.runtime.getURL("/"))

// browser.runtime.openOptionsPage()
// const bg_href = (await browser.runtime.getBackgroundPage()).location.href;
// console.log(bg_href)

