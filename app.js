(function(){
"use strict";

// Public Indian Free-to-Air playlist sources. Failed sources are skipped.
var PLAYLISTS=[
  "https://raw.githubusercontent.com/gnaidu05/Iptv/main/playlists/india-active.m3u",
  "https://raw.githubusercontent.com/gnaidu05/Iptv/main/playlists/india.m3u",
  "https://iptv-org.github.io/iptv/countries/in.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/in-mh.m3u",
  "https://iptv-org.github.io/iptv/languages/mar.m3u",
  "https://iptv-org.github.io/iptv/languages/hin.m3u"
];
var TARGET_HEIGHT=240;
var TARGET_BANDWIDTH=350000; // साधारण 150–350 kbps लक्ष्य
var CATS=["Marathi","Hindi","News","Entertainment","Movies","Sports","Documentary & Lifestyle"];

var video=document.getElementById("video");
var box=document.getElementById("channels");
var search=document.getElementById("search");
var count=document.getElementById("count");
var shown=document.getElementById("shown");
var nowName=document.getElementById("nowName");
var msg=document.getElementById("playMessage");

var all=[],filtered=[],activeCat="all",focusIndex=-1,playingUrl="",buttons=[];
var playRequest=0;
var favs={};
try{favs=JSON.parse(localStorage.getItem("rutik_tv_favs")||"{}")}catch(e){}

if(video){
  video.preload="metadata";
  video.setAttribute("playsinline","");
  video.setAttribute("webkit-playsinline","");
}

function say(t){if(msg)msg.textContent=t}
function attr(line,key){
  var re=new RegExp(key+'="([^"]*)"',"i");
  return(line.match(re)||[])[1]||"";
}

function parseM3U(t){
  var out=[],meta=null;
  t.replace(/\r/g,"").split("\n").forEach(function(line){
    line=line.trim();
    if(!line)return;
    if(line.indexOf("#EXTINF:")===0){
      var comma=line.lastIndexOf(",");
      meta={
        name:comma>=0?line.slice(comma+1).trim():"TV Channel",
        group:attr(line,"group-title"),
        lang:attr(line,"tvg-language"),
        raw:line
      };
    }else if(line.charAt(0)!=="#"&&meta){
      meta.url=line;
      out.push(meta);
      meta=null;
    }
  });
  return out;
}

function classify(ch){
  var name=(ch.name||"").toLowerCase();
  var group=(ch.group||"").toLowerCase();
  var lang=(ch.lang||"").toLowerCase();
  var s=name+" "+group+" "+lang+" "+(ch.raw||"").toLowerCase();
  if(/\b(english|eng|kids?|children|cartoon|devotional|bhakti|religious|education|educational|learning|music|songs?|radio)\b/.test(s))return [];
  var cats=[];
  if(/\b(marathi|mar|मराठी)\b/.test(s))cats.push("Marathi");
  if(/\b(hindi|hin|हिंदी)\b/.test(s))cats.push("Hindi");
  if(/\b(news|न्यूज|बातम्या)\b/.test(s))cats.push("News");
  if(/\b(movie|movies|cinema|film|films)\b/.test(s))cats.push("Movies");
  if(/\b(sport|sports|cricket|football|tennis|badminton)\b/.test(s))cats.push("Sports");
  if(/\b(documentary|lifestyle|travel|food|nature|wildlife)\b/.test(s))cats.push("Documentary & Lifestyle");
  if(/\b(entertainment|general entertainment|serial|drama)\b/.test(s))cats.push("Entertainment");
  if((lang==="mar"||lang==="marathi")&&cats.indexOf("Marathi")<0)cats.push("Marathi");
  if((lang==="hin"||lang==="hindi")&&cats.indexOf("Hindi")<0)cats.push("Hindi");
  if(/news/.test(group)&&cats.indexOf("News")<0)cats.push("News");
  if(/movie/.test(group)&&cats.indexOf("Movies")<0)cats.push("Movies");
  if(/sport/.test(group)&&cats.indexOf("Sports")<0)cats.push("Sports");
  if(/documentary|lifestyle/.test(group)&&cats.indexOf("Documentary & Lifestyle")<0)cats.push("Documentary & Lifestyle");
  if(!cats.length&&(/general|entertainment/.test(group)||!group))cats.push("Entertainment");
  return cats;
}

function prepare(texts){
  var byUrl={};
  texts.forEach(function(t){
    parseM3U(t||"").forEach(function(ch){
      if(!ch.url)return;
      if(!byUrl[ch.url]||(ch.group||"").length>(byUrl[ch.url].group||"").length)byUrl[ch.url]=ch;
    });
  });
  all=Object.keys(byUrl).map(function(url){
    var ch=byUrl[url];ch.cats=classify(ch);return ch;
  }).filter(function(ch){return ch.cats.length>0;});
}

function currentRows(){
  var q=(search.value||"").toLowerCase();
  return all.filter(function(ch){
    var catOK=activeCat==="all"?true:
      activeCat==="Favourites"?!!favs[ch.url]:ch.cats.indexOf(activeCat)>=0;
    return catOK&&ch.name.toLowerCase().indexOf(q)>=0;
  });
}

function render(){
  filtered=currentRows();
  box.innerHTML="";
  buttons=[];
  document.getElementById("categoryTitle").textContent=
    activeCat==="all"?"ALL CHANNELS":activeCat.toUpperCase();

  if(!filtered.length){
    box.innerHTML='<div class="hint">या Category मध्ये सध्या चॅनेल उपलब्ध नाहीत.</div>';
    shown.textContent="0";
    return;
  }
  if(focusIndex>=filtered.length)focusIndex=-1;

  filtered.forEach(function(ch,i){
    var b=document.createElement("div");
    b.setAttribute("role","button");
    b.setAttribute("tabindex","-1");
    b.className="channel"+(i===focusIndex?" focused":"")+(ch.url===playingUrl?" playing":"");

    var f=document.createElement("button");
    f.type="button";
    f.className="fav";
    f.textContent=favs[ch.url]?"★":"☆";
    f.setAttribute("aria-label","Toggle favourite");
    f.onclick=function(e){
      e.stopPropagation();
      if(favs[ch.url])delete favs[ch.url];else favs[ch.url]=true;
      try{localStorage.setItem("rutik_tv_favs",JSON.stringify(favs));}catch(x){}
      render();
    };

    var strong=document.createElement("strong");
    strong.textContent=(i+1)+". "+ch.name;
    var small=document.createElement("small");
    small.textContent=ch.cats.join(" · ");
    b.appendChild(f);
    b.appendChild(strong);
    b.appendChild(small);
    b.onclick=function(){
      focusIndex=i;
      render();
      say("निवडले: "+ch.name+" · सुरू करण्यासाठी OK दाबा.");
    };
    box.appendChild(b);
    buttons.push(b);
  });
  shown.textContent=filtered.length+" channels";
}

/*
  HLS master playlist मधून कमी resolution ची variant निवडण्याचा प्रयत्न.
  CORS मुळे playlist वाचता आली नाही तर मूळ URL वापरला जाईल.
  Fixed-quality stream असल्यास त्याची quality बदलता येत नाही.
*/
function getAttribute(line,name){
  var re=new RegExp("(?:^|,)"+name+"=([^,]*)","i");
  var m=line.match(re);
  return m?m[1].replace(/^"|"$/g,""):"";
}

function chooseLowQualityVariant(masterText,masterUrl){
  var lines=masterText.replace(/\r/g,"").split("\n");
  var variants=[];
  for(var i=0;i<lines.length;i++){
    var line=lines[i].trim();
    if(line.indexOf("#EXT-X-STREAM-INF:")!==0)continue;
    var uri="";
    for(var j=i+1;j<lines.length;j++){
      var next=lines[j].trim();
      if(next && next.charAt(0)!=="#"){uri=next;break;}
    }
    if(!uri)continue;

    var res=getAttribute(line,"RESOLUTION");
    var height=0;
    if(res){
      var parts=res.toLowerCase().split("x");
      height=parseInt(parts[1],10)||0;
    }
    var bandwidth=parseInt(getAttribute(line,"AVERAGE-BANDWIDTH")||
      getAttribute(line,"BANDWIDTH"),10)||0;

    try{uri=new URL(uri,masterUrl).href;}catch(e){}
    variants.push({url:uri,height:height,bandwidth:bandwidth});
  }

  if(!variants.length)return null;

  var eligible=variants.filter(function(v){
    return v.height>0 && v.height<=TARGET_HEIGHT &&
      (!v.bandwidth || v.bandwidth<=TARGET_BANDWIDTH);
  });

  if(eligible.length){
    eligible.sort(function(a,b){
      return (b.height-a.height)||(b.bandwidth-a.bandwidth);
    });
    return eligible[0];
  }

  // 240p variant नसेल तर उपलब्ध सर्वात कमी resolution निवडा.
  variants.sort(function(a,b){
    return (a.height||99999)-(b.height||99999) ||
      (a.bandwidth||999999999)-(b.bandwidth||999999999);
  });
  return variants[0];
}

function resolveStreamUrl(originalUrl){
  return fetch(originalUrl,{cache:"no-store"})
    .then(function(response){
      if(!response.ok)throw new Error("Playlist fetch failed");
      return response.text();
    })
    .then(function(text){
      if(text.indexOf("#EXTM3U")===-1 ||
         text.indexOf("#EXT-X-STREAM-INF")===-1){
        return {url:originalUrl,quality:"मूळ stream"};
      }
      var variant=chooseLowQualityVariant(text,originalUrl);
      if(!variant)return {url:originalUrl,quality:"मूळ stream"};
      var label=variant.height?variant.height+"p":"Low quality";
      return {url:variant.url,quality:label};
    })
    .catch(function(){
      return {url:originalUrl,quality:"Auto / मूळ stream"};
    });
}

function play(i){
  if(i<0||i>=filtered.length)return;
  focusIndex=i;
  var ch=filtered[i];
  var request=++playRequest;
  playingUrl=ch.url;
  nowName.textContent=ch.name;
  say("कमी Quality (240p) stream शोधत आहे…");
  render();

  video.pause();
  video.removeAttribute("src");
  video.load();

  resolveStreamUrl(ch.url).then(function(result){
    if(request!==playRequest)return;
    say("Stream सुरू करत आहे · "+result.quality);
    video.src=result.url;
    video.load();
    var p=video.play();
    if(p&&p.catch){
      p.catch(function(){
        if(request===playRequest)
          say("Stream सुरू झाले नाही. Video वरील Play दाबा किंवा दुसरे channel निवडा.");
      });
    }
  });
}

function move(d){
  if(!filtered.length)return;
  focusIndex=focusIndex<0?(d>0?0:filtered.length-1):
    (focusIndex+d+filtered.length)%filtered.length;
  if(playingUrl){play(focusIndex);}
  else{
    render();
    say("निवडले: "+filtered[focusIndex].name+" · OK दाबल्यावरच सुरू होईल.");
    if(buttons[focusIndex])buttons[focusIndex].scrollIntoView({block:"nearest"});
  }
}

document.getElementById("categories").addEventListener("click",function(e){
  var b=e.target.closest(".cat");
  if(!b)return;
  activeCat=b.dataset.cat;
  focusIndex=-1;
  Array.prototype.forEach.call(this.querySelectorAll(".cat"),function(x){
    x.classList.toggle("selected",x===b);
  });
  render();
  say(activeCat==="all"?"सर्व चॅनेल्स":activeCat+" category");
});

document.getElementById("prev").onclick=function(){move(-1);};
document.getElementById("next").onclick=function(){move(1);};
document.getElementById("playSelected").onclick=function(){
  if(focusIndex<0&&filtered.length)focusIndex=0;
  play(focusIndex);
};
document.getElementById("clear").onclick=function(){
  search.value="";
  focusIndex=-1;
  render();
  search.focus();
};
search.oninput=function(){focusIndex=-1;render();};

video.addEventListener("playing",function(){say("LIVE · "+nowName.textContent);});
video.addEventListener("waiting",function(){say("Buffering… कमी Quality stream वापरली जात आहे.");});
video.addEventListener("error",function(){
  say("हा stream उपलब्ध नाही किंवा समर्थित नाही. NEXT वापरून दुसरा चॅनेल पाहा.");
});

document.addEventListener("keydown",function(e){
  var tag=(document.activeElement&&document.activeElement.tagName||"").toLowerCase();
  if(tag==="input")return;
  if(["ArrowDown","8","PageDown","ArrowRight"].indexOf(e.key)>=0){
    e.preventDefault();move(1);
  }else if(["ArrowUp","2","PageUp","ArrowLeft"].indexOf(e.key)>=0){
    e.preventDefault();move(-1);
  }else if(e.key==="Enter"||e.key===" "){
    e.preventDefault();
    if(focusIndex<0&&filtered.length)focusIndex=0;
    play(focusIndex);
  }else if(e.key==="Escape"){
    playRequest++;
    video.pause();
    video.removeAttribute("src");
    video.load();
    playingUrl="";
    nowName.textContent="No channel playing";
    say("Playback stopped.");
    render();
  }
});

Promise.all(PLAYLISTS.map(function(url){
  return fetch(url,{cache:"no-store"})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.text();})
    .then(function(text){return {url:url,text:text};})
    .catch(function(){return {url:url,text:""};});
})).then(function(results){
  var good=results.filter(function(x){return !!x.text;});
  var failed=results.length-good.length;
  if(!good.length)throw new Error("कोणतीही playlist load झाली नाही. Network/CORS तपासा.");
  prepare(good.map(function(x){return x.text;}));
  count.textContent=all.length+" channels · "+good.length+"/"+PLAYLISTS.length+" sources";
  render();
  say("भारतीय channels load झाले. "+failed+" source उपलब्ध नाहीत; इतर sources मधील channels वापरता येतील.");
}).catch(function(e){
  count.textContent="Playlist error";
  box.innerHTML='<div class="hint">Playlist load झाली नाही: '+String(e.message)+'. Internet / Cloud Browser network तपासा.</div>';
  say("Channel list load failed.");
});
})();
    
