import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-help',
  imports: [RouterLink],
  templateUrl: './help.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {}
