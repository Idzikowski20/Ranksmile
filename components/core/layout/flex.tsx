import styled from '@emotion/styled';
import {Container, type ContainerProps} from './container';
import {theme} from '../theme';

const omitFlexProps = new Set<string>([
  'as',
  'direction',
  'flex',
  'gap',
  'display',
  'align',
  'justify',
  'wrap',
]);

type SpaceSize = keyof typeof theme.space;

interface FlexLayoutProps {
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  display?: 'flex' | 'inline-flex' | 'none';
  flex?: React.CSSProperties['flex'];
  gap?: SpaceSize | `${SpaceSize} ${SpaceSize}`;
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly' | 'left' | 'right';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
}

export interface FlexProps
  extends Omit<ContainerProps, 'display' | 'gap' | 'flex' | 'flexDirection' | 'flexWrap' | 'alignItems' | 'justifyContent'>,
    FlexLayoutProps {}

export const Flex = styled(Container, {
  shouldForwardProp: prop => !omitFlexProps.has(prop as string),
})<FlexProps>`
  display: ${p => p.display ?? 'flex'};
  ${p => p.gap && `gap: ${p.gap};`}
  ${p => p.direction && `flex-direction: ${p.direction};`}
  ${p => p.wrap && `flex-wrap: ${p.wrap};`}
  ${p => p.flex && `flex: ${p.flex};`}
  ${p => {
    if (!p.justify) return '';
    const map: Record<string, string> = {
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
      between: 'space-between',
      around: 'space-around',
      evenly: 'space-evenly',
    };
    return `justify-content: ${map[p.justify] ?? p.justify};`;
  }}
  ${p => {
    if (!p.align) return '';
    const map: Record<string, string> = {
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
    };
    return `align-items: ${map[p.align] ?? p.align};`;
  }}
` as unknown as (props: FlexProps) => React.ReactElement;
