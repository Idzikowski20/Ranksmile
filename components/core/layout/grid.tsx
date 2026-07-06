import styled from '@emotion/styled';
import {Container, type ContainerProps} from './container';

interface GridLayoutProps {
  columns?: string;
  rows?: string;
  areas?: string;
  autoColumns?: string;
  autoRows?: string;
  autoFlow?: 'row' | 'column' | 'dense' | 'row dense' | 'column dense';
  gap?: string;
  columnGap?: string;
  rowGap?: string;
}

export interface GridProps
  extends Omit<ContainerProps, 'display' | 'gap' | 'gridTemplateColumns' | 'gridTemplateRows' | 'gridArea' | 'gridColumn' | 'gridRow'>,
    GridLayoutProps {}

export const Grid = styled(Container, {
  shouldForwardProp: prop =>
    !['columns', 'rows', 'areas', 'autoColumns', 'autoRows', 'autoFlow', 'columnGap', 'rowGap'].includes(
      prop as string
    ),
})<GridProps>`
  display: grid;
  ${p => p.columns && `grid-template-columns: ${p.columns};`}
  ${p => p.rows && `grid-template-rows: ${p.rows};`}
  ${p => p.areas && `grid-template-areas: ${p.areas};`}
  ${p => p.autoColumns && `grid-auto-columns: ${p.autoColumns};`}
  ${p => p.autoRows && `grid-auto-rows: ${p.autoRows};`}
  ${p => p.autoFlow && `grid-auto-flow: ${p.autoFlow};`}
  ${p => p.gap && `gap: ${p.gap};`}
  ${p => p.columnGap && `column-gap: ${p.columnGap};`}
  ${p => p.rowGap && `row-gap: ${p.rowGap};`}
` as unknown as (props: GridProps) => React.ReactElement;
