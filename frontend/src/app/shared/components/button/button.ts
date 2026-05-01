import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'danger-outline'
  | 'primary-outline';

export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-outline-secondary',
  danger: 'btn-danger',
  'danger-outline': 'btn-outline-danger',
  'primary-outline': 'btn-outline-primary',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  loading = input<boolean>(false);
  disabled = input<boolean>(false);
  fullWidth = input<boolean>(false);
  type = input<'button' | 'submit'>('button');
  testId = input<string>();

  clicked = output<void>();

  btnClass = computed(() => {
    const classes = ['dt-debug', 'btn', VARIANT_CLASS[this.variant()], SIZE_CLASS[this.size()]];
    if (this.fullWidth()) classes.push('w-100');
    return classes.filter(Boolean).join(' ');
  });

  isDisabled = computed(() => this.disabled() || this.loading());
}
