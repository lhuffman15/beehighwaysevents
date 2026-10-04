/* ============================================================
   Bee Highways — shared event loader (used by the flyer maker)
   Reads the same published Google Sheet as the schedule page.
   ============================================================ */
(function () {
  "use strict";
  var CONFIG = window.BH_CONFIG || {};

  function parseCSV(text) {
    var rows = [], row = [], field = "", i = 0, inQuotes = false, c;
    text = text.replace(/^\uFEFF/, "");
    while (i < text.length) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
      i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); });
  }

  function mapColumns(headers) {
    var h = headers.map(function (s) { return s.trim().toLowerCase(); });
    var used = {};
    function find(aliases) {
      var i, j;
      for (i = 0; i < aliases.length; i++) {
        j = h.indexOf(aliases[i]);
        if (j > -1 && !used[j]) { used[j] = true; return j; }
      }
      for (i = 0; i < aliases.length; i++) {
        for (j = 0; j < h.length; j++) {
          if (!used[j] && h[j].indexOf(aliases[i]) > -1 && h[j] !== "timestamp") { used[j] = true; return j; }
        }
      }
      return -1;
    }
    var cols = {};
    cols.hide = find(["hide"]);
    cols.logo = find(["venue logo link", "venue logo", "logo"]);
    cols.linkText = find(["link button text", "button text"]);
    cols.short = find(["short description", "summary", "blurb"]);
    cols.full = find(["full description", "description", "details"]);
    cols.title = find(["event title", "title", "event name"]);
    cols.type = find(["event type", "type", "category"]);
    cols.start = find(["start time", "start"]);
    cols.end = find(["end time", "end"]);
    cols.date = find(["date", "event date", "day"]);
    cols.venue = find(["venue name", "venue"]);
    cols.address = find(["address", "location", "where"]);
    cols.bring = find(["what to bring", "bring"]);
    cols.link = find(["sign-up or more info link", "link", "url", "rsvp"]);
    cols.photos = [];
    h.forEach(function (name, j) {
      if (!used[j] && /photo|image|picture|flyer/.test(name)) { used[j] = true; cols.photos.push(j); }
    });
    return cols;
  }

  function parseDate(s) {
    s = (s || "").trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return { y: +m[3] < 100 ? 2000 + +m[3] : +m[3], m: +m[1] - 1, d: +m[2] };
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
    var t = Date.parse(s);
    if (!isNaN(t)) { var dt = new Date(t); return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() }; }
    return null;
  }
  function parseTime(s) {
    s = (s || "").trim().toLowerCase().replace(/\./g, "");
    if (!s) return null;
    var m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a|p)?$/);
    if (!m) return null;
    var hr = +m[1], min = +(m[2] || 0), ap = m[3];
    if (ap) { if (hr === 12) hr = 0; if (ap[0] === "p") hr += 12; }
    return hr > 23 || min > 59 ? null : hr * 60 + min;
  }

  // Google Drive share links → image links. Returns a list of URLs to try, best first.
  function imageCandidates(u) {
    u = (u || "").trim();
    if (!/^https?:\/\//.test(u)) return [];
    var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?id=)([\w-]{20,})/);
    if (m) return ["https://lh3.googleusercontent.com/d/" + m[1] + "=w2000", "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w2000"];
    var wp = u.match(/^https?:\/\/((?:www\.)?beehighways\.org\/wp-content\/[^?#]+)/);
    if (wp) return [u, "https://i0.wp.com/" + wp[1] + "?w=2000"];
    return [u];
  }

  function toEvents(rows) {
    var cols = mapColumns(rows[0]);
    function get(r, key) { return cols[key] > -1 ? (r[cols[key]] || "").trim() : ""; }
    var events = [];
    rows.slice(1).forEach(function (r, i) {
      if (/^(y|yes|x|hide|hidden|true)$/i.test(get(r, "hide"))) return;
      var date = parseDate(get(r, "date"));
      var title = get(r, "title");
      if (!date || !title) return;
      var ev = {
        id: "event-" + i,
        title: title,
        type: get(r, "type"),
        day: new Date(date.y, date.m, date.d),
        startMin: parseTime(get(r, "start")),
        endMin: parseTime(get(r, "end")),
        venue: get(r, "venue"),
        address: get(r, "address"),
        link: get(r, "link"),
        logo: (get(r, "logo").match(/https?:\/\/\S+/) || [""])[0],
        photos: []
      };
      if (ev.startMin == null) ev.endMin = null;
      cols.photos.forEach(function (c) {
        (r[c] || "").split(/[\s,]+/).forEach(function (u) { if (/^https?:\/\//.test(u)) ev.photos.push(u); });
      });
      var endMin = ev.endMin != null ? ev.endMin : (ev.startMin != null ? ev.startMin + 120 : 24 * 60);
      ev.endsAt = new Date(date.y, date.m, date.d, 0, endMin);
      events.push(ev);
    });
    return events.sort(function (a, b) { return a.day - b.day || (a.startMin || 0) - (b.startMin || 0); });
  }

  function loadEvents() {
    var url = (CONFIG.sheetCsvUrl || "").trim();
    var request = !url && window.BH_SAMPLE_CSV
      ? Promise.resolve(window.BH_SAMPLE_CSV)
      : fetch(url || "sample-events.csv", { cache: "no-store" }).then(function (res) {
          if (!res.ok) throw new Error("Sheet request failed with status " + res.status);
          return res.text();
        });
    return request.then(function (text) {
      if (/^\s*</.test(text)) throw new Error("The sheet link returned a web page instead of CSV.");
      var rows = parseCSV(text);
      return rows.length ? toEvents(rows) : [];
    });
  }

  window.BHData = { loadEvents: loadEvents, imageCandidates: imageCandidates, usingSample: !(CONFIG.sheetCsvUrl || "").trim() };
})();
