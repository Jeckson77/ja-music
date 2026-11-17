/* Frontend Skills: navigation state, keyboard clarity, and demo-specific semantics. */
(function(){
  "use strict";
  function initialize(){
    const isStudio=!!document.getElementById("overview");
    document.body.dataset.jaApp=isStudio?"studio":"listener";
    const nav=document.querySelector(".phone .nav");
    if(nav){
      nav.setAttribute("aria-label",isStudio?"Ja Music Studio navigation":"Ja Music listener navigation");
      const sync=()=>{
        nav.querySelectorAll("button[data-goto]").forEach(button=>{
          const isActive=button.classList.contains("active");
          if(isActive){if(button.getAttribute("aria-current")!=="page")button.setAttribute("aria-current","page")}
          else if(button.hasAttribute("aria-current"))button.removeAttribute("aria-current");
        });
      };
      const observer=new MutationObserver(sync);
      observer.observe(nav,{subtree:true,attributes:true,attributeFilter:["class"]});
      sync();
    }
    const toast=document.getElementById("toast");
    if(toast){toast.setAttribute("role","status");toast.setAttribute("aria-live","polite");toast.setAttribute("aria-atomic","true")}
    // Native-like keyboard Escape: close transient overlays without modifying business logic.
    document.addEventListener("keydown",event=>{
      if(event.key!=="Escape")return;
      const close=document.getElementById("closeProfileModal");
      const profile=document.getElementById("profileModal");
      if(profile&&!profile.hidden&&close){close.click();return}
      const receipt=document.getElementById("giftReceipt");
      const done=document.getElementById("closeGiftReceipt");
      if(receipt&&!receipt.hidden&&done)done.click();
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();