import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'danger-outline'
  | 'primary-outline'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-dt-primary',
  secondary: 'btn-dt-secondary',
  danger: 'btn-dt-danger',
  'danger-outline': 'btn-dt-danger-outline',
  'primary-outline': 'btn-dt-primary-outline',
  ghost: 'btn-dt-ghost',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn-dt-sm',
  md: '',
  lg: 'btn-dt-lg',
};

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
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
  /** Optional accessible label forwarded to the inner <button> element's aria-label attribute. Use for icon-only buttons where visible text is absent. */
  ariaLabel = input<string>();

  clicked = output<void>();

  btnClass = computed(() => {
    const classes = ['dt-debug', VARIANT_CLASS[this.variant()], SIZE_CLASS[this.size()]];
    if (this.fullWidth()) classes.push('w-full');
    return classes.filter(Boolean).join(' ');
  });

  isDisabled = computed(() => this.disabled() || this.loading());
}
