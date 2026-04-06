import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home',
  template: `
    <div class="container py-5 text-center">
      <img src="daltime-logo.png" alt="DalTime" height="80" class="mb-4" />
      <h1 class="fw-bold">DalTime</h1>
      <p class="lead text-muted mb-4">Free shift scheduling for nonprofit teams.</p>
      <p class="text-muted mx-auto" style="max-width: 600px">
        Schedule part-time employees across multiple shifts, locations, and availability
        constraints — without the cost of commercial scheduling software.
      </p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {}
