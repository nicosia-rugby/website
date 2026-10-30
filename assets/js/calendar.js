/* ==========================================================================
   Upcoming sessions from the public Google Calendar.
   Fills #calendar on the home page. No libraries.
   English copy: change LOCALE and TEXT only.
   ========================================================================== */
(function () {
  "use strict";

  var CAL_ID = "nicosia@cyprus-rugby.com";
  var API_KEY = "AIzaSyCZc2zCHYsx0ekIIkN-2AKaGhTjhyWpjtw"; // restricted to Calendar API + nicosiarugby.com/*
  var MAX = 6;
  var TIME_ZONE = "Asia/Nicosia";
  var LOCALE = "el-GR";

  var TEXT = {
    loading: "Φόρτωση προγράμματος…",
    empty: "Δεν υπάρχουν προγραμματισμένες προπονήσεις.",
    errorStart: "Δεν φορτώθηκε το πρόγραμμα. Δες το στο ",
    errorCalendar: "Google Calendar",
    errorMiddle: " ή στείλε μας μήνυμα στο ",
    errorWhatsapp: "WhatsApp",
    errorEnd: ".",
    allDay: "Όλη μέρα",
    newTab: " (ανοίγει σε νέα καρτέλα)"
  };

  var CAL_URL = "https://calendar.google.com/calendar/u/0/r?cid=" + CAL_ID;
  var WHATSAPP_FALLBACK = "https://wa.me/35795592946";

  var section = document.getElementById("calendar");
  if (!section) return;
  var status = section.querySelector("[data-cal-status]");
  var list = section.querySelector("[data-cal-list]");
  if (!status || !list) return;

  var fmtDay = new Intl.DateTimeFormat(LOCALE, { day: "numeric", timeZone: TIME_ZONE });
  var fmtMonth = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: TIME_ZONE });
  var fmtWeekday = new Intl.DateTimeFormat(LOCALE, { weekday: "long", timeZone: TIME_ZONE });
  var fmtTime = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });

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
    a.appendChild(el("span", "visually-hidden", TEXT.newTab));
    return a;
  }

  function showStatus(nodes, isError) {
    list.hidden = true;
    list.textContent = "";
    status.textContent = "";
    nodes.forEach(function (n) { status.appendChild(typeof n === "string" ? document.createTextNode(n) : n); });
    status.classList.toggle("is-error", !!isError);
    status.hidden = false;
  }

  function showError() {
    var wa = document.querySelector('a[href^="https://wa.me/"]');
    showStatus([
      TEXT.errorStart,
      externalLink(CAL_URL, TEXT.errorCalendar),
      TEXT.errorMiddle,
      externalLink(wa ? wa.href : WHATSAPP_FALLBACK, TEXT.errorWhatsapp),
      TEXT.errorEnd
    ], true);
  }

  function card(event) {
    var start = event.start || {};
    var allDay = !start.dateTime && !!start.date;
    // All-day dates have no time: noon UTC keeps the same calendar day in Nicosia.
    var date = allDay ? new Date(start.date + "T12:00:00Z") : new Date(start.dateTime);
    if (isNaN(date)) return null;

    var li = el("li", "cal-card");

    var when = el("time", "cal-date");
    when.dateTime = allDay ? start.date : start.dateTime;
    when.appendChild(el("span", "cal-day", fmtDay.format(date)));
    when.appendChild(el("span", "cal-month", fmtMonth.format(date).replace(".", "")));
    li.appendChild(when);

    var body = el("div", "cal-body");
    body.appendChild(el("h4", "cal-title", event.summary || ""));
    var weekday = fmtWeekday.format(date);
    body.appendChild(el("p", "cal-when", weekday + " · " + (allDay ? TEXT.allDay : fmtTime.format(date))));
    if (event.location) {
      var place = event.location.split(",")[0].trim();
      if (place) body.appendChild(el("p", "cal-where", place));
    }
    li.appendChild(body);
    return li;
  }

  function render(items) {
    var cards = items.map(card).filter(Boolean);
    if (!cards.length) {
      showStatus([TEXT.empty], false);
      return;
    }
    list.textContent = "";
    cards.forEach(function (c) { list.appendChild(c); });
    status.hidden = true;
    list.hidden = false;
  }

  var params = new URLSearchParams({
    key: API_KEY,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(MAX),
    timeMin: new Date().toISOString(),
    timeZone: TIME_ZONE
  });
  var url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(CAL_ID) + "/events?" + params;

  status.textContent = TEXT.loading;

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error("Calendar API " + res.status);
      return res.json();
    })
    .then(function (data) { render(Array.isArray(data.items) ? data.items : []); })
    .catch(function (err) {
      console.warn(err);
      showError();
    });
})();
