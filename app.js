(function(){
"use strict";
var PLAYLIST="https://iptv-org.github.io/iptv/countries/in.m3u";
var CATS=["Marathi","Hindi","News","Entertainment","Movies","Sports","Documentary & Lifestyle"];
var video=document.getElementById("video"),box=document.getElementById("channels"),search=document.getElementById("search");
var count=document.getElementById("count"),shown=document.getElementById("shown"),nowName=document.getElementById("nowName"),msg=document.getElementById("playMessage");
var all=[],filtered=[],activeCat="all",focusIndex=-1,playingUrl="",buttons=[];
var favs={};try{favs=JSON.parse(localStorage.getItem("rutik_tv_favs")||"{}")}catch(e){}
function say(t){msg.textContent=t}
function attr(line,key){var re=new RegExp(key+'="([^"]*)"',"i");return(line.match(re)||[])[1]||""}
function parseM3U(t){
 var out=[],meta=null;
 t.replace(/\r/g,"").split("\n").forEach(function(line){line=line.trim();if(!line)return;
  if(line.indexOf("#EXTINF:")===0){
   var comma=line.lastIndexOf(",");
   meta={name:comma>=0?line.slice(comma+1).trim():"TV Channel",group:attr(line,"group-title"),lang:attr(line,"tvg-language"),raw:line};
  }else if(line.charAt(0)!=="#"&&meta){meta.url=line;out.push(meta);meta=null}
 });
 return out;
}
function classify(ch){
 var s=(ch.name+" "+ch.group+" "+ch.lang+" "+ch.raw).toLowerCase();
 // Explicitly exclude the five unwanted content types/languages.
 if(/\b(english|eng|kids?|children|cartoon|devotional|bhakti|religious|education|educational|learning|music|songs?|radio)\b/.test(s))return [];
 var cats=[];
 if(/\b(marathi|mar)\b/.test(s))cats.push("Marathi");
 if(/\b(hindi|hin)\b/.test(s))cats.push("Hindi");
 if(/\b(news|news channel)\b/.test(s))cats.push("News");
 if(/\b(movie|movies|cinema|film)\b/.test(s))cats.push("Movies");
 if(/\b(sport|sports|cricket|football|tennis|badminton)\b/.test(s))cats.push("Sports");
 if(/\b(documentary|lifestyle|travel|food|nature|wildlife)\b/.test(s))cats.push("Documentary & Lifestyle");
 if(/\b(entertainment|general entertainment|serial|drama)\b/.test(s))cats.push("Entertainment");
 // Assign otherwise-unclassified Hindi/Marathi channels to Entertainment only if language is known.
 if(!cats.length && /\b(marathi|mar|hindi|hin)\b/.test(s))cats.push("Entertainment");
 return cats;
}
function prepare(){
 all=parseM3U(window.__playlistText||"").map(function(ch){ch.cats=classify(ch);return ch}).filter(function(ch){return ch.cats.length>0});
}
function currentRows(){
 var q=search.value.toLowerCase();
 return all.filter(function(ch){
  var catOK=activeCat==="all"?true:activeCat==="Favourites"?!!favs[ch.url]:ch.cats.indexOf(activeCat)>=0;
  return catOK&&ch.name.toLowerCase().indexOf(q)>=0;
 });
}
function render(){
 filtered=currentRows();box.innerHTML="";buttons=[];
 document.getElementById("categoryTitle").textContent=activeCat==="all"?"ALL CHANNELS":activeCat.toUpperCase();
 if(!filtered.length){box.innerHTML='<div class="hint">या Category मध्ये सध्या चॅनेल उपलब्ध नाहीत.</div>';shown.textContent="0";return}
 if(focusIndex>=filtered.length)focusIndex=-1;
 filtered.forEach(function(ch,i){
  var b=document.createElement("button");b.type="button";b.className="channel"+(i===focusIndex?" focused":"")+(ch.url===playingUrl?" playing":"");
  var f=document.createElement("button");f.type="button";f.className="fav";f.textContent=favs[ch.url]?"★":"☆";f.setAttribute("aria-label","Favourite");
  f.onclick=function(e){e.stopPropagation();if(favs[ch.url])delete favs[ch.url];else favs[ch.url]=true;try{localStorage.setItem("rutik_tv_favs",JSON.stringify(favs))}catch(x){}render()};
  var strong=document.createElement("strong");strong.textContent=(i+1)+". "+ch.name;
  var small=document.createElement("small");small.textContent=ch.cats.join(" · ");
  b.appendChild(f);b.appendChild(strong);b.appendChild(small);
  b.onclick=function(){focusIndex=i;render();say("निवडले: "+ch.name+" · सुरू करण्यासाठी OK दाबा.")};
  box.appendChild(b);buttons.push(b);
 });
 shown.textContent=filtered.length+" channels";
}
function play(i){
 if(i<0||i>=filtered.length)return;focusIndex=i;var ch=filtered[i];playingUrl=ch.url;nowName.textContent=ch.name;say("Connecting…");render();
 video.pause();video.removeAttribute("src");video.load();video.src=ch.url;video.load();var p=video.play();
 if(p&&p.catch)p.catch(function(){say("Stream सुरू झाले नाही. Video वरील Play दाबा किंवा दुसरे channel निवडा.")});
}
function move(d){
 if(!filtered.length)return;
 focusIndex=focusIndex<0?(d>0?0:filtered.length-1):(focusIndex+d+filtered.length)%filtered.length;
 if(playingUrl){play(focusIndex)}else{render();say("निवडले: "+filtered[focusIndex].name+" · OK दाबल्यावरच सुरू होईल.");if(buttons[focusIndex])buttons[focusIndex].scrollIntoView({block:"nearest"})}
}
document.getElementById("categories").addEventListener("click",function(e){var b=e.target.closest(".cat");if(!b)return;activeCat=b.dataset.cat;focusIndex=-1;Array.prototype.forEach.call(this.querySelectorAll(".cat"),function(x){x.classList.toggle("selected",x===b)});render();say(activeCat==="all"?"सर्व चॅनेल्स":activeCat+" category")});
document.getElementById("prev").onclick=function(){move(-1)};
document.getElementById("next").onclick=function(){move(1)};
document.getElementById("playSelected").onclick=function(){if(focusIndex<0&&filtered.length)focusIndex=0;play(focusIndex)};
document.getElementById("clear").onclick=function(){search.value="";focusIndex=-1;render();search.focus()};
search.oninput=function(){focusIndex=-1;render()};
video.addEventListener("playing",function(){say("LIVE · "+nowName.textContent)});
video.addEventListener("waiting",function(){say("Buffering…")});
video.addEventListener("error",function(){say("हा stream उपलब्ध नाही किंवा समर्थित नाही. NEXT वापरून दुसरा चॅनेल पाहा.")});
document.addEventListener("keydown",function(e){var tag=(document.activeElement&&document.activeElement.tagName||"").toLowerCase();if(tag==="INPUT")return;
 if(["ArrowDown","8","PageDown","ArrowRight"].indexOf(e.key)>=0){e.preventDefault();move(1)}
 else if(["ArrowUp","2","PageUp","ArrowLeft"].indexOf(e.key)>=0){e.preventDefault();move(-1)}
 else if(e.key==="Enter"||e.key===" "){e.preventDefault();if(focusIndex<0&&filtered.length)focusIndex=0;play(focusIndex)}
 else if(e.key==="Escape"){video.pause();video.removeAttribute("src");video.load();playingUrl="";nowName.textContent="No channel playing";say("Playback stopped.");render()}
});
fetch(PLAYLIST,{cache:"no-store"}).then(function(r){if(!r.ok)throw Error("HTTP "+r.status);return r.text()}).then(function(t){
 window.__playlistText=t;prepare();CATS.forEach(function(c){/* fixed categories are already in UI */});
 count.textContent=all.length+" included";render();say("कोणताही channel आपोआप सुरू होत नाही. निवडा आणि OK दाबा.");
}).catch(function(e){count.textContent="Playlist error";box.innerHTML='<div class="hint">Playlist load झाली नाही: '+String(e.message)+'. Cloud Browser मधील network/CORS तपासावे लागेल.</div>';say("Channel list load failed.")});
})();
