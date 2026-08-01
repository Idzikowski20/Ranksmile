"use client";

import React, { useId } from "react";
import { motion } from "motion/react";

const SMILEY_PATH =
  "M91.4595 26.5015C102.568 12.8345 123.432 12.8345 134.54 26.5015C140.447 33.7678 149.618 37.5668 158.932 36.6049C176.451 34.7958 191.204 49.5488 189.395 67.0678C188.433 76.382 192.232 85.5535 199.498 91.4595C213.165 102.568 213.165 123.432 199.498 134.54C192.232 140.447 188.433 149.618 189.395 158.932C191.204 176.451 176.451 191.204 158.932 189.395C149.618 188.433 140.447 192.232 134.54 199.498C123.432 213.165 102.568 213.165 91.4595 199.498C85.5535 192.232 76.382 188.433 67.0678 189.395C49.5488 191.204 34.7958 176.451 36.6049 158.932C37.5668 149.618 33.7678 140.447 26.5015 134.54C12.8345 123.432 12.8345 102.568 26.5015 91.4595C33.7678 85.5535 37.5668 76.382 36.6049 67.0678C34.7958 49.5488 49.5488 34.7958 67.0678 36.6049C76.382 37.5668 85.5535 33.7678 91.4595 26.5015Z";

const REST_X = 24.661;
const REST_Y = 109.888;
const ENTER_X = 20.182;
const ENTER_Y = 671.07;

export type BounceSmileyAnimationProps = {
  className?: string;
  /** Face-only mark for toolbars / nav (no bounce stage). */
  compact?: boolean;
  /** Bounce-in on first mount only. Ignored when `compact`. Default true. */
  entrance?: boolean;
  /** Pixel size when `compact` (default 20). */
  size?: number;
  /** Disable looping rotate/blink (static mark). */
  animateRotate?: boolean;
};

function SmileyFace({
  filterId,
  paintId,
  animateRotate = true,
}: {
  filterId: string;
  paintId: string;
  animateRotate?: boolean;
}) {
  // CSS keyframes (globals.css) — same approach as legacy Surfy blink.
  // Motion SVG rotate/path loops were not reliably painting in production.
  return (
    <g fill="none">
      <g
        className={animateRotate ? "smily-face-spin" : undefined}
        filter={`url(#${filterId})`}
        style={
          animateRotate
            ? undefined
            : { transformBox: "view-box", transformOrigin: "113px 113px" }
        }
      >
        <path d={SMILEY_PATH} fill="#FA6B3D" />
        <path d={SMILEY_PATH} fill={`url(#${paintId})`} />
      </g>
      <circle cx="80.5" cy="112.5" r="7.5" fill="#C11C0D" />
      <g
        className={animateRotate ? "smily-eye-blink" : undefined}
        style={
          animateRotate
            ? undefined
            : { transformBox: "view-box", transformOrigin: "130.5px 112.5px" }
        }
      >
        <path
          d="M 123 112.5 C 123 116.642 126.358 120 130.5 120 C 134.642 120 138 116.642 138 112.5 C 138 108.358 134.589 104.915 130.447 104.915 C 126.305 104.915 123 108.358 123 112.5 Z"
          fill="#C11C0D"
        />
      </g>
      <path
        d="M90 127C97.2727 139 112.727 139 120 127"
        stroke="#E92B0D"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <defs>
        <filter
          id={filterId}
          x="16.251"
          y="16.2512"
          width="193.498"
          height="193.498"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="15.65" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow_bounce_smiley" />
        </filter>
        <radialGradient
          id={paintId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(113 113) rotate(90) scale(227)"
        >
          <stop stopColor="#FFB08A" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
    </g>
  );
}

/**
 * Ranksmile / Smily mark.
 * - Full: bounce entrance once on mount, then rests; CSS rotate + blink forever.
 * - Compact: face-only for toolbars (CSS rotate loop, no bounce stage).
 */
export function BounceSmileyAnimation({
  className,
  compact = false,
  entrance = true,
  size = 20,
  animateRotate = true,
}: BounceSmileyAnimationProps) {
  const uid = useId().replace(/:/g, "");
  const filterId = `filter0_i_bounce_smiley_${uid}`;
  const paintId = `paint0_radial_bounce_smiley_${uid}`;

  if (compact) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 226 226"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: "inline-block", flexShrink: 0, verticalAlign: "middle" }}
        aria-hidden="true"
      >
        <SmileyFace filterId={filterId} paintId={paintId} animateRotate={animateRotate} />
      </svg>
    );
  }

  return (
    <svg
      className={className || "w-full h-full"}
      viewBox="0 0 280 360"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <motion.g
        style={{ transformBox: "view-box", transformOrigin: "113px 113px" }}
        initial={entrance ? { x: ENTER_X, y: ENTER_Y } : { x: REST_X, y: REST_Y }}
        animate={{ x: REST_X, y: REST_Y }}
        transition={
          entrance
            ? {
                type: "spring",
                stiffness: 16.5234375,
                damping: 4.1015625,
                mass: 1,
              }
            : { duration: 0 }
        }
      >
        <svg x={0} y={0} width={226} height={226} viewBox="0 0 226 226" overflow="visible">
          <SmileyFace filterId={filterId} paintId={paintId} animateRotate={animateRotate} />
        </svg>
      </motion.g>
    </svg>
  );
}

export default BounceSmileyAnimation;
