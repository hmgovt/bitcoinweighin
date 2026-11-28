/*
 * Anonymous visit counts (PostHog EU, cookieless). Described on /privacy.
 *
 * Counts page views so we can see which pages people read and where they came
 * from. Cookieless and kept in memory only: nothing is stored on the visitor's
 * device, and PostHog discards the IP address. Everything goes through
 * bitcoinweighin.com/e/ (functions/e/[[path]].ts), never to PostHog directly.
 *
 * Not counted at all: browsers sending Global Privacy Control or Do Not Track,
 * visitors who pressed "Don't count my visits" on /privacy, the /embed widget
 * (it runs on other people's pages), any framed copy, and every host other
 * than the live site (previews, localhost).
 *
 * Only the path changing counts as a new page view: moving the slider rewrites
 * the query string, which is not a new page.
 */
(function () {
	var POSTHOG_KEY = ''; // public project key (write-only, safe in pages); empty = counting off
	var NO_COUNT_KEY = 'bwi-no-count'; // set by the button on /privacy

	var optedOut = false;
	try {
		optedOut = localStorage.getItem(NO_COUNT_KEY) === '1';
	} catch (_) {}
	if (
		!POSTHOG_KEY ||
		location.hostname !== 'bitcoinweighin.com' ||
		/^\/embed(\/|$)/.test(location.pathname) ||
		window.top !== window ||
		navigator.globalPrivacyControl === true ||
		navigator.doNotTrack === '1' ||
		window.doNotTrack === '1' ||
		optedOut
	)
		return;

	// PostHog's standard loader.
	/* eslint-disable */
	!function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset get_distinct_id get_property".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
	/* eslint-enable */
	window.posthog.init(POSTHOG_KEY, {
		api_host: '/e',
		ui_host: 'https://eu.posthog.com',
		cookieless_mode: 'always',
		persistence: 'memory',
		respect_dnt: true,
		person_profiles: 'never',
		capture_pageview: 'history_change',
		capture_pageleave: true,
		autocapture: false,
		disable_session_recording: true,
		disable_surveys: true,
		disable_web_experiments: true,
		advanced_disable_flags: true,
		capture_performance: false,
		capture_dead_clicks: false,
		capture_heatmaps: false,
		enable_heatmaps: false,
		capture_exceptions: false
	});
})();
