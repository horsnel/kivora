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

  // Live clock
  (function(){
    var el=document.getElementById("liveClock");
    if(!el)return;
    function update(){
      var now=new Date();
      var h=String(now.getHours()).padStart(2,"0");
      var m=String(now.getMinutes()).padStart(2,"0");
      var s=String(now.getSeconds()).padStart(2,"0");
      var days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      var day=days[now.getDay()];
      var mon=months[now.getMonth()];
      var date=now.getDate();
      el.innerHTML='<span class="clock-time">'+h+'</span><span class="clock-sep">:</span><span class="clock-time">'+m+'</span><span class="clock-sep">:</span><span class="clock-time">'+s+'</span> <small style="font-weight:400;color:var(--text-muted);margin-left:6px;">'+day+', '+mon+' '+date+'</small>';
    }
    update();
    setInterval(update,1000);
  })();

  // Cookie consent
  var cc=localStorage.getItem("cookie_consent");
  if(cc==="accepted"&&typeof gtag==="function"){gtag("consent","update",{analytics_storage:"granted"})}
})();
