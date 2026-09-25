/* ============================================================
   Bee Highways — Pollinator Parties schedule
   Reads events from a published Google Sheet (CSV) and draws
   them as stops along a winding orange road.
   You shouldn't need to edit this file. Settings live in config.js.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = window.BH_CONFIG || {};
  var SAMPLE_CSV = "sample-events.csv"; // used only if sample-events.js is missing
  var MOBILE = window.matchMedia("(max-width: 759px)");
  var road = document.getElementById("road");
  var list = document.getElementById("upcoming");
  var svg = road.querySelector(".road__svg");
  var bee = road.querySelector(".road__bee");
  var restingButterfly = road.querySelector(".road__butterfly");

  // Hand-cut photo shapes, cycled so no two neighbors match.
  var BLOBS = [
    "46% 54% 44% 56% / 52% 46% 54% 48%",
    "54% 46% 58% 42% / 44% 56% 44% 56%",
    "42% 58% 50% 50% / 56% 44% 58% 42%",
    "58% 42% 46% 54% / 48% 52% 42% 58%"
  ];

  /* ---------- page setup ---------- */
  if (/[?&]embed=1\b/.test(location.search)) document.documentElement.classList.add("is-embed");
  document.querySelectorAll("[data-config-href]").forEach(function (a) {
    var url = CONFIG[a.getAttribute("data-config-href")];
    if (url) a.href = url;
  });
  document.querySelectorAll("[data-config-mail]").forEach(function (a) {
    var mail = CONFIG[a.getAttribute("data-config-mail")];
    if (mail) { a.href = "mailto:" + mail; a.textContent = mail; }
  });

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    var rows = [], row = [], field = "", i = 0, inQuotes = false, c;
    text = text.replace(/^\uFEFF/, "");
    while (i < text.length) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
        } else field += c;
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

  // Match columns by their header text, so renaming a form question slightly won't break things.
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

  /* ---------- dates & times ---------- */
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
  // Returns minutes after midnight, or null.
  function parseTime(s) {
    s = (s || "").trim().toLowerCase().replace(/\./g, "");
    if (!s) return null;
    var m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a|p)?$/);
    if (!m) return null;
    var hr = +m[1], min = +(m[2] || 0), ap = m[3];
    if (ap) {
      if (hr === 12) hr = 0;
      if (ap[0] === "p") hr += 12;
    }
    return hr > 23 || min > 59 ? null : hr * 60 + min;
  }
  function fmtTime(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
  }
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // "Sat, Aug 29, 11am - 2pm" (house style)
  function fmtWhen(ev) {
    var s = DOW[ev.day.getDay()] + ", " + MON[ev.day.getMonth()] + " " + ev.day.getDate();
    if (ev.startMin != null) s += ", " + fmtTime(ev.startMin) + (ev.endMin != null ? " - " + fmtTime(ev.endMin) : "");
    return s;
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function linkify(escaped) {
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function paragraphs(text) {
    return text.split(/\n\s*\n/).map(function (p) {
      return "<p>" + linkify(esc(p.trim())).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }
  // Turns Google Drive share links into image links that can be shown on a page.
  function photoUrl(u) {
    var m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?id=)([\w-]{20,})/) ||
            u.match(/[?&]id=([\w-]{20,})/);
    if (m && /google/.test(u)) return "https://drive.google.com/thumbnail?id=" + m[1] + "&sz=w1600";
    return u;
  }
  // Finds the settings for an event type in config.js (tag color + standard text).
  var COLORS = ["road", "goldenrod", "frame", "meadow", "sky", "plain"];
  function typeInfo(t) {
    var name = (t || "").toLowerCase();
    var types = CONFIG.eventTypes || [];
    for (var i = 0; i < types.length; i++) {
      var words = [types[i].match, types[i].name].filter(Boolean);
      for (var j = 0; j < words.length; j++) {
        if (name.indexOf(String(words[j]).toLowerCase()) > -1) return types[i];
      }
    }
    return CONFIG.otherEventType || {};
  }
  function typeClass(t) {
    var c = typeInfo(t).color;
    return "tag--" + (COLORS.indexOf(c) > -1 ? c : "plain");
  }
  var PIN = '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M7 15s5-5.1 5-8.6A5 5 0 0 0 2 6.4C2 9.9 7 15 7 15Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="6.4" r="1.8" fill="currentColor"/></svg>';
  var CHEV = '<svg class="chev" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- build events ---------- */
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
        short: get(r, "short"),
        full: get(r, "full"),
        bring: get(r, "bring"),
        link: get(r, "link"),
        linkText: get(r, "linkText"),
        photos: []
      };
      if (ev.startMin == null) ev.endMin = null;
      // Blank fields fall back to the standard text for this event type (config.js).
      var info = typeInfo(ev.type);
      if (!ev.short && info.short) ev.short = info.short;
      if (!ev.full && info.full) ev.full = info.full;
      if (!ev.bring && info.bring) ev.bring = info.bring;
      cols.photos.forEach(function (c) {
        (r[c] || "").split(/[\s,]+/).forEach(function (u) {
          if (/^https?:\/\//.test(u)) ev.photos.push(photoUrl(u));
        });
      });
      // The event counts as past once its end time (or the whole day) is over.
      var endMin = ev.endMin != null ? ev.endMin : (ev.startMin != null ? ev.startMin + 120 : 24 * 60);
      ev.endsAt = new Date(date.y, date.m, date.d, 0, endMin);
      events.push(ev);
    });
    return events;
  }

  /* ---------- add to calendar ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function stamp(day, mins) {
    var s = day.getFullYear() + pad(day.getMonth() + 1) + pad(day.getDate());
    return mins == null ? s : s + "T" + pad(Math.floor(mins / 60)) + pad(mins % 60) + "00";
  }
  function nextDay(day) { return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1); }
  function calTimes(ev) {
    if (ev.startMin == null) return { start: stamp(ev.day), end: stamp(nextDay(ev.day)), allDay: true };
    var end = ev.endMin != null ? ev.endMin : Math.min(ev.startMin + 120, 23 * 60 + 59);
    return { start: stamp(ev.day, ev.startMin), end: stamp(ev.day, end), allDay: false };
  }
  function calDetails(ev) {
    return [ev.short, ev.bring ? "What to bring: " + ev.bring : "", ev.link].filter(Boolean).join("\n\n");
  }
  function calLocation(ev) {
    if (ev.venue && ev.address && ev.address.toLowerCase().indexOf(ev.venue.toLowerCase()) > -1) return ev.address;
    return [ev.venue, ev.address].filter(Boolean).join(", ");
  }
  function googleCalUrl(ev) {
    var t = calTimes(ev);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(ev.title) +
      "&dates=" + t.start + "/" + t.end +
      (t.allDay ? "" : "&ctz=" + encodeURIComponent(CONFIG.timeZone || "America/Los_Angeles")) +
      "&details=" + encodeURIComponent(calDetails(ev)) +
      "&location=" + encodeURIComponent(calLocation(ev));
  }
  function icsText(ev) {
    var t = calTimes(ev), tz = CONFIG.timeZone || "America/Los_Angeles";
    function clean(s) { return String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
    var now = new Date();
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bee Highways//Pollinator Parties//EN", "BEGIN:VEVENT",
      "UID:" + ev.id + "-" + t.start + "@beehighways.org",
      "DTSTAMP:" + now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + "T" + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + "00Z",
      t.allDay ? "DTSTART;VALUE=DATE:" + t.start : "DTSTART;TZID=" + tz + ":" + t.start,
      t.allDay ? "DTEND;VALUE=DATE:" + t.end : "DTEND;TZID=" + tz + ":" + t.end,
      "SUMMARY:" + clean(ev.title),
      "DESCRIPTION:" + clean(calDetails(ev)),
      "LOCATION:" + clean(calLocation(ev)),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
  }

  /* ---------- render ---------- */
  var eventsById = {};

  function stopHTML(ev, index) {
    var side = index % 2 === 0 ? "left" : "right";
    var photos = ev.photos.length ? ev.photos : [CONFIG.fallbackPhoto || "assets/img/meadow-1200.jpg"];
    var blob = BLOBS[index % BLOBS.length];
    var where = ev.venue || ev.address;
    var mapQ = ev.address || ev.venue;
    var html = '<li class="stop" data-side="' + side + '">' +
      '<div class="stop__marker" aria-hidden="true"><span class="stop__dow">' + DOW[ev.day.getDay()] + '</span><span class="stop__day">' + ev.day.getDate() + "</span></div>" +
      '<article class="card" id="' + ev.id + '" aria-labelledby="' + ev.id + '-title">' +
        '<button class="card__photo" type="button" style="--blob:' + blob + '" data-event="' + ev.id + '" data-photo="0" aria-label="View photos from ' + esc(ev.title) + '">' +
          '<img src="' + esc(photos[0]) + '" alt="" loading="lazy" decoding="async"></button>' +
        (ev.type ? '<p class="tag ' + typeClass(ev.type) + '">' + esc(ev.type) + "</p>" : "") +
        '<h3 class="card__title" id="' + ev.id + '-title">' + esc(ev.title) + "</h3>" +
        '<p class="card__when">' + esc(fmtWhen(ev)) + "</p>" +
        (where ? '<p class="card__where">' + PIN + "<span>" + esc(where) + "</span></p>" : "") +
        (ev.short ? '<p class="card__blurb">' + linkify(esc(ev.short)) + "</p>" : "") +
        '<div class="card__actions">' +
          '<button class="btn btn--ghost card__toggle" type="button" aria-expanded="false" aria-controls="' + ev.id + '-more">More details ' + CHEV + "</button>" +
          (ev.link ? '<a class="btn btn--road" href="' + esc(ev.link) + '" target="_blank" rel="noopener">' + esc(ev.linkText || CONFIG.defaultLinkText || "Event details") + "</a>" : "") +
        "</div>" +
        '<div class="more" id="' + ev.id + '-more"><div class="more__inner"><div class="more__body">';
    if (photos.length > 1) {
      html += '<ul class="thumbs">' + photos.slice(1).map(function (p, k) {
        return '<li><button type="button" style="--blob-sm:' + BLOBS[(index + k + 1) % BLOBS.length] + '" data-event="' + ev.id + '" data-photo="' + (k + 1) + '" aria-label="View photo ' + (k + 2) + " of " + photos.length + '">' +
          '<img src="' + esc(p) + '" alt="" loading="lazy" decoding="async"></button></li>';
      }).join("") + "</ul>";
    }
    if (ev.full) html += paragraphs(ev.full);
    if (ev.bring) html += '<p class="more__label">What to bring</p><p>' + esc(ev.bring) + "</p>";
    if (mapQ) {
      html += '<p class="more__label">Where</p><p>' + esc(calLocation(ev)) +
        '<br><a href="https://maps.google.com/?q=' + encodeURIComponent(mapQ) + '" target="_blank" rel="noopener">Open in Maps</a></p>';
    }
    html += '<p class="more__label">Add to your calendar</p><p class="cal-links">' +
      '<a href="' + esc(googleCalUrl(ev)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
      '<a href="#" data-ics="' + ev.id + '">Apple or Outlook (.ics)</a></p>';
    html += "</div></div></div></article></li>";
    return html;
  }

  function renderUpcoming(events) {
    if (!events.length) {
      list.innerHTML = '<li class="road__status">New parties are on the way! <a href="' + esc(CONFIG.joinUrl || "https://beehighways.org/#joinus") + '">Sign up to bee invited</a> and we\'ll let you know.</li>';
      return;
    }
    var html = "", lastMonth = null, thisYear = new Date().getFullYear();
    events.forEach(function (ev, i) {
      var key = ev.day.getFullYear() + "-" + ev.day.getMonth();
      if (key !== lastMonth) {
        lastMonth = key;
        var label = MONTH[ev.day.getMonth()] + (ev.day.getFullYear() !== thisYear ? " " + ev.day.getFullYear() : "");
        html += '<li class="month"><h3 class="month__sign">' + label + "</h3></li>";
      }
      html += stopHTML(ev, i);
    });
    list.innerHTML = html;
    list.querySelectorAll(".card__photo img, .thumbs img").forEach(function (img) {
      img.addEventListener("error", function () {
        if (!img.dataset.failed) { img.dataset.failed = "1"; img.src = CONFIG.fallbackPhoto || "assets/img/meadow-1200.jpg"; }
      });
    });
  }

  function renderPast(events) {
    var section = document.querySelector(".past");
    if (!events.length) return;
    section.hidden = false;
    var ul = document.getElementById("past-list");
    ul.innerHTML = events.map(function (ev) {
      var photo = ev.photos[0] || CONFIG.fallbackPhoto || "assets/img/meadow-1200.jpg";
      return '<li class="past-card">' +
        '<div class="past-card__photo"><img src="' + esc(photo) + '" alt="" loading="lazy"></div>' +
        '<p class="past-card__date">' + esc(fmtWhen(ev)) + (ev.day.getFullYear() !== new Date().getFullYear() ? ", " + ev.day.getFullYear() : "") + "</p>" +
        '<h3 class="past-card__title">' + esc(ev.title) + "</h3>" +
        (ev.link ? '<a href="' + esc(ev.link) + '" target="_blank" rel="noopener">Event details and photos</a>' : "") +
        "</li>";
    }).join("");
    ul.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () {
        if (!img.dataset.failed) { img.dataset.failed = "1"; img.src = CONFIG.fallbackPhoto || "assets/img/meadow-1200.jpg"; }
      });
    });
    var btn = section.querySelector(".past__toggle");
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      btn.textContent = open ? "Show past parties" : "Hide past parties";
      ul.hidden = open;
      postHeight();
    });
  }

  /* ---------- the road ---------- */
  var drawQueued = false;
  function queueDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(function () { drawQueued = false; drawRoad(); postHeight(); });
  }

  function drawRoad() {
    var W = road.clientWidth, H = road.clientHeight;
    var mobile = MOBILE.matches;
    var listLeft = list.offsetLeft;
    var colCenter = listLeft + 38; // middle of the 76px road column on phones
    var center = W / 2;
    var items = list.children;
    var stopCount = 0;

    // 1. Put each marker and month sign on its spot along the road.
    Array.prototype.forEach.call(items, function (li) {
      var x;
      if (li.classList.contains("stop")) {
        var left = li.getAttribute("data-side") === "left";
        x = mobile ? colCenter + (stopCount % 2 ? 6 : -6) : center + (left ? -46 : 46);
        stopCount++;
      } else {
        x = mobile ? colCenter : center;
      }
      li.style.setProperty("--x", (x - listLeft) + "px");
    });

    // 2. Read where they landed and thread the road through them.
    var rr = road.getBoundingClientRect();
    var pts = [];
    Array.prototype.forEach.call(items, function (li) {
      var anchor = li.querySelector(".stop__marker, .month__sign");
      if (!anchor) return;
      var r = anchor.getBoundingClientRect();
      var x = li.classList.contains("month") && mobile ? parseFloat(li.style.getPropertyValue("--x")) + listLeft : r.left + r.width / 2 - rr.left;
      pts.push({ x: x, y: r.top + r.height / 2 - rr.top });
    });
    var startX = pts.length ? pts[0].x : (mobile ? colCenter : center);
    var endX = pts.length ? pts[pts.length - 1].x : startX;
    pts.unshift({ x: startX, y: 22 });
    pts.push({ x: endX + (mobile ? 0 : (stopCount % 2 ? 40 : -40)), y: H - 64 });

    var d = "M" + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], dy = (b.y - a.y) * 0.5;
      d += " C" + a.x.toFixed(1) + " " + (a.y + dy).toFixed(1) + " " + b.x.toFixed(1) + " " + (b.y - dy).toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1);
    }
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML =
      '<path class="road__edge" transform="translate(0 4)" d="' + d + '"/>' +
      '<path class="road__surface" d="' + d + '"/>' +
      '<path class="road__line" d="' + d + '"/>';

    // 3. A bee walks at the start of the road; a monarch rests at the end.
    bee.style.left = (pts[0].x + 4) + "px";
    bee.style.top = (pts[0].y + 6) + "px";
    var last = pts[pts.length - 1];
    restingButterfly.style.left = last.x + "px";
    restingButterfly.style.top = last.y + "px";
    road.classList.add("is-drawn");
  }

  /* ---------- interactions ---------- */
  var lightbox = document.getElementById("lightbox");
  var lbImg = lightbox.querySelector(".lightbox__img");
  var lbPrev = lightbox.querySelector(".lightbox__prev");
  var lbNext = lightbox.querySelector(".lightbox__next");
  var lbState = { photos: [], i: 0, returnFocus: null, title: "" };

  function showPhoto() {
    lbImg.src = lbState.photos[lbState.i];
    lbImg.alt = "Photo " + (lbState.i + 1) + " of " + lbState.photos.length + " from " + lbState.title;
    lbPrev.hidden = lbNext.hidden = lbState.photos.length < 2;
  }
  function openLightbox(ev, i, from) {
    lbState = { photos: ev.photos.length ? ev.photos : [CONFIG.fallbackPhoto], i: i, returnFocus: from, title: ev.title };
    showPhoto();
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightbox.querySelector(".lightbox__close").focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lbState.returnFocus) lbState.returnFocus.focus();
  }
  function step(n) { lbState.i = (lbState.i + n + lbState.photos.length) % lbState.photos.length; showPhoto(); }

  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox || e.target.closest(".lightbox__close")) closeLightbox();
    else if (e.target.closest(".lightbox__prev")) step(-1);
    else if (e.target.closest(".lightbox__next")) step(1);
  });
  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {
      var f = Array.prototype.filter.call(lightbox.querySelectorAll("button"), function (b) { return !b.hidden; });
      var idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  list.addEventListener("click", function (e) {
    var toggle = e.target.closest(".card__toggle");
    if (toggle) {
      var card = toggle.closest(".card");
      var open = !card.classList.contains("is-open");
      card.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.firstChild.nodeValue = open ? "Fewer details " : "More details ";
      return;
    }
    var photoBtn = e.target.closest("[data-photo]");
    if (photoBtn) {
      openLightbox(eventsById[photoBtn.getAttribute("data-event")], +photoBtn.getAttribute("data-photo"), photoBtn);
      return;
    }
    var ics = e.target.closest("[data-ics]");
    if (ics) {
      e.preventDefault();
      var ev = eventsById[ics.getAttribute("data-ics")];
      var blob = new Blob([icsText(ev)], { type: "text/calendar;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = ev.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) + ".ics";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
  });

  // Lets beehighways.org size an embedded iframe to fit (see README).
  function postHeight() {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "bh-events-height", height: document.documentElement.scrollHeight }, "*");
    }
  }

  /* ---------- go ---------- */
  function load() {
    var url = (CONFIG.sheetCsvUrl || "").trim();
    var usingSample = !url;
    if (usingSample) {
      url = SAMPLE_CSV;
      document.querySelector(".sample-note").hidden = false;
    }
    var request = usingSample && window.BH_SAMPLE_CSV
      ? Promise.resolve(window.BH_SAMPLE_CSV)
      : fetch(url, { cache: "no-store" }).then(function (res) {
          if (!res.ok) throw new Error("Sheet request failed with status " + res.status);
          return res.text();
        });
    return request
      .then(function (text) {
        if (/^\s*</.test(text)) throw new Error("The sheet link returned a web page instead of CSV. Use File > Share > Publish to web and choose .csv.");
        var rows = parseCSV(text);
        if (rows.length < 1) throw new Error("The sheet is empty.");
        var all = toEvents(rows);
        all.forEach(function (ev) { eventsById[ev.id] = ev; });
        var now = new Date();
        var upcoming = all.filter(function (ev) { return ev.endsAt >= now; })
          .sort(function (a, b) { return a.day - b.day || (a.startMin || 0) - (b.startMin || 0); });
        var past = all.filter(function (ev) { return ev.endsAt < now; })
          .sort(function (a, b) { return b.day - a.day; });
        renderUpcoming(upcoming);
        renderPast(past);
      })
      .catch(function (err) {
        console.error("[Bee Highways schedule]", err);
        list.innerHTML = '<li class="road__status">The schedule didn\'t load. Refresh the page, or see upcoming events on <a href="https://beehighways.org/#events-section">beehighways.org</a>.</li>';
      })
      .then(queueDraw);
  }

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(queueDraw);
    ro.observe(road);
    ro.observe(list);
  }
  window.addEventListener("resize", queueDraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueDraw);
  queueDraw();
  load();
})();
