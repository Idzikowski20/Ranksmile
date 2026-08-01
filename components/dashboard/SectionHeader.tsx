import React from 'react';
import {Flex} from '../koala/core/layout';
import {Text} from '../koala/core/text';

interface Props {
  icon?: React.ReactNode;
  label: string;
}

const SectionHeader = ({icon, label}: Props) => (
  <Flex align="center" gap="sm">
    {icon}
    <Text size="md" bold variant="muted">{label}</Text>
  </Flex>
);

export default SectionHeader;
