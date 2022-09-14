import { ValidToken, UserData, AuthData, AuthResp, HighlightAdd, HighlightUpdate, HistreResponse, histreResponseSchema, histreAuthSchema } from './common';

export class Histre {
  static host = 'https://histre.com';
  static api_v1 = `${Histre.host}/api/v1`;
  static url = {
    auth:      `${Histre.api_v1}/auth_token/`,
    refresh:   `${Histre.api_v1}/auth_token_refresh/`,
    highlight: `${Histre.api_v1}/highlight/`,
  };
  headers: any = { 
    "Host": "histre.com",
    "Content-Type": "application/json" 
  };
  user: UserData;
  tokens?: ValidToken = undefined;

  constructor(user: UserData, tokens?: ValidToken) {
    this.user = user;
    this.tokens = tokens;
  }

  async updateTokens() {
    let result_tokens = this.tokens;
    let err_msg: string | undefined = undefined;
    if (result_tokens) {
      const is_valid_token = Histre.hasValidTokens(result_tokens.created_at);
      if (!is_valid_token.access) {
        if (is_valid_token.refresh) {
          const resp = await this.refreshAuthToken(this.tokens!.token.refresh);
          if (resp) {
            this.tokens = { token: resp, created_at: Date.now() }
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
      console.log("Authenticating with username and password")
      if (this.user) {
        const new_token = await this.authUser();
        if (new_token) {
          this.tokens = { token: new_token, created_at: Date.now() };
          return this.tokens;
        } else {
          err_msg = "Failed to authenticate user."
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

  async authUser(): Promise<AuthData | undefined> {
    const req_body = JSON.stringify(this.user);
    const resp = await fetch(Histre.url.auth, {
      headers: this.headers,
      method: 'POST',
      body: req_body,
    });
    if (isValidResponse(resp)) {
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

    // TODO: parsed.body.details might contain more specific error message.
    // Something to do with username or password.
    // Do it in hasError() fn instead?
    if (Histre.hasError(body)) {
      return undefined;
    }

    const parsed_data = histreAuthSchema.safeParse(body.data.data)
    if (!parsed_data.success) {
      for (const issue of parsed_data.error.issues) {
        console.error(`Failed to validate 'data.${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
      }
      return undefined;
    }

    return parsed_data.data;
  };

  // Most endpoints return 403 (Forbidden) for auth errors.
  // Aquire and refresh endpoints return 401 for auth errors.
  async refreshAuthToken(refresh: string): Promise<AuthData | undefined> {
    const r = await fetch(Histre.url.refresh, {
      headers: this.headers,
      method: 'POST',
      body: `{"refresh": "${refresh}"}`,
    });
    const resp = await r.json();
    if (isValidResponse(resp)) {
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

    const parsed_data = histreAuthSchema.safeParse(body.data.data)
    if (!parsed_data.success) {
      for (const issue of parsed_data.error.issues) {
        console.error(`Failed to validate 'data.${issue.path[0]}' field in Histre JSON response. Error: ${issue.message}`)
      }
      return undefined;
    }

    return parsed_data.data;
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

  static hasError(histre_json: HistreResponse) {
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
