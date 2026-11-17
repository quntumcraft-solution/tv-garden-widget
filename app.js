(function(){
var INDIA="https://iptv-org.github.io/iptv/countries/in.m3u";
var TEST="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
var video=document.getElementById("video"), list=document.getElementById("channels");
var status=document.getElementById("status"), notice=document.getElementById("notice");
var playing=document.getElementById("playing"), search=document.getElementById("search");
var group=document.getElementById("group"), data=[];
function msg(t){notice.textContent=t}
function parseM3U(t){
 var out=[],meta=null;
 t.replace(/\r/g,"").split("\n").forEach(function(line){
  line=line.trim(); if(!line)return;
  if(line.indexOf("#EXTINF:")===0){
   var comma=line.lastIndexOf(",");
   meta={name:comma>=0?line.slice(comma+1).trim():"TV channel",
    group:(line.match(/group-title="([^"]*)"/i)||[])[1]||"Other"};
  }else if(line[0]!="#"&&meta){meta.url=line;out.push(meta);meta=null}
 });
 return out;
}
function play(ch){
 playing.textContent=ch.name;msg("Connecting…");
 video.pause();video.removeAttribute("src");video.load();
 video.src=ch.url;video.load();
 var p=video.play();
 if(p&&p.catch)p.catch(function(){msg("Playback did not start. Press Play on the video controls, or try another channel.")});
}
video.addEventListener("playing",function(){msg("Video is playing.")});
video.addEventListener("error",function(){var c=video.error?video.error.code:"unknown";msg("Stream error ("+c+"). This channel may be offline, restricted, or incompatible. Try another.")});
function render(){
 var q=search.value.toLowerCase(),g=group.value;
 var rows=data.filter(function(x){return x.name.toLowerCase().indexOf(q)>=0&&(g==="all"||x.group===g)});
 list.innerHTML="";
 if(!rows.length){list.innerHTML='<p class="hint">No channels found.</p>';return}
 rows.slice(0,300).forEach(function(ch){
  var b=document.createElement("button");b.className="ch";b.type="button";
  var strong=document.createElement("strong");strong.textContent=ch.name;
  var small=document.createElement("small");small.textContent=ch.group;
  b.appendChild(strong);b.appendChild(small);b.addEventListener("click",function(){play(ch)});
  list.appendChild(b);
 });
}
function loadIndia(){
 status.textContent="Loading playlist…";msg("Downloading the public India playlist…");
 fetch(INDIA,{cache:"no-store"}).then(function(r){if(!r.ok)throw Error("HTTP "+r.status);return r.text()})
 .then(function(t){
  data=parseM3U(t);if(!data.length)throw Error("Playlist contained no channels");
  var groups={};data.forEach(function(x){groups[x.group]=1});
  group.innerHTML='<option value="all">All groups</option>';
  Object.keys(groups).sort().forEach(function(g){var o=document.createElement("option");o.value=g;o.textContent=g;group.appendChild(o)});
  render();status.textContent=data.length+" channels listed";msg("Choose a channel. Availability varies by stream.");
 }).catch(function(e){
  status.textContent="Playlist could not load";
  list.innerHTML='<p class="hint">The playlist could not be downloaded in this Cloud Browser. Error: '+String(e.message)+'. You can still test video playback above. This may be a browser CORS/network restriction.</p>';
  msg("India channel list could not be fetched. The player test is separate.");
 });
}
document.getElementById("test").addEventListener("click",function(){play({name:"HLS test stream",url:TEST})});
document.getElementById("loadIndia").addEventListener("click",loadIndia);
search.addEventListener("input",render);group.addEventListener("change",render);
document.addEventListener("keydown",function(e){
 var bs=[].slice.call(list.querySelectorAll("button.ch"));if(!bs.length)return;
 var i=bs.indexOf(document.activeElement);
 if(e.key==="ArrowDown"||e.key==="ArrowRight"){e.preventDefault();bs[(i+1+bs.length)%bs.length].focus()}
 if(e.key==="ArrowUp"||e.key==="ArrowLeft"){e.preventDefault();bs[(i<=0?bs.length-1:i-1)].focus()}
 if(e.key==="Enter"&&i>=0){e.preventDefault();bs[i].click()}
});
status.textContent="Ready";
})();