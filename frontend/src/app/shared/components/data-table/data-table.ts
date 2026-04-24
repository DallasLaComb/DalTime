import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ColumnDef } from './column-def.model';

@Component({
  selector: 'app-data-table',
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T> {
  columns = input.required<ColumnDef[]>();
  data = input.required<T[]>();
  trackBy = input.required<(index: number, item: T) => unknown>();
}
