(function(){
  // Back to top
  var btn=document.getElementById("backToTop");
  window.addEventListener("scroll",function(){btn.style.display=window.scrollY>300?"block":"none"});
  btn.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"})});

  // Dark mode toggle
  (function(){
    var toggle=document.getElementById("theme-toggle");
    if(!toggle)return;
    var saved=localStorage.getItem("theme");
    if(saved){document.documentElement.setAttribute("data-theme",saved)}
    else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches){
      document.documentElement.setAttribute("data-theme","dark");
    }
    toggle.addEventListener("click",function(){
      var current=document.documentElement.getAttribute("data-theme");
      var next=current==="dark"?"light":"dark";
      document.documentElement.setAttribute("data-theme",next);
      localStorage.setItem("theme",next);
    });
  })();

  // Header date - full professional format
  (function(){
    var dateEl=document.getElementById("headerDate");
    if(!dateEl)return;
    function update(){
      var now=new Date();
      var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      var months=["January","February","March","April","May","June","July","August","September","October","November","December"];
      var day=days[now.getDay()];
      var mon=months[now.getMonth()];
      var date=now.getDate();
      var year=now.getFullYear();
      dateEl.textContent=day+', '+mon+' '+date+', '+year;
    }
    update();
    setInterval(update,60000);
  })();

  // Live clock - 12h format with AM/PM
  (function(){
    var el=document.getElementById("liveClock");
    if(!el)return;
    function update(){
      var now=new Date();
      var h=now.getHours();
      var m=String(now.getMinutes()).padStart(2,"0");
      var s=String(now.getSeconds()).padStart(2,"0");
      var ampm=h>=12?"PM":"AM";
      h=h%12||12;
      el.innerHTML='<span class="clock-time">'+h+':'+m+':'+s+'</span> <span class="clock-ampm">'+ampm+'</span>';
    }
    update();
    setInterval(update,1000);
  })();

  // Cookie consent
  var cc=localStorage.getItem("cookie_consent");
  if(cc==="accepted"&&typeof gtag==="function"){gtag("consent","update",{analytics_storage:"granted"})}

  // Reading progress bar (article pages only)
  (function(){
    var bar = document.getElementById("reading-progress-bar");
    if (!bar) return;
    var article = bar.closest(".post-page") || bar.closest("article");
    if (!article) return;
    window.addEventListener("scroll", function(){
      var rect = article.getBoundingClientRect();
      var articleTop = rect.top + window.scrollY;
      var articleHeight = article.scrollHeight;
      var scrolled = window.scrollY - articleTop + window.innerHeight * 0.3;
      var progress = Math.max(0, Math.min(100, (scrolled / articleHeight) * 100));
      bar.style.width = progress + "%";
    });
  })();
})();

  // Breaking news dynamic loader
  (function(){
    var alert = document.getElementById("breaking-alert");
    if (!alert) return;
    // Only fetch if no static headline is set (param-based fallback already rendered)
    var existingText = alert.querySelector(".breaking-alert-text");
    if (existingText && existingText.textContent.trim()) return;
    fetch("/api/breaking-news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get" })
    }).then(function(r){ return r.json(); }).then(function(data){
      if (!data.active || !data.headline) return;
      if (localStorage.getItem("breaking_dismissed")) return;
      alert.style.display = "";
      var badge = alert.querySelector(".breaking-alert-badge");
      var textEl = alert.querySelector(".breaking-alert-text");
      if (textEl) textEl.textContent = data.headline;
      if (data.link) {
        alert.style.cursor = "pointer";
        alert.addEventListener("click", function(){
          window.open(data.link, "_blank");
        });
      }
      var closeBtn = document.getElementById("breaking-alert-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", function(e){
          e.stopPropagation();
          alert.style.display = "none";
          localStorage.setItem("breaking_dismissed", "1");
        });
      }
    }).catch(function(){});
  })();
