(function(){
  var t=document.getElementById("menu-toggle"),n=document.getElementById("main-nav");
  if(t&&n){t.addEventListener("click",function(){n.classList.toggle("open");var o=n.classList.contains("open");t.setAttribute("aria-expanded",o);t.innerHTML=o?"\u2715":"\u2630"});for(var l=n.querySelectorAll("a"),i=0;i<l.length;i++)l[i].addEventListener("click",function(){n.classList.remove("open");t.innerHTML="\u2630";t.setAttribute("aria-expanded","false")})}
})();
