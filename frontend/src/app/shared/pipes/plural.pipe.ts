import { Pipe, PipeTransform } from '@angular/core';

/** `{{ n | plural: 'employee' }}` → "1 employee" / "0 employees" / "2 employees". */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(count: number | null | undefined, singular: string, plural = `${singular}s`): string {
    const n = count ?? 0;
    return `${n} ${n === 1 ? singular : plural}`;
  }
}
