pimcore.registerNS("pimcore.plugin.PimcoreBulkSearchBundle");

pimcore.plugin.PimcoreBulkSearchBundle = Class.create({

    initialize: function () {
        document.addEventListener(pimcore.events.pimcoreReady, this.pimcoreReady.bind(this));
    },

    pimcoreReady: function (e) {
        this.log('pimcoreReady fired');
        this.registerGridHeaderMenuExtensions();
    },

    registerGridHeaderMenuExtensions: function () {
        this.log('registerGridHeaderMenuExtensions start', {
            hasObjectSearch: !!(pimcore.object && pimcore.object.search),
            hasVariantsTab: !!(pimcore.object && pimcore.object.variantsTab),
            hasAssetListfolder: !!(pimcore.asset && pimcore.asset.listfolder)
        });

        // Pimcore uses Prototype's addMethods() to copy methods from
        // pimcore.element.helpers.gridColumnConfig into these classes.
        // Therefore we must patch the class prototypes, not the helper object itself.
        this.patchUpdateGridHeaderContextMenu(pimcore.object && pimcore.object.search ? pimcore.object.search : null);
        this.patchUpdateGridHeaderContextMenu(pimcore.object && pimcore.object.variantsTab ? pimcore.object.variantsTab : null);
        this.patchUpdateGridHeaderContextMenu(pimcore.asset && pimcore.asset.listfolder ? pimcore.asset.listfolder : null);
    },

    log: function (message, data) {
        try {
            // Enable debug output only when explicitly requested
            // window.localStorage.setItem('pimcoreBulkSearchDebug', '1')
            // window.localStorage.removeItem('pimcoreBulkSearchDebug')
            if (!window
                || !window.localStorage
                || window.localStorage.getItem('pimcoreBulkSearchDebug') !== '1'
            ) {
                return;
            }

            if (window && window.console && typeof window.console.log === 'function') {
                if (typeof data !== 'undefined') {
                    window.console.log('[PimcoreBulkSearchBundle]', message, data);
                } else {
                    window.console.log('[PimcoreBulkSearchBundle]', message);
                }
            }
        } catch (e) {
            // ignore
        }
    },

    patchUpdateGridHeaderContextMenu: function (klass) {
        var klassName = (klass && klass.prototype && klass.prototype.className) ? klass.prototype.className : 'unknown';

        if (!klass || !klass.prototype || typeof klass.prototype.updateGridHeaderContextMenu !== 'function') {
            
            return;
        }

        if (klass.prototype.pimcoreBulkSearchPatched === true) {
            this.log('patchUpdateGridHeaderContextMenu skipped (already patched)', {klassName: klassName});
            return;
        }
        klass.prototype.pimcoreBulkSearchPatched = true;
        this.log('patchUpdateGridHeaderContextMenu patched', {klassName: klassName});

        var plugin = this;
        var originalFn = klass.prototype.updateGridHeaderContextMenu;

        klass.prototype.updateGridHeaderContextMenu = function (grid) {
            plugin.log('updateGridHeaderContextMenu wrapper called', {
                klassName: klassName,
                gridId: grid && grid.id ? grid.id : null
            });

            originalFn.apply(this, arguments);

            var menu = grid && grid.headerCt ? grid.headerCt.getMenu() : null;
            if (!menu || menu.pimcoreBulkSearchInitialized) {
                plugin.log('menu missing or already initialized', {
                    hasMenu: !!menu,
                    alreadyInitialized: !!(menu && menu.pimcoreBulkSearchInitialized)
                });
                return;
            }
            menu.pimcoreBulkSearchInitialized = true;
            plugin.log('menu initialized', {
                itemsCount: menu.items ? menu.items.getCount() : null
            });

            // Keep a reference to the grid tab instance (pimcore.object.search / pimcore.object.variantsTab / etc.).
            var gridTab = this;

            menu.on('beforeshow', function (menu) {
                plugin.log('header menu beforeshow', {
                    itemsCount: menu.items ? menu.items.getCount() : null
                });

                var activeHeader = menu.activeHeader;
                if (!activeHeader) {
                    plugin.log('beforeshow: no activeHeader');
                    return;
                }

                var resolved = plugin.resolveFieldMeta(gridTab, activeHeader);
                var isInput = !!(resolved && resolved.type === 'input');
                plugin.log('activeHeader', {
                    dataIndex: activeHeader.dataIndex,
                    text: activeHeader.text,
                    isInput: isInput,
                    resolvedFieldType: resolved ? resolved.type : null,
                    resolvedFieldKey: resolved ? resolved.key : null
                });

                var bulkItem = menu.pimcoreBulkSearchMenuItem;
                if (!bulkItem || bulkItem.destroyed) {
                    bulkItem = new Ext.menu.Item({
                        text: t('pimcore_bulk_search_bulk_search_option'),
                        iconCls: 'pimcore_icon_search',
                        handler: Ext.emptyFn
                    });
                    menu.pimcoreBulkSearchMenuItem = bulkItem;
                    plugin.log('bulk menu item created');
                }

                // Always update handler to use the current active column (menu item is reused across columns).
                if (typeof bulkItem.setHandler === 'function') {
                    bulkItem.setHandler(function () {
                        plugin.openBulkSearchWindowForGrid(grid, activeHeader);
                    });
                } else {
                    bulkItem.handler = function () {
                        plugin.openBulkSearchWindowForGrid(grid, activeHeader);
                    };
                }

                if (menu.items.indexOf(bulkItem) === -1) {
                    // Insert right after "Batch edit selected" if present, otherwise before "Filter" (itemId: filters).
                    var inserted = false;
                    var targetText = t('batch_change_selected');

                    for (var i = 0; i < menu.items.getCount(); i++) {
                        var item = menu.items.getAt(i);
                        if (item && item.text && String(item.text).indexOf(targetText) !== -1) {
                            menu.insert(i + 1, bulkItem);
                            inserted = true;
                            plugin.log('bulk item inserted after batch_change_selected', {index: i});
                            break;
                        }
                    }

                    if (!inserted) {
                        var filterIndex = -1;
                        for (var j = 0; j < menu.items.getCount(); j++) {
                            var filterItem = menu.items.getAt(j);
                            if (filterItem && filterItem.itemId === 'filters') {
                                filterIndex = j;
                                break;
                            }
                        }

                        if (filterIndex > -1) {
                            menu.insert(filterIndex, bulkItem);
                            plugin.log('bulk item inserted before filter menu', {index: filterIndex});
                        } else {
                            menu.add(bulkItem);
                            plugin.log('bulk item appended at end');
                        }
                    }
                }

                bulkItem.setVisible(isInput === true);
                plugin.log('bulk item visibility set', {visible: isInput === true});
            });
        };
    },

    /**
     * Resolves Pimcore field meta for a grid column.
     * For object grids, the reliable source is the grid tab's fieldObject mapping.
     */
    resolveFieldMeta: function (gridTab, column) {
        var dataIndex = column ? column.dataIndex : null;
        if (!dataIndex) {
            return null;
        }

        // Most reliable: fieldObject mapping (set in object/folder/search.js and variantsTab.js)
        if (gridTab && gridTab.fieldObject) {
            if (gridTab.fieldObject[dataIndex]) {
                return gridTab.fieldObject[dataIndex];
            }

            // Fallback: case-insensitive match (some projects use upper-case keys like "GTIN")
            var wanted = String(dataIndex).toLowerCase();
            try {
                var keys = Object.keys(gridTab.fieldObject);
                for (var i = 0; i < keys.length; i++) {
                    if (String(keys[i]).toLowerCase() === wanted) {
                        return gridTab.fieldObject[keys[i]];
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        // Fallback: sometimes Pimcore attaches meta on the column config under a custom property.
        var fieldMeta = column.pimcoreLayout
            || column.pimcoreField
            || (column.initialConfig ? (column.initialConfig.pimcoreLayout || column.initialConfig.pimcoreField) : null)
            || (column.config ? (column.config.pimcoreLayout || column.config.pimcoreField) : null);

        return fieldMeta || null;
    },

    isInputFieldColumn: function (column) {
        var meta = this.resolveFieldMeta(null, column);
        return !!(meta && meta.type === 'input');
    },

    openBulkSearchWindowForGrid: function (grid, column) {
        var dataIndex = column.dataIndex;
        if (!dataIndex) {
            return;
        }

        var store = grid.getStore();
        if (!store) {
            return;
        }

        var currentValue = '';
        var existingFilter = store.getFilters().get('x-gridfilter-' + dataIndex);
        if (existingFilter) {
            var existingValue = existingFilter.getValue();
            if (Ext.isArray(existingValue)) {
                currentValue = existingValue.join("\n");
            } else if (!Ext.isEmpty(existingValue)) {
                currentValue = String(existingValue);
            }
        }

        var textarea = Ext.create('Ext.form.field.TextArea', {
            fieldLabel: t('pimcore_bulk_search_values'),
            labelAlign: 'top',
            grow: false,
            anchor: '100%',
            height: 260,
            value: currentValue
        });

        var win = Ext.create('Ext.window.Window', {
            title: t('pimcore_bulk_search_bulk_search_option') + ' - ' + (column.text || dataIndex),
            modal: true,
            width: 520,
            layout: 'fit',
            items: [{
                xtype: 'form',
                bodyPadding: 10,
                items: [
                    {
                        xtype: 'displayfield',
                        value: t('pimcore_bulk_search_hint_one_value_per_line')
                    },
                    textarea
                ]
            }],
            buttons: [
                {
                    text: t('cancel'),
                    handler: function () {
                        win.close();
                    }
                },
                {
                    text: t('apply'),
                    iconCls: 'pimcore_icon_apply',
                    handler: function () {
                        var values = this.parseBulkValues(textarea.getValue());
                        this.applyBulkFilterToGrid(grid, dataIndex, values);
                        win.close();
                    }.bind(this)
                }
            ]
        });

        win.show();
    },

    applyBulkFilterToGrid: function (grid, dataIndex, values) {
        var store = grid.getStore();
        var filters = store.getFilters();
        var filterId = 'x-gridfilter-' + dataIndex;

        filters.beginUpdate();
        filters.removeByKey(filterId);

        if (values && values.length > 0) {
            // type=list triggers OR value matching server-side in Pimcore's GridHelperService.
            filters.add(new Ext.util.Filter({
                id: filterId,
                property: dataIndex,
                operator: '=',
                value: values,
                type: 'list'
            }));
        }

        filters.endUpdate();

        if (typeof store.loadPage === 'function') {
            store.loadPage(1);
        } else {
            store.load();
        }
    },

    parseBulkValues: function (raw) {
        var lines = String(raw || '').split(/\r?\n/);
        var values = [];
        var map = {};

        for (var i = 0; i < lines.length; i++) {
            var value = String(lines[i]).trim();
            if (value.length === 0) {
                continue;
            }
            if (map[value] === true) {
                continue;
            }
            map[value] = true;
            values.push(value);
        }

        return values;
    }
});

var PimcoreBulkSearchBundlePlugin = new pimcore.plugin.PimcoreBulkSearchBundle();
