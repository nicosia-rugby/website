/* Nicosia Rugby Club — progressive enhancement.
   Core content (training, events, contact) works without this file. It adds:
   1. the collapsible mobile menu;
   2. date housekeeping for events and notices;
   3. the Clubhouse: menu item, homepage block, Clubhouse list and post viewer,
      all driven by clubhouse/posts.js. */
(function () {
  "use strict";

  var LANG = (document.documentElement.lang || "en").slice(0, 2);
  var ROOT = document.body.getAttribute("data-root") || "";
  var LANG_ROOT = document.body.getAttribute("data-lang-root") || "";
  var HOME_DAYS = 120;   // dated posts stay on the homepage this many days
  var HOME_MAX = 3;      // maximum cards on the homepage
  var PREVIEW_CHARS = 120;

  /* ---------- Mobile menu ---------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("primary-nav");
  if (header && toggle && nav) {
    var label = toggle.querySelector(".menu-toggle-label");
    var openText = toggle.getAttribute("data-label-open") || "Menu";
    var closeText = toggle.getAttribute("data-label-close") || "Close";
    var setOpen = function (open, returnFocus) {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? closeText : openText;
      if (!open && returnFocus) toggle.focus();
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true", false);
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false, false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("is-open")) setOpen(false, true);
    });
    var desktop = window.matchMedia("(min-width: 901px)");
    var onChange = function (mq) { if (mq.matches) setOpen(false, false); };
    if (desktop.addEventListener) desktop.addEventListener("change", onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  }

  /* ---------- Language links keep the current post (?p=…) ---------- */
  if (location.search) {
    document.querySelectorAll("a[data-keep-query]").forEach(function (a) {
      a.setAttribute("href", a.getAttribute("href").split("?")[0] + location.search);
    });
  }

  /* ---------- Dates ---------- */
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var now = new Date();
  var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  document.querySelectorAll("[data-show-until]").forEach(function (el) {
    if (today > el.getAttribute("data-show-until")) el.hidden = true;
  });

  // Homepage events: drop past ones; CSS shows the first three remaining.
  var upcoming = document.querySelector(".events--upcoming");
  if (upcoming) {
    var left = 0;
    upcoming.querySelectorAll("li[data-end]").forEach(function (li) {
      if (today > li.getAttribute("data-end")) li.remove(); else left++;
    });
    if (left === 0) {
      upcoming.hidden = true;
      var over = upcoming.parentNode.querySelector("[data-season-over]");
      if (over) over.hidden = false;
    }
  }

  // Events page: mark past rows; when all are past, show the "next season" message.
  var rows = document.querySelectorAll(".event-row[data-end]");
  if (rows.length) {
    var pastCount = 0;
    rows.forEach(function (row) {
      if (today > row.getAttribute("data-end")) {
        pastCount++;
        row.classList.add("is-past");
        var list = row.closest(".event-list");
        var tag = document.createElement("span");
        tag.className = "past-tag";
        tag.textContent = (list && list.getAttribute("data-past-label")) || "Past";
        var date = row.querySelector(".event-date");
        if (date) date.appendChild(tag);
      }
    });
    if (pastCount === rows.length) {
      var msg = document.querySelector("#calendar [data-season-over]");
      if (msg) msg.hidden = false;
    }
  }

  /* ======================================================================
     CLUBHOUSE
     ====================================================================== */
  var POSTS = Array.isArray(window.POSTS) ? window.POSTS.filter(function (f) {
    return typeof f === "string" && /^[a-z0-9-]+$/i.test(f);
  }) : [];

  // Menu item appears once there is at least one post.
  if (POSTS.length) {
    document.querySelectorAll("[data-clubhouse-link]").forEach(function (li) { li.hidden = false; });
  }

  var postsBase = new URL(ROOT + "clubhouse/", location.href);
  var viewerUrl = function (folder) { return LANG_ROOT + "clubhouse/post.html?p=" + encodeURIComponent(folder); };

  // "01-05-2026-game" → Date(2026-05-01); undated → null
  function folderDate(folder) {
    var m = /^(\d{2})-(\d{2})-(\d{4})-/.exec(folder);
    if (!m) return null;
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d) ? null : d;
  }
  function formatDate(d) {
    try {
      return new Intl.DateTimeFormat(LANG === "el" ? "el-GR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
    } catch (e) { return d.toDateString(); }
  }
  function tidyName(folder) {
    var s = folder.replace(/^\d{2}-\d{2}-\d{4}-/, "").replace(/-/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Fetch a post: Greek pages try post.el.html first, then post.html.
  function loadPost(folder) {
    var base = new URL(folder + "/", postsBase);
    var getText = function (file) {
      return fetch(new URL(file, base)).then(function (r) {
        if (r.ok) return r.text();
        var err = new Error("HTTP " + r.status); err.status = r.status; throw err;
      });
    };
    var english = function () {
      return getText("post.html").then(function (html) { return { html: html, lang: "en", base: base }; });
    };
    if (LANG !== "el") return english();
    return getText("post.el.html")
      .then(function (html) { return { html: html, lang: "el", base: base }; })
      .catch(function (err) { if (err.status === 404) return english(); throw err; });
  }

  // Parse without displaying; fix relative paths; drop scripts and inline handlers.
  function parsePost(post) {
    var doc = new DOMParser().parseFromString(post.html, "text/html");
    doc.querySelectorAll("script, style, link, meta, title").forEach(function (el) { el.remove(); });
    doc.querySelectorAll("*").forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      });
    });
    doc.querySelectorAll("img[src], a[href]").forEach(function (el) {
      var attr = el.tagName === "IMG" ? "src" : "href";
      var val = el.getAttribute(attr);
      if (/^(#|mailto:|tel:)/i.test(val)) return;
      if (/^javascript:/i.test(val)) { el.removeAttribute(attr); return; }
      el.setAttribute(attr, new URL(val, post.base).href);
    });
    return doc;
  }

  function summary(folder, post) {
    var doc = parsePost(post);
    var h1 = doc.querySelector("h1");
    var img = doc.querySelector("img[src]");
    var p = doc.querySelector("p");
    var text = p ? p.textContent.replace(/\s+/g, " ").trim() : "";
    if (text.length > PREVIEW_CHARS) {
      text = text.slice(0, PREVIEW_CHARS);
      text = text.slice(0, Math.max(text.lastIndexOf(" "), 40)).replace(/[\s.,;:!?–-]+$/, "") + "…";
    }
    return {
      folder: folder,
      title: h1 ? h1.textContent.trim() : tidyName(folder),
      img: img ? img.getAttribute("src") : null,
      preview: text,
      date: folderDate(folder),
      lang: post.lang
    };
  }

  function card(s, headingTag) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.className = "post-card";
    a.href = viewerUrl(s.folder);
    if (s.lang !== LANG) a.lang = s.lang;

    var media = document.createElement("div");
    media.className = "post-card-media";
    var img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    if (s.img) { img.src = s.img; }
    else {
      media.classList.add("post-card-media--logo");
      img.src = ROOT + "assets/images/nrc-mark-light.png";
    }
    media.appendChild(img);

    var body = document.createElement("div");
    body.className = "post-card-body";
    if (s.date) {
      var t = document.createElement("time");
      t.className = "post-card-date";
      t.dateTime = s.date.getFullYear() + "-" + pad(s.date.getMonth() + 1) + "-" + pad(s.date.getDate());
      t.textContent = formatDate(s.date);
      body.appendChild(t);
    }
    var h = document.createElement(headingTag);
    h.textContent = s.title;
    body.appendChild(h);
    if (s.preview) {
      var p = document.createElement("p");
      p.textContent = s.preview;
      body.appendChild(p);
    }
    a.appendChild(media);
    a.appendChild(body);
    li.appendChild(a);
    return li;
  }

  function fillGrid(grid, folders) {
    var headingTag = grid.getAttribute("data-heading") || "h3";
    return Promise.all(folders.map(function (f) {
      return loadPost(f).then(function (post) { return summary(f, post); }).catch(function () { return null; });
    })).then(function (list) {
      var shown = 0;
      list.forEach(function (s) { if (s) { grid.appendChild(card(s, headingTag)); shown++; } });
      grid.setAttribute("data-count", String(shown));
      return shown;
    });
  }

  // Homepage block: evergreen posts, or dated within HOME_DAYS; first HOME_MAX.
  var latest = document.querySelector("[data-clubhouse-latest]");
  if (latest && POSTS.length) {
    var limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - HOME_DAYS);
    var eligible = POSTS.filter(function (f) {
      var d = folderDate(f);
      return !d || d >= limit;
    }).slice(0, HOME_MAX);
    if (eligible.length) {
      fillGrid(latest.querySelector("[data-post-grid]"), eligible).then(function (n) {
        if (n) latest.hidden = false;
      });
    }
  }

  // Clubhouse page: all posts.
  var all = document.querySelector("[data-post-grid][data-all]");
  if (all) {
    var empty = document.querySelector("[data-post-empty]");
    if (!POSTS.length) { if (empty) empty.hidden = false; }
    else fillGrid(all, POSTS).then(function (n) { if (!n && empty) empty.hidden = false; });
  }

  // Post viewer.
  var viewer = document.querySelector("[data-post-viewer]");
  if (viewer) {
    var msg = function (k) { return viewer.getAttribute("data-msg-" + k) || ""; };
    var bodyEl = viewer.querySelector("[data-post-body]");
    var dateEl = viewer.querySelector("[data-post-date]");
    var noteEl = viewer.querySelector("[data-post-note]");
    var folder = new URLSearchParams(location.search).get("p") || "";

    var status = function (text, retry) {
      bodyEl.replaceChildren();
      var p = document.createElement("p");
      p.className = "post-status";
      p.textContent = text;
      bodyEl.appendChild(p);
      if (retry) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = msg("retry");
        b.addEventListener("click", show);
        bodyEl.appendChild(b);
      }
    };

    function show() {
      if (!/^[a-z0-9-]+$/i.test(folder)) { status(msg("notfound")); return; }
      status(msg("loading"));
      loadPost(folder).then(function (post) {
        var doc = parsePost(post);
        // Photos: lazy, and open full size in a new tab.
        doc.querySelectorAll("img").forEach(function (img, i) {
          if (i > 0) img.loading = "lazy";
          img.decoding = "async";
          if (img.closest("a")) return;
          var a = doc.createElement("a");
          a.href = img.getAttribute("src");
          a.target = "_blank";
          a.rel = "noopener";
          a.className = "post-photo";
          var sr = doc.createElement("span");
          sr.className = "visually-hidden";
          sr.textContent = msg("photo");
          img.replaceWith(a);
          a.appendChild(img);
          a.appendChild(sr);
        });
        doc.querySelectorAll("a[href^='http']").forEach(function (a) {
          if (new URL(a.href).origin !== location.origin) { a.target = "_blank"; a.rel = "noopener"; }
        });
        bodyEl.lang = post.lang;
        bodyEl.replaceChildren.apply(bodyEl, Array.prototype.slice.call(doc.body.childNodes));

        var h1 = bodyEl.querySelector("h1");
        var title = h1 ? h1.textContent.trim() : tidyName(folder);
        document.title = title + " | Nicosia Rugby Club";
        var p = bodyEl.querySelector("p");
        var meta = document.querySelector('meta[name="description"]');
        if (p && meta) meta.setAttribute("content", p.textContent.replace(/\s+/g, " ").trim().slice(0, 155));

        // Canonical + language alternates for this post (static pages carry them in <head>).
        var addLink = function (rel, href, hreflang) {
          var l = document.createElement("link");
          l.rel = rel; l.href = href;
          if (hreflang) l.hreflang = hreflang;
          document.head.appendChild(l);
        };
        var selfUrl = location.origin + location.pathname + "?p=" + encodeURIComponent(folder);
        addLink("canonical", selfUrl);
        document.querySelectorAll(".lang-switch a[hreflang]").forEach(function (a) {
          addLink("alternate", a.href, a.getAttribute("hreflang"));
        });

        var d = folderDate(folder);
        if (d) {
          dateEl.replaceChildren();
          var t = document.createElement("time");
          t.dateTime = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
          t.textContent = formatDate(d);
          dateEl.appendChild(t);
          dateEl.hidden = false;
        }
        if (post.lang !== LANG && msg("en-only")) {
          noteEl.textContent = msg("en-only");
          noteEl.hidden = false;
        }
      }).catch(function (err) {
        status(err && err.status === 404 ? msg("notfound") : msg("error"), !(err && err.status === 404));
      });
    }
    show();
  }
})();
