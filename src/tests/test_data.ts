export const test_local = {
  "http://localhost:8080/test.html": {
    title: "Best practices for inclusive textual websites - Seirdy",
    highlights: {
      "local-6nazstnm": { 
        "text": "t does not apply to websites that have a lot of non-textual content. It also does not apply to websites that focus more on generating revenue or pleasing investors than",
        "color": "yellow" 
      },
      "local-bjcczyzj": { 
        "text": "not apply to websites that",
        "color": "orange" 
      },
      "local-4twzo1f2": { 
        "text": "apply to websites",
        "color": "green" 
      },
      "local-7292ap92": { 
        "text": "ply to",
        "color": "blue" 
      },
      "local-cvlm97wh": { 
        "text": "hat have a lot",
        "color": "purple" 
      },
      "local-wq4elqm4": { 
        "text": "investors than being incl",
        "color": "red" 
      },
      "local-jeuib9on": { 
        "text": "revenue or pleasing ",
        "color": "green" 
      },
      "local-zvsaa2zb": { 
        "text": "does not apply to",
        "color": "blue" 
      },
      "local-ipm5qe3c": { 
        "text": "that focus more",
        "color": "green" 
      },
      "local-adj8wtbd": { 
        "text": "entire page at a glance with a screenreader - you have to listen to the structure of it carefully and remember all that, or read through the entire",
        "color": "yellow" 
      },
      "local-8x21bbro": { 
        "text": "xceptions, there are only two times I feel comfortable overriding default st",
        "color": "green" 
      },
      "local-fgbsq2nx": { 
        "text": "     doing this when the defaults are truly inaccessible, or clash with another accessibility enhancement I made.\n\nMy previous advice regarding line spacing and maximum line length fell in the fir",
        "color": "purple" 
      },
      "local-81adxnn2": { 
        "text": "what ",
        "color": "red" 
      },
      "local-o4hizrvw": { 
        "text": "poor",
        "color": "green" 
      },
      "local-rm3gmbmw": { 
        "text": "more harmful to screen readers than ???no ARIA???. Only use ARIA to fill in gaps left by POSH.\n\nAgain: avoid catering to",
        "color": "orange" 
      },
      "local-lkodvlal": { 
        "text": "Finding this range is difficult. The best way to resolve such difficult and subjective",
        "color": "purple" 
      }
    }
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
