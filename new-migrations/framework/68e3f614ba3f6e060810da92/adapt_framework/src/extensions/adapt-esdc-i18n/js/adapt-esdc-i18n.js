define(["core/js/adapt"], function (Adapt) {

  function loadScript(scriptObject, callback) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = scriptObject.type || 'text/javascript';
    if (scriptObject.src) {
      script.src = scriptObject.src;
    }
    if (scriptObject.text) {
      script.text = scriptObject.text;
    }
    if (callback) {
      script.onreadystatechange = callback;
      script.onload = callback;
    }
    head.appendChild(script);
  }

  function init() {
    Adapt.wait ? Adapt.wait.begin() : Adapt.trigger("plugin:beginWait");
    loadScript({ src: './assets/jquery.i18n.js' }, function () {
      loadScript({ src: './assets/jquery.i18n.messagestore.js' }, function () {
        loadScript({ src: './assets/i18n.js' }, function () {
          Adapt.wait ? Adapt.wait.end() : Adapt.trigger("plugin:endWait");
          Adapt.trigger("i18n:ready");
        });
      });
    });
  };

  Adapt.once("app:dataReady", init);
});
