(function(){
  var r=document.getElementById("search-toggle"),t=document.getElementById("search-overlay"),s=document.getElementById("search-input"),c=document.getElementById("search-close"),n=document.getElementById("search-results");
  function h(){t&&(t.classList.add("active"),document.body.style.overflow="hidden",s&&s.focus())}
  function d(){t&&(t.classList.remove("active"),document.body.style.overflow="",s&&(s.value=""),n&&(n.innerHTML=""))}
  r&&r.addEventListener("click",h);
  c&&c.addEventListener("click",d);
  t&&t.addEventListener("click",function(e){e.target===t&&d()});
  document.addEventListener("keydown",function(e){e.key==="Escape"&&d(),(e.ctrlKey||e.metaKey)&&e.key==="k"&&(e.preventDefault(),h())});
  s&&n&&(var sm=null,sa=null,su=null;
  fetch("/index.json").then(function(e){return e.json()}).then(function(e){sm=e,sa=new Fuse(e,{keys:["title","summary","categories","tags"],threshold:.35,ignoreLocation:true,includeScore:true})}).catch(function(){});
  s.addEventListener("input",function(){clearTimeout(su);var e=s.value.trim();if(!e){n.innerHTML="";return}su=setTimeout(function(){if(!sa){n.innerHTML="<p style='color:#888;padding:20px;'>Loading...</p>";return}var t,s,o,r,c,l,i=sa.search(e);if(!i.length){n.innerHTML="<p style='color:#888;padding:20px;'>No results found.</p>";return}for(s="",l=Math.min(i.length,10),o=0;o<l;o++)t=i[o].item,r=t.categories&&t.categories.length?t.categories[0]:"",c=t.date?new Date(t.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"",s+='<a class="search-result-item" href="'+t.permalink+'">',t.image&&(s+='<img src="'+t.image+'" alt="" />'),s+='<div class="search-result-body">',r&&(s+='<span class="search-result-cat">'+r+"</span>"),s+="<h3>"+t.title+"</h3>",t.summary&&(s+="<p>"+t.summary.substring(0,140)+"...</p>"),c&&(s+='<span class="search-result-date">'+c+"</span>"),s+="</div></a>";n.innerHTML=s},250)})})})();
