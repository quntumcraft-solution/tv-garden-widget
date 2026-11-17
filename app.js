(function(){
"use strict";
var PLAYLIST="https://iptv-org.github.io/iptv/countries/in.m3u";
var video=document.getElementById("video"), channelsBox=document.getElementById("channels");
var search=document.getElementById("search"), cats=document.getElementById("categories");
var count=document.getElementById("count"), shown=document.getElementById("shown");
var nowName=document.getElementById("nowName"), playMessage=document.getElementById("playMessage");
var all=[], filtered=[], current=-1, activeCat="all", buttons=[];
function say(s){playMessage.textContent=s}
function parse(text){
 var out=[],meta=null;
 text.replace(/\r/g,"").split("\n").forEach(function(line){
  line=line.trim();if(!line)return;
  if(line.indexOf("#EXTINF:")===0){
   var comma=line.lastIndexOf(",");
   meta={name:comma>=0?line.slice(comma+1).trim():"TV Channel",
    group:(line.match(/group-title="([^"]*)"/i)||[])[1]||"Other"};
  }else if(line.charAt(0)!=="#"&&meta){meta.url=line;out.push(meta);meta=null}
 });
 return out;
}
function makeCategories(){
 var groups={};all.forEach(function(c){groups[c.group]=1});
 Object.keys(groups).sort().forEach(function(g){
  var b=document.createElement("button");b.className="cat";b.dataset.cat=g;b.textContent=g.toUpperCase();
  b.addEventListener("click",function(){activeCat=g;current=-1;markCat();render()});cats.appendChild(b);
 });
}
function markCat(){Array.prototype.forEach.call(cats.querySelectorAll(".cat"),function(b){b.classList.toggle("selected",b.dataset.cat===activeCat)})}
function render(){
 var q=search.value.toLowerCase();
 filtered=all.filter(function(c){return (activeCat==="all"||c.group===activeCat)&&c.name.toLowerCase().indexOf(q)!==-1});
 channelsBox.innerHTML="";buttons=[];
 if(!filtered.length){channelsBox.innerHTML='<div class="hint">No matching channels. Try another category or search.</div>';shown.textContent="0";return}
 filtered.forEach(function(ch,i){
  var b=document.createElement("button");b.type="button";b.className="channel"+(i===current?" selected":"");
  var strong=document.createElement("strong");strong.textContent=(i+1)+". "+ch.name;
  var small=document.createElement("small");small.textContent=ch.group;
  b.appendChild(strong);b.appendChild(small);
  b.addEventListener("click",function(){playIndex(i)});
  channelsBox.appendChild(b);buttons.push(b);
 });
 shown.textContent=filtered.length+" found";
}
function playIndex(i){
 if(!filtered.length)return;
 if(i<0)i=filtered.length-1;if(i>=filtered.length)i=0;
 current=i;var ch=filtered[current];
 nowName.textContent=ch.name;say("Connecting to "+ch.name+"…");
 render();
 video.pause();video.removeAttribute("src");video.load();video.src=ch.url;video.load();
 var p=video.play();if(p&&p.catch)p.catch(function(){say("Cannot autoplay this stream. Press ▶ on the video. If it fails, try NEXT channel.")});
 if(buttons[current])buttons[current].scrollIntoView({block:"nearest"});
}
function step(d){if(!filtered.length)return;playIndex(current<0?(d>0?0:filtered.length-1):current+d)}
video.addEventListener("playing",function(){say("LIVE · "+nowName.textContent)});
video.addEventListener("waiting",function(){say("Buffering…")});
video.addEventListener("error",function(){var code=video.error?video.error.code:"?";say("Stream unavailable / unsupported (error "+code+"). Press NEXT to try another channel.")});
document.getElementById("prev").addEventListener("click",function(){step(-1)});
document.getElementById("next").addEventListener("click",function(){step(1)});
document.getElementById("clear").addEventListener("click",function(){search.value="";render();search.focus()});
search.addEventListener("input",function(){current=-1;render()});
document.addEventListener("keydown",function(e){
 var tag=(document.activeElement&&document.activeElement.tagName||"").toLowerCase();
 if(tag==="input"||tag==="select")return;
 if(e.key==="ArrowDown"||e.key==="8"||e.key==="PageDown"){e.preventDefault();step(1)}
 else if(e.key==="ArrowUp"||e.key==="2"||e.key==="PageUp"){e.preventDefault();step(-1)}
 else if(e.key==="Enter"||e.key===" "){e.preventDefault();if(current>=0)playIndex(current);else step(1)}
 else if(e.key==="ArrowLeft"){e.preventDefault();step(-1)}
 else if(e.key==="ArrowRight"){e.preventDefault();step(1)}
});
fetch(PLAYLIST,{cache:"no-store"}).then(function(r){if(!r.ok)throw Error("HTTP "+r.status);return r.text()})
.then(function(t){all=parse(t);if(!all.length)throw Error("No channel data");makeCategories();markCat();count.textContent=all.length+" channels";render();say("Choose a channel. ▲/▼ or 2/8 changes channels.")})
.catch(function(err){count.textContent="Playlist error";channelsBox.innerHTML='<div class="hint">Could not load channel list: '+String(err.message)+'. Your Cloud Browser may block playlist access (CORS/network). Please send this screen to troubleshoot.</div>';say("Channel list failed to load.")});
})();
