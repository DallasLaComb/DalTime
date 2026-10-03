export interface ColumnDef {
  /** Column header text */
  header: string;
  /** CSS class applied to both <th> and <td> cells (e.g., 'hidden xl:table-cell') */
  cssClass?: string;
  /** Additional CSS class for the <th> element only (e.g., 'text-right') */
  headerCssClass?: string;
}
