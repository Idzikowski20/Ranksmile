import React from 'react';
import { AiFaq } from '../../aiTracking/sections/AiFaq';
import { FAQ_LEFT, FAQ_RIGHT } from '../content';

/* Figma 5:2205 — identical FAQ layout to the AI Tracker page; only the copy differs. */
export function CeFaq() {
  return <AiFaq left={FAQ_LEFT} right={FAQ_RIGHT} />;
}

export default CeFaq;
