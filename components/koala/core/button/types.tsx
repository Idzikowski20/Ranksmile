export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'warning' | 'link' | 'transparent';
export type ButtonSize = 'zero' | 'xs' | 'sm' | 'md';

export interface CommonButtonProps {
  busy?: boolean;
  icon?: React.ReactNode;
  size?: ButtonSize;
  tooltipProps?: { title?: React.ReactNode; disabled?: boolean };
  variant?: ButtonVariant;
}

export interface ButtonProps extends CommonButtonProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonButtonProps> {
  children?: React.ReactNode;
  'aria-label'?: string;
}
