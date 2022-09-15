import { localUserSchema } from "./common";
import { getLocalUser, setLocalUser } from "./storage";

function init() {
  const form = document.querySelector("form")!;
  const feedback = form.querySelector("#feedback")! as HTMLElement;

  getLocalUser().then((data) => {
    if (data) {
      form.querySelector<HTMLInputElement>("#username")!.value = data.username;
      form.querySelector<HTMLInputElement>("#password")!.value = data.password;
    }
  });


  form.addEventListener("submit", async (e) => {
    feedback.dataset.state = "none";
    if (!e.target) {
      return;
    }
    const form_elem = e.target as HTMLFormElement;
    const form_data = new FormData(form_elem);
    const user = localUserSchema.safeParse({username: form_data.get("username"), password: form_data.get("password")});
    if (!user.success) {
      console.error("Invalid username and/or password entered");
      feedback.dataset.state = "failed";
      return;
    }
    await setLocalUser(user.data);
    console.log("New username and password saved")
    feedback.dataset.state = "saved";
    e.preventDefault();
  });

  // setTimeout(() => {
  //   form.querySelector("button")!.click()
  // }, 1)
}

document.addEventListener("DOMContentLoaded", init);
