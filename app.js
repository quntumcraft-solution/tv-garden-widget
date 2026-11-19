(function(){
"use strict";

/* RUTIK LIVE TV - MANUAL PLAY VERSION */

var PLAYLISTS=[
  "https://raw.githubusercontent.com/gnaidu05/Iptv/main/playlists/india-active.m3u",
  "https://iptv-org.github.io/iptv/countries/in.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/in-mh.m3u",
  "https://iptv-org.github.io/iptv/languages/mar.m3u",
  "https://iptv-org.github.io/iptv/languages/hin.m3u"
];

var PAGE_SIZE=20;

var video=document.getElementById("video");
var box=document.getElementById("channels");
var search=document.getElementById("search");
var count=document.getElementById("count");
var shown=document.getElementById("shown");
var nowName=document.getElementById("nowName");
var msg=document.getElementById("playMessage");
var categoriesEl=document.getElementById("categories");

var categoryButtons=Array.prototype.slice.call(
  categoriesEl.querySelectorAll(".cat")
);

var all=[];
var filtered=[];
var activeCat="all";
var focusIndex=-1;
var playingUrl="";
var navMode="channels";
var categoryFocus=0;

var favs={};
var removed={};


/* LOAD SAVED DATA */

try{
  favs=JSON.parse(
    localStorage.getItem("rutik_tv_favs")||"{}"
  )||{};
}catch(e){
  favs={};
}

try{
  removed=JSON.parse(
    localStorage.getItem("rutik_tv_removed")||"{}"
  )||{};
}catch(e){
  removed={};
}


/* VIDEO AUTOPLAY OFF */

video.autoplay=false;
video.removeAttribute("autoplay");
video.preload="none";

try{
  video.pause();
  video.removeAttribute("src");
  video.load();
}catch(e){}


function say(t){
  if(msg)msg.textContent=t;
}


function attr(line,key){

  var re=new RegExp(key+'="([^"]*)"',"i");

  return(line.match(re)||[])[1]||"";
}


/* PARSE PLAYLIST */

function parseM3U(t){

  var out=[];
  var meta=null;

  var lines=String(t||"")
    .replace(/\r/g,"")
    .split("\n");

  for(var i=0;i<lines.length;i++){

    var line=lines[i].trim();

    if(!line)continue;

    if(line.indexOf("#EXTINF:")===0){

      var comma=line.lastIndexOf(",");

      meta={
        name:comma>=0
          ?line.slice(comma+1).trim()
          :"TV Channel",

        group:attr(line,"group-title"),
        lang:attr(line,"tvg-language"),
        raw:line
      };

    }else if(line.charAt(0)!=="#"&&meta){

      meta.url=line;

      out.push(meta);

      meta=null;
    }
  }

  return out;
}


/* CATEGORY DETECTION */

function classify(ch){

  var s=(
    ch.name+" "+ch.group+" "+ch.lang+" "+ch.raw
  ).toLowerCase();

  var cats=[];

  if(/\b(english|eng|kids?|children|cartoon|devotional|bhakti|religious|education|educational|learning|music|songs?|radio)\b/.test(s)){
    return [];
  }

  if(/\b(marathi|mar|मराठी)\b/.test(s)){
    cats.push("Marathi");
  }

  if(/\b(hindi|hin|हिंदी)\b/.test(s)){
    cats.push("Hindi");
  }

  if(/\b(news|न्यूज|बातम्या)\b/.test(s)){
    cats.push("News");
  }

  if(/\b(movie|movies|cinema|film|films)\b/.test(s)){
    cats.push("Movies");
  }

  if(/\b(sport|sports|cricket|football|tennis|badminton)\b/.test(s)){
    cats.push("Sports");
  }

  if(/\b(documentary|lifestyle|travel|food|nature|wildlife)\b/.test(s)){
    cats.push("Documentary & Lifestyle");
  }

  if(/\b(entertainment|serial|drama)\b/.test(s)){
    cats.push("Entertainment");
  }

  if((ch.lang==="mar"||ch.lang==="marathi")&&cats.indexOf("Marathi")<0){
    cats.push("Marathi");
  }

  if((ch.lang==="hin"||ch.lang==="hindi")&&cats.indexOf("Hindi")<0){
    cats.push("Hindi");
  }

  if(!cats.length){
    cats.push("Entertainment");
  }

  return cats;
}


/* PREPARE CHANNELS */

function prepare(text){

  var parsed=parseM3U(text);

  var seen={};
  var result=[];

  for(var i=0;i<parsed.length;i++){

    var ch=parsed[i];

    if(
      !ch.url||
      seen[ch.url]||
      removed[ch.url]
    ){
      continue;
    }

    seen[ch.url]=true;

    ch.cats=classify(ch);

    if(ch.cats.length){
      result.push(ch);
    }
  }

  all=result;
}


/* FILTER CHANNELS */

function currentRows(){

  var q=(search.value||"").toLowerCase().trim();

  return all.filter(function(ch){

    var catOK=
      activeCat==="all"||
      (
        activeCat==="Favourites"
        ?!!favs[ch.url]
        :ch.cats.indexOf(activeCat)>=0
      );

    return catOK&&
      ch.name.toLowerCase().indexOf(q)>=0;
  });
}


/* SAVE FAVOURITES */

function saveFavs(){

  try{
    localStorage.setItem(
      "rutik_tv_favs",
      JSON.stringify(favs)
    );
  }catch(e){}
}


/* SAVE REMOVED CHANNELS */

function saveRemoved(){

  try{
    localStorage.setItem(
      "rutik_tv_removed",
      JSON.stringify(removed)
    );
  }catch(e){}
}


/* REMOVE CHANNEL */

function removeChannel(ch){

  if(!ch)return;

  var approved=false;

  try{
    approved=window.confirm(
      "Remove this channel from your list?"
    );
  }catch(e){}

  if(!approved)return;

  removed[ch.url]=true;

  saveRemoved();

  delete favs[ch.url];

  saveFavs();

  if(ch.url===playingUrl){
    stopPlayback();
  }

  var oldIndex=focusIndex;

  filtered=currentRows();

  focusIndex=Math.min(
    oldIndex,
    filtered.length-1
  );

  if(filtered.length===0){
    focusIndex=-1;
  }

  render();

  say("Channel removed successfully.");
}


/* TOGGLE FAVOURITE */

function toggleFav(ch){

  if(!ch)return;

  if(favs[ch.url]){
    delete favs[ch.url];
  }else{
    favs[ch.url]=true;
  }

  saveFavs();

  filtered=currentRows();

  if(focusIndex>=filtered.length){
    focusIndex=filtered.length-1;
  }

  render();

  say(
    favs[ch.url]
      ?"Added to favourites."
      :"Removed from favourites."
  );
}


/* RENDER CHANNEL LIST */

function render(){

  filtered=currentRows();

  if(focusIndex>=filtered.length){
    focusIndex=filtered.length-1;
  }

  box.innerHTML="";

  var title=activeCat==="all"
    ?"ALL CHANNELS"
    :activeCat.toUpperCase();

  document.getElementById("categoryTitle").textContent=title;

  if(!filtered.length){

    box.innerHTML=
      '<div class="hint">No channels available.</div>';

    shown.textContent="0";

    return;
  }

  if(focusIndex<0){
    focusIndex=0;
  }

  var start=Math.floor(focusIndex/PAGE_SIZE)*PAGE_SIZE;

  var end=Math.min(
    start+PAGE_SIZE,
    filtered.length
  );

  for(var i=start;i<end;i++){

    (function(index){

      var ch=filtered[index];

      var row=document.createElement("div");

      row.className="channel"+
        (index===focusIndex?" focused":"")+
        (ch.url===playingUrl?" playing":"");


      /* REMOVE BUTTON */

      var removeBtn=document.createElement("button");

      removeBtn.type="button";
      removeBtn.className="remove-channel";
      removeBtn.textContent="×";
      removeBtn.title="Remove channel";

      removeBtn.onclick=function(e){

        if(e&&e.stopPropagation){
          e.stopPropagation();
        }

        removeChannel(ch);
      };


      /* FAVOURITE BUTTON */

      var fav=document.createElement("button");

      fav.type="button";
      fav.className="fav";

      fav.textContent=favs[ch.url]?"★":"☆";

      fav.onclick=function(e){

        if(e&&e.stopPropagation){
          e.stopPropagation();
        }

        toggleFav(ch);
      };


      /* CHANNEL NAME */

      var name=document.createElement("strong");

      name.textContent=(index+1)+". "+ch.name;


      /* CATEGORY */

      var small=document.createElement("small");

      small.textContent=ch.cats.join(" · ");


      row.appendChild(removeBtn);
      row.appendChild(fav);
      row.appendChild(name);
      row.appendChild(small);


      row.onclick=function(){

        navMode="channels";

        focusIndex=index;

        render();

        say(
          "Selected: "+ch.name+
          " | Press OK to play."
        );
      };

      box.appendChild(row);

    })(i);
  }

  shown.textContent=
    (start+1)+"-"+end+" / "+filtered.length;
}


/* CHANNEL NAVIGATION */

function move(d){

  if(!filtered.length)return;

  if(focusIndex<0){
    focusIndex=0;
  }else{
    focusIndex=
      (focusIndex+d+filtered.length)%filtered.length;
  }

  navMode="channels";

  render();

  say(
    "Selected: "+filtered[focusIndex].name+
    " | OK = Play"
  );
}


/* MANUAL PLAY ONLY */

function play(index){

  if(index<0||index>=filtered.length)return;

  focusIndex=index;

  var ch=filtered[index];

  playingUrl=ch.url;

  nowName.textContent=ch.name;

  say("Starting selected channel...");

  render();

  try{
    video.pause();
    video.removeAttribute("src");
    video.load();
  }catch(e){}

  video.autoplay=false;

  video.src=ch.url;

  video.load();

  /* Play only after user action */

  var p=video.play();

  if(p&&p.catch){

    p.catch(function(){

      say(
        "Stream unavailable or unsupported. Try another channel."
      );
    });
  }
}


/* STOP PLAYBACK */

function stopPlayback(){

  try{
    video.pause();
    video.removeAttribute("src");
    video.load();
  }catch(e){}

  playingUrl="";

  nowName.textContent="No channel playing";

  say("Playback stopped.");

  render();
}


/* CATEGORY FOCUS */

function paintCategoryFocus(){

  categoryButtons.forEach(function(b,i){

    b.classList.toggle(
      "key-focused",
      navMode==="categories"&&i===categoryFocus
    );
  });
}


/* ACTIVATE CATEGORY */

function activateCategory(index){

  if(index<0||index>=categoryButtons.length)return;

  categoryFocus=index;

  activeCat=
    categoryButtons[index].getAttribute("data-cat");

  categoryButtons.forEach(function(b,i){

    b.classList.toggle(
      "selected",
      i===index
    );
  });

  focusIndex=0;

  navMode="channels";

  render();

  paintCategoryFocus();

  say(
    activeCat==="all"
      ?"All channels"
      :activeCat+" category"
  );
}


/* CATEGORY CLICK */

categoriesEl.addEventListener("click",function(e){

  var node=e.target;

  while(
    node&&
    node!==categoriesEl&&
    !(node.classList&&node.classList.contains("cat"))
  ){
    node=node.parentNode;
  }

  if(!node||node===categoriesEl)return;

  categoryFocus=categoryButtons.indexOf(node);

  activateCategory(categoryFocus);
});


/* PLAYER BUTTONS */

document.getElementById("prev").onclick=function(){
  move(-1);
};

document.getElementById("next").onclick=function(){
  move(1);
};

document.getElementById("playSelected").onclick=function(){

  if(focusIndex<0){
    focusIndex=0;
  }

  play(focusIndex);
};


/* CLEAR SEARCH */

document.getElementById("clear").onclick=function(){

  search.value="";

  focusIndex=0;

  navMode="channels";

  render();

  say("Search cleared.");
};


/* SEARCH */

search.onfocus=function(){
  navMode="search";
};

search.oninput=function(){

  focusIndex=0;

  render();
};

search.onkeydown=function(e){

  if(e.key==="Enter"){

    search.blur();

    navMode="channels";

    if(filtered.length){
      focusIndex=0;
    }

    render();

    say("Search results ready.");
  }
};


/* KEYPAD CONTROLS */

document.addEventListener("keydown",function(e){

  var tag=(
    document.activeElement&&
    document.activeElement.tagName||""
  ).toLowerCase();

  var key=e.key||e.keyCode;

  if(tag==="input"){

    if(key==="Escape"){

      search.blur();

      navMode="channels";
    }

    return;
  }


  /* UP */

  if(key==="ArrowUp"||key==="8"){

    e.preventDefault();

    if(navMode==="categories"){

      activateCategory(categoryFocus);

    }else{

      move(-1);
    }

    return;
  }


  /* DOWN */

  if(key==="ArrowDown"||key==="2"){

    e.preventDefault();

    if(navMode==="categories"){

      activateCategory(categoryFocus);

    }else{

      move(1);
    }

    return;
  }


  /* LEFT */

  if(key==="ArrowLeft"||key==="4"){

    e.preventDefault();

    navMode="categories";

    categoryFocus=Math.max(
      0,
      categoryFocus-1
    );

    paintCategoryFocus();

    return;
  }


  /* RIGHT */

  if(key==="ArrowRight"||key==="6"){

    e.preventDefault();

    navMode="categories";

    categoryFocus=Math.min(
      categoryButtons.length-1,
      categoryFocus+1
    );

    paintCategoryFocus();

    return;
  }


  /* SEARCH */

  if(key==="0"){

    e.preventDefault();

    search.focus();

    return;
  }


  /* FAVOURITE */

  if(key==="5"||key==="*"){

    e.preventDefault();

    toggleFav(filtered[focusIndex]);

    return;
  }


  /* OK */

  if(key==="Enter"||key===" "){

    e.preventDefault();

    if(navMode==="categories"){

      activateCategory(categoryFocus);

    }else if(filtered.length){

      if(focusIndex<0){
        focusIndex=0;
      }

      play(focusIndex);
    }

    return;
  }


  /* STOP */

  if(key==="Escape"){

    stopPlayback();
  }

});


/* VIDEO EVENTS */

video.addEventListener("playing",function(){

  say("LIVE · "+nowName.textContent);
});

video.addEventListener("waiting",function(){

  say("Buffering...");
});

video.addEventListener("error",function(){

  say("Stream unavailable or unsupported.");
});


/* LOAD PLAYLIST */

function loadPlaylist(index){

  if(index>=PLAYLISTS.length){

    count.textContent="Playlist unavailable";

    box.innerHTML=
      '<div class="hint">Playlist load failed. Check internet.</div>';

    say("Channel list load failed.");

    return;
  }

  if(typeof fetch!=="function"){

    count.textContent="Browser fetch unsupported";

    box.innerHTML=
      '<div class="hint">This browser does not support playlist loading.</div>';

    return;
  }

  count.textContent=
    "Loading source "+(index+1)+"/"+PLAYLISTS.length;


  fetch(PLAYLISTS[index])

    .then(function(r){

      if(!r.ok){
        throw new Error("HTTP error");
      }

      return r.text();
    })

    .then(function(text){

      if(text.indexOf("#EXTM3U")<0){
        throw new Error("Invalid playlist");
      }

      prepare(text);

      if(!all.length){
        throw new Error("No channels");
      }

      filtered=currentRows();

      focusIndex=filtered.length?0:-1;

      count.textContent=all.length+" channels";

      render();

      say(
        "Channels ready. Select a channel and press OK to play."
      );

    })

    .catch(function(){

      loadPlaylist(index+1);
    });
}


/* START */

loadPlaylist(0);

})();
