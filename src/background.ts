import * as browser from 'webextension-polyfill'
// TODO: move into json file instead?
import {username, password} from "../tmp/.secret.dev";

console.log("==== LOAD ./dist/background.js ====")

let host = 'https://histre.com';
let api_v1 = `${host}/api/v1`;
const authUrl = `${api_v1}/auth_token/`;

interface HistreResp<T> {
  data?: T,
  error: {
    error: boolean,
    errcode: number,
    errmsg?: string,
    status: number
  }
}

// access is valid for 15 minutes
// refresh is valid for 30 days
type AuthResp = HistreResp<{access: string, refresh: string}>

async function autheticate(): Promise<AuthResp | undefined> {
  const credentials = {
    username: username,
    password: password
  };
  const body = JSON.stringify(credentials);
  const headers = { 
    "Host": host,
    "Content-Type": "application/json" 
  };
  const r = await fetch(authUrl, {
    headers: headers,
    method: 'POST',
    body: body,
  });
  if (r.status != 200) {
    console.error(`Failed to make user authentication request. Error ${r.status} ${r.statusText}`);
    return;
  }

  const auth_resp = await r.json();
  return auth_resp as AuthResp
};

browser.runtime.openOptionsPage()
async function init() {
  const bg = await browser.runtime.getBackgroundPage();
  console.log(bg)
}
init()

console.log("testj", init) 
console.log("testj") 
console.log("testj", autheticate) 

