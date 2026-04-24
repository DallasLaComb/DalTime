import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-card-list',
  templateUrl: './card-list.html',
  styleUrl: './card-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
})
export class CardListComponent<T> {
  data = input.required<T[]>();
  trackBy = input.required<(index: number, item: T) => unknown>();
  cardTemplate = input.required<TemplateRef<{ $implicit: T }>>();
}
