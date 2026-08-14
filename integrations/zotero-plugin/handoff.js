(function (root, factory) {
	let api = factory();
	if (typeof module == "object" && module.exports) module.exports = api;
	else root.SociologyPhdDeskHandoff = api;
})(this, function () {
	"use strict";

	const APPLICATION = "sociology-phd-desk-zotero";
	const VERSION = 1;
	const MAX_ITEMS = 1000;
	const MAX_FRAGMENT_CHARACTERS = 12 * 1024;
	const APP_URL = "https://yoesher.github.io/sociology-phd-desk/";
	const BUNDLE_EXTENSION = ".spdzotero";
	const supportedTypes = new Set([
		"artwork", "audioRecording", "bill", "blogPost", "book", "bookSection", "case",
		"computerProgram", "conferencePaper", "dataset", "dictionaryEntry", "document",
		"email", "encyclopediaArticle", "film", "forumPost", "hearing", "instantMessage",
		"interview", "journalArticle", "letter", "magazineArticle", "manuscript", "map",
		"newspaperArticle", "patent", "podcast", "preprint", "presentation",
		"radioBroadcast", "report", "standard", "statute", "thesis", "tvBroadcast",
		"videoRecording", "webpage",
	]);

	function boundedString(value, maxLength) {
		if (value === null || value === undefined) return undefined;
		let result = String(value);
		return result ? result.slice(0, maxLength) : undefined;
	}

	function isoDateTime(value) {
		if (!value) return undefined;
		let normalized = String(value).replace(" ", "T");
		if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) normalized += "Z";
		let date = new Date(normalized);
		return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
	}

	function serializeCreator(creator, creatorTypeName) {
		let serialized = {};
		let creatorType = boundedString(creatorTypeName, 240);
		let firstName = boundedString(creator.firstName, 1000);
		let lastName = boundedString(creator.lastName, 1000);
		let name = boundedString(creator.name, 1000);
		if (creatorType) serialized.creatorType = creatorType;
		if (firstName) serialized.firstName = firstName;
		if (lastName) serialized.lastName = lastName;
		if (name) serialized.name = name;
		return serialized;
	}

	function serializeRegularItem(item, adapters) {
		if (!item?.isRegularItem?.()) throw new Error("Only regular bibliographic items can be sent.");
		let itemType = adapters.itemTypeName(item);
		if (!supportedTypes.has(itemType)) throw new Error("Unsupported Zotero item type: " + itemType);
		let title = boundedString(item.getField("title"), 1000);
		if (!title) throw new Error("A selected Zotero item has no title.");
		let serialized = {
			itemKey: boundedString(item.key, 240),
			libraryID: item.libraryID,
			itemType,
			title,
			creators: item.getCreators().slice(0, 1000).map(creator =>
				serializeCreator(creator, adapters.creatorTypeName(creator.creatorTypeID))),
		};
		if (!serialized.itemKey) throw new Error("A selected Zotero item has no stable item key.");

		let optionalFields = {
			libraryType: adapters.libraryType(item.libraryID),
			itemVersion: item.version,
			date: item.getField("date"),
			publicationTitle: item.getField("publicationTitle"),
			volume: item.getField("volume"),
			issue: item.getField("issue"),
			pages: item.getField("pages"),
			publisher: item.getField("publisher"),
			place: item.getField("place"),
			DOI: item.getField("DOI"),
			ISBN: item.getField("ISBN"),
			ISSN: item.getField("ISSN"),
			URL: item.getField("url"),
			abstractNote: item.getField("abstractNote"),
			dateAdded: isoDateTime(item.dateAdded),
			dateModified: isoDateTime(item.dateModified),
		};
		for (let [key, value] of Object.entries(optionalFields)) {
			let maximum = key == "abstractNote" ? 250000 : key == "URL" ? 32000 : 5000;
			let bounded = typeof value == "number" ? value : boundedString(value, maximum);
			if (bounded !== undefined) serialized[key] = bounded;
		}
		let tags = item.getTags().slice(0, 2000)
			.map(tag => boundedString(tag.tag, 5000)).filter(Boolean);
		if (tags.length) serialized.tags = tags;
		let collections = item.getCollections().slice(0, 2000)
			.map(key => boundedString(key, 240)).filter(Boolean);
		if (collections.length) serialized.collectionKeys = collections;
		return serialized;
	}

	function buildBundle(items, adapters, now) {
		if (!items.length) throw new Error("Select at least one bibliographic item.");
		if (items.length > MAX_ITEMS) throw new Error("At most 1000 items can be sent in one handoff.");
		return {
			application: APPLICATION,
			version: VERSION,
			createdAt: (now || new Date()).toISOString(),
			items: items.map(item => serializeRegularItem(item, adapters)),
		};
	}

	function fragmentURL(bundle) {
		let encoded = encodeURIComponent(JSON.stringify(bundle));
		if (encoded.length > MAX_FRAGMENT_CHARACTERS) return null;
		return APP_URL + "#/literature?view=inbox&zotero-handoff=" + encoded;
	}

	async function deliver(bundle, transport) {
		let url = fragmentURL(bundle);
		if (url) {
			try {
				await transport.launch(url);
				return "fragment";
			} catch {
				// A system URL handler can still reject a bounded URL. Use the file fallback.
			}
		}
		await transport.save(bundle);
		return "file";
	}

	return {
		APPLICATION,
		VERSION,
		MAX_ITEMS,
		MAX_FRAGMENT_CHARACTERS,
		APP_URL,
		BUNDLE_EXTENSION,
		buildBundle,
		deliver,
		fragmentURL,
		serializeRegularItem,
	};
});
