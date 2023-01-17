import { storage } from "webextension-polyfill";

export const test_local = {
  "http://localhost:8080/test.html": {
    title: "Best practices for inclusive textual websites - Seirdy",
    highlights: [
      { 
        "item_id": "local-6nazstnm", 
        "text": "t does not apply to websites that have a lot of non-textual content. It also does not apply to websites that focus more on generating revenue or pleasing investors than",
        "color": "yellow" 
      },
      { 
        "item_id": "local-bjcczyzj", 
        "text": "not apply to websites that",
        "color": "orange" 
      },
      { 
        "item_id": "local-4twzo1f2", 
        "text": "apply to websites",
        "color": "green" 
      },
      { 
        "item_id": "local-7292ap92", 
        "text": "ply to",
        "color": "blue" 
      },
      { 
        "item_id": "local-cvlm97wh", 
        "text": "hat have a lot",
        "color": "purple" 
      },
      { 
        "item_id": "local-wq4elqm4", 
        "text": "investors than being incl",
        "color": "red" 
      },
      { 
        "item_id": "local-jeuib9on", 
        "text": "revenue or pleasing ",
        "color": "green" 
      },
      { 
        "item_id": "local-zvsaa2zb", 
        "text": "does not apply to",
        "color": "blue" 
      },
      { 
        "item_id": "local-ipm5qe3c", 
        "text": "that focus more",
        "color": "green" 
      },
      { 
        "item_id": "local-adj8wtbd", 
        "text": "entire page at a glance with a screenreader - you have to listen to the structure of it carefully and remember all that, or read through the entire",
        "color": "yellow" 
      },
      { 
        "item_id": "local-8x21bbro", 
        "text": "xceptions, there are only two times I feel comfortable overriding default st",
        "color": "green" 
      },
      { 
        "item_id": "local-fgbsq2nx", 
        "text": "     doing this when the defaults are truly inaccessible, or clash with another accessibility enhancement I made.\n\nMy previous advice regarding line spacing and maximum line length fell in the fir",
        "color": "purple" 
      },
      { 
        "item_id": "local-81adxnn2", 
        "text": "what ",
        "color": "red" 
      },
      { 
        "item_id": "local-o4hizrvw", 
        "text": "poor",
        "color": "green" 
      },
      { 
        "item_id": "local-rm3gmbmw", 
        "text": "more harmful to screen readers than “no ARIA”. Only use ARIA to fill in gaps left by POSH.\n\nAgain: avoid catering to",
        "color": "orange" 
      },
      { 
        "item_id": "local-lkodvlal", 
        "text": "Finding this range is difficult. The best way to resolve such difficult and subjective",
        "color": "purple" 
      }
    ]
  }
};

export const test_data = [
  { input: [
      { start: 0, end: 10, index: 0 },
      { start: 2, end: 6, index: 1 },
    ],
    expect: [
      { start: 0, end: 2, index: 0 },
      { start: 2, end: 6, index: 1 },
      { start: 6, end: 10, index: 0 },
    ]
  },
  { input: [
      { start: 0, end: 10, index: 0 },
      { start: 2, end: 6, index: 1 },
      { start: 5, end: 8, index: 2 },
    ],
    expect: [
      { start: 0, end: 2, index: 0 },
      { start: 2, end: 5, index: 1 },
      { start: 5, end: 8, index: 2 },
      { start: 8, end: 10, index: 0 },
    ]
  },
  { input: [
      { start: 0, end: 10, index: 0 },
      { start: 2, end: 4, index: 1 },
      { start: 6, end: 8, index: 2 },
    ],
    expect: [
      { start: 0, end: 2, index: 0 },
      { start: 2, end: 4, index: 1 },
      { start: 4, end: 6, index: 0 },
      { start: 6, end: 8, index: 2 },
      { start: 8, end: 10, index: 0 },
    ]
  },
  { input: [
      { start: 1, end: 10, index: 0 },
      { start: 1, end: 10, index: 1 },
    ],
    expect: [
      { start: 1, end: 1, index: 0 },
      { start: 1, end: 10, index: 1 },
    ]
  },
  { input: [
      { start: 0, end: 10, index: 0 },
      { start: 2, end: 4, index: 8 },
      { start: 6, end: 8, index: 6 },
      { start: 8, end: 13, index: 5 },
    ],
    expect: [
      { start: 0, end: 2, index: 0 },
      { start: 2, end: 4, index: 8 },
      { start: 4, end: 6, index: 0 },
      { start: 6, end: 8, index: 6 },
      { start: 8, end: 13, index: 5 },
    ]
  }
];

export function backgroundTestData() {
  // Add test user data
  const data = {
    ...test_local,
    "http://localhost:5173/tests/web.histre.html": {
      title: "Page title",
      highlights: [{
          "highlight_id": "local-6nazstnm", 
          "text": "histre highlights",
          "color": "yellow" 
        },
      ]
    }
  }

  data["http://localhost:8080/test.html"].highlights = data["http://localhost:8080/test.html"].highlights.slice(0, 2);

  storage.local.set({highlights_add: data});

  const test_popup = false;
  if (test_popup) {
    // For faster debugging popup.html
    browser.tabs.query({currentWindow: true})
    .then(async (tabs) => {
      const root_url = browser.runtime.getURL("/");
      const popup_url = root_url + "dist/popup.html";

      let has_popup_tab = false;
      // browser.tabs.reload won't ever fire because when web extension
      // is reloaded popup.html tab is also closed.
      for (const tab of tabs) {
        if (tab.url == popup_url) {
          browser.tabs.reload(tab.id)
          has_popup_tab = true;
          break;
        }
      }

      if (!has_popup_tab) {
        browser.tabs.create({ url: popup_url, active: false});
      }
    })
  }
}
