(function(){
  var btn=document.getElementById("backToTop");
  window.addEventListener("scroll",function(){btn.style.display=window.scrollY>300?"block":"none"});
  btn.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"})});
  var cc=localStorage.getItem("cookie_consent");
  if(cc==="accepted"&&typeof gtag==="function"){gtag("consent","update",{analytics_storage:"granted"})}
})();