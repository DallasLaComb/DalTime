import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookies',
  imports: [RouterLink],
  templateUrl: './cookies.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookiesComponent {}
