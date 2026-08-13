SociologyPhdDeskPlugin = {
	id: null,
	version: null,
	rootURI: null,
	menuRegistration: null,

	init({ id, version, rootURI }) {
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
	},

	addToWindow(window) {
		window.MozXULElement.insertFTLIfNeeded("sociology-phd-desk.ftl");
	},

	removeFromWindow() {
		// MenuManager owns menu nodes. Fluent resources are safe to retain until window teardown.
	},

	registerMenu() {
		if (this.menuRegistration) Zotero.MenuManager.unregisterMenu(this.menuRegistration);
		this.menuRegistration = Zotero.MenuManager.registerMenu({
			menuID: "sociology-phd-desk-send-items",
			pluginID: this.id,
			target: "main/library/item",
			menus: [{
				menuType: "menuitem",
				l10nID: "sociology-phd-desk-send-items",
				onShowing: (event, context) => {
					let items = context.items || [];
					context.setEnabled(items.length > 0 && items.every(item => item.isRegularItem()));
				},
				onCommand: (event, context) => {
					void this.sendItems(context.items || []);
				},
			}],
		});
	},

	adapters() {
		return {
			itemTypeName: item => Zotero.ItemTypes.getName(item.itemTypeID),
			creatorTypeName: id => Zotero.CreatorTypes.getName(id),
			libraryType: id => Zotero.Libraries.get(id)?.libraryType,
		};
	},

	localizedText(zh, en) {
		return String(Zotero.locale || "").toLowerCase().startsWith("zh") ? zh : en;
	},

	async sendItems(items) {
		try {
			let bundle = SociologyPhdDeskHandoff.buildBundle(items, this.adapters());
			await SociologyPhdDeskHandoff.deliver(bundle, {
				launch: async url => Zotero.launchURL(url),
				save: async value => this.saveBundle(value),
			});
		} catch (error) {
			Zotero.logError(error);
			Services.prompt.alert(
				null,
				"Sociology PhD Desk",
				this.localizedText("无法发送所选文献。请检查条目类型和元数据。", "The selected items could not be sent. Check their item types and metadata."),
			);
		}
	},

	async saveBundle(bundle) {
		let { FilePicker } = ChromeUtils.importESModule(
			"chrome://zotero/content/modules/filePicker.mjs",
		);
		let window = Zotero.getMainWindow();
		let picker = new FilePicker();
		picker.init(
			window,
			this.localizedText("保存 Sociology PhD Desk 导入包", "Save Sociology PhD Desk handoff"),
			picker.modeSave,
		);
		picker.appendFilter("Sociology PhD Desk Zotero Handoff", "*.spdzotero");
		picker.defaultExtension = "spdzotero";
		picker.defaultString = "sociology-phd-desk-zotero.spdzotero";
		let result = await picker.show();
		if (result != picker.returnOK && result != picker.returnReplace) return;
		await Zotero.File.putContentsAsync(picker.file, JSON.stringify(bundle, null, 2));
		Services.prompt.alert(
			null,
			"Sociology PhD Desk",
			this.localizedText("导入包已保存。请在工作站的“文献”页面选择“从 Zotero 导入”。", "Handoff saved. In the Desk, open Literature and choose Import from Zotero."),
		);
	},

	shutdown() {
		if (this.menuRegistration) Zotero.MenuManager.unregisterMenu(this.menuRegistration);
		this.menuRegistration = null;
	},
};
