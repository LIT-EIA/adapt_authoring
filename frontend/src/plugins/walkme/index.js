define(function (require) {
    var Origin = require('core/origin');

    function enableWalkMe() {
        var walkme = document.createElement('script');
        walkme.type = 'text/javascript';
        walkme.async = true;
        walkme.src = 'https://cdn.walkme.com/users/fdd897d9b38b430d8c765f992e33e82b/test/walkme_fdd897d9b38b430d8c765f992e33e82b_https.js';
        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(walkme, s);
        window._walkmeConfig = {smartLoad:true};
    }

    if(Origin.constants.useWalkMe){
        enableWalkMe();
    }

});