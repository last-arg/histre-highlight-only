import { storage } from 'webextension-polyfill'
console.log("==== LOAD ./dist/background.js ====")

let host = 'https://histre.com';
let api_v1 = `${host}/api/v1`;
const authUrl = `${api_v1}/auth_token/`;
const refreshAuthUrl = `${api_v1}/auth_token_refresh/`;

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
type AuthResp = HistreResp<Required<AuthData>>
interface UserData {
  username: string,
  password: string,
}

async function authUser(user: UserData): Promise<AuthResp> {
  const body = JSON.stringify(user);
  const headers = { 
    "Host": host,
    "Content-Type": "application/json" 
  };
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
  const headers = { 
    "Host": host,
    "Content-Type": "application/json" 
  };
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

interface AuthData {
  access: string,
  refresh: string,
}

type AuthDataTime = { token: AuthData, created_at: number};

async function getLocalAuthData(): Promise<AuthDataTime | undefined> {
  const data = await storage.local.get(
    {token: {access: undefined, refresh: undefined}, created_at: undefined});
  if (data.token.access && data.token.refresh && data.created_at) {
    return data as AuthDataTime;
  }
  return undefined;
}

async function setLocalAuthData(token: AuthData): Promise<AuthDataTime> {
  const result = {token: token, created_at: Date.now()};
  console.log(result)
  await storage.local.set(result);
  return result;
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

async function init() {
  if (__DEV__) {; 
    // Add test user data
    const user = await import("../tmp/.secret.dev");
    await setLocalUser(user.user)
  }

  let auth_data = await getLocalAuthData()
  console.log("current auth data", auth_data)
  let err_msg: string | undefined = undefined;
  if (auth_data) {
    const now = new Date();
    const created_date = new Date(auth_data.created_at);
    const access_date = new Date(created_date);
    access_date.setMinutes(access_date.getMinutes() + 15);
    const refresh_date = new Date(created_date);
    refresh_date.setDate(refresh_date.getDate() + 30);

    if (now > access_date) {
      if (now < refresh_date) {
        console.log("Refresh token", auth_data)
        const resp = await refreshAuthToken(auth_data.token.refresh);
        if (resp.error) {
          err_msg = "Failed to refresh access token."
          if (resp.details) {
            err_msg += ` Error: ${resp.details.detail}`;
          } else if (resp.errmsg) {
            err_msg += ` Error(${resp.errcode}): ${resp.errmsg}`;
          }
        } else if (resp.data) {
          auth_data = await setLocalAuthData(resp.data)
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
    console.log("user", user)
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
        auth_data = await setLocalAuthData(resp.data)
      }
    } else {
      err_msg = "Need to provide username and password"
    }
  }

  if (auth_data) {
    console.log("new auth data", auth_data)
  } else if (err_msg) {
    console.error(err_msg)
  } else {
    console.error(`Have exhausted all options to authenticate you. Only advice would be to make sure that account credentials are right and keep trying from time to time.`);
  }

}
init()

// browser.runtime.openOptionsPage()
// const bg_href = (await browser.runtime.getBackgroundPage()).location.href;
// console.log(bg_href)
