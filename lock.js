/* Aru: one-language mode.
   ?lang=en|ru|kk|kz in the address fixes the language and hides the switcher.
   The choice is remembered on this device, so the app, showroom and lessons
   open in the same language. The trilingual landing (no ?lang) clears it. */
(function(){
  var codes={ru:0,kk:1,kz:1,en:2}, v=null;
  try{
    var q=new URLSearchParams(location.search).get('lang');
    var isLanding=document.currentScript&&document.currentScript.hasAttribute('data-landing');
    if(q!=null&&Object.prototype.hasOwnProperty.call(codes,q)){ v=codes[q]; localStorage.setItem('aru_lock_lang',String(v)); }
    else if(isLanding){ localStorage.removeItem('aru_lock_lang'); }
    else { var s=localStorage.getItem('aru_lock_lang'); if(s==='0'||s==='1'||s==='2') v=+s; }
  }catch(e){}
  window.ARU_LOCK=v;
  if(v!=null){
    document.documentElement.classList.add('solo');
    document.documentElement.lang=['ru','kk','en'][v];
    var st=document.createElement('style');
    st.textContent='.solo .langs,.solo .guide-langs,.solo .solo-hide{display:none!important}';
    document.head.appendChild(st);
  }
})();
