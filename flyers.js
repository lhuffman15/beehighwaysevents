/* ============================================================
   Bee Highways — Flyer Maker (square social)
   Draws flyers on a canvas from the event sheet, using the
   Bee Highways fonts, colors and painted meadow.
   ============================================================ */
(function () {
  "use strict";

  var S = 2160;          // canvas size in pixels
  var U = S / 1080;      // layout is designed on a 1080 grid
  var CX = 540;          // horizontal center
  var COLORS = { green: "#495c2d", orange: "#b56a40", crimson: "#981940", white: "#ffffff" };
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
    dates: $("f-dates"), small: $("f-small"), photo: $("f-photo"), photofile: $("f-photofile"), photopos: $("f-photopos")
  };
  var canvases = { garden: $("c-garden"), photo: $("c-photo") };

  var state = { events: [], selected: [], logoImg: null, photoImg: null, uploadedPhoto: null, art: {} };

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
        return ev.type ? line + " | " + shortType(ev.type) : line;
      });
    }
    return { headline: headline, place: place, dates: dates.join("\n") };
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
  var REGION_TOP = 52, REGION_BOTTOM = 620, MAX_W = 920;

  function buildLayout(ctx, data, k) {
    var blocks = [];
    var maxW = MAX_W * U;

    if (data.headline) {
      var h = fitWrapped(ctx, data.headline, DISPLAY, Math.round(90 * k * U), Math.round(40 * U), maxW, 2);
      blocks.push({ kind: "text", role: "headline", family: DISPLAY, size: h.size, lines: h.lines, lh: h.size * 1.0, gapAfter: 26 * k * U });
    }
    if (data.useLogo && state.logoImg) {
      var img = state.logoImg, boxW = 640 * k * U, boxH = 170 * k * U;
      var sc = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      blocks.push({ kind: "logo", img: img, w: img.naturalWidth * sc, h: img.naturalHeight * sc, gapAfter: 44 * k * U });
    } else if (data.place) {
      var p = fitWrapped(ctx, data.place, DISPLAY, Math.round(78 * k * U), Math.round(36 * U), maxW, 2);
      blocks.push({ kind: "text", role: "place", family: DISPLAY, size: p.size, lines: p.lines, lh: p.size * 1.0, gapAfter: 44 * k * U });
    }
    var dateLines = data.dates.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(parseDateLine);
    if (dateLines.length) {
      var hasLabels = dateLines.some(function (d) { return d.label; });
      var size = Math.round((hasLabels ? 84 : dateLines.length > 2 ? 86 : 112) * k * U);
      dateLines.forEach(function (d) {
        while (size > 30 * U && measureDate(ctx, d, size) > maxW) size -= 2;
      });
      blocks.push({ kind: "dates", lines: dateLines, size: size, lh: size * (hasLabels ? 1.12 : 1.04), gapAfter: 22 * k * U });
    }
    if (data.small) {
      var ss = Math.round(22 * Math.max(k, 0.8) * U);
      setFont(ctx, LABEL, ss, 500, "italic");
      while (ss > 14 * U && ctx.measureText(data.small).width > maxW) { ss -= 1; setFont(ctx, LABEL, ss, 500, "italic"); }
      blocks.push({ kind: "small", text: data.small, size: ss, lh: ss * 1.3, gapAfter: 0 });
    }
    var total = 0;
    blocks.forEach(function (b, i) {
      b.height = b.kind === "logo" ? b.h : b.kind === "small" ? b.lh : (b.lines.length * b.lh);
      total += b.height + (i < blocks.length - 1 ? b.gapAfter : 0);
    });
    return { blocks: blocks, total: total };
  }

  function layout(ctx, data) {
    var avail = (REGION_BOTTOM - REGION_TOP) * U, k = 1, lay;
    do { lay = buildLayout(ctx, data, k); k -= 0.04; } while (lay.total > avail && k > 0.45);
    // Sit a little above center, the way the hand-made flyers do.
    var y = REGION_TOP * U + Math.max(0, (avail - lay.total) * 0.4);
    lay.blocks.forEach(function (b) { b.y = y; y += b.height + b.gapAfter; });
    return lay;
  }

  /* ---------- drawing ---------- */
  function shadow(ctx, on) {
    ctx.shadowColor = on ? "rgba(20, 30, 20, 0.55)" : "transparent";
    ctx.shadowBlur = on ? 18 * U : 0;
    ctx.shadowOffsetY = on ? 3 * U : 0;
  }

  function drawText(ctx, lay, colors, glow) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    lay.blocks.forEach(function (b) {
      if (b.kind === "text") {
        ctx.fillStyle = colors[b.role];
        shadow(ctx, glow[b.role]);
        setFont(ctx, b.family, b.size);
        b.lines.forEach(function (line, i) {
          var w = ctx.measureText(line).width;
          ctx.fillText(line, CX * U - w / 2, b.y + i * b.lh + b.size * 0.8);
        });
      } else if (b.kind === "logo") {
        shadow(ctx, false);
        ctx.drawImage(b.img, CX * U - b.w / 2, b.y, b.w, b.h);
      } else if (b.kind === "dates") {
        ctx.fillStyle = colors.dates;
        shadow(ctx, glow.dates);
        b.lines.forEach(function (d, i) {
          var x = CX * U - measureDate(ctx, d, b.size) / 2;
          var base = b.y + i * b.lh + b.size * 0.8;
          d.segs.forEach(function (s) {
            var sz = s.sup ? b.size * 0.5 : b.size;
            setFont(ctx, DISPLAY, sz);
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
        shadow(ctx, glow.small);
        setFont(ctx, LABEL, b.size, 500, "italic");
        var sw = ctx.measureText(b.text).width;
        ctx.fillText(b.text, CX * U - sw / 2, b.y + b.size);
      }
    });
    shadow(ctx, false);
  }

  function drawLogo(ctx) {
    var logo = state.art.logo;
    if (!logo) return;
    var w = 196 * U, h = w * (logo.naturalHeight / logo.naturalWidth);
    ctx.drawImage(logo, 54 * U, 1029 * U - h, w, h);
  }

  function coverImage(ctx, img, pos) {
    var iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(S / iw, S / ih);
    var dw = iw * sc, dh = ih * sc, t = pos / 100;
    ctx.drawImage(img, (S - dw) * t, (S - dh) * t, dw, dh);
  }

  function renderGarden(data) {
    var c = canvases.garden, ctx = c.getContext("2d");
    ctx.clearRect(0, 0, S, S);
    if (state.art.garden) ctx.drawImage(state.art.garden, 0, 0, S, S);
    drawLogo(ctx);
    var lay = layout(ctx, data);
    drawText(ctx, lay,
      { headline: COLORS.green, place: COLORS.orange, dates: COLORS.crimson, small: COLORS.crimson },
      {});
  }

  function renderPhoto(data) {
    var c = canvases.photo, ctx = c.getContext("2d");
    ctx.clearRect(0, 0, S, S);
    var photo = state.uploadedPhoto || state.photoImg;
    if (!photo) {
      ctx.fillStyle = "#e8e1d3"; ctx.fillRect(0, 0, S, S);
      if (state.art.overlay) ctx.drawImage(state.art.overlay, 0, 0, S, S);
      ctx.fillStyle = COLORS.crimson; ctx.textAlign = "center";
      setFont(ctx, HAND, 46 * U);
      ctx.fillText("Add a photo in step 3", CX * U, 380 * U);
      ctx.textAlign = "left";
      return false;
    }
    coverImage(ctx, photo, +f.photopos.value);
    var lay = layout(ctx, data);
    // Soft sky fade behind the headline and place so they read on any photo.
    var titleEnd = REGION_TOP * U;
    lay.blocks.forEach(function (b) { if (b.kind !== "dates" && b.kind !== "small") titleEnd = b.y + b.height; });
    var fadeEnd = Math.min(titleEnd + 150 * U, S * 0.7);
    var g = ctx.createLinearGradient(0, 0, 0, fadeEnd);
    g.addColorStop(0, "rgba(" + SKY + ",0.95)");
    g.addColorStop(Math.max(0.05, (titleEnd - 30 * U) / fadeEnd), "rgba(" + SKY + ",0.8)");
    g.addColorStop(1, "rgba(" + SKY + ",0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, fadeEnd);
    if (state.art.overlay) ctx.drawImage(state.art.overlay, 0, 0, S, S);
    drawLogo(ctx);
    drawText(ctx, lay,
      { headline: COLORS.green, place: COLORS.orange, dates: COLORS.white, small: COLORS.white },
      { dates: true, small: true });
    return true;
  }

  var queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var data = {
        headline: f.headline.value.trim(),
        place: f.place.value.trim(),
        useLogo: f.uselogo.checked,
        dates: f.dates.value,
        small: f.small.value.trim()
      };
      var any = state.selected.length > 0;
      renderGarden(data);
      var hasPhoto = renderPhoto(data);
      document.querySelector('[data-download="garden"]').disabled = !any;
      document.querySelector('[data-download="photo"]').disabled = !any || !hasPhoto;
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

  function onSelect() {
    var ids = Array.prototype.map.call($("events").querySelectorAll("input:checked"), function (i) { return i.value; });
    state.selected = state.events.filter(function (ev) { return ids.indexOf(ev.id) > -1; });
    if (!state.selected.length) { render(); return; }
    var d = defaultsFor(state.selected);
    f.headline.value = d.headline;
    f.place.value = d.place;
    f.dates.value = d.dates;
    f.dates.rows = Math.max(2, d.dates.split("\n").length);

    // Venue logo from the sheet, if there is one.
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

    // Photo choices come from the first selected event that has photos.
    var withPhotos = state.selected.find(function (ev) { return ev.photos.length; });
    var photos = withPhotos ? withPhotos.photos : [];
    f.photo.innerHTML = photos.map(function (p, i) { return '<option value="' + i + '">Photo ' + (i + 1) + " from the form</option>"; }).join("");
    $("photo-pick-wrap").hidden = photos.length < 2;
    state.photoImg = null;
    state.uploadedPhoto = null;
    f.photopos.value = 50;
    setStatus("photo", "");
    if (photos.length) loadPhoto(photos, 0);
    render();
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
      setStatus("photo", "Using " + file.name + ".", true);
      render();
    });
  });

  f.photo.addEventListener("change", function () {
    var withPhotos = state.selected.find(function (ev) { return ev.photos.length; });
    state.uploadedPhoto = null;
    if (withPhotos) loadPhoto(withPhotos.photos, +f.photo.value);
  });
  [f.headline, f.place, f.dates, f.small, f.photopos].forEach(function (el) { el.addEventListener("input", render); });
  f.uselogo.addEventListener("change", render);

  /* ---------- download ---------- */
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40); }
  document.querySelectorAll("[data-download]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var which = btn.getAttribute("data-download");
      var ev = state.selected[0];
      var name = "bee-highways-" + (ev ? ev.day.getFullYear() + "-" + String(ev.day.getMonth() + 1).padStart(2, "0") + "-" + String(ev.day.getDate()).padStart(2, "0") + "-" + slug(f.place.value || ev.title) : "flyer") + "-square-" + which + ".png";
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
  var fontsReady = Promise.all([
    document.fonts.load("40px \"A Love of Thunder\""),
    document.fonts.load("40px \"Architects Daughter\""),
    document.fonts.load("italic 500 20px Montserrat")
  ]).catch(function () {});
  var artReady = Promise.all([
    loadOne("assets/flyers/square-garden.jpg").then(function (i) { state.art.garden = i; }),
    loadOne("assets/flyers/square-meadow-overlay.webp").then(function (i) { state.art.overlay = i; }),
    loadOne("assets/flyers/logo-pollinator-parties-white.svg").then(function (i) { state.art.logo = i; })
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
