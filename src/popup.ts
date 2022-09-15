console.log("popup.html")
console.log(document.body)

document.querySelector("form")!.addEventListener("submit", (e) => {
  console.log("t", e.target)
  e.preventDefault();
})
