import WebComponent from "@ui5/webcomponents-base/src/sap/ui/webcomponents/base/WebComponent";
import ResizeHandler from "@ui5/webcomponents-base/src/sap/ui/webcomponents/base/delegate/ResizeHandler";
import ItemNavigation from "@ui5/webcomponents-base/src/sap/ui/webcomponents/base/delegate/ItemNavigation";
import Core from "@ui5/webcomponents-base/src/sap/ui/webcomponents/base/Core";
import ShadowDOM from "@ui5/webcomponents-base/src/sap/ui/webcomponents/base/compatibility/ShadowDOM";
import TableColumn from "./TableColumn";
import TableRow from "./TableRow";
import TableRenderer from "./build/compiled/TableRenderer.lit";

// Styles
import belize from "./themes/sap_belize/Table.less";
import belizeHcb from "./themes/sap_belize_hcb/Table.less";
import fiori3 from "./themes/sap_fiori_3/Table.less";

ShadowDOM.registerStyle("sap_belize", "Table.css", belize);
ShadowDOM.registerStyle("sap_belize_hcb", "Table.css", belizeHcb);
ShadowDOM.registerStyle("sap_fiori_3", "Table.css", fiori3);

/**
 * @public
 */
const metadata = {
	tag: "ui5-table",
	styleUrl: [
		"Table.css",
	],
	slots: /** @lends sap.ui.webcomponents.main.Table.prototype */ {

		/**
		 * Defines the <code>ui5-table</code> rows.
		 * <br><b>Note:</b> Only <code>ui5-table-row</code> is allowed.
		 *
		 * @type {TableRow[]}
		 * @slot
		 * @public
		 */
		rows: {
			type: TableRow,
			multiple: true,
		},

		/**
		 * Defines the configuration for the columns of the <code>ui5-table</code>.
		 * <br><b>Note:</b> Only <code>ui5-table-column</code> is allowed.
		 *
		 * @type {TableColumn[]}
		 * @slot
		 * @public
		 */
		columns: {
			type: TableColumn,
			multiple: true,
			listenFor: { exclude: ["header"] },
		},
	},
	properties: /** @lends sap.ui.webcomponents.main.Table.prototype */ {
		/**
		 * Determines whether the column headers remain fixed at the top of the page during
		 * vertical scrolling as long as the Web Component is in the viewport.
		 * <br><br>
		 * <b>Limitations:</b>
		 * <ul>
		 * <li>Browsers that do not support this feature:
		 * <ul>
		 * <li>Internet Explorer</li>
		 * <li>Microsoft Edge lower than version 41 (EdgeHTML 16)</li>
		 * <li>Mozilla Firefox lower than version 59</li>
		 * </ul></li>
		 * <li>Scrolling behavior:
		 * <ul>
		 * <li>If the Web Component is placed in layout containers that have the <code>overflow: hidden</code>
		 * or <code>overflow: auto</code> style definition, this can
		 * prevent the sticky elements of the Web Component from becoming fixed at the top of the viewport.</li>
		 * </ul></li>
		 * </ul>
		 *
		 * @type {boolean}
		 * @public
		 */
		stickyColumnHeader: {
			type: Boolean,
		},

		_hiddenColumns: {
			type: Object,
			multiple: true,
		},
	},
	events: /** @lends sap.ui.webcomponents.main.Table.prototype */ {
	},
};

/**
 * @class
 *
 * <h3 class="comment-api-title">Overview</h3>
 *
 * The <code>ui5-table</code> component provides a set of sophisticated and convenient functions for responsive table design.
 * It provides a comprehensive set of features for displaying and dealing with vast amounts of data.
 * <br><br>
 * To render the <code>Table</code> properly, the order of the <code>columns</code> should match with the
 * order of the item <code>cells</code> in the <code>rows</code>.
 * <br><br>
 * Desktop and tablet devices are supported.
 * On tablets, special consideration should be given to the number of visible columns
 * and rows due to the limited performance of some devices.
 *
 * <h3>ES6 Module Import</h3>
 *
 * <code>import "@ui5/webcomponents/dist/Table";</code>
 * <br>
 * <b>Note:</b> This also includes the <code>ui5-table-column</code>, <code>ui5-table-row</code> and <code>ui5-table-cell</code> Web Components.
 *
 * @constructor
 * @author SAP SE
 * @alias sap.ui.webcomponents.main.Table
 * @extends sap.ui.webcomponents.base.WebComponent
 * @tagname ui5-table
 * @appenddocs TableColumn TableRow TableCell
 * @public
 */
class Table extends WebComponent {
	static get metadata() {
		return metadata;
	}

	static get renderer() {
		return TableRenderer;
	}

	static get calculateTemplateContext() {
		return state => {
			const context = {
				ctr: state,
				visibleColumns: [],
				classes: {
					main: {
						sapWCTableHeader: true,
					},
					columns: {
						sapWCTableColumnWrapper: true,
					},
				},
				styles: {
					main: {
						"grid-template-columns": "",
						position: state.stickyColumnHeader ? "sticky" : "",
						top: state.stickyColumnHeader ? "0px" : "",
					},
				},
			};

			context.ctr.columns.forEach((column, index) => {
				if (!context.ctr._hiddenColumns[index]) {
					context.visibleColumns.push(column);

					// width of columns
					context.styles.main["grid-template-columns"] += `minmax(0, ${column.width || "1fr"}) `;
				}
			}, this);

			return context;
		};
	}

	constructor(props) {
		super(props);

		this._itemNavigation = new ItemNavigation(this);

		this._itemNavigation.getItemsCallback = function getItemsCallback() {
			return this.rows;
		}.bind(this);

		this._delegates.push(this._itemNavigation);

		this.fnOnRowFocused = this.onRowFocused.bind(this);
	}

	onBeforeRendering() {
		const columnSettings = this.getColumnPropagationSettings();

		this._itemNavigation.init();

		this.rows.forEach(row => {
			row._columnsInfo = columnSettings;
			row.removeEventListener("_focused", this.fnOnRowFocused);
			row.addEventListener("_focused", this.fnOnRowFocused);
		});
	}

	onEnterDOM() {
		ResizeHandler.register(this.getDomRef(), this.popinContent.bind(this));
	}

	onExitDOM() {
		ResizeHandler.deregister(this.getDomRef(), this.popinContent.bind(this));
	}

	onRowFocused(event) {
		this._itemNavigation.update(event.target);
	}

	popinContent(_event) {
		const clientRect = this.getDomRef().getBoundingClientRect();
		const tableWidth = clientRect.width;
		const hiddenColumns = [];
		const visibleColumnsIndexes = [];

		// store the hidden columns
		this.columns.forEach((column, index) => {
			if (tableWidth < column.minWidth && column.minWidth !== Infinity) {
				hiddenColumns[index] = {
					index,
					popinText: column.popinText,
					demandPopin: column.demandPopin,
				};
			} else {
				visibleColumnsIndexes.push(index);
			}
		});

		if (visibleColumnsIndexes.length) {
			this.columns[visibleColumnsIndexes[0]]._first = true;
			this.columns[visibleColumnsIndexes[visibleColumnsIndexes.length - 1]]._last = true;
		}

		// invalidate only if hidden columns count has changed
		if (this._hiddenColumns.length !== hiddenColumns.length) {
			this._hiddenColumns = hiddenColumns;
		}
	}

	/**
	 * Gets settings to be propagated from columns to rows.
	 *
	 * @returns {object}
	 * @memberof Table
	 */
	getColumnPropagationSettings() {
		return this.columns.map((column, index) => {
			return {
				index,
				width: column.width,
				minWidth: column.minWidth,
				demandPopin: column.demandPopin,
				popinText: column.popinText,
				visible: !this._hiddenColumns[index],
			};
		}, this);
	}
}

Core.boot().then(_ => {
	Table.define();
});

export default Table;
