import React from 'react';
import {Flex, type FlexProps} from './flex';

export type StackProps = FlexProps;

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (props, ref) => <Flex {...props} direction={props.direction ?? 'column'} ref={ref} />
);
Stack.displayName = 'Stack';

export default Stack;
