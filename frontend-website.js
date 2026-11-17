/* Frontend Skills: escape-to-close mobile navigation and navigation focus. */
(()=>{"use strict";
 const menu=document.getElementById("menuToggle");
 const links=document.getElementById("navLinks");
 if(menu&&links){
   document.addEventListener("keydown",e=>{
     if(e.key!=="Escape"||menu.getAttribute("aria-expanded")!=="true")return;
     links.classList.remove("open");menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-label","Open menu");menu.focus();
   });
   document.addEventListener("click",e=>{
     if(menu.getAttribute("aria-expanded")!=="true")return;
     if(menu.contains(e.target)||links.contains(e.target))return;
     links.classList.remove("open");menu.setAttribute("aria-expanded","false");menu.setAttribute("aria-label","Open menu");
   });
 }
 const frame=document.querySelector(".demo-iframe");
 if(frame){frame.setAttribute("loading","lazy");frame.setAttribute("referrerpolicy","strict-origin-when-cross-origin")}
})();