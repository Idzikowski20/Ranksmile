import React from 'react';
import { AiFaq } from '../../aiTracking/sections/AiFaq';
import { FAQ_LEFT, FAQ_RIGHT } from '../content';

/* Same FAQ layout as the other marketing pages; pricing-specific copy. */
export function PrFaq() {
  return <AiFaq left={FAQ_LEFT} right={FAQ_RIGHT} />;
}

export default PrFaq;
