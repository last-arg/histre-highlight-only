import { runtime } from "webextension-polyfill";
import { localUserSchema, Action, Position, PositionLocation, PositionOrigin } from "./common";
import { getLocalUser, getPosition, setPosition } from "./storage";

function init() {
  const user_form = document.querySelector("#user")!;
  const settings_form = document.querySelector("#settings")!;

  getLocalUser().then((data) => {
    if (data) {
      user_form.querySelector<HTMLInputElement>("#username")!.value = data.username;
      user_form.querySelector<HTMLInputElement>("#password")!.value = data.password;
    }
  });

  getPosition().then((pos) => {
    let origin = "selection";
    let location = "tc";
    if (pos) {
      origin = pos.origin;
      location = pos.location;
    }
    const input_origin = settings_form.querySelector<HTMLInputElement>("#position-" + origin)!;
    input_origin.checked = true;
    const input_location = settings_form.querySelector<HTMLInputElement>("#position-" + location)!;
    input_location.checked = true
  });

  user_form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form_elem = e.target as HTMLFormElement;
    const user_feedback = form_elem.querySelector(".feedback")! as HTMLElement;
    user_feedback.dataset.state = "none";
    if (!form_elem) {
      return;
    }
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
    const form_elem = e.target as HTMLFormElement;
    const settings_feedback = form_elem.querySelector(".feedback")! as HTMLElement;
    settings_feedback.dataset.state = "none";
    if (!form_elem) {
      return;
    }
    let curr_pos = await getPosition();
    const form_data = new FormData(form_elem);
    let new_pos: Position = {
      location: form_data.get("position") as PositionLocation,
      origin: form_data.get("position-origin") as PositionOrigin,
    };
    if (!new_pos.location || !new_pos.origin) {
      return;
    }
    settings_feedback.dataset.state = "saved";
    if (curr_pos === new_pos) {
      return;
    }
    setPosition(new_pos);

    // TODO: background script should be handling update of tabs
    // runtime.sendMessage reciever/handler will also contain tab id
    // Send position change to other tabs
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, {pos: new_pos})
      }
    }
    return;
  })
}

init();
