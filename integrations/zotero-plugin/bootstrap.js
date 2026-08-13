/* eslint-disable no-unused-vars -- Zotero calls these bootstrap globals by name. */
var SociologyPhdDeskHandoff;
var SociologyPhdDeskPlugin;

function log(message) {
	Zotero.debug("Sociology PhD Desk: " + message);
}

function install(data) {
	log("Installed " + data.version);
}

async function startup({ id, version, rootURI }) {
	await Zotero.initializationPromise;
	Services.scriptloader.loadSubScript(rootURI + "handoff.js");
	Services.scriptloader.loadSubScript(rootURI + "plugin.js");
	SociologyPhdDeskPlugin.init({ id, version, rootURI });
	for (let window of Zotero.getMainWindows()) {
		if (window.ZoteroPane) SociologyPhdDeskPlugin.addToWindow(window);
	}
	SociologyPhdDeskPlugin.registerMenu();
	log("Started " + version);
}

function onMainWindowLoad({ window }) {
	SociologyPhdDeskPlugin?.addToWindow(window);
}

function onMainWindowUnload({ window }) {
	SociologyPhdDeskPlugin?.removeFromWindow(window);
}

function shutdown(data, reason) {
	if (reason == APP_SHUTDOWN) return;
	SociologyPhdDeskPlugin?.shutdown();
	SociologyPhdDeskPlugin = undefined;
	SociologyPhdDeskHandoff = undefined;
	log("Stopped " + data.version);
}

function uninstall(data) {
	log("Uninstalled " + data.version);
}
