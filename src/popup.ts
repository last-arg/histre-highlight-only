import { runtime } from "webextension-polyfill";
import { localUserSchema, Action, Position } from "./common";
import { getLocalUser, getPosition, setPosition } from "./storage";

function init() {
  const user_form = document.querySelector("#user")!;
  const user_feedback = user_form.querySelector(".feedback")! as HTMLElement;
  const settings_form = document.querySelector("#settings")!;
  const settings_feedback = settings_form.querySelector(".feedback")! as HTMLElement;

  getLocalUser().then((data) => {
    if (data) {
      user_form.querySelector<HTMLInputElement>("#username")!.value = data.username;
      user_form.querySelector<HTMLInputElement>("#password")!.value = data.password;
    }
  });

  getPosition().then((pos) => {
    const new_pos = pos || "top";
    const new_input = settings_form.querySelector<HTMLInputElement>("#position-" + new_pos);
    if (new_input) {
      new_input.checked = true;
    }
  });

  user_form.addEventListener("submit", async (e) => {
    e.preventDefault();
    user_feedback.dataset.state = "none";
    if (!e.target) {
      return;
    }
    const form_elem = e.target as HTMLFormElement;
    const form_data = new FormData(form_elem);
    const user = localUserSchema.safeParse({username: form_data.get("username"), password: form_data.get("password")});
    if (!user.success) {
      console.error("Failed to save. Make sure username and/or password is correct.");
      user_feedback.dataset.state = "failed";
      return;
    }

    const is_saved = await runtime.sendMessage(
      "addon@histre-highlight-only.com", 
      { action: Action.UpdateUser , data: user.data },
    )

    if (is_saved) {
      console.log("New username and password saved")
      user_feedback.dataset.state = "saved";
    } else {
      console.error("Failed to save. Make sure username and/or password is correct.");
      user_feedback.dataset.state = "failed";
    }
    return;
  });

  // setTimeout(() => {
  //   user_form.querySelector("button")!.click()
  // }, 1)

  settings_form.addEventListener("submit", async (e) => {
    e.preventDefault();
    settings_feedback.dataset.state = "none";
    if (!e.target) {
      return;
    }
    const form_elem = e.target as HTMLFormElement;
    const form_data = new FormData(form_elem);
    const pos = form_data.get("position") as Position;
    if (!pos) {
      return;
    }
    const curr_pos = (await getPosition()) || "top";
    settings_feedback.dataset.state = "saved";
    if (curr_pos === pos) {
      return;
    }
    setPosition(pos);

    // Send position change to other tabs
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, {pos: pos})
      }
    }
    return;
  })
}

init();
