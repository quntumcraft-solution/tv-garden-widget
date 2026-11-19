(function(){

"use strict";

/* RUTIK LIVE TV - SMALL SCREEN VERSION */

var PLAYLISTS = [
  "https://raw.githubusercontent.com/gnaidu05/Iptv/main/playlists/india-active.m3u",
  "https://iptv-org.github.io/iptv/countries/in.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/in-mh.m3u",
  "https://iptv-org.github.io/iptv/languages/mar.m3u",
  "https://iptv-org.github.io/iptv/languages/hin.m3u"
];

var video = document.getElementById("video");
var box = document.getElementById("channels");
var search = document.getElementById("search");
var count = document.getElementById("count");
var shown = document.getElementById("shown");
var nowName = document.getElementById("nowName");
var msg = document.getElementById("playMessage");
var categoriesEl = document.getElementById("categories");

var buttons = Array.prototype.slice.call(
  categoriesEl.querySelectorAll(".cat")
);

var all = [];
var filtered = [];

var activeCat = "all";
var focusIndex = 0;
var categoryFocus = 0;
var navMode = "channels";
var playingUrl = "";

var favs = {};
var removed = {};

try {
  favs = JSON.parse(localStorage.getItem("rutik_tv_favs") || "{}") || {};
} catch(e) {}

try {
  removed = JSON.parse(localStorage.getItem("rutik_tv_removed") || "{}") || {};
} catch(e) {}

/* AUTOPLAY DISABLED */

video.autoplay = false;
video.removeAttribute("autoplay");
video.preload = "none";

try {
  video.pause();
  video.removeAttribute("src");
  video.load();
} catch(e) {}


function say(t) {
  msg.textContent = t;
}

function attr(line, key) {
  var re = new RegExp(key + '="([^"]*)"', "i");
  return (line.match(re) || [])[1] || "";
}


/* PLAYLIST PARSER */

function parseM3U(text) {

  var result = [];
  var meta = null;

  var lines = String(text).replace(/\r/g, "").split("\n");

  for (var i = 0; i < lines.length; i++) {

    var line = lines[i].trim();

    if (!line) continue;

    if (line.indexOf("#EXTINF:") === 0) {

      var comma = line.lastIndexOf(",");

      meta = {
        name: comma >= 0 ? line.substring(comma + 1).trim() : "TV Channel",
        group: attr(line, "group-title"),
        lang: attr(line, "tvg-language"),
        raw: line
      };

    } else if (line.charAt(0) !== "#" && meta) {

      meta.url = line;
      result.push(meta);
      meta = null;

    }
  }

  return result;
}


/* CATEGORY DETECTION */

function classify(ch) {

  var s = (
    ch.name + " " +
    ch.group + " " +
    ch.lang + " " +
    ch.raw
  ).toLowerCase();

  var cats = [];

  if (/\b(marathi|mar|मराठी)\b/.test(s)) cats.push("Marathi");

  if (/\b(hindi|hin|हिंदी)\b/.test(s)) cats.push("Hindi");

  if (/\b(news|न्यूज|बातम्या)\b/.test(s)) cats.push("News");

  if (/\b(movie|movies|cinema|film|films)\b/.test(s)) cats.push("Movies");

  if (/\b(sport|sports|cricket|football|tennis|badminton)\b/.test(s)) cats.push("Sports");

  if (/\b(documentary|lifestyle|travel|food|nature|wildlife)\b/.test(s)) {
    cats.push("Documentary & Lifestyle");
  }

  if (/\b(entertainment|serial|drama)\b/.test(s)) {
    cats.push("Entertainment");
  }

  if (cats.length === 0) cats.push("Entertainment");

  return cats;
}


/* PREPARE CHANNELS */

function prepare(text) {

  var parsed = parseM3U(text);
  var seen = {};
  all = [];

  for (var i = 0; i < parsed.length; i++) {

    var ch = parsed[i];

    if (!ch.url || seen[ch.url] || removed[ch.url]) continue;

    seen[ch.url] = true;
    ch.cats = classify(ch);

    all.push(ch);
  }
}


/* FILTER */

function currentRows() {

  var q = (search.value || "").toLowerCase().trim();

  return all.filter(function(ch) {

    var catOK =
      activeCat === "all" ||
      (
        activeCat === "Favourites"
        ? !!favs[ch.url]
        : ch.cats.indexOf(activeCat) >= 0
      );

    return catOK && ch.name.toLowerCase().indexOf(q) >= 0;

  });
}


/* SAVE */

function saveData() {

  try {
    localStorage.setItem("rutik_tv_favs", JSON.stringify(favs));
    localStorage.setItem("rutik_tv_removed", JSON.stringify(removed));
  } catch(e) {}
}


/* REMOVE CHANNEL */

function removeChannel(ch) {

  if (!ch) return;

  var ok = true;

  try {
    ok = confirm("Remove this channel?");
  } catch(e) {}

  if (!ok) return;

  removed[ch.url] = true;
  delete favs[ch.url];

  saveData();

  if (playingUrl === ch.url) stopPlayback();

  filtered = currentRows();

  focusIndex = Math.min(focusIndex, filtered.length - 1);

  if (focusIndex < 0) focusIndex = 0;

  render();

  say("Channel removed");
}


/* FAVOURITE */

function toggleFav(ch) {

  if (!ch) return;

  if (favs[ch.url]) {
    delete favs[ch.url];
  } else {
    favs[ch.url] = true;
  }

  saveData();

  filtered = currentRows();

  render();

  say("Favourite updated");
}


/* RENDER */

function render() {

  filtered = currentRows();

  box.innerHTML = "";

  document.getElementById("categoryTitle").textContent =
    activeCat === "all" ? "ALL CHANNELS" : activeCat.toUpperCase();

  if (focusIndex >= filtered.length) {
    focusIndex = filtered.length - 1;
  }

  if (filtered.length === 0) {

    box.innerHTML = '<div class="hint">No channels found</div>';
    shown.textContent = "0";
    return;
  }

  if (focusIndex < 0) focusIndex = 0;

  var start = Math.max(0, focusIndex - 2);
  var end = Math.min(filtered.length, start + 20);

  for (var i = start; i < end; i++) {

    (function(index) {

      var ch = filtered[index];

      var row = document.createElement("div");

      row.className = "channel";

      if (index === focusIndex) row.className += " focused";
      if (ch.url === playingUrl) row.className += " playing";

      var removeBtn = document.createElement("button");
      removeBtn.className = "remove-channel";
      removeBtn.type = "button";
      removeBtn.textContent = "X";

      removeBtn.onclick = function(e) {
        e.stopPropagation();
        removeChannel(ch);
      };

      var fav = document.createElement("button");
      fav.className = "fav";
      fav.type = "button";
      fav.textContent = favs[ch.url] ? "★" : "☆";

      fav.onclick = function(e) {
        e.stopPropagation();
        toggleFav(ch);
      };

      var name = document.createElement("strong");
      name.textContent = (index + 1) + ". " + ch.name;

      var small = document.createElement("small");
      small.textContent = ch.cats.join(" / ");

      row.appendChild(removeBtn);
      row.appendChild(fav);
      row.appendChild(name);
      row.appendChild(small);

      row.onclick = function() {
        focusIndex = index;
        navMode = "channels";
        render();
        say("Selected: " + ch.name + " - Press OK");
      };

      box.appendChild(row);

    })(i);
  }

  shown.textContent = (focusIndex + 1) + "/" + filtered.length;

  var selected = box.querySelector(".focused");

  if (selected && selected.scrollIntoView) {
    selected.scrollIntoView({block:"nearest"});
  }
}


/* MOVE CHANNEL */

function moveChannel(direction) {

  if (!filtered.length) return;

  focusIndex += direction;

  if (focusIndex < 0) focusIndex = filtered.length - 1;

  if (focusIndex >= filtered.length) focusIndex = 0;

  navMode = "channels";

  render();

  say("Selected: " + filtered[focusIndex].name);
}


/* PLAY ONLY WHEN OK PRESSED */

function playChannel() {

  if (!filtered.length || focusIndex < 0) return;

  var ch = filtered[focusIndex];

  playingUrl = ch.url;

  nowName.textContent = ch.name;

  say("Starting selected channel...");

  render();

  try {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } catch(e) {}

  video.autoplay = false;
  video.src = ch.url;
  video.load();

  var p = video.play();

  if (p && p.catch) {
    p.catch(function() {
      say("Channel not supported or unavailable");
    });
  }
}


/* STOP */

function stopPlayback() {

  try {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } catch(e) {}

  playingUrl = "";
  nowName.textContent = "No channel playing";

  say("Playback stopped");

  render();
}


/* CATEGORY NAVIGATION */

function paintCategory() {

  buttons.forEach(function(b, i) {

    b.classList.toggle("key-focused", navMode === "categories" && i === categoryFocus);

  });

  var selected = buttons[categoryFocus];

  if (selected) {
    selected.scrollIntoView({block:"nearest", inline:"nearest"});
  }
}


function activateCategory(index) {

  if (index < 0 || index >= buttons.length) return;

  categoryFocus = index;

  activeCat = buttons[index].getAttribute("data-cat");

  buttons.forEach(function(b, i) {
    b.classList.toggle("selected", i === index);
  });

  focusIndex = 0;
  navMode = "channels";

  render();
  paintCategory();

  say("Category: " + activeCat);
}


categoriesEl.addEventListener("click", function(e) {

  var node = e.target;

  while (node && node !== categoriesEl &&
    !(node.classList && node.classList.contains("cat"))) {
    node = node.parentNode;
  }

  if (!node || node === categoriesEl) return;

  activateCategory(buttons.indexOf(node));
});


/* SEARCH */

search.onfocus = function() {
  navMode = "search";
};

search.oninput = function() {
  focusIndex = 0;
  render();
};

search.onkeydown = function(e) {

  if (e.key === "Enter" || e.keyCode === 13) {
    search.blur();
    navMode = "channels";
    focusIndex = 0;
    render();
  }
};

document.getElementById("clear").onclick = function() {
  search.value = "";
  focusIndex = 0;
  navMode = "channels";
  render();
};


/* KEYPAD */

document.addEventListener("keydown", function(e) {

  var key = e.key || "";
  var code = e.keyCode || 0;

  var tag = (
    document.activeElement &&
    document.activeElement.tagName || ""
  ).toLowerCase();

  if (tag === "input") {
    if (key === "Escape" || code === 27) {
      search.blur();
      navMode = "channels";
    }
    return;
  }

  /* UP / DOWN */

  if (key === "ArrowUp" || code === 38 || key === "8") {
    e.preventDefault();
    moveChannel(-1);
    return;
  }

  if (key === "ArrowDown" || code === 40 || key === "2") {
    e.preventDefault();
    moveChannel(1);
    return;
  }

  /* LEFT / RIGHT */

  if (key === "ArrowLeft" || code === 37 || key === "4") {

    e.preventDefault();

    navMode = "categories";
    categoryFocus = Math.max(0, categoryFocus - 1);

    paintCategory();
    return;
  }

  if (key === "ArrowRight" || code === 39 || key === "6") {

    e.preventDefault();

    navMode = "categories";
    categoryFocus = Math.min(buttons.length - 1, categoryFocus + 1);

    paintCategory();
    return;
  }

  /* OK */

  if (key === "Enter" || code === 13) {

    e.preventDefault();

    if (navMode === "categories") {
      activateCategory(categoryFocus);
    } else {
      playChannel();
    }

    return;
  }

  /* SEARCH */

  if (key === "0") {
    e.preventDefault();
    search.focus();
    return;
  }

  /* FAVOURITE */

  if (key === "5" || key === "*") {
    e.preventDefault();
    toggleFav(filtered[focusIndex]);
    return;
  }

  /* STOP */

  if (key === "Escape" || code === 27) {
    stopPlayback();
  }

});


/* VIDEO EVENTS */

video.addEventListener("playing", function() {
  say("LIVE: " + nowName.textContent);
});

video.addEventListener("waiting", function() {
  say("Buffering...");
});

video.addEventListener("error", function() {
  say("Stream unavailable");
});


/* LOAD PLAYLIST */

function loadPlaylist(index) {

  if (index >= PLAYLISTS.length) {

    count.textContent = "Playlist error";

    box.innerHTML = '<div class="hint">Internet / Playlist error</div>';

    say("Playlist could not load");

    return;
  }

  if (typeof fetch !== "function") {

    count.textContent = "Fetch unsupported";

    box.innerHTML = '<div class="hint">Browser does not support playlist loading</div>';

    return;
  }

  count.textContent = "Loading " + (index + 1);

  fetch(PLAYLISTS[index])

  .then(function(response) {

    if (!response.ok) throw new Error("HTTP error");

    return response.text();

  })

  .then(function(text) {

    if (text.indexOf("#EXTM3U") < 0) {
      throw new Error("Invalid playlist");
    }

    prepare(text);

    filtered = currentRows();

    focusIndex = 0;

    count.textContent = all.length + " CH";

    render();

    say("Select channel and press OK");

  })

  .catch(function() {

    loadPlaylist(index + 1);

  });

}


/* START */

loadPlaylist(0);

})();
