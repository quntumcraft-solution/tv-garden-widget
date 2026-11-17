(function () {
    "use strict";

    /* =================================
       RUTIK LIVE TV - MAIN SETTINGS
    ================================= */

    var PLAYLIST = "https://iptv-org.github.io/iptv/countries/in.m3u";

    // LOW QUALITY STREAM SETTINGS
    var TARGET_HEIGHT = 240;
    var TARGET_BANDWIDTH = 350000;

    var CATS = [
        "Marathi",
        "Hindi",
        "News",
        "Entertainment",
        "Movies",
        "Sports",
        "Documentary & Lifestyle"
    ];

    var video = document.getElementById("video");
    var box = document.getElementById("channels");
    var search = document.getElementById("search");

    var count = document.getElementById("count");
    var shown = document.getElementById("shown");
    var nowName = document.getElementById("nowName");
    var msg = document.getElementById("playMessage");

    var categoryBox = document.getElementById("categories");

    var all = [];
    var filtered = [];
    var buttons = [];

    var activeCat = "all";
    var focusIndex = -1;
    var playingUrl = "";

    var categoryButtons = [];
    var categoryFocus = -1;

    var navMode = "channels";

    var favs = {};
    var playRequest = 0;

    try {
        favs = JSON.parse(
            localStorage.getItem("rutik_tv_favs") || "{}"
        );
    } catch (e) {
        favs = {};
    }

    video.preload = "metadata";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");


    /* =================================
       MESSAGE
    ================================= */

    function say(text) {
        msg.textContent = text;
    }


    /* =================================
       M3U PLAYLIST READER
    ================================= */

    function attr(line, key) {
        var re = new RegExp(key + '="([^"]*)"', "i");
        return (line.match(re) || [])[1] || "";
    }

    function parseM3U(text) {

        var out = [];
        var meta = null;

        text.replace(/\r/g, "").split("\n").forEach(function (line) {

            line = line.trim();

            if (!line) return;

            if (line.indexOf("#EXTINF:") === 0) {

                var comma = line.lastIndexOf(",");

                meta = {
                    name: comma >= 0
                        ? line.slice(comma + 1).trim()
                        : "TV Channel",

                    group: attr(line, "group-title"),
                    lang: attr(line, "tvg-language"),
                    raw: line
                };

            } else if (line.charAt(0) !== "#" && meta) {

                meta.url = line;
                out.push(meta);
                meta = null;

            }

        });

        return out;
    }


    /* =================================
       CHANNEL CATEGORY FILTER
    ================================= */

    function classify(ch) {

        var s = (
            ch.name + " " +
            ch.group + " " +
            ch.lang + " " +
            ch.raw
        ).toLowerCase();

        if (/\b(english|eng|kids?|children|cartoon|devotional|bhakti|religious|education|educational|learning|music|songs?|radio)\b/.test(s)) {
            return [];
        }

        var cats = [];

        if (/\b(marathi|mar)\b/.test(s)) cats.push("Marathi");

        if (/\b(hindi|hin)\b/.test(s)) cats.push("Hindi");

        if (/\b(news|news channel)\b/.test(s)) cats.push("News");

        if (/\b(movie|movies|cinema|film)\b/.test(s)) cats.push("Movies");

        if (/\b(sport|sports|cricket|football|tennis|badminton)\b/.test(s)) {
            cats.push("Sports");
        }

        if (/\b(documentary|lifestyle|travel|food|nature|wildlife)\b/.test(s)) {
            cats.push("Documentary & Lifestyle");
        }

        if (/\b(entertainment|general entertainment|serial|drama)\b/.test(s)) {
            cats.push("Entertainment");
        }

        if (
            !cats.length &&
            /\b(marathi|mar|hindi|hin)\b/.test(s)
        ) {
            cats.push("Entertainment");
        }

        return cats;
    }


    function prepare() {

        all = parseM3U(window.__playlistText || "")
            .map(function (ch) {
                ch.cats = classify(ch);
                return ch;
            })
            .filter(function (ch) {
                return ch.cats.length > 0;
            });

    }


    /* =================================
       LOW QUALITY STREAM SELECTOR
    ================================= */

    function getAttribute(line, name) {

        var re = new RegExp("(?:^|,)" + name + "=([^,]*)", "i");

        var match = line.match(re);

        return match
            ? match[1].replace(/^"|"$/g, "")
            : "";

    }


    function chooseLowQualityVariant(text, masterUrl) {

        var lines = text.replace(/\r/g, "").split("\n");

        var variants = [];

        for (var i = 0; i < lines.length; i++) {

            var line = lines[i].trim();

            if (line.indexOf("#EXT-X-STREAM-INF:") !== 0) {
                continue;
            }

            var uri = "";

            for (var j = i + 1; j < lines.length; j++) {

                var next = lines[j].trim();

                if (next && next.charAt(0) !== "#") {
                    uri = next;
                    break;
                }

            }

            if (!uri) continue;

            var resolution = getAttribute(line, "RESOLUTION");

            var height = 0;

            if (resolution) {

                var parts = resolution.toLowerCase().split("x");

                height = parseInt(parts[1], 10) || 0;

            }

            var bandwidth = parseInt(
                getAttribute(line, "AVERAGE-BANDWIDTH") ||
                getAttribute(line, "BANDWIDTH"),
                10
            ) || 0;

            try {
                uri = new URL(uri, masterUrl).href;
            } catch (e) {}

            variants.push({
                url: uri,
                height: height,
                bandwidth: bandwidth
            });

        }

        if (!variants.length) return null;

        // First preference: 240p or lower with low bitrate.

        var eligible = variants.filter(function (v) {

            return v.height > 0 &&
                v.height <= TARGET_HEIGHT &&
                (!v.bandwidth || v.bandwidth <= TARGET_BANDWIDTH);

        });

        if (eligible.length) {

            eligible.sort(function (a, b) {

                return (b.height - a.height) ||
                    (b.bandwidth - a.bandwidth);

            });

            return eligible[0];

        }

        // If 240p is unavailable, choose the lowest resolution.

        variants.sort(function (a, b) {

            return (a.height || 99999) - (b.height || 99999) ||
                (a.bandwidth || 999999999) -
                (b.bandwidth || 999999999);

        });

        return variants[0];

    }


    function resolveStreamUrl(originalUrl) {

        return fetch(originalUrl, {
            cache: "no-store"
        })

        .then(function (response) {

            if (!response.ok) {
                throw new Error("Stream fetch failed");
            }

            return response.text();

        })

        .then(function (text) {

            if (
                text.indexOf("#EXTM3U") === -1 ||
                text.indexOf("#EXT-X-STREAM-INF") === -1
            ) {

                return {
                    url: originalUrl,
                    quality: "Original Stream"
                };

            }

            var variant = chooseLowQualityVariant(
                text,
                originalUrl
            );

            if (!variant) {

                return {
                    url: originalUrl,
                    quality: "Original Stream"
                };

            }

            return {
                url: variant.url,
                quality: variant.height
                    ? variant.height + "p"
                    : "Low Quality"
            };

        })

        .catch(function () {

            // If playlist cannot be read, use original stream.

            return {
                url: originalUrl,
                quality: "Auto / Original"
            };

        });

    }


    /* =================================
       CURRENT CHANNEL LIST
    ================================= */

    function currentRows() {

        var q = search.value.toLowerCase();

        return all.filter(function (ch) {

            var catOK =
                activeCat === "all"
                    ? true
                    : activeCat === "Favourites"
                        ? !!favs[ch.url]
                        : ch.cats.indexOf(activeCat) >= 0;

            return catOK &&
                ch.name.toLowerCase().indexOf(q) >= 0;

        });

    }


    /* =================================
       CATEGORY BUTTONS
    ================================= */

    function updateCategoryButtons() {

        categoryButtons = Array.prototype.slice.call(
            categoryBox.querySelectorAll(".cat")
        );

    }


    function focusCategory(index) {

        updateCategoryButtons();

        if (!categoryButtons.length) return;

        categoryFocus =
            (index + categoryButtons.length) %
            categoryButtons.length;

        navMode = "categories";

        categoryButtons.forEach(function (btn, i) {

            btn.classList.toggle(
                "keyboard-focus",
                i === categoryFocus
            );

        });

        var btn = categoryButtons[categoryFocus];

        btn.focus();

        btn.scrollIntoView({
            block: "nearest",
            inline: "nearest"
        });

    }


    function selectCategory(btn) {

        if (!btn) return;

        activeCat = btn.dataset.cat;

        focusIndex = -1;

        navMode = "categories";

        categoryBox.querySelectorAll(".cat").forEach(function (b) {

            b.classList.toggle(
                "selected",
                b === btn
            );

        });

        categoryFocus = categoryButtons.indexOf(btn);

        render();

        say(
            activeCat === "all"
                ? "सर्व चॅनेल्स"
                : activeCat + " category"
        );

    }


    categoryBox.addEventListener("click", function (e) {

        var btn = e.target.closest(".cat");

        if (!btn) return;

        updateCategoryButtons();

        categoryFocus = categoryButtons.indexOf(btn);

        selectCategory(btn);

    });


    /* =================================
       CHANNEL LIST DISPLAY
    ================================= */

    function render() {

        filtered = currentRows();

        box.innerHTML = "";
        buttons = [];

        document.getElementById("categoryTitle").textContent =
            activeCat === "all"
                ? "ALL CHANNELS"
                : activeCat.toUpperCase();

        if (!filtered.length) {

            box.innerHTML =
                '<div class="hint">या Category मध्ये सध्या चॅनेल उपलब्ध नाहीत.</div>';

            shown.textContent = "0";

            return;
        }

        if (focusIndex >= filtered.length) {
            focusIndex = -1;
        }

        filtered.forEach(function (ch, i) {

            var b = document.createElement("button");

            b.type = "button";

            b.className =
                "channel" +
                (i === focusIndex ? " focused" : "") +
                (ch.url === playingUrl ? " playing" : "");

            var f = document.createElement("button");

            f.type = "button";
            f.className = "fav";

            f.textContent = favs[ch.url] ? "★" : "☆";

            f.setAttribute("aria-label", "Favourite");

            f.onclick = function (e) {

                e.stopPropagation();

                if (favs[ch.url]) {
                    delete favs[ch.url];
                } else {
                    favs[ch.url] = true;
                }

                try {
                    localStorage.setItem(
                        "rutik_tv_favs",
                        JSON.stringify(favs)
                    );
                } catch (x) {}

                render();

            };

            var strong = document.createElement("strong");

            strong.textContent = (i + 1) + ". " + ch.name;

            var small = document.createElement("small");

            small.textContent = ch.cats.join(" · ");

            b.appendChild(f);
            b.appendChild(strong);
            b.appendChild(small);

            b.onclick = function () {

                focusIndex = i;

                navMode = "channels";

                render();

                if (buttons[i]) {
                    buttons[i].focus();
                }

                say(
                    "निवडले: " +
                    ch.name +
                    " · सुरू करण्यासाठी OK दाबा."
                );

            };

            box.appendChild(b);

            buttons.push(b);

        });

        shown.textContent = filtered.length + " channels";

    }


    /* =================================
       CHANNEL PLAYBACK - 240p PRIORITY
    ================================= */

    function play(i) {

        if (i < 0 || i >= filtered.length) return;

        focusIndex = i;

        navMode = "channels";

        var ch = filtered[i];

        var requestId = ++playRequest;

        playingUrl = ch.url;

        nowName.textContent = ch.name;

        say("240p कमी Quality शोधत आहे…");

        render();

        video.pause();

        video.removeAttribute("src");

        video.load();

        resolveStreamUrl(ch.url).then(function (result) {

            // Ignore old requests if user selects another channel.

            if (requestId !== playRequest) return;

            say("Starting Stream · " + result.quality);

            video.src = result.url;

            video.load();

            var p = video.play();

            if (p && p.catch) {

                p.catch(function () {

                    if (requestId === playRequest) {

                        say(
                            "Stream सुरू झाले नाही. Video वरील Play दाबा किंवा दुसरे channel निवडा."
                        );

                    }

                });

            }

        });

    }


    /* =================================
       CHANNEL UP / DOWN
    ================================= */

    function move(d) {

        if (!filtered.length) return;

        focusIndex =
            focusIndex < 0
                ? (d > 0 ? 0 : filtered.length - 1)
                : (focusIndex + d + filtered.length) % filtered.length;

        navMode = "channels";

        if (playingUrl) {

            play(focusIndex);

        } else {

            render();

            say(
                "निवडले: " +
                filtered[focusIndex].name +
                " · OK दाबल्यावर सुरू होईल."
            );

            if (buttons[focusIndex]) {

                buttons[focusIndex].focus();

                buttons[focusIndex].scrollIntoView({
                    block: "nearest"
                });

            }

        }

    }


    /* =================================
       PLAY / PREVIOUS / NEXT BUTTONS
    ================================= */

    document.getElementById("prev").onclick = function () {
        move(-1);
    };

    document.getElementById("next").onclick = function () {
        move(1);
    };

    document.getElementById("playSelected").onclick = function () {

        if (focusIndex < 0 && filtered.length) {
            focusIndex = 0;
        }

        play(focusIndex);

    };


    /* =================================
       SEARCH
    ================================= */

    document.getElementById("clear").onclick = function () {

        search.value = "";

        focusIndex = -1;

        render();

        search.focus();

    };

    search.oninput = function () {

        focusIndex = -1;

        render();

    };


    /* =================================
       VIDEO EVENTS
    ================================= */

    video.addEventListener("playing", function () {

        say("LIVE · " + nowName.textContent);

    });

    video.addEventListener("waiting", function () {

        say("Buffering… कमी Quality Stream वापरली जात आहे.");

    });

    video.addEventListener("error", function () {

        say(
            "हा stream उपलब्ध नाही किंवा समर्थित नाही. NEXT वापरून दुसरा चॅनेल पाहा."
        );

    });


    /* =================================
       KEYPAD NAVIGATION
    ================================= */

    document.addEventListener("keydown", function (e) {

        var key = e.key;

        var tag = (
            document.activeElement &&
            document.activeElement.tagName || ""
        ).toLowerCase();

        var isCategory =
            document.activeElement &&
            document.activeElement.classList.contains("cat");

        var isChannel =
            document.activeElement &&
            document.activeElement.classList.contains("channel");


        if (tag === "input") {

            if (key === "Escape") {
                search.blur();
            } else {
                return;
            }

        }


        if (key === "ArrowLeft" || key === "4") {

            e.preventDefault();

            if (categoryFocus < 0) {

                updateCategoryButtons();

                categoryFocus = categoryButtons.indexOf(
                    categoryBox.querySelector(".cat.selected")
                );

            }

            focusCategory(categoryFocus - 1);

            return;

        }


        if (key === "ArrowRight" || key === "6") {

            e.preventDefault();

            if (categoryFocus < 0) {

                updateCategoryButtons();

                categoryFocus = categoryButtons.indexOf(
                    categoryBox.querySelector(".cat.selected")
                );

            }

            focusCategory(categoryFocus + 1);

            return;

        }


        if (key === "ArrowUp" || key === "2") {

            e.preventDefault();

            if (isCategory) {
                return;
            }

            if (
                !playingUrl &&
                (focusIndex <= 0 || !isChannel)
            ) {

                updateCategoryButtons();

                var selected = categoryButtons.indexOf(
                    categoryBox.querySelector(".cat.selected")
                );

                focusCategory(selected);

                return;

            }

            move(-1);

            return;

        }


        if (key === "ArrowDown" || key === "8") {

            e.preventDefault();

            if (isCategory || navMode === "categories") {

                if (filtered.length > 0) {

                    focusIndex = 0;

                    navMode = "channels";

                    render();

                    if (buttons[0]) {
                        buttons[0].focus();
                    }

                }

                return;

            }

            move(1);

            return;

        }


        if (key === "Enter" || key === " ") {

            e.preventDefault();

            if (isCategory) {

                selectCategory(document.activeElement);

                return;

            }

            if (focusIndex < 0 && filtered.length) {
                focusIndex = 0;
            }

            play(focusIndex);

            return;

        }


        if (key === "Escape") {

            playRequest++;

            video.pause();

            video.removeAttribute("src");

            video.load();

            playingUrl = "";

            nowName.textContent = "No channel playing";

            say("Playback stopped.");

            render();

            return;

        }

    });


    /* =================================
       LOAD PLAYLIST
    ================================= */

    updateCategoryButtons();

    fetch(PLAYLIST, {
        cache: "no-store"
    })

    .then(function (r) {

        if (!r.ok) {
            throw Error("HTTP " + r.status);
        }

        return r.text();

    })

    .then(function (t) {

        window.__playlistText = t;

        prepare();

        count.textContent = all.length + " included";

        render();

        say(
            "चॅनेल निवडा. LEFT / RIGHT वापरून Category बदला."
        );

    })

    .catch(function (e) {

        count.textContent = "Playlist error";

        box.innerHTML =
            '<div class="hint">Playlist load झाली नाही: ' +
            String(e.message) +
            '. Cloud Browser मधील network/CORS तपासावे लागेल.</div>';

        say("Channel list load failed.");

    });

})();
