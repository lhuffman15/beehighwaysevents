// ------------------------------------------------------------
// Bee Highways events page settings
// This is the only file you normally need to edit.
// ------------------------------------------------------------

window.BH_CONFIG = {
  // Paste the "Publish to web" CSV link for your Events tab here.
  // Google Sheet > File > Share > Publish to web > pick the "Events" tab >
  // pick "Comma-separated values (.csv)" > Publish > copy the link.
  // Leave it empty ("") to show the sample events while you set things up.
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2V40D-eiR2FfEiQhIeDlkyLSzd0wFPJbwej6WtMoZXozNVavdCZmrqo6AbbdmMZ8lLBt_h_7wytpI/pub?gid=51536016&single=true&output=csv",

  // ------------------------------------------------------------
  // EVENT TYPES
  // Each type gets its own tag color and its own standard text.
  // When someone leaves "Short description", "Full description" or
  // "What to bring" blank on the form, the page uses the text below
  // for that event's type. Fill a field in on the form only when an
  // event needs something different.
  //
  //   match:  a word that appears in the event type (not case-sensitive)
  //   color:  road (orange), goldenrod (yellow), frame (crimson),
  //           meadow (green), sky (blue) or plain (white)
  //   Use \n\n in "full" to start a new paragraph.
  //
  // To add a new type with its own color, copy one { ... } block,
  // paste it before the closing ], and change the words.
  // ------------------------------------------------------------
  eventTypes: [
    {
      name: "Pollinator Planting Party",
      match: "plant",
      color: "road",
      short: "Let's plant a native pollinator highway! Music, snacks & fun!",
      full: "Join us to plant California native plants that feed bees, butterflies, moths and birds. No experience needed. We'll show you how, and there are jobs for every age.\n\nAll ages, abilities and talents are welcome. Community Service Hours are available.",
      bring: "Gloves & shovel or trowel.",
    },
    {
      name: "Sheet Mulching Party",
      match: "mulch",
      color: "goldenrod",
      short: "Help us prepare the land for native plants. Music, snacks & fun!",
      full: "Sheet mulching smothers weeds without chemicals so native plants can move in. We lay down cardboard, soak it, and pile mulch on top. It's messy and very satisfying.\n\nAll ages, abilities and talents are welcome. Community Service Hours are available.",
      bring: "Gloves, a rake if you have one, and shoes you don't mind getting dirty.",
    },
    {
      name: "Tabling Event",
      match: "tabl",
      color: "frame",
      short: "Come say hi at the Bee Highways table!",
      full: "Stop by to learn about Bee Highways, get tips for planting natives at home, and find out how to join our next party.",
      bring: "",
    },
  ],

  // Tag color and standard text for any other event type
  // (anything typed into "Other" on the form).
  otherEventType: {
    color: "plain",
    short: "",
    full: "",
    bring: "",
  },

  // Time zone for "Add to calendar" links.
  timeZone: "America/Los_Angeles",

  // Where the "Volunteer Sign Up" and "Join Us" buttons point.
  volunteerUrl: "https://forms.gle/YAfg9rfbt8JgkAGX9",
  joinUrl: "https://beehighways.org/#joinus",
  contactEmail: "beehighways1@gmail.com",

  // Button text when an event has a link but no custom button text.
  defaultLinkText: "Event details",

  // Photo shown when an event has no photos.
  fallbackPhoto: "assets/img/meadow-1200.jpg",
};
