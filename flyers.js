/* ============================================================
   Bee Highways — Flyer Maker (square social)
   Draws flyers on a canvas from the event sheet, using the
   Bee Highways fonts, colors and painted meadow.
   ============================================================ */
(function () {
  "use strict";
  var CONFIG = window.BH_CONFIG || {};

  // Each flyer size is designed on its own grid; U converts grid units to pixels.
  var FORMATS = {
    square: {
      w: 2160, h: 2160, grid: 1080,
      top: 52, bottom: 620, maxW: 920,
      sizes: { headline: 90, place: 78, date: 112, dateMany: 86, dateLabel: 84 },
      art: { garden: "assets/flyers/square-garden.jpg", overlay: "assets/flyers/square-meadow-overlay.webp" },
      bhLogo: { x: 54, bottom: 1029, w: 196 },
      photoFrame: 460 / 612,   // photo fills the top, ending 152pt above the bottom (InDesign)
      small: true
    },
    letter: {
      w: 2550, h: 3300, grid: 850,
      top: 40, bottom: 572, maxW: 770,
      sizes: { headline: 70, place: 62, date: 90, dateMany: 62, dateLabel: 50 },
      art: { garden: "assets/flyers/letter-garden.jpg", overlay: "assets/flyers/letter-meadow-overlay.webp" },
      bhLogo: { right: 800, top: 902, w: 122 },
      details: { size: 25, maxW: 640 },
      qr: { x: 50, w: 150 },
      contact: { right: 800, bottom: 1060, size: 22, maxW: 330 },
      monarch: { x: 600, y: 568, w: 215 },
      photoFrame: 576 / 792,   // photo ends 216pt above the bottom (InDesign)
      fadeAll: true
    },
    wide: {
      w: 2560, h: 1440, grid: 1280,
      top: 26, bottom: 352, maxW: 1190,
      sizes: { headline: 50, place: 50, date: 84, dateMany: 56, dateLabel: 46 },
      art: { garden: "assets/flyers/wide-garden.jpg", overlay: "assets/flyers/wide-meadow-overlay.webp" },
      bhLogo: { right: 1246, top: 548, w: 104 },
      details: { size: 25, maxW: 820 },
      qr: { x: 28, w: 128, bottom: 694, sideBySide: true },
      contact: { right: 1250, bottom: 694, size: 17, maxW: 380 },
      inlinePlace: true,
      joinDates: true
    }
  };
  // Where the three photo shapes sit on the 16:9 collage (pixels on the 2560 × 1440 art).
  var COLLAGE_SLOTS = [[84, 212, 642, 691], [1025, 305, 523, 788], [1827, 297, 599, 616]];
  var COLLAGE_SAMPLES = ["assets/flyers/collage-sample-1.jpg", "assets/flyers/collage-sample-2.jpg", "assets/flyers/collage-sample-3.jpg"];
  var COLORS = { green: "#495c2d", orange: "#b56a40", crimson: "#981940", white: "#ffffff", ink: "#30303c" };
  var SKY = "85,190,233"; // sky color of the painted background
  var DEFAULT_SMALL = "Dates subject to change. Check BeeHighways.org for current info.";
  var DISPLAY = '"A Love of Thunder", Georgia, serif';
  var HAND = '"Architects Daughter", sans-serif';
  var LABEL = 'Montserrat, Arial, sans-serif';

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var $ = function (id) { return document.getElementById(id); };
  var f = {
    headline: $("f-headline"), place: $("f-place"), uselogo: $("f-uselogo"), logo: $("f-logo"),
    dates: $("f-dates"), details: $("f-details"), contact: $("f-contact"), qr: $("f-qr"), small: $("f-small"),
    photo: $("f-photo"), photofile: $("f-photofile"), photox: $("f-photox"), photoy: $("f-photoy"), zoom: $("f-zoom"),
    monarch: $("f-monarch"), ctitle: $("f-ctitle"), csub: $("f-csub"),
    fade: $("f-fade"), fadecolor: $("f-fadecolor")
  };
  // Color of the fade behind the words on photo flyers, as "r,g,b".
  function fadeColor() {
    var hex = (f.fadecolor.value || "#55bee9").replace("#", "");
    return [0, 2, 4].map(function (i) { return parseInt(hex.substr(i, 2), 16); }).join(",");
  }
  var canvases = {
    "square-garden": $("c-square-garden"), "square-photo": $("c-square-photo"),
    "letter-garden": $("c-letter-garden"), "letter-photo": $("c-letter-photo"),
    "wide-garden": $("c-wide-garden"), "wide-photo": $("c-wide-photo"), "wide-collage": $("c-wide-collage")
  };

  var state = {
    events: [], selected: [], logoImg: null, photoImg: null, uploadedPhoto: null, art: {},
    collage: { uploaded: [null, null, null], fromEvent: [null, null, null], samples: [null, null, null] },
    room: {}
  };

  /* ---------- images ---------- */
  function loadOne(src, cors) {
    return new Promise(function (resolve) {
      var img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  // Tries each address until one loads in a way the flyer can be downloaded.
  function loadFirst(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve(null);
      return loadOne(urls[i++], true).then(function (img) { return img || next(); });
    }
    return next();
  }
  function loadFile(file) {
    return loadOne(URL.createObjectURL(file), false);
  }

  /* ---------- text helpers ---------- */
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function fmtTime(mins) {
    var h = Math.floor(mins / 60), m = mins % 60, ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
  }
  function shortType(t) { return (t || "").replace(/^pollinator\s+/i, "").trim(); }

  function defaultsFor(list) {
    var first = list[0];
    var at = first.title.indexOf("@");
    var headline = at > -1 ? first.title.slice(0, at).trim() + " @" : first.title;
    // Several events of different kinds share one general headline.
    var types = list.map(function (ev) { return (ev.type || "").toLowerCase(); });
    if (list.length > 1 && types.some(function (t) { return t !== types[0]; })) headline = "Pollinator Parties @";
    var place = at > -1 ? first.title.slice(at + 1).trim() : first.venue;
    var dates;
    if (list.length === 1) {
      dates = [DOW[first.day.getDay()] + ": " + MONTHS[first.day.getMonth()] + " " + ordinal(first.day.getDate())];
      if (first.startMin != null) dates.push(fmtTime(first.startMin) + (first.endMin != null ? " - " + fmtTime(first.endMin) : ""));
    } else {
      dates = list.map(function (ev) {
        var line = DOW[ev.day.getDay()] + ", " + MON[ev.day.getMonth()] + " " + ev.day.getDate();
        if (ev.startMin != null) line += ", " + fmtTime(ev.startMin) + (ev.endMin != null ? " - " + fmtTime(ev.endMin) : "");
        return ev.type ? line + " | " + shortType(ev.type) : line;
      });
    }
    // Details for the letter flyer: the short description, what to bring, and the address.
    var details = [];
    if (first.short) details.push(first.short);
    var bring = (first.bring || "").trim().replace(/\.$/, "");
    details.push(bring ? "Bring " + bring.charAt(0).toLowerCase() + bring.slice(1) + ". All are welcome." : "All are welcome.");
    if (first.address && list.every(function (ev) { return ev.address === first.address; })) details.push(first.address);
    var withLink = list.find(function (ev) { return ev.link; });
    return {
      headline: headline, place: place, dates: dates.join("\n"), details: details.join("\n"),
      qr: withLink ? withLink.link : (CONFIG.flyerQrDefault || "https://beehighways.org")
    };
  }

  function setFont(ctx, family, size, weight, style) {
    ctx.font = (style || "") + " " + (weight || 400) + " " + size + "px " + family;
  }

  // Wrap words into lines no wider than maxW at the given size.
  function wrap(ctx, text, family, size, maxW) {
    setFont(ctx, family, size);
    var words = text.split(/\s+/).filter(Boolean), lines = [], line = "";
    words.forEach(function (w) {
      var test = line ? line + " " + w : w;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines;
  }
  // Even out two-line breaks so the second line isn't a lonely word.
  function balance(ctx, lines, family, size, maxW) {
    if (lines.length !== 2) return lines;
    var words = (lines[0] + " " + lines[1]).split(" "), best = lines, bestDiff = Infinity;
    setFont(ctx, family, size);
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
      var wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
      if (wa > maxW || wb > maxW) continue;
      var diff = Math.abs(wa - wb);
      if (diff < bestDiff) { bestDiff = diff; best = [a, b]; }
    }
    return best;
  }
  // Largest size (down to min) where the text fits in maxLines lines.
  function fitWrapped(ctx, text, family, maxSize, minSize, maxW, maxLines) {
    for (var size = maxSize; size >= minSize; size -= 2) {
      var lines = wrap(ctx, text, family, size, maxW);
      var widest = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; }));
      if (lines.length <= maxLines && widest <= maxW) return { size: size, lines: balance(ctx, lines, family, size, maxW) };
    }
    var l = wrap(ctx, text, family, minSize, maxW);
    return { size: minSize, lines: l };
  }

  // A date line may hold an ordinal ("25TH") drawn as superscript, and an optional "| label".
  function parseDateLine(line) {
    var parts = line.split("|");
    var main = parts[0].trim().toUpperCase();
    var label = parts.length > 1 ? parts.slice(1).join("|").trim() : "";
    var segs = [], re = /(\d)(ST|ND|RD|TH)\b/g, last = 0, m;
    while ((m = re.exec(main))) {
      segs.push({ t: main.slice(last, m.index + 1) });
      segs.push({ t: m[2], sup: true });
      last = m.index + m[0].length;
    }
    segs.push({ t: main.slice(last) });
    return { segs: segs.filter(function (s) { return s.t; }), label: label };
  }
  function measureDate(ctx, d, size) {
    var w = 0;
    d.segs.forEach(function (s) {
      setFont(ctx, DISPLAY, s.sup ? size * 0.5 : size);
      w += ctx.measureText(s.t).width;
    });
    if (d.label) { setFont(ctx, HAND, size * 0.74); w += size * 0.35 + ctx.measureText(d.label).width; }
    return w;
  }

  /* ---------- layout ---------- */
  // Stacks the headline, place, dates and details, shrinking everything
  // together until it fits the space above the meadow.
  function buildLayout(ctx, fmt, U, data, k) {
    var blocks = [], maxW = fmt.maxW * U, sz = fmt.sizes;

    var logoInTitle = fmt === FORMATS.square && data.useLogo && state.logoImg;
    var inline = null;
    if (fmt.inlinePlace && data.headline && data.place) {
      // On 16:9 slides the headline and place share one line when they fit.
      for (var is = Math.round(sz.headline * k * U); is >= Math.round(sz.headline * 0.6 * U); is -= 2) {
        setFont(ctx, DISPLAY, is);
        if (ctx.measureText(data.headline + "  " + data.place).width <= maxW) { inline = is; break; }
      }
    }
    if (inline) {
      blocks.push({ kind: "pair", a: data.headline + "  ", b: data.place, size: inline, lines: [0], lh: inline, gapAfter: 34 * k * U });
    } else if (data.headline) {
      var h = fitWrapped(ctx, data.headline, DISPLAY, Math.round(sz.headline * k * U), Math.round(sz.headline * 0.45 * U), maxW, 2);
      blocks.push({ kind: "text", role: "headline", family: DISPLAY, size: h.size, lines: h.lines, lh: h.size, gapAfter: 26 * k * U });
    }
    if (inline) {
      // already placed with the headline
    } else if (logoInTitle) {
      var img = state.logoImg, boxW = 640 * k * U, boxH = 170 * k * U;
      var sc = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      blocks.push({ kind: "logo", img: img, w: img.naturalWidth * sc, h: img.naturalHeight * sc, gapAfter: 44 * k * U });
    } else if (data.place) {
      var p = fitWrapped(ctx, data.place, DISPLAY, Math.round(sz.place * k * U), Math.round(sz.place * 0.45 * U), maxW, 2);
      blocks.push({ kind: "text", role: "place", family: DISPLAY, size: p.size, lines: p.lines, lh: p.size, gapAfter: 44 * k * U });
    }
    var rawDates = data.dates.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (fmt.joinDates && rawDates.length === 2 && rawDates.join("").indexOf("|") === -1) rawDates = [rawDates.join(", ")];
    var dateLines = rawDates.map(parseDateLine);
    if (dateLines.length) {
      var hasLabels = dateLines.some(function (d) { return d.label; });
      var size = Math.round((hasLabels ? sz.dateLabel : dateLines.length > 2 ? sz.dateMany : sz.date) * k * U);
      dateLines.forEach(function (d) { while (size > 24 * U && measureDate(ctx, d, size) > maxW) size -= 2; });
      blocks.push({ kind: "dates", lines: dateLines, size: size, lh: size * (hasLabels ? 1.15 : 1.04), gapAfter: (fmt.details ? 34 : 22) * k * U });
    }
    if (fmt.details && data.details) {
      var ds = Math.round(fmt.details.size * Math.max(k, 0.75) * U), lines = [];
      data.details.split("\n").forEach(function (para) {
        if (para.trim()) lines = lines.concat(balance(ctx, wrap(ctx, para.trim(), HAND, ds, fmt.details.maxW * U), HAND, ds, fmt.details.maxW * U));
      });
      blocks.push({ kind: "text", role: "details", family: HAND, size: ds, lines: lines, lh: ds * 1.5, gapAfter: 0 });
    }
    if (fmt.small && data.small) {
      var ss = Math.round(22 * Math.max(k, 0.8) * U);
      setFont(ctx, LABEL, ss, 500, "italic");
      while (ss > 14 * U && ctx.measureText(data.small).width > maxW) { ss -= 1; setFont(ctx, LABEL, ss, 500, "italic"); }
      blocks.push({ kind: "small", text: data.small, size: ss, lh: ss * 1.3, gapAfter: 0 });
    }
    var total = 0;
    blocks.forEach(function (b, i) {
      b.height = b.kind === "logo" ? b.h : b.kind === "small" ? b.lh : b.lines.length * b.lh;
      total += b.height + (i < blocks.length - 1 ? b.gapAfter : 0);
    });
    return { blocks: blocks, total: total };
  }

  function layout(ctx, fmt, U, data) {
    var avail = (fmt.bottom - fmt.top) * U, k = 1, lay;
    do { lay = buildLayout(ctx, fmt, U, data, k); k -= 0.04; } while (lay.total > avail && k > 0.45);
    var y = fmt.top * U + Math.max(0, (avail - lay.total) * 0.4);
    lay.blocks.forEach(function (b) { b.y = y; y += b.height + b.gapAfter; });
    return lay;
  }

  /* ---------- drawing ---------- */
  function shadow(ctx, on, U) {
    ctx.shadowColor = on ? "rgba(20, 30, 20, 0.55)" : "transparent";
    ctx.shadowBlur = on ? 18 * U : 0;
    ctx.shadowOffsetY = on ? 3 * U : 0;
  }

  function drawText(ctx, U, cx, lay, colors, glow) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    lay.blocks.forEach(function (b) {
      if (b.kind === "text") {
        ctx.fillStyle = colors[b.role];
        shadow(ctx, glow[b.role], U);
        setFont(ctx, b.family, b.size);
        b.lines.forEach(function (line, i) {
          var w = ctx.measureText(line).width;
          var base = b.role === "details" ? b.y + i * b.lh + b.size * 1.05 : b.y + i * b.lh + b.size * 0.8;
          ctx.fillText(line, cx - w / 2, base);
        });
      } else if (b.kind === "pair") {
        shadow(ctx, false, U);
        setFont(ctx, DISPLAY, b.size);
        var wa = ctx.measureText(b.a).width, wb = ctx.measureText(b.b).width, px = cx - (wa + wb) / 2;
        var pb = b.y + b.size * 0.8;
        ctx.fillStyle = colors.headline; ctx.fillText(b.a, px, pb);
        ctx.fillStyle = colors.place; ctx.fillText(b.b, px + wa, pb);
      } else if (b.kind === "logo") {
        shadow(ctx, false, U);
        ctx.drawImage(b.img, cx - b.w / 2, b.y, b.w, b.h);
      } else if (b.kind === "dates") {
        ctx.fillStyle = colors.dates;
        shadow(ctx, glow.dates, U);
        b.lines.forEach(function (d, i) {
          var x = cx - measureDate(ctx, d, b.size) / 2;
          var base = b.y + i * b.lh + b.size * 0.8;
          d.segs.forEach(function (s) {
            setFont(ctx, DISPLAY, s.sup ? b.size * 0.5 : b.size);
            ctx.fillText(s.t, x, s.sup ? base - b.size * 0.36 : base);
            x += ctx.measureText(s.t).width;
          });
          if (d.label) {
            setFont(ctx, HAND, b.size * 0.74);
            ctx.fillText(d.label, x + b.size * 0.35, base);
          }
        });
      } else if (b.kind === "small") {
        ctx.fillStyle = colors.small;
        shadow(ctx, glow.small, U);
        setFont(ctx, LABEL, b.size, 500, "italic");
        ctx.fillText(b.text, cx - ctx.measureText(b.text).width / 2, b.y + b.size);
      }
    });
    shadow(ctx, false, U);
  }

  function drawBHLogo(ctx, fmt, U) {
    var logo = state.art.logo, L = fmt.bhLogo;
    if (!logo) return;
    var w = L.w * U, h = w * (logo.naturalHeight / logo.naturalWidth);
    if (L.right != null) ctx.drawImage(logo, L.right * U - w, L.top * U, w, h);
    else ctx.drawImage(logo, L.x * U, L.bottom * U - h, w, h);
  }

  // Letters with extra space between them, like the brand's labels.
  function trackedText(ctx, text, cx, y, tracking) {
    var widths = text.split("").map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + tracking * (text.length - 1);
    var x = cx - total / 2;
    text.split("").forEach(function (ch, i) { ctx.fillText(ch, x, y); x += widths[i] + tracking; });
  }

  function qrLabel(url) {
    var m = (url || "").match(/^(?:https?:\/\/)?(?:www\.)?([^\/?#]+)/i);
    return m ? m[1].toUpperCase() : "";
  }

  // Crimson QR box (and the venue logo box under it) in the bottom-left corner.
  function drawQrAndVenue(ctx, fmt, U, data) {
    var Q = fmt.qr, x = Q.x * U, w = Q.w * U, pad = 14 * U, labelH = 24 * U;
    var boxH = w + labelH;
    var hasVenue = !!state.logoImg;
    var bottom = (Q.bottom || 1052) * U;
    var venueX = x, venueY = bottom - w, qrY;
    if (Q.sideBySide) {
      qrY = bottom - boxH;
      venueX = x + w + 14 * U;
      venueY = qrY;
    } else {
      qrY = hasVenue ? venueY - 16 * U - boxH : bottom - boxH;
    }

    if (data.qr) {
      ctx.fillStyle = COLORS.crimson;
      ctx.fillRect(x, qrY, w, boxH);
      try {
        var qr = qrcode(0, "M");
        qr.addData(data.qr);
        qr.make();
        var n = qr.getModuleCount(), cell = (w - pad * 2) / n;
        ctx.fillStyle = COLORS.white;
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect(x + pad + c * cell, qrY + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
        }
      } catch (err) { console.error("QR code", err); }
      var label = qrLabel(data.qr);
      if (label) {
        var ls = 9.5 * U;
        setFont(ctx, LABEL, ls, 600);
        while (ls > 6 * U && ctx.measureText(label).width + label.length * ls * 0.25 > w - 12 * U) { ls -= 0.5 * U; setFont(ctx, LABEL, ls, 600); }
        ctx.fillStyle = COLORS.white;
        trackedText(ctx, label, x + w / 2, qrY + w + labelH * 0.3, ls * 0.25);
      }
    }
    if (hasVenue) {
      var img = state.logoImg;
      ctx.fillStyle = COLORS.white;
      var vh = Q.sideBySide ? boxH : w, vw = Q.sideBySide ? boxH * 1.6 : w;
      ctx.fillRect(venueX, venueY, vw, vh);
      var sc = Math.min((vw - 20 * U) / img.naturalWidth, (vh - 20 * U) / img.naturalHeight);
      var iw = img.naturalWidth * sc, ih = img.naturalHeight * sc;
      ctx.drawImage(img, venueX + (vw - iw) / 2, venueY + (vh - ih) / 2, iw, ih);
    }
  }

  function drawContact(ctx, fmt, U, text) {
    if (!text) return;
    var C = fmt.contact, size = C.size * U, maxW = C.maxW * U;
    setFont(ctx, HAND, size);
    var lines = [text];
    if (ctx.measureText(text).width > maxW) {
      var at = text.indexOf("@");
      lines = at > -1 ? [text.slice(0, at + 1), text.slice(at + 1)] : wrap(ctx, text, HAND, size, maxW);
    }
    while (size > 14 * U && Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) > maxW) {
      size -= U; setFont(ctx, HAND, size);
    }
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = "right";
    shadow(ctx, true, U);
    var lh = size * 1.25, y = C.bottom * U - (lines.length - 1) * lh;
    lines.forEach(function (l, i) { ctx.fillText(l, C.right * U, y + i * lh); });
    shadow(ctx, false, U);
    ctx.textAlign = "left";
  }

  // Returns which directions have room to move (the photo is bigger than the space that way).
  function coverImage(ctx, img, W, H, px, py, zoom) {
    var iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(W / iw, H / ih) * zoom;
    var dw = iw * sc, dh = ih * sc;
    ctx.drawImage(img, (W - dw) * px, (H - dh) * py, dw, dh);
    return { x: dw - W > 2, y: dh - H > 2 };
  }

  function renderOne(sizeKey, variant, data) {
    var fmt = FORMATS[sizeKey], U = fmt.w / fmt.grid, cx = fmt.w / 2;
    var c = canvases[sizeKey + "-" + variant], ctx = c.getContext("2d");
    var art = state.art[sizeKey] || {};
    ctx.clearRect(0, 0, fmt.w, fmt.h);
    var photo = state.uploadedPhoto || state.photoImg;

    if (variant === "photo" && !photo) {
      ctx.fillStyle = "#e8e1d3"; ctx.fillRect(0, 0, fmt.w, fmt.h);
      if (art.overlay) ctx.drawImage(art.overlay, 0, 0, fmt.w, fmt.h);
      ctx.fillStyle = COLORS.crimson; ctx.textAlign = "center";
      setFont(ctx, HAND, 46 * (fmt.w / 1080));
      ctx.fillText("Add a photo in step 3", cx, fmt.h * 0.33);
      ctx.textAlign = "left";
      return false;
    }

    if (variant === "garden") {
      if (art.garden) ctx.drawImage(art.garden, 0, 0, fmt.w, fmt.h);
    } else {
      // The photo fills the space above the meadow; the meadow art covers everything below it.
      var frameH = Math.round(fmt.h * (fmt.photoFrame || 1));
      if (frameH < fmt.h) { ctx.fillStyle = "#3a4a2a"; ctx.fillRect(0, frameH, fmt.w, fmt.h - frameH); }
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, fmt.w, frameH); ctx.clip();
      state.room[sizeKey] = coverImage(ctx, photo, fmt.w, frameH, f.photox.value / 100, f.photoy.value / 100, f.zoom.value / 100);
      ctx.restore();
    }
    var lay = layout(ctx, fmt, U, data);

    if (variant === "photo") {
      // Soft sky fade behind the words so they read on any photo.
      var textEnd = fmt.top * U;
      lay.blocks.forEach(function (b) {
        if (fmt.fadeAll ? b.kind !== "small" : (b.kind !== "dates" && b.kind !== "small" && b.role !== "details")) textEnd = b.y + b.height;
      });
      var fadeEnd = Math.min(textEnd + 150 * U, fmt.h * 0.75);
      var g = ctx.createLinearGradient(0, 0, 0, fadeEnd);
      var tint = fadeColor(), strength = f.fade.value / 100;
      g.addColorStop(0, "rgba(" + tint + "," + (0.95 * strength) + ")");
      g.addColorStop(Math.max(0.05, (textEnd - 30 * U) / fadeEnd), "rgba(" + tint + "," + (0.82 * strength) + ")");
      g.addColorStop(1, "rgba(" + tint + ",0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, fmt.w, fadeEnd);
      if (!fmt.fadeAll) {
        // A soft shadow band behind the white date and details so they read on busy photos.
        var lowBlocks = lay.blocks.filter(function (b) { return b.kind === "dates" || b.kind === "small" || b.role === "details"; });
        if (lowBlocks.length) {
          var y0 = lowBlocks[0].y - 40 * U, last = lowBlocks[lowBlocks.length - 1], y1 = last.y + last.height + 40 * U;
          var band = ctx.createLinearGradient(0, y0, 0, y1);
          band.addColorStop(0, "rgba(20,30,25,0)");
          band.addColorStop(0.25, "rgba(20,30,25,0.32)");
          band.addColorStop(0.75, "rgba(20,30,25,0.32)");
          band.addColorStop(1, "rgba(20,30,25,0)");
          ctx.fillStyle = band; ctx.fillRect(0, y0, fmt.w, y1 - y0);
        }
      }
      if (art.overlay) ctx.drawImage(art.overlay, 0, 0, fmt.w, fmt.h);
      if (fmt.monarch && data.monarch && state.art.monarch) {
        var M = fmt.monarch, mw = M.w * U, mh = mw * state.art.monarch.naturalHeight / state.art.monarch.naturalWidth;
        ctx.drawImage(state.art.monarch, M.x * U, M.y * U, mw, mh);
      }
    }

    drawBHLogo(ctx, fmt, U);
    if (fmt.qr) drawQrAndVenue(ctx, fmt, U, data);
    if (fmt.contact) drawContact(ctx, fmt, U, data.contact);

    // On photo versions of the square and 16:9, the date and details sit on the photo, so they're white.
    var onPhoto = variant === "photo" && !fmt.fadeAll;
    drawText(ctx, U, cx, lay, {
      headline: COLORS.green, place: COLORS.orange,
      details: onPhoto ? COLORS.white : COLORS.ink,
      dates: onPhoto ? COLORS.white : COLORS.crimson,
      small: onPhoto ? COLORS.white : COLORS.crimson
    }, { dates: onPhoto, small: onPhoto, details: onPhoto });
    return true;
  }

  /* ---------- 16:9 photo collage ---------- */
  var slotCanvas = document.createElement("canvas");
  function collagePhoto(i) {
    var c = state.collage;
    return c.uploaded[i] || c.fromEvent[i] || c.samples[i];
  }
  function renderCollage(data) {
    var fmt = FORMATS.wide, U = fmt.w / fmt.grid, cx = fmt.w / 2;
    var ctx = canvases["wide-collage"].getContext("2d");
    ctx.clearRect(0, 0, fmt.w, fmt.h);
    if (state.art.collage) ctx.drawImage(state.art.collage, 0, 0, fmt.w, fmt.h);
    var mask = state.art.collageMask;
    COLLAGE_SLOTS.forEach(function (box, i) {
      var img = collagePhoto(i);
      if (!img || !mask) return;
      // Fill the shape's box with the photo, then keep only the white shape (butterflies stay on top).
      slotCanvas.width = box[2]; slotCanvas.height = box[3];
      var sctx = slotCanvas.getContext("2d");
      sctx.globalCompositeOperation = "source-over";
      sctx.clearRect(0, 0, box[2], box[3]);
      var sc = Math.max(box[2] / img.naturalWidth, box[3] / img.naturalHeight);
      var dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      sctx.drawImage(img, (box[2] - dw) / 2, (box[3] - dh) * 0.35, dw, dh);
      sctx.globalCompositeOperation = "destination-in";
      sctx.drawImage(mask, box[0], box[1], box[2], box[3], 0, 0, box[2], box[3]);
      ctx.drawImage(slotCanvas, box[0], box[1]);
    });
    // Title and subtitle across the top.
    var maxW = 1180 * U;
    if (data.ctitle) {
      var ts = 64 * U;
      setFont(ctx, DISPLAY, ts);
      var tw = ctx.measureText(data.ctitle).width;
      if (tw > maxW) { ts = Math.floor(ts * maxW / tw); setFont(ctx, DISPLAY, ts); }
      ctx.fillStyle = COLORS.crimson; ctx.textAlign = "center";
      ctx.fillText(data.ctitle, cx, 22 * U + 64 * U * 0.8 - (64 * U - ts) * 0.4);
    }
    if (data.csub) {
      var ss = 30 * U;
      setFont(ctx, HAND, ss);
      while (ss > 16 * U && ctx.measureText(data.csub).width > 900 * U) { ss -= U; setFont(ctx, HAND, ss); }
      ctx.fillStyle = "#111111"; ctx.textAlign = "center";
      ctx.fillText(data.csub, cx, 112 * U);
    }
    ctx.textAlign = "left";
  }

  function collageDefaults(d) {
    var lines = d.dates.split("\n").map(function (l) { return l.split("|")[0].trim(); }).filter(Boolean);
    var sub = lines.length === 2 && d.dates.indexOf("|") === -1 ? lines.join(", ") : lines.join(" & ");
    return { title: (d.headline + " " + d.place).trim(), sub: sub };
  }

  function names(keys) {
    var n = keys.map(function (k) { return { square: "square", letter: "letter", wide: "16:9" }[k]; });
    var list = n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n[n.length - 1] : n[0];
    return list + (n.length > 1 ? " versions" : " version");
  }

  var queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var data = {
        headline: f.headline.value.trim(), place: f.place.value.trim(), useLogo: f.uselogo.checked,
        dates: f.dates.value, details: f.details.value, contact: f.contact.value.trim(),
        qr: f.qr.value.trim(), small: f.small.value.trim(), monarch: f.monarch.checked,
        ctitle: f.ctitle.value.trim(), csub: f.csub.value.trim()
      };
      var any = state.selected.length > 0;
      ["square", "letter", "wide"].forEach(function (size) {
        ["garden", "photo"].forEach(function (variant) {
          var ok = renderOne(size, variant, data);
          document.querySelector('[data-download="' + size + "-" + variant + '"]').disabled = !any || !ok;
        });
      });
      renderCollage(data);
      // Explain when a slider can't move the photo because it already fits that way.
      var r = state.room, hint = $("photo-hint"), msgs = [];
      if (state.uploadedPhoto || state.photoImg) {
        var noY = ["square", "letter", "wide"].filter(function (k) { return r[k] && !r[k].y; });
        var noX = ["square", "letter", "wide"].filter(function (k) { return r[k] && !r[k].x; });
        if (noY.length) msgs.push("Up / down can't move the " + names(noY) + " because the whole photo already fits top to bottom. Zoom in a little first.");
        if (noX.length) msgs.push("Left / right can't move the " + names(noX) + " because the whole photo already fits side to side. Zoom in a little first.");
      }
      hint.textContent = msgs.join(" ");
      hint.hidden = !msgs.length;
      document.querySelector('[data-download="wide-collage"]').disabled = !any;
    });
  }

  /* ---------- event list & selection ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function renderEventList() {
    var box = $("events");
    var now = new Date();
    var upcoming = state.events.filter(function (ev) { return ev.endsAt >= now; });
    if (!upcoming.length) { box.innerHTML = '<p class="hint">No upcoming events yet. Add one with the event form.</p>'; return; }
    box.innerHTML = upcoming.map(function (ev) {
      var date = DOW[ev.day.getDay()] + ", " + MON[ev.day.getMonth()] + " " + ev.day.getDate() + (ev.startMin != null ? ", " + fmtTime(ev.startMin) : "");
      return '<label class="ev"><input type="checkbox" value="' + ev.id + '">' +
        '<span><span class="ev__date">' + esc(date) + '</span><span class="ev__title">' + esc(ev.title) + "</span></span></label>";
    }).join("");
    box.addEventListener("change", onSelect);
    var first = box.querySelector("input");
    if (first) { first.checked = true; onSelect(); }
  }

  function resetPhotoPosition() { f.photox.value = 50; f.photoy.value = 50; f.zoom.value = 100; }

  function onSelect() {
    var ids = Array.prototype.map.call($("events").querySelectorAll("input:checked"), function (i) { return i.value; });
    state.selected = state.events.filter(function (ev) { return ids.indexOf(ev.id) > -1; });
    if (!state.selected.length) { render(); return; }
    var d = defaultsFor(state.selected);
    f.headline.value = d.headline;
    f.place.value = d.place;
    f.dates.value = d.dates;
    f.dates.rows = Math.max(2, d.dates.split("\n").length);
    f.details.value = d.details;
    f.details.rows = Math.max(2, d.details.split("\n").length);
    f.qr.value = d.qr;
    var cd = collageDefaults(d);
    f.ctitle.value = cd.title;
    f.csub.value = cd.sub;

    var logoUrl = (state.selected.find(function (ev) { return ev.logo; }) || {}).logo;
    state.logoImg = null;
    setStatus("logo", "");
    f.uselogo.checked = false;
    if (logoUrl) {
      setStatus("logo", "Loading the venue logo…");
      loadFirst(BHData.imageCandidates(logoUrl)).then(function (img) {
        if (img) { state.logoImg = img; f.uselogo.checked = true; setStatus("logo", "Using the venue logo from the form. Drop a different one here to replace it.", true); }
        else setStatus("logo", "The venue logo link from the form didn't load. Drop the logo file here instead.");
        render();
      });
    }

    var withPhotos = state.selected.find(function (ev) { return ev.photos.length; });
    var photos = withPhotos ? withPhotos.photos : [];
    f.photo.innerHTML = photos.map(function (p, i) { return '<option value="' + i + '">Photo ' + (i + 1) + " from the form</option>"; }).join("");
    $("photo-pick-wrap").hidden = photos.length < 2;
    state.photoImg = null;
    state.uploadedPhoto = null;
    resetPhotoPosition();
    setStatus("photo", "");
    if (photos.length) loadPhoto(photos, 0);

    // The collage uses the event's own photos when it has two or more; otherwise the sample photos.
    state.collage.fromEvent = [null, null, null];
    state.collage.uploaded = [null, null, null];
    [0, 1, 2].forEach(function (i) { setSlotStatus(i); });
    if (photos.length >= 2) {
      photos.slice(0, 3).forEach(function (url, i) {
        loadFirst(BHData.imageCandidates(url)).then(function (img) {
          state.collage.fromEvent[i] = img;
          setSlotStatus(i);
          render();
        });
      });
    }
    render();
  }

  function setSlotStatus(i) {
    var c = state.collage, el = $("slot" + (i + 1) + "-status"), drop = $("slot" + (i + 1) + "-drop");
    var src = c.uploaded[i] ? c.uploaded[i].fileName : c.fromEvent[i] ? "Photo " + (i + 1) + " from the form" : "Sample photo";
    el.textContent = "Photo " + (i + 1) + ": " + src + ". Drop or click to replace.";
    drop.classList.toggle("is-set", !!(c.uploaded[i] || c.fromEvent[i]));
  }

  function loadPhoto(photos, i) {
    setStatus("photo", "Loading the photo from the form…");
    loadFirst(BHData.imageCandidates(photos[i])).then(function (img) {
      state.photoImg = img;
      if (img) setStatus("photo", "Using photo " + (i + 1) + " from the form. Drop a different one here to replace it.", true);
      else setStatus("photo", "That photo link didn't load (it may not be shared publicly). Drop the photo file here instead.");
      render();
    });
  }

  function setStatus(which, text, ok) {
    var el = $(which + "-status"), drop = $(which + "-drop");
    el.textContent = text || (which === "logo"
      ? "Drop a logo here, or click to choose one. PNG with a see-through background works best."
      : "Drop a photo here, or click to choose one.");
    drop.classList.toggle("is-set", !!ok);
  }

  /* ---------- uploads ---------- */
  function wireDrop(which, input, onFile) {
    var drop = $(which + "-drop");
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove("is-over"); }); });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      var file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) onFile(file);
    });
    input.addEventListener("change", function () {
      if (input.files[0]) onFile(input.files[0]);
      input.value = ""; // so choosing the same file again still works
    });
  }
  wireDrop("logo", f.logo, function (file) {
    loadFile(file).then(function (img) {
      if (!img) { setStatus("logo", "That file couldn't be opened. Try a PNG or JPG."); return; }
      state.logoImg = img; f.uselogo.checked = true;
      setStatus("logo", "Using " + file.name + ".", true);
      render();
    });
  });
  wireDrop("photo", f.photofile, function (file) {
    loadFile(file).then(function (img) {
      if (!img) { setStatus("photo", "That file couldn't be opened. Try a JPG or PNG."); return; }
      state.uploadedPhoto = img;
      resetPhotoPosition();
      setStatus("photo", "Using " + file.name + ".", true);
      render();
    });
  });

  [0, 1, 2].forEach(function (i) {
    wireDrop("slot" + (i + 1), $("f-slot" + (i + 1)), function (file) {
      loadFile(file).then(function (img) {
        if (!img) return;
        img.fileName = file.name;
        state.collage.uploaded[i] = img;
        setSlotStatus(i);
        render();
      });
    });
  });
  $("collage-reset").addEventListener("click", function () {
    state.collage.uploaded = [null, null, null];
    [0, 1, 2].forEach(function (i) { setSlotStatus(i); });
    render();
  });

  f.photo.addEventListener("change", function () {
    var withPhotos = state.selected.find(function (ev) { return ev.photos.length; });
    state.uploadedPhoto = null;
    resetPhotoPosition();
    if (withPhotos) loadPhoto(withPhotos.photos, +f.photo.value);
  });
  document.querySelectorAll("[data-fade]").forEach(function (b) {
    b.addEventListener("click", function () { f.fadecolor.value = b.getAttribute("data-fade"); render(); });
  });
  $("photo-reset").addEventListener("click", function () { resetPhotoPosition(); render(); });
  [f.headline, f.place, f.dates, f.details, f.contact, f.qr, f.small, f.photox, f.photoy, f.zoom, f.ctitle, f.csub, f.fade, f.fadecolor].forEach(function (el) { el.addEventListener("input", render); });
  [f.uselogo, f.monarch].forEach(function (el) { el.addEventListener("change", render); });

  /* ---------- download ---------- */
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  document.querySelectorAll("[data-download]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var which = btn.getAttribute("data-download");
      var ev = state.selected[0];
      var name = "bee-highways-" + (ev ? ev.day.getFullYear() + "-" + String(ev.day.getMonth() + 1).padStart(2, "0") + "-" + String(ev.day.getDate()).padStart(2, "0") + "-" + slug(f.place.value || ev.title) : "flyer") + "-" + which + ".png";
      try {
        canvases[which].toBlob(function (blob) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        }, "image/png");
      } catch (err) {
        console.error(err);
        notice("This flyer couldn't be downloaded because one of its images is blocked by the site it's hosted on. Drop that image into the page as a file and try again.");
      }
    });
  });

  function notice(text) { var n = $("notice"); n.textContent = text; n.hidden = !text; }

  /* ---------- start ---------- */
  f.small.value = DEFAULT_SMALL;
  f.contact.value = CONFIG.flyerContact || "";
  var fontsReady = Promise.all([
    document.fonts.load("40px \"A Love of Thunder\""),
    document.fonts.load("40px \"Architects Daughter\""),
    document.fonts.load("italic 500 20px Montserrat"),
    document.fonts.load("600 20px Montserrat")
  ]).catch(function () {});
  var artReady = Promise.all([
    loadOne(FORMATS.square.art.garden).then(function (i) { state.art.square = state.art.square || {}; state.art.square.garden = i; }),
    loadOne(FORMATS.square.art.overlay).then(function (i) { state.art.square = state.art.square || {}; state.art.square.overlay = i; }),
    loadOne(FORMATS.letter.art.garden).then(function (i) { state.art.letter = state.art.letter || {}; state.art.letter.garden = i; }),
    loadOne(FORMATS.letter.art.overlay).then(function (i) { state.art.letter = state.art.letter || {}; state.art.letter.overlay = i; }),
    loadOne("assets/flyers/logo-pollinator-parties-white.svg").then(function (i) { state.art.logo = i; }),
    loadOne("assets/flyers/monarch-perched.png").then(function (i) { state.art.monarch = i; }),
    loadOne(FORMATS.wide.art.garden).then(function (i) { state.art.wide = state.art.wide || {}; state.art.wide.garden = i; }),
    loadOne(FORMATS.wide.art.overlay).then(function (i) { state.art.wide = state.art.wide || {}; state.art.wide.overlay = i; }),
    loadOne("assets/flyers/wide-collage.jpg").then(function (i) { state.art.collage = i; }),
    loadOne("assets/flyers/wide-collage-mask.png").then(function (i) { state.art.collageMask = i; }),
    Promise.all(COLLAGE_SAMPLES.map(function (u) { return loadOne(u); })).then(function (imgs) { state.collage.samples = imgs; })
  ]);
  Promise.all([fontsReady, artReady, BHData.loadEvents()])
    .then(function (res) {
      state.events = res[2];
      if (BHData.usingSample) notice("Showing sample events. Add your sheet link in config.js to use the real ones.");
      renderEventList();
      render();
    })
    .catch(function (err) {
      console.error("[Bee Highways flyers]", err);
      $("events").innerHTML = '<p class="hint">The events didn\'t load. Check the sheet link in config.js, then refresh.</p>';
    });
})();
