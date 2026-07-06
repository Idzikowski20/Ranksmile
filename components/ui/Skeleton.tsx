import React from 'react';
import { Skeleton as CoreSkeleton } from '../core/loader/indeterminateLoader';

const SKELETON_COUNT = 5;

const Skeleton = () => <CoreSkeleton rows={SKELETON_COUNT} />;

export default Skeleton;
