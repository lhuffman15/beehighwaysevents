/**
 * Bee Highways — one-time setup script
 * Creates the "Add a Bee Highways Event" Google Form and the Google Sheet
 * it saves to, with the exact questions the events page reads.
 *
 * How to run it (about 2 minutes):
 *  1. Go to https://script.google.com and click "New project".
 *  2. Delete the sample code, paste this whole file in, and click Save.
 *  3. Optional: add your two teammates' emails to EDITORS below.
 *  4. Pick "createEventForm" in the function menu at the top and click Run.
 *  5. Google will ask for permission the first time. Click through to allow it.
 *  6. When it finishes, open "Execution log" to find the links to your new Form and Sheet.
 */

// Teammates who should be able to edit the Form and the Sheet, e.g. ["sam@gmail.com", "ana@gmail.com"]
var EDITORS = [];

function createEventForm() {
  var form = FormApp.create("Add a Bee Highways Event");
  form.setDescription(
    "Adds an event to the Pollinator Parties schedule on the website. " +
    "It shows up within about 5 minutes. To change or remove an event later, edit its row in the Events sheet."
  );
  form.setCollectEmail(false);
  form.setConfirmationMessage("Thanks! The event will appear on the schedule in about 5 minutes.");
  form.setShowLinkToRespondAgain(true);

  form.addTextItem()
    .setTitle("Event title")
    .setHelpText('What you\'ll do plus "Party" and the place. Example: Planting Party @ Eden Gardens Elementary')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Event type")
    .setChoiceValues(["Planting Party", "Sheet Mulching Party", "Garden Care Day", "Community Meeting"])
    .showOtherOption(true)
    .setRequired(true);

  form.addDateItem().setTitle("Date").setRequired(true);
  form.addTimeItem().setTitle("Start time").setHelpText("Leave blank for an all-day event.");
  form.addTimeItem().setTitle("End time");

  form.addTextItem()
    .setTitle("Venue name")
    .setHelpText("Example: Eden Gardens Elementary");
  form.addTextItem()
    .setTitle("Address")
    .setHelpText("Street address, city. Used for the map link.");

  form.addTextItem()
    .setTitle("Short description")
    .setHelpText("One or two sentences shown on the event card. Example: Let's plant a native pollinator highway! Music, snacks & fun!")
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle("Full description")
    .setHelpText("Shown when someone clicks More details. Leave a blank line between paragraphs.");
  form.addTextItem()
    .setTitle("What to bring")
    .setHelpText("Example: Gloves & shovel or trowel.");

  form.addParagraphTextItem()
    .setTitle("Photo links")
    .setHelpText(
      "One link per line. The first photo is the main one on the card. " +
      "Use links to images on beehighways.org, or Google Drive links from the shared Event Photos folder."
    );

  var urlCheck = FormApp.createTextValidation().requireTextIsUrl()
    .setHelpText("Paste a full link starting with https://").build();
  form.addTextItem()
    .setTitle("Sign-up or more info link")
    .setHelpText("Optional. For example, the event's post on beehighways.org or a sign-up form.")
    .setValidation(urlCheck);
  form.addTextItem()
    .setTitle("Link button text")
    .setHelpText('Optional. Words on the link button, like "Sign up". Leave blank for "Event details".');

  // Sheet the answers go into
  var ss = SpreadsheetApp.create("Bee Highways Events");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);

  // Add a "Hide" column after the form's columns, rename the tab, freeze the header.
  var sheet = ss.getSheets().filter(function (s) { return s.getFormUrl(); })[0] || ss.getSheets()[0];
  sheet.setName("Events");
  var lastCol = sheet.getLastColumn();
  sheet.getRange(1, lastCol + 1).setValue("Hide").setNote("Type yes here to take an event off the website without deleting it.");
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol + 1).setFontWeight("bold").setBackground("#f6efe2");

  // Remove the empty default tab if Google left one behind.
  ss.getSheets().forEach(function (s) {
    if (s.getSheetId() !== sheet.getSheetId() && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  // A shared Drive folder for event photos. Anyone with the link can view, so photos show on the website.
  var folder = DriveApp.createFolder("Bee Highways Event Photos");
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  if (EDITORS.length) {
    form.addEditors(EDITORS);
    ss.addEditors(EDITORS);
    folder.addEditors(EDITORS);
  }

  Logger.log("Done! Save these links:");
  Logger.log("Form to add events (share with your team): " + form.getPublishedUrl());
  Logger.log("Edit the form's questions: " + form.getEditUrl());
  Logger.log("Events sheet: " + ss.getUrl());
  Logger.log("Photo folder: " + folder.getUrl());
  Logger.log("Next step: in the sheet, File > Share > Publish to web > Events tab > .csv > Publish, and paste that link into config.js.");
}
