import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {theme} from '../theme';

type TextSize = keyof typeof theme.font.size;
type ContentVariant = keyof typeof theme.tokens.content;

export interface BaseTextProps {
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  cursor?: 'default' | 'pointer' | 'text' | 'move' | 'not-allowed' | 'wait' | 'help';
  density?: 'compressed' | 'comfortable';
  ellipsis?: boolean;
  italic?: boolean;
  monospace?: boolean;
  strikethrough?: boolean;
  tabular?: boolean;
  textWrap?: 'wrap' | 'nowrap' | 'balance' | 'pretty' | 'stable';
  underline?: boolean | 'dotted';
  uppercase?: boolean;
  variant?: ContentVariant | 'muted' | 'inherit';
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'break-word';
  wrap?: 'nowrap' | 'normal' | 'pre' | 'pre-line' | 'pre-wrap';
}

type TextPrimitive = 'span' | 'p' | 'label' | 'div' | 'time' | 'legend';

export interface TextProps<T extends TextPrimitive = 'span'>
  extends BaseTextProps,
    Omit<
      React.DetailedHTMLProps<React.HTMLAttributes<HTMLElementTagNameMap[T]>, HTMLElementTagNameMap[T]>,
      'style'
    > {
  children: React.ReactNode;
  as?: T;
  color?: never;
  size?: TextSize;
  style?: React.CSSProperties;
}

export const Text = styled(
  // eslint-disable-next-line no-confusing-arrow
  <T extends TextPrimitive = 'span'>(props: TextProps<T> & {className?: string}) => {
    if (typeof props.children === 'function') {
      // @ts-expect-error render-prop variant
      return props.children({className: props.className ?? ''});
    }
    const {children, ...rest} = props as TextProps<T>;
    const Component = props.as || 'span';
    return <Component {...(rest as Record<string, unknown>)}>{children}</Component>;
  },
  {
    shouldForwardProp: p => isPropValid(p),
  }
)`
  ${p => p.size && `font-size: ${theme.font.size[p.size]};`}
  ${p => {
    if (!p.density) return '';
    const lh = p.density === 'compressed' ? 1 : 1.4;
    return `line-height: ${lh};`;
  }}
  ${p => p.align && `text-align: ${p.align};`}
  font-style: ${p => (p.italic ? 'italic' : undefined)};
  text-decoration: ${p => {
    if (p.strikethrough && p.underline) return 'underline line-through';
    if (p.strikethrough) return 'line-through';
    if (p.underline === 'dotted') return 'underline dotted';
    if (p.underline) return 'underline';
    return undefined;
  }};
  cursor: ${p => p.cursor ?? undefined};
  color: ${p => {
    if (p.variant === 'inherit') return undefined;
    const key = p.variant === 'muted' ? 'secondary' : (p.variant ?? 'primary');
    return theme.tokens.content[key as ContentVariant] ?? theme.tokens.content.primary;
  }};
  overflow: ${p => (p.ellipsis ? 'hidden' : undefined)};
  text-overflow: ${p => (p.ellipsis ? 'ellipsis' : undefined)};
  white-space: ${p => (p.wrap ? p.wrap : p.ellipsis ? 'nowrap' : undefined)};
  text-wrap: ${p => p.textWrap ?? undefined};
  word-break: ${p => p.wordBreak ?? undefined};
  width: ${p => (p.ellipsis ? '100%' : undefined)};
  font-family: ${p => theme.font.family[p.monospace ? 'mono' : 'sans']};
  font-weight: ${p => {
    if (p.bold === true) return theme.font.weight[p.monospace ? 'mono' : 'sans'].medium;
    if (p.bold === false) return theme.font.weight[p.monospace ? 'mono' : 'sans'].regular;
    return undefined;
  }};
  font-variant-numeric: ${p =>
    [p.tabular ? 'tabular-nums' : undefined].filter(Boolean).join(' ') || undefined};
  text-transform: ${p => (p.uppercase ? 'uppercase' : undefined)};
  margin: 0;
  padding: 0;
` as unknown as <T extends TextPrimitive = 'span'>(props: TextProps<T>) => React.ReactElement;
