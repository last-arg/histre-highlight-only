import { runtime } from "webextension-polyfill";
import { localUserSchema, Action, UserSettings, Position, Origin, UserData } from "./common";
import { getLocalUser, getSettings } from "./storage";
import { ext_id, settings_default } from "./config";
import { act } from "@artalar/act";

const user_form = document.querySelector("#user")!;
const user = act<UserData | undefined>(undefined);
// const user = reactive<UserData | undefined>(undefined);
const renderUser = act(() => {
    const u = user();
    if (u) {
        user_form.querySelector<HTMLInputElement>("#username")!.value = u.username;
        user_form.querySelector<HTMLInputElement>("#password")!.value = u.password;
    }
})
getLocalUser().then((data) => {
    if (data) {
        user(data);
        renderUser();
    }
})

const settings_form = document.querySelector("#settings")!;
const settings = act<UserSettings>(settings_default);
const renderSettings = act(() => {
    const s = settings();
    const input_origin = settings_form.querySelector<HTMLInputElement>("#position-" + s.origin)!;
    input_origin.checked = true;
    const input_location = settings_form.querySelector<HTMLInputElement>("#position-" + s.location)!;
    input_location.checked = true
})

getSettings().then((pos) => {
    if (pos) {
        console.log("pos")
        settings(pos);
        renderSettings();
    }
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
    const form_user = localUserSchema.safeParse({ username: form_data.get("username"), password: form_data.get("password") });
    if (!form_user.success) {
        console.error("Failed to save. Make sure username and/or password is correct.");
        user_feedback.dataset.state = "failed";
        return;
    }

    const is_saved = await runtime.sendMessage(
        ext_id,
        { action: Action.UpdateUser, data: form_user.data },
    )

    if (is_saved) {
        user_feedback.dataset.state = "saved";
        user(form_user.data);
    } else {
        console.error("Failed to save. Make sure username and/or password is correct.");
        user_feedback.dataset.state = "failed";
    }
    return;
});

settings_form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form_elem = e.target as HTMLFormElement;
    const settings_feedback = form_elem.querySelector(".feedback")! as HTMLElement;
    settings_feedback.dataset.state = "none";
    if (!form_elem) {
        return;
    }
    const form_data = new FormData(form_elem);
    let new_pos: UserSettings = {
        location: form_data.get("position") as Position,
        origin: form_data.get("position-origin") as Origin,
    };
    if (!new_pos.location || !new_pos.origin) {
        return;
    }
    settings_feedback.dataset.state = "saved";
    if (settings().origin === new_pos.origin
        && settings().location === new_pos.location
    ) {
        return;
    }

    const success = await runtime.sendMessage(
        ext_id,
        { action: Action.UpdateSettings, data: new_pos },
    )

    if (success) {
        settings_feedback.dataset.state = "saved";
        settings(new_pos);
        renderSettings()
    } else {
        console.error("Failed to save settings. Try again.");
        settings_feedback.dataset.state = "failed";
    }
})
