import { css, type SerializedStyles } from '@emotion/react';
import { motionDuration, motionEasing, motionTransition } from '../tokens/motion';

const reduce = '@media (prefers-reduced-motion: reduce)';

function bezier(e: readonly number[]) {
  return `cubic-bezier(${e.join(', ')})`;
}

/** Shared enter/exit opacity for overlays. */
export const fade: SerializedStyles = css`
  transition: opacity ${motionTransition.fade.moderate};
  ${reduce} {
    transition: none;
  }
`;

export const slide: SerializedStyles = css`
  transition:
    opacity ${motionTransition.enter.moderate},
    transform ${motionTransition.enter.moderate};
  ${reduce} {
    transition: none;
  }
`;

export const dialogMotion: SerializedStyles = css`
  animation: koala-dialog-in ${motionDuration.moderate}ms ${bezier(motionEasing.enter)} both;
  ${reduce} {
    animation: none;
  }
  @keyframes koala-dialog-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

export const popoverMotion: SerializedStyles = css`
  animation: koala-pop-in ${motionDuration.fast}ms ${bezier(motionEasing.enter)} both;
  ${reduce} {
    animation: none;
  }
  @keyframes koala-pop-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const dropdownMotion = popoverMotion;
export const tooltipMotion = popoverMotion;

export const toastMotion: SerializedStyles = css`
  animation: koala-toast-in ${motionDuration.moderate}ms ${bezier(motionEasing.enter)} both;
  ${reduce} {
    animation: none;
  }
  @keyframes koala-toast-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const pressable: SerializedStyles = css`
  transition:
    background-color ${motionTransition.fade.fast},
    color ${motionTransition.fade.fast},
    border-color ${motionTransition.fade.fast},
    transform ${motionTransition.snap.fast};
  &:active {
    transform: scale(0.98);
  }
  ${reduce} {
    transition: none;
    &:active {
      transform: none;
    }
  }
`;

export {
  motionDuration,
  motionEasing,
  motionTransition,
} from '../tokens/motion';
