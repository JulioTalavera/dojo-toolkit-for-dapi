require([
    "dojo/parser",
    "dojo/dom",
    "dojo/_base/lang",
    "dojo/ready",
    "dijit/layout/BorderContainer",
    "dijit/layout/TabContainer",
    "api/ModuleContentPane",
    "dijit/layout/AccordionContainer",
    "api/ModuleTreeModel",
    "api/ModuleTree",
    "dojo/_base/config",
    "dojo/query",
    "dijit/registry",
    "dijit/MenuItem",
    "dijit/Menu",
    "dojo/_base/array", // array.forEach
    "dijit/MenuSeparator",
    "dijit/form/FilteringSelect",
    "dijit/TooltipDialog",
    "dijit/form/DropDownButton",
    "dojo/_base/connect",
    "dijit/popup"
], function (parser, dom, lang, ready, BorderContainer, TabContainer, ContentPane, AccordionContainer,
        ModuleTreeModel, ModuleTree, config, query, registry, MenuItem, Menu, array, MenuSeparator, FilteringSelect, TooltipDialog, DropDownButton, connect, popup) {
    var moduleModel = null, moduleTree = null, currentVersion = null, apiSearchToolTipDialog = null, apiSearchWidget = null;
    ready(function () {
        var parsed = parser.parse();
        var s = dom.byId("versionSelector");
        apiSearchToolTipDialog = registry.byId("apiSearchToolTipDialog");
        apiSearchToolTipDialog.closable = true;
        s.onchange = lang.hitch(s, versionChange);
        buildTree();

        // TODO - syntax highlighter for premalinked loaded modules -- plus this should be reusable (mixin?) as its also used in moduletree.js
        // should do as i thought, create an extended ContentPane with these functions because the show/hide semantics needs to be captured too (for summaries)
        var content = dom.byId("content");
        var contentpane = registry.byId("baseTab"); // the default loaded module tab (even when there is a permalink and intro screen) will always be named baseTab - intro screen id changed
        if (contentpane) {
            contentpane.initModulePane();
        }


        var tabContainer = registry.byId("content");
        /* temp - add a close all option - move to context menu on the tab label */
        dojo.getObject("dijit.layout._ScrollingTabControllerMenuButton").prototype.loadDropDown = function (callback) {
            this.dropDown = new Menu({
                id: this.containerId + "_menu",
                ownerDocument: this.ownerDocument,
                dir: this.dir,
                lang: this.lang,
                textDir: this.textDir
            });
            var container = registry.byId(this.containerId);
            // add close all
            var menuItem = new MenuItem({
                label: "Close all",
                iconClass: "dijitInline dijitIcon dijitMenuItemIcon dijitIconDelete",
                onClick: function () {
                    var _this = this;
                    tabContainer.getChildren().forEach(function (item) {
                        console.log(item);
                        if (item.closable) {
                            tabContainer.removeChild(item);
                            item.destroyRecursive();
                        }
                    });
                }
            });
            this.dropDown.addChild(menuItem);
            this.dropDown.addChild(new MenuSeparator());
            // end close all            

            array.forEach(container.getChildren(), function (page) {
                var menuItem = new MenuItem({
                    id: page.id + "_stcMi",
                    label: page.title,
                    iconClass: page.iconClass,
                    disabled: page.disabled,
                    ownerDocument: this.ownerDocument,
                    dir: page.dir,
                    lang: page.lang,
                    textDir: page.textDir,
                    onClick: function () {
                        container.selectChild(page);
                    }
                });
                this.dropDown.addChild(menuItem);
            }, this);
            callback();
        };
        /* end temp - add a close all option - move to context menu on the tab label */
    });

    var buildTree = function () {
        if (moduleModel !== null) {
            moduleTree.destroyRecursive();
        }
        //moduleModel = new ModuleTreeModel(baseUrl + 'lib/tree.php?v=' + currentVersion);
        // moduleModel = new ModuleTreeModel(config.apiPath + '/' + selectedVersion + '/tree.json'); // for loading different versions
        // this is the default version - will need a global to check on when the selected version is changed
        var version = currentVersion ?  currentVersion : config.apiDefault;
        var jsonfile = config.apiPath + '/' + version + '/tree.json';
        moduleModel = new ModuleTreeModel(jsonfile);
        moduleTree = new ModuleTree({
            id: "moduleTree",
            model: moduleModel,
            showRoot: false,
            persist: false,
            version : version
        });
        moduleTree.placeAt("moduleTreePane");
        moduleTree.startup();

// started selectedChildWidget
        moduleModel.getRoot(function (data) {
            buildSearch(data);
        });
        var tabContainer = registry.byId("content");
		tabContainer.watch("selectedChildWidget", function (attr, oldVal, selectedChildWidget) {
			// If we are still scrolling the Tree from a previous run, cancel that animation
			if (moduleTree.scrollAnim) {
				moduleTree.scrollAnim.stop();
			}

			if (!selectedChildWidget.page) {
				// This tab doesn't have a corresponding entry in the tree.   It must be the welcome tab.
				return;
			}
			setTreePath(selectedChildWidget.page);
		}, true);
//end selectedChildWidgets        
    };
    var versionChange = function (e) {
        // summary:
        //    Change the version displayed.
        var v = this.options[this.selectedIndex].value;
        // if we reverted, bug out.
        if (currentVersion === v) { return; }
        currentVersion = v;
        buildTree();
    };
    var buildSearch = function (rootjson) {
        // TODO: maybe test if theres an existing widget and disconnect?
        apiSearchWidget = registry.byId("apiSearchWidget");
        apiSearchWidget.queryExpr = "*${0}*"; //contains
        apiSearchWidget.autoComplete = false;
        var store = treeToStore(rootjson, {identifier: 'id', items: []});
        apiSearchWidget.store.setData(store);

        apiSearchWidget.on("Change", function (data) {
            //var path = ["root"].concat(data.split("/"));
            setTreePath(data);
        });
    };
    var treeToStore = function (jsonObj, store) {
        if (jsonObj.children) {
            array.forEach(jsonObj.children, function (item) {
                store.items.push({id: item.id, name: item.id});
                if (item.children) {
                    treeToStore(item, store);
                }
            });
        }
        return store;
    };

    var setTreePath = function (page) {
        // Select the TreeNode corresponding to this tab's object.   For dijit/form/Button the path must be
        // ["root", "dijit/", "dijit/form/", "dijit/form/Button"]
		var parts = page.match(/[^/\.]+[/\.]?/g), path = "";
        path = ["root"].concat(array.map(parts, function (part, idx) {
			return parts.slice(0, idx + 1).join("").replace(/\.$/, "");
		}));

		moduleTree.set("path", path).then(function () {
            //debugger;
            var selectednode = moduleTree.selectedNode;
            var top = selectednode.domNode.offsetTop;
            var left = selectednode.domNode.offsetLeft;
            //selectednode.domNode.focus();
            //window.scrollTo(top, left);

            selectednode.domNode.scrollIntoView();
            popup.close(apiSearchToolTipDialog);
            //apiSearchWidget.setValue("");
        },
		function (err) {
			console.log("tree: error setting path to " + path);
		});
    };
});

