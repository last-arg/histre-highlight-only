import { runtime } from "webextension-polyfill";
import { localUserSchema, Action, Position, PositionLocation, PositionOrigin, UserData } from "./common";
import { getLocalUser, getPosition, setPosition } from "./storage";
import { reactive } from "./core";
import { act } from "@artalar/act";

const user_form = document.querySelector("#user")!;
const user = reactive<UserData | undefined>(undefined);
const renderUser = reactive(() => {
  console.log("render user")
  if (user.value) {
    user_form.querySelector<HTMLInputElement>("#username")!.value = user.value.username;
    user_form.querySelector<HTMLInputElement>("#password")!.value = user.value.password;
  }
})
getLocalUser().then((data) => {
  console.log("update user");
  if (data) {
    user.set(data);
    renderUser.get();
  }
})

const settings_form = document.querySelector("#settings")!;
const selection = act<Position>({ origin: "selection", location: "tc" });
const renderSettings = selection.subscribe((sel) => {
    const input_origin = settings_form.querySelector<HTMLInputElement>("#position-" + sel.origin)!;
    input_origin.checked = true;
    const input_location = settings_form.querySelector<HTMLInputElement>("#position-" + sel.location)!;
    input_location.checked = true
})
getPosition().then((pos) => {
  if (pos) {
    selection(pos);
  }
});


function init() {
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
