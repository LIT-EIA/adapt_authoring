define([
	'core/js/adapt',
	'./guidedtourView',
	'core/js/models/itemsComponentModel'
], function (Adapt, GuidedtourView, ItemsComponentModel) {

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
			// Then bind the event to the callback function.
			// There are several events for cross browser compatibility.
			script.onreadystatechange = callback;
			script.onload = callback;
		}

		// Append the <script> tag.
		head.appendChild(script);
	}

	function setShepherdJS() {
		Adapt.wait ? Adapt.wait.begin() : Adapt.trigger("plugin:beginWait");
		var src = "./assets/shepherd/shepherd.js";
		loadScript({ src: src }, function () {
			Adapt.wait ? Adapt.wait.end() : Adapt.trigger("plugin:endWait");
		});
	}

	Adapt.once("app:dataReady", setShepherdJS)

	return Adapt.register('guidedtour', {
		model: ItemsComponentModel,
		view: GuidedtourView
	});

});