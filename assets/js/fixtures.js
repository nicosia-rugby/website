/* Nicosia Rugby Club — fixtures from Google Calendar.
   One shared script for EN and GR pages. Google Calendar is the only source of games.
   Markup hooks (see index.html and events.html):
     [data-fixtures="next"]    homepage: next games as cards (data-count = how many)
     [data-fixtures="season"]  events page: upcoming games as rows, grouped by month
     [data-fixtures-past]      events page: section for past games (stays hidden if none)
     [data-fixtures-subscribe] "Add to Google Calendar" link (href set from CAL_ID)
   Language comes from <html lang>. Vanilla JS, no build step. */
(function () {
  "use strict";

  /* ---------- Config ---------- */
  var CAL_ID = "c_f53db125d62c076aa25edcbc4182f3c4c035934b5eeec58315bb278a544a8b0b@group.calendar.google.com";
  var API_KEY = "AIzaSyCZc2zCHYsx0ekIIkN-2AKaGhTjhyWpjtw"; // browser key: Calendar API only, nicosiarugby.com/* referrer
  var TIME_ZONE = "Europe/Nicosia";
  var SEASON_START = "2026-09-01T00:00:00+03:00";
  var SEASON_END = "2027-07-01T00:00:00+03:00";   // exclusive: includes 30 June 2027
  var CACHE_MINUTES = 10;
  var DEFAULT_COUNT = 3;

  var TEXT = {
    en: {
      locale: "en-GB",
      loading: "Loading games…",
      empty: "No games scheduled yet.",
      errorStart: "Games could not be loaded. See them in ",
      errorCalendar: "Google Calendar",
      errorMiddle: " or ",
      errorWhatsapp: "message us on WhatsApp",
      errorEnd: ".",
      kickoff: "Kick-off",
      venue: "Venue",
      newTab: " (opens in a new tab)"
    },
    el: {
      locale: "el-GR",
      loading: "Φόρτωση αγώνων…",
      empty: "Δεν υπάρχουν προγραμματισμένοι αγώνες.",
      errorStart: "Δεν φορτώθηκε το πρόγραμμα. Δες το στο ",
      errorCalendar: "Google Calendar",
      errorMiddle: " ή ",
      errorWhatsapp: "στείλε μας μήνυμα στο WhatsApp",
      errorEnd: ".",
      kickoff: "Έναρξη",
      venue: "Γήπεδο",
      newTab: " (ανοίγει σε νέα καρτέλα)"
    }
  };

  /* ---------- Rugby format (colours only) ----------
     Set in the Calendar event description with one line, e.g.  label: touch
     Key and value are case-insensitive; spaces around them are ignored. The line is never shown.
     Each value maps to a CSS class (.fixture--*) that sets the card / row colours.
     To add a format: add an entry here and a .fixture--<class> rule in styles.css. */
  var FORMATS = {
    "touch": "touch",
    "15s": "15s",
    "7s": "7s"
  };
  // Fallback when there is no valid label line: explicit words in the title only. Never 15s.
  var TITLE_FORMATS = [
    { pattern: /touch/i, format: "touch" },
    { pattern: /\b(7s|sevens)\b/i, format: "7s" }
  ];

  // Calendar descriptions can be plain text or HTML: read as plain-text lines, never rendered.
  function descriptionLines(description) {
    if (!description) return [];
    var html = String(description).replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, "\n");
    var text = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
    return text.replace(/\u00A0/g, " ").split("\n");
  }

  function getFormat(event) {
    var lines = descriptionLines(event.description);
    for (var i = 0; i < lines.length; i++) {
      var m = /^\s*label\s*:\s*(.*?)\s*$/i.exec(lines[i]);
      if (m && FORMATS.hasOwnProperty(m[1].toLowerCase())) return { format: FORMATS[m[1].toLowerCase()], by: "label" };
    }
    var title = event.summary || "";
    for (var j = 0; j < TITLE_FORMATS.length; j++) {
      if (TITLE_FORMATS[j].pattern.test(title)) return { format: TITLE_FORMATS[j].format, by: "title" };
    }
    return null;
  }

  function formatClass(game) {
    var f = getFormat(game.raw);
    return f ? " fixture--" + f.format : "";
  }

  /* ---------- Title display ----------
     Display only; the Calendar title is not changed:
     a line break after every ":", and each "|" becomes a line break. */
  function titleNode(tag, title) {
    var node = el(tag);
    var parts = String(title).replace(/:/g, ":\n").split(/\||\n/);
    var first = true;
    parts.forEach(function (part) {
      part = part.trim();
      if (!part) return;
      if (!first) node.appendChild(document.createElement("br"));
      node.appendChild(document.createTextNode(part));
      first = false;
    });
    return node;
  }

  /* ---------- Venue ----------
     Calendar "location" is one free-text string ("Name, Plus Code, area, postcode, country").
     Cards show its first segment only when it looks like a name: not a Plus Code,
     not starting with a number (street number / postcode). Otherwise no venue is shown. */
  var PLUS_CODE = /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/i;

  function venueName(location) {
    var first = String(location || "").split(",")[0].trim();
    if (!first || PLUS_CODE.test(first) || /^\d/.test(first) || /^https?:/i.test(first)) return "";
    return first;
  }

  /* Google Maps link for a Calendar location (homepage and events page).
     A Google Maps URL is used as is; plain text becomes a Maps search
     (official Maps URLs format, full location string, so the pin is exact).
     Any other URL (e.g. a video call) gets no link. */
  function mapsUrl(location) {
    var loc = String(location || "").trim();
    if (!loc) return "";
    if (/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)\//i.test(loc)) return loc;
    if (/^[a-z]+:\/\//i.test(loc)) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(loc);
  }

  // Venue text, linked to Google Maps when possible.
  function venueNode(tag, className, text, location) {
    var node = el(tag, className);
    var url = mapsUrl(location);
    if (url) node.appendChild(externalLink(url, text));
    else node.textContent = text;
    return node;
  }

  /* ---------- Setup ---------- */
  var LANG = (document.documentElement.lang || "en").slice(0, 2) === "el" ? "el" : "en";
  var T = TEXT[LANG];
  var SUBSCRIBE_URL = "https://calendar.google.com/calendar/u/0/r?cid=" + encodeURIComponent(CAL_ID);
  var VIEW_URL = "https://calendar.google.com/calendar/embed?src=" + encodeURIComponent(CAL_ID) + "&ctz=" + encodeURIComponent(TIME_ZONE) + "&mode=AGENDA";

  document.querySelectorAll("[data-fixtures-subscribe]").forEach(function (a) { a.href = SUBSCRIBE_URL; });

  var targets = document.querySelectorAll("[data-fixtures]");
  if (!targets.length) return;

  var fmtDate = new Intl.DateTimeFormat(T.locale, LANG === "el"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE }
    : { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
  var fmtMonth = new Intl.DateTimeFormat(T.locale, { month: "long", year: "numeric", timeZone: TIME_ZONE });
  var fmtTime = new Intl.DateTimeFormat(T.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });
  var fmtKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function externalLink(href, label) {
    var a = el("a", null, label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(el("span", "visually-hidden", T.newTab));
    return a;
  }

  function parts(fmt, date) {
    var out = {};
    fmt.formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  // "Sat 7 Nov 2026" / "Σάββατο 7 Νοεμβρίου 2026", same as the existing pages.
  function dateText(date) {
    var p = parts(fmtDate, date);
    return p.weekday + " " + p.day + " " + p.month + " " + p.year;
  }

  // "YYYY-MM-DD HH:MM" in Cyprus time: used for sorting, grouping and past/upcoming.
  function localKey(date) {
    var p = parts(fmtKey, date);
    return p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute;
  }

  // Normalise one Calendar event. All-day events have no kick-off time.
  function toGame(item, index) {
    var start = item.start || {};
    var end = item.end || {};
    var allDay = !start.dateTime && !!start.date;
    // Noon UTC keeps an all-day date on the same calendar day in Cyprus.
    var date = allDay ? new Date(start.date + "T12:00:00Z") : new Date(start.dateTime);
    if (isNaN(date)) return null;
    var endKey;
    if (allDay) endKey = (end.date || start.date) + " 00:00";          // end.date is exclusive
    else endKey = end.dateTime ? localKey(new Date(end.dateTime)) : localKey(date);
    return {
      raw: item,
      index: index,
      title: item.summary || "",
      venue: item.location || "",
      date: date,
      isoDate: allDay ? start.date : start.dateTime,
      time: allDay ? "" : fmtTime.format(date),
      key: allDay ? start.date + " 00:00" : localKey(date),
      endKey: endKey,
      monthKey: (allDay ? start.date : localKey(date)).slice(0, 7)
    };
  }

  /* ---------- Fetch (one request per page, cached 10 minutes) ---------- */
  var CACHE_KEY = "nrc-fixtures:" + CAL_ID + ":" + SEASON_START + ":" + SEASON_END;
  var request = null;

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && Array.isArray(c.items) && Date.now() - c.time < CACHE_MINUTES * 60000) return c.items;
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function writeCache(items) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), items: items })); } catch (e) { /* ignore */ }
  }

  function fetchPage(pageToken, items) {
    var params = new URLSearchParams({
      key: API_KEY,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeMin: SEASON_START,
      timeMax: SEASON_END,
      timeZone: TIME_ZONE
    });
    if (pageToken) params.set("pageToken", pageToken);
    var url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(CAL_ID) + "/events?" + params;
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("Calendar API " + res.status);
      return res.json();
    }).then(function (data) {
      items = items.concat(Array.isArray(data.items) ? data.items : []);
      return data.nextPageToken ? fetchPage(data.nextPageToken, items) : items;
    });
  }

  function loadGames() {
    if (!request) {
      var cached = readCache();
      request = cached ? Promise.resolve(cached) : fetchPage(null, []).then(function (items) {
        items = items.filter(function (i) { return i.status !== "cancelled"; });
        writeCache(items);
        return items;
      });
    }
    return request.then(function (items) {
      var games = items.map(toGame).filter(Boolean);
      // Chronological; identical start times keep Calendar order.
      games.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index; });
      return games;
    });
  }

  /* ---------- States ---------- */
  function setStatus(box, nodes, boxed) {
    box.textContent = "";
    box.className = boxed ? "empty-state" : "";
    var p = el("p");
    nodes.forEach(function (n) { p.appendChild(typeof n === "string" ? document.createTextNode(n) : n); });
    box.appendChild(p);
    box.hidden = false;
  }

  function errorNodes() {
    var wa = document.querySelector('#contact a[href^="https://wa.me/"], a[href^="https://wa.me/"]');
    var nodes = [T.errorStart, externalLink(VIEW_URL, T.errorCalendar)];
    if (wa) nodes.push(T.errorMiddle, externalLink(wa.href, T.errorWhatsapp));
    nodes.push(T.errorEnd);
    return nodes;
  }

  /* ---------- Rendering ---------- */
  // Homepage card: the original .event card, coloured by format.
  function card(game) {
    var li = el("li", "event" + formatClass(game));
    var body = el("div");
    body.appendChild(titleNode("h3", game.title));
    var meta = el("p", "event-meta");
    var time = el("time", null, dateText(game.date) + (game.time ? ", " + game.time : ""));
    time.dateTime = game.isoDate;
    meta.appendChild(time);
    body.appendChild(meta);
    var venue = venueName(game.venue);
    if (venue) body.appendChild(venueNode("p", "event-meta", venue, game.venue));
    li.appendChild(body);
    return li;
  }

  // Events page row: the original .event-row row, coloured by format.
  function row(game, isPast) {
    var li = el("li", "event-row" + formatClass(game) + (isPast ? " is-past" : ""));
    var dateP = el("p", "event-date");
    var time = el("time", null, dateText(game.date));
    time.dateTime = game.isoDate;
    dateP.appendChild(time);
    li.appendChild(dateP);
    var body = el("div");
    body.appendChild(titleNode("h4", game.title));
    li.appendChild(body);
    var dl = el("dl");
    if (game.time) { dl.appendChild(el("dt", null, T.kickoff)); dl.appendChild(el("dd", null, game.time)); }
    if (game.venue) { dl.appendChild(el("dt", null, T.venue)); dl.appendChild(venueNode("dd", null, game.venue, game.venue)); }
    li.appendChild(dl);
    return li;
  }

  // Month headings + rows, as on the original events page.
  function monthGroups(container, games, isPast) {
    var list = null, month = null;
    games.forEach(function (g) {
      if (g.monthKey !== month) {
        month = g.monthKey;
        var h = el("h3", "month", fmtMonth.format(new Date(month + "-15T12:00:00Z")));
        container.appendChild(h);
        list = el("ul", "event-list");
        container.appendChild(list);
      }
      list.appendChild(row(g, isPast));
    });
  }

  function render(target, games) {
    var box = target.querySelector("[data-fixtures-status]");
    var out = target.querySelector("[data-fixtures-list]");
    var mode = target.getAttribute("data-fixtures");
    var nowKey = localKey(new Date());
    var upcoming = games.filter(function (g) { return g.endKey > nowKey; });
    var past = games.filter(function (g) { return g.endKey <= nowKey; });

    out.textContent = "";
    if (mode === "next") {
      var count = parseInt(target.getAttribute("data-count"), 10) || DEFAULT_COUNT;
      upcoming.slice(0, count).forEach(function (g) { out.appendChild(card(g)); });
    } else {
      monthGroups(out, upcoming, false);
      var pastSection = document.querySelector("[data-fixtures-past]");
      var pastList = pastSection && pastSection.querySelector("[data-fixtures-list]");
      if (pastList) {
        pastList.textContent = "";
        monthGroups(pastList, past, true);
        pastSection.hidden = !past.length;
      }
    }

    if (upcoming.length) {
      box.hidden = true;
      out.hidden = false;
    } else {
      out.hidden = true;
      setStatus(box, [T.empty], true);
    }
  }

  targets.forEach(function (target) {
    var box = target.querySelector("[data-fixtures-status]");
    if (box) setStatus(box, [T.loading], false);
  });

  loadGames().then(function (games) {
    targets.forEach(function (target) { render(target, games); });
  }).catch(function (err) {
    console.warn("[fixtures]", err);
    targets.forEach(function (target) {
      var out = target.querySelector("[data-fixtures-list]");
      if (out) out.hidden = true;
      var box = target.querySelector("[data-fixtures-status]");
      if (box) setStatus(box, errorNodes(), true);
    });
  });
})();
