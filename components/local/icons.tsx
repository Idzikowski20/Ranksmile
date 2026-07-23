import React from 'react';

type IconProps = { size?: number; color?: string };

export function IconChevronRight({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.293 12.707a1 1 0 0 1 0-1.414L9.586 8 6.293 4.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z"
        fill={color}
      />
    </svg>
  );
}

export function IconChevronDown({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.293 6.293a1 1 0 0 1 1.414 0L8 9.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
        fill={color}
      />
    </svg>
  );
}

export function IconStarFilled({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.666 5.435a.4.4 0 0 1 .218.675l-3.503 3.539.716 4.893a.4.4 0 0 1-.57.417L8 12.774l-4.527 2.185a.4.4 0 0 1-.57-.417l.716-4.893L.116 6.11a.4.4 0 0 1 .218-.675l4.959-.842L7.647.21a.4.4 0 0 1 .706 0l2.354 4.382 4.96.842Z"
        fill={color}
      />
    </svg>
  );
}

export function IconStarOutline({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.406 6.399 8 3.782 6.594 6.399l-2.892.49 2.042 2.064-.424 2.895L8 10.554l2.68 1.294-.424-2.895 2.041-2.063-2.89-.491Zm6.26-.964a.4.4 0 0 1 .218.675l-3.503 3.539.716 4.893a.4.4 0 0 1-.57.417L8 12.774l-4.527 2.185a.4.4 0 0 1-.57-.417l.716-4.893L.116 6.11a.4.4 0 0 1 .218-.675l4.959-.842L7.647.21a.4.4 0 0 1 .706 0l2.354 4.382 4.96.842Z"
        fill={color}
      />
    </svg>
  );
}

export function IconBook({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2H4ZM3 8a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1Zm7-3a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Z" fill={color} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 0c.768 0 1.47.289 2 .764A2.989 2.989 0 0 1 10 0h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5a1 1 0 0 0-1 1 1 1 0 1 1-2 0 1 1 0 0 0-1-1H1a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1h5Zm1 3v9.17c-.313-.11-.65-.17-1-.17H2V2h4a1 1 0 0 1 1 1Zm2 9.17c.313-.11.65-.17 1-.17h4V2h-4a1 1 0 0 0-1 1v9.17Z"
        fill={color}
      />
    </svg>
  );
}

export function IconChat({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 15a1 1 0 0 1-.45-.11A1 1 0 0 1 1 14V1a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6.39L2.6 14.79A1 1 0 0 1 2 15ZM3 2v10l2.46-1.82a1 1 0 0 1 .6-.2H13v-8L3 2Z"
        fill={color}
      />
    </svg>
  );
}

export function IconExport({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 1 3.696 3.7a1 1 0 1 1-1.415 1.413L9 4.83v6.083a1 1 0 1 1-2 0V4.828l-1.289 1.29a1 1 0 1 1-1.414-1.415L8 1Z" fill={color} />
      <path d="M3 13v-2a1 1 0 1 0-2 0v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3a1 1 0 1 0-2 0v2H3Z" fill={color} />
    </svg>
  );
}

export function IconPlus({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 8.004c0 .594.5 1 1 1h3v3c0 .5.402 1 1 1s1-.5 1-1v-3h3c.5 0 1-.399 1-1 0-.602-.5-1-1-1H9v-3c0-.5-.402-1-1-1s-1 .5-1 1v3H4c-.5 0-1 .406-1 1Z"
        fill={color}
      />
    </svg>
  );
}

export function IconPicture({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill={color} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h12ZM4 10.23 5.77 12H3v-.77l1-1ZM3 8.51V4h10v3.1l-.59-.58a2 2 0 0 0-2.82 0L6.35 9.75l-.94-.93A2 2 0 0 0 3 8.51Zm10 1.42-2-2L6.93 12H13V9.93Z"
        fill={color}
      />
    </svg>
  );
}

/** Filled map pin (dashboard / onboarding). */
export function IconPin({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill={color} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0a7.115 7.115 0 0 0-4.94 1.978A6.68 6.68 0 0 0 1 6.784c0 2.763 1.572 4.945 3.038 6.388a15.85 15.85 0 0 0 3.081 2.35l.022.012a.286.286 0 0 1 .005.003h.002l.015.01L8 16l.837-.453.015-.01.007-.003.022-.013a9.021 9.021 0 0 0 .296-.176 15.851 15.851 0 0 0 2.785-2.174C13.428 11.73 15 9.548 15 6.785a6.68 6.68 0 0 0-2.06-4.806A7.116 7.116 0 0 0 8 0Z"
        fill={color}
      />
    </svg>
  );
}

/** Outline map pin (setup connect step). Formerly LocalSetupIcons IconPin. */
export function IconPinOutline({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill={color}>
      <path d="M8 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M8 0a7.115 7.115 0 0 0-4.94 1.978A6.68 6.68 0 0 0 1 6.784c0 2.763 1.572 4.945 3.038 6.388a15.85 15.85 0 0 0 3.081 2.35l.022.012a.286.286 0 0 1 .005.003h.002l.015.01L8 16l.837-.453.015-.01.007-.003.022-.013a9.021 9.021 0 0 0 .296-.176 15.851 15.851 0 0 0 2.785-2.174C13.428 11.73 15 9.548 15 6.785a6.68 6.68 0 0 0-2.06-4.806A7.116 7.116 0 0 0 8 0ZM4.455 3.398A5.106 5.106 0 0 1 8 1.983c1.335 0 2.61.512 3.545 1.415A4.705 4.705 0 0 1 13 6.784c0 1.994-1.142 3.696-2.447 4.98A13.955 13.955 0 0 1 8 13.735a13.956 13.956 0 0 1-2.553-1.97C4.142 10.48 3 8.778 3 6.784c0-1.265.52-2.483 1.455-3.386Z" />
    </svg>
  );
}

export function IconPhone({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3.263 3A.263.263 0 0 0 3 3.263C3 8.641 7.36 13 12.737 13a.263.263 0 0 0 .263-.263v-1.834a.333.333 0 0 0-.209-.31l-1.758-.703a.333.333 0 0 0-.337.054c-.48.4-1.11.571-1.669.58-.552.008-1.236-.143-1.734-.641a.997.997 0 0 1-.038-.04L5.77 8.183a1.752 1.752 0 0 1-.47-.853 1.716 1.716 0 0 1 .062-.92c.158-.463.49-.863.694-1.107a.334.334 0 0 0 .054-.337L5.407 3.21a.334.334 0 0 0-.31-.21H3.263ZM1 3.263A2.263 2.263 0 0 1 3.263 1h1.834c.954 0 1.812.58 2.166 1.467l.704 1.757a2.334 2.334 0 0 1-.375 2.36 4.48 4.48 0 0 0-.264.342L8.71 8.469c.018.01.104.058.287.055a.74.74 0 0 0 .419-.117 2.333 2.333 0 0 1 2.36-.374l1.758.703A2.333 2.333 0 0 1 15 10.903v1.834A2.263 2.263 0 0 1 12.737 15C6.255 15 1 9.745 1 3.263Z"
        clipRule="evenodd"
        fill={color}
      />
    </svg>
  );
}

export function IconEdit({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.807.369a1.259 1.259 0 0 1 1.78 0l3.044 3.044a1.259 1.259 0 0 1 0 1.78L5.824 15H1v-4.824L10.807.369Zm.89 1.958L9.72 4.305l1.976 1.976 1.978-1.978-1.976-1.976ZM3.014 11.01l5.29-5.29 1.977 1.975-5.291 5.291H3.014V11.01Z"
        fill={color}
      />
      <path d="M10 13a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4Z" fill={color} />
    </svg>
  );
}

export function IconTrash({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 1a1 1 0 0 0-1 1H3a1 1 0 0 0 0 2v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 1 0 0-2h-3a1 1 0 0 0-1-1H7ZM5 4h6v9H5V4Z"
        fill={color}
      />
    </svg>
  );
}

export function IconShare({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
        fill={color}
      />
      <path
        d="M3 10a3 3 0 0 0-3 3v1h2v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2v-1a3 3 0 0 0-3-3H3ZM13 5a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0V9h-1a1 1 0 1 1 0-2h1V6a1 1 0 0 1 1-1Z"
        fill={color}
      />
    </svg>
  );
}

export function IconKebab({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM10 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM8 16a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill={color}
      />
    </svg>
  );
}

export function IconCheck({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M13.707 3.793a1 1 0 0 1 0 1.414l-6.996 7a1 1 0 0 1-1.414 0L2.293 9.2a1 1 0 0 1 1.414-1.414l2.297 2.3 6.289-6.292a1 1 0 0 1 1.414 0Z"
        clipRule="evenodd"
        fill={color}
      />
    </svg>
  );
}

export function IconArrowRight({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.293 3.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414-1.414L11.586 9H2a1 1 0 0 1 0-2h9.586L9.293 4.707a1 1 0 0 1 0-1.414Z"
        fill={color}
      />
    </svg>
  );
}

export function IconSparkle({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M12.365 1.264a.385.385 0 0 0-.73 0l-.511 1.553a.48.48 0 0 1-.307.307l-1.553.51a.385.385 0 0 0 0 .731l1.553.511a.48.48 0 0 1 .307.307l.51 1.553a.385.385 0 0 0 .731 0l.511-1.553a.48.48 0 0 1 .307-.307l1.553-.51a.385.385 0 0 0 0-.731l-1.553-.511a.48.48 0 0 1-.307-.307l-.51-1.553ZM6.371 5.269a.39.39 0 0 0-.742 0L4.704 8.08a.977.977 0 0 1-.623.623l-2.812.925a.39.39 0 0 0 0 .742l2.812.925a.977.977 0 0 1 .623.623l.925 2.812a.39.39 0 0 0 .742 0l.925-2.812a.977.977 0 0 1 .623-.623l2.812-.925a.39.39 0 0 0 0-.742L7.92 8.704a.977.977 0 0 1-.623-.623L6.371 5.27Z"
        fill={color}
      />
    </svg>
  );
}

export function IconArrowDown({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.707 9.293a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L7 11.586V2a1 1 0 0 1 2 0v9.586l2.293-2.293a1 1 0 0 1 1.414 0Z"
        fill={color}
      />
    </svg>
  );
}

export function IconClose({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.758 3.758a1 1 0 0 0 0 1.414L6.586 8l-2.828 2.828a1 1 0 1 0 1.414 1.414L8 9.414l2.828 2.828a1 1 0 1 0 1.414-1.414L9.414 8l2.828-2.828a1 1 0 1 0-1.414-1.414L8 6.586 5.172 3.758a1 1 0 0 0-1.414 0Z"
        fill={color}
      />
    </svg>
  );
}

export function IconGoogle({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.5 0A7.5 7.5 0 0 0 0 7.5 7.5 7.5 0 0 0 7.5 15 7.5 7.5 0 0 0 15 7.5c0-.169-.014-.334-.025-.5H15V6H7v3h4.724c-.621 1.742-2.271 3-4.224 3A4.505 4.505 0 0 1 3 7.5C3 5.019 5.019 3 7.5 3c.83 0 1.598.237 2.263.632l2.364-2.027A7.461 7.461 0 0 0 7.5 0" fill="currentColor" />
    </svg>
  );
}

export function IconGoogleColor({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.24c0-.9-.07-1.56-.23-2.25H12v4.09h6.06a5.38 5.38 0 0 1-2.25 3.57l-.02.13 3.27 2.53.23.03c2.07-1.92 3.27-4.75 3.27-8.1Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.48-2.7a6.5 6.5 0 0 1-3.81 1.1 6.62 6.62 0 0 1-6.26-4.56h-.13l-3.4 2.63-.04.13A11 11 0 0 0 12 23Z" fill="#34A853" />
      <path d="M5.74 14.18A6.77 6.77 0 0 1 5.38 12c0-.76.13-1.5.35-2.17v-.15L2.28 7l-.12.05A11.01 11.01 0 0 0 1 12c0 1.77.43 3.45 1.17 4.94l3.57-2.76Z" fill="#FBBC05" />
      <path d="M12 5.25c2.07 0 3.46.9 4.25 1.64l3.1-3.03a11 11 0 0 0-17.19 3.2l3.57 2.76A6.65 6.65 0 0 1 12 5.25Z" fill="#EB4335" />
    </svg>
  );
}

export function IconSearch({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill={color}>
      <path d="m14.704 13.285-4.537-4.537a4.997 4.997 0 1 0-1.419 1.42l4.537 4.536a1 1 0 0 0 1.638-.325.998.998 0 0 0-.219-1.094ZM3.002 6a2.998 2.998 0 1 1 5.996 0 2.998 2.998 0 0 1-5.996 0Z" />
    </svg>
  );
}

export function IconLightning({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M11.8274 6.55747L6.46238 15.5471C5.82153 16.5015 4.34049 15.7978 4.67562 14.6981L6.41223 9H4.00019C3.39117 9 2.92358 8.46022 3.01041 7.85743L4.51022 0.857429C4.5811 0.365299 5.00279 0 5.5 0H9.09602C9.75989 0 10.2395 0.634984 10.0579 1.27353L8.99817 5H10.9972C11.7974 5 12.2734 5.89314 11.8274 6.55747Z" />
    </svg>
  );
}

export function IconLock({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12.042 5.011v1.074A2.01 2.01 0 0 1 14 8.03v3.009a4.009 4.009 0 0 1-1.194 2.804A4.02 4.02 0 0 1 9.983 15H6.017a4.02 4.02 0 0 1-2.823-1.157A4.009 4.009 0 0 1 2 11.039V8.09a2.004 2.004 0 0 1 2.008-2.005V5.01a4.01 4.01 0 0 1 1.177-2.836 4.02 4.02 0 0 1 6.857 2.836ZM9.445 3.593a2.01 2.01 0 0 0-3.428 1.418v1.074h4.016V5.01c0-.531-.211-1.042-.588-1.418Zm1.991 8.822c.375-.366.593-.863.606-1.386V8.09H4.059v2.939a2.004 2.004 0 0 0 2.008 1.955h3.966a2.01 2.01 0 0 0 1.403-.57Zm-2.7-.677a1.005 1.005 0 0 1-1.715-.71v-1.002a1.002 1.002 0 0 1 1.004-1.003 1.005 1.005 0 0 1 1.004 1.003v1.003c0 .266-.106.52-.294.709Z" />
    </svg>
  );
}

export function IconWarning({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="#E07D42">
      <path d="M7 6h2v4H7V6Zm2 7v-2H7v2h2Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M6.152 1.172c.719-1.563 2.977-1.563 3.696 0l6.043 13.141c.363.791-.225 1.687-1.109 1.687H1.218c-.884 0-1.472-.896-1.109-1.687L6.152 1.172Zm7.374 12.837L8 1.99 2.474 14.01h11.052Z" />
    </svg>
  );
}

export function RoleIconBriefcase() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 3a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V3Zm6 0v1H6V3h4Zm-8 7v3h12v-3h-4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1H2Zm8-2h4V6H2v2h4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RoleIconLaptop() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.25 2C2.56 2 2 2.56 2 3.25v7.5c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25v-7.5C14 2.56 13.44 2 12.75 2h-9.5ZM4 10V4h8v6H4Z"
        fill="currentColor"
      />
      <path d="M16 13H0v2h16v-2Z" fill="currentColor" />
    </svg>
  );
}

export function RoleIconMegaphone() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 2a1 1 0 0 0-1.6-.8L8.667 4H5.5a3.5 3.5 0 1 0 0 7H6v4a1 1 0 1 0 2 0v-4h.667l3.733 2.8A1 1 0 0 0 14 13V2ZM9.6 5.8 12 4v7L9.6 9.2A1 1 0 0 0 9 9H5.5a1.5 1.5 0 0 1 0-3H9a1 1 0 0 0 .6-.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RoleIconPin() {
  return <IconPin size={16} color="currentColor" />;
}

export function RoleIconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 1a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM6 5a2 2 0 0 1 4 0 2 2 0 0 1-4 0Z"
        fill="currentColor"
      />
      <path
        d="M4.5 10A3.5 3.5 0 0 0 1 13.5V15h2v-1.5A1.5 1.5 0 0 1 4.5 12h7a1.5 1.5 0 0 1 1.5 1.5V15h2v-1.5a3.5 3.5 0 0 0-3.5-3.5h-7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconThumbUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m13.854 13.312 1.963-4.292C16.438 7.596 15.4 6 13.854 6H10l.734-2.527c.313-.889.08-1.792-.697-2.243-.732-.425-1.6-.225-2.198.404L4.32 4.808A4 4 0 0 0 3 7.778v3.858a2 2 0 0 0 .789 1.592l1.26.96a4 4 0 0 0 2.423.816h3.764c1.135 0 2.162-.646 2.618-1.692ZM5.66 6.292l2.944-2.656-.525 1.805A2 2 0 0 0 10 7.999h3.854a.12.12 0 0 1 .064.014.16.16 0 0 1 .053.052.173.173 0 0 1 .028.076.146.146 0 0 1-.012.072l-1.96 4.284-.006.016a.832.832 0 0 1-.785.49H7.472a2 2 0 0 1-1.211-.408L5 11.636V7.777a2 2 0 0 1 .66-1.485Z"
        fill="currentColor"
      />
      <path d="M1 5.999a1 1 0 0 0-1 1v5.004a1 1 0 0 0 2 0V6.999a1 1 0 0 0-1-1Z" fill="currentColor" />
    </svg>
  );
}

export function IconThumbDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="m13.854 2.695 1.963 4.292c.621 1.425-.417 3.021-1.963 3.021H10l.734 2.528c.313.888.08 1.791-.697 2.243-.732.425-1.6.224-2.198-.404L4.32 11.2A4 4 0 0 1 3 8.23V4.371a2 2 0 0 1 .789-1.591l1.26-.96a4 4 0 0 1 2.423-.816h3.764c1.135 0 2.162.646 2.618 1.691ZM5.66 9.715l2.944 2.656-.525-1.804A2 2 0 0 1 10 8.009h3.854a.12.12 0 0 0 .064-.015.16.16 0 0 0 .053-.052.173.173 0 0 0 .028-.076.146.146 0 0 0-.012-.071l-1.96-4.284-.006-.017a.832.832 0 0 0-.785-.49H7.472a2 2 0 0 0-1.211.408L5 4.372V8.23a2 2 0 0 0 .66 1.485Z"
        fill="currentColor"
      />
      <path d="M1 10.008a1 1 0 0 1-1-1V4.006a1 1 0 0 1 2 0V9.01a1 1 0 0 1-1 1Z" fill="currentColor" />
    </svg>
  );
}

export function IconMagicWand({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.559 1.289a1 1 0 0 0-1.415 0L1.29 10.144a1 1 0 0 0 0 1.415l2.153 2.153a1 1 0 0 0 1.415 0l8.855-8.856a1 1 0 0 0 0-1.414L11.559 1.29Zm-.707 2.121L8.697 5.565l.74.739 2.154-2.155-.74-.739ZM3.41 10.851 7.272 6.99l.739.739-3.862 3.861-.739-.739Z"
        fill={color}
      />
      <path
        d="M13.622 7.259a.4.4 0 0 1 .75 0l.305.823a.4.4 0 0 0 .237.236l.823.305a.4.4 0 0 1 0 .75l-.823.305a.4.4 0 0 0-.237.237l-.304.823a.4.4 0 0 1-.75 0l-.305-.823a.4.4 0 0 0-.236-.237l-.824-.305a.4.4 0 0 1 0-.75l.824-.305a.4.4 0 0 0 .236-.236l.304-.823Zm-2.999 4.003a.4.4 0 0 1 .75 0l.575 1.553a.4.4 0 0 0 .236.236l1.552.574a.4.4 0 0 1 0 .75l-1.552.575a.4.4 0 0 0-.236.237l-.574 1.552a.4.4 0 0 1-.75 0l-.575-1.553a.4.4 0 0 0-.236-.236l-1.552-.574a.4.4 0 0 1 0-.75l1.552-.575a.4.4 0 0 0 .236-.236l.574-1.553Z"
        fill={color}
      />
    </svg>
  );
}

export function IconCalendar({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 1a1 1 0 1 1 2 0v2h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2V1a1 1 0 0 1 2 0v2h4V1ZM4 5a1 1 0 0 0 2 0h4a1 1 0 1 0 2 0h1v2H3V5h1ZM3 9v4h10V9H3Z"
        fill={color}
      />
    </svg>
  );
}

export function IconLink({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.707 11.707a1 1 0 0 1 0-1.414L10.586 8.414a2 2 0 0 0 0-2.828L9.172 4.172a2 2 0 0 0-2.828 0L4.929 5.586a1 1 0 0 1-1.414-1.414l1.415-1.414a4 4 0 0 1 5.656 0l1.414 1.414a4 4 0 0 1 0 5.657l-1.879 1.878a1 1 0 0 1-1.414 0ZM7.293 4.293a1 1 0 0 1 0 1.414L5.414 7.586a2 2 0 0 0 0 2.828l1.414 1.414a2 2 0 0 0 2.828 0l1.415-1.414a1 1 0 1 1 1.414 1.414l-1.415 1.414a4 4 0 0 1-5.656 0L4 10.414a4 4 0 0 1 0-5.657l1.879-1.878a1 1 0 0 1 1.414 0Z"
        fill={color}
      />
    </svg>
  );
}

export function IconExternalLink({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M14.388 1.079a.998.998 0 0 0-.39-.079H9.75a1.001 1.001 0 1 0 0 2.003h1.83L5.298 9.29a1.001 1.001 0 0 0 1.416 1.416l6.284-6.288v1.83a1.001 1.001 0 1 0 2.003 0V2.002a.997.997 0 0 0-.612-.922Z"
        fill={color}
      />
      <path
        d="M1 5a1 1 0 0 1 1-1h4v2H3v7h7v-3h2v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5Z"
        fill={color}
      />
    </svg>
  );
}

export function IconReload({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.95 1a1 1 0 0 0-1 1v1.11-.06a7 7 0 1 0 0 9.9 1 1 0 0 0-1.41-1.41 5 5 0 1 1 0-7.08c.16.172.31.352.45.54h-2a1 1 0 0 0 0 2h4a1 1 0 0 0 1-1V2a.999.999 0 0 0-1.04-1Z"
        fill={color}
      />
    </svg>
  );
}

export function IconFacebook({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 .007c-4.418 0-8 3.604-8 8.048 0 4.017 2.925 7.346 6.75 7.952v-5.625H4.718V8.055H6.75V6.282c0-2.019 1.195-3.132 3.021-3.132.876 0 1.793.157 1.793.157v1.98h-1.012c-.992 0-1.302.62-1.302 1.258v1.509h2.217l-.355 2.327H9.25v5.625c3.825-.603 6.75-3.933 6.75-7.95C16 3.61 12.418.006 8 .006Z"
        fill={color}
      />
    </svg>
  );
}

export function IconInfo({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M7.82 6a1 1 0 0 1 .99 1.16L8 12h2a1 1 0 1 1 0 2H7.18a1 1 0 0 1-.99-1.16L7 8H6a1 1 0 0 1 0-2h1.82ZM8.5 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        fill={color}
      />
    </svg>
  );
}

export function IconRobot({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 7a2 2 0 0 0-2-2H9V3.72A2 2 0 0 0 10 2a2 2 0 1 0-4 0 2 2 0 0 0 1 1.72V5H4a2 2 0 0 0-2 2 2 2 0 1 0 0 4v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a2 2 0 0 0 0-4ZM4 14V7h8v7H4Zm2-6a1 1 0 0 0-1 1v1a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Zm3.293.293A1 1 0 0 1 11 9v1a1 1 0 0 1-2 0V9a1 1 0 0 1 .293-.707Z"
        fill={color}
      />
    </svg>
  );
}

export function LocalProBadge() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-label="Local Pro location" role="img">
      <path d="M2.40723 13.314C2.00622 13.715 1.72463 14.2185 1.59657 14.7732L0 20L5.17203 18.4C5.74085 18.1436 6.25832 18.0013 6.67393 17.5806C7.88695 16.3527 7.8515 14.4916 6.67393 13.314C5.49635 12.1364 3.5848 12.1364 2.40723 13.314Z" fill="#FFB531" />
      <path d="M14 1.07562L18.9243 6C19.6218 4.51261 19.9998 2.89075 19.9998 1.21009V0H18.7899C17.1092 0 15.4874 0.378192 14 1.07562Z" fill="#ED5757" />
      <path d="M16.8344 8.86423C16.414 9.28462 15.5457 10.0648 14.3293 10.9974C13.54 11.6024 7.56455 15.2127 7.56455 15.2127L4.61172 12.4922C4.61172 12.4922 8.39998 6.17087 9.05851 5.35426C9.87052 4.34733 10.7616 3.53954 11.1356 3.16548C12.0474 2.25371 12.8685 1.60481 14 1.07562L16.5 3.53773L18.9358 6C18.4066 7.13169 17.7461 7.95246 16.8344 8.86423Z" fill="#E6E6E9" />
      <path d="M14.3048 5.68584C13.6205 5.00156 12.5157 5.00156 11.8313 5.68584C11.147 6.37011 11.147 7.47509 11.8313 8.15937C12.5157 8.84379 13.6205 8.84364 14.3048 8.15937C14.9892 7.47509 14.9892 6.37026 14.3048 5.68584Z" fill="#48ADD9" />
    </svg>
  );
}

export function GrowthAgentIllustration() {
  return (
    <svg width="200" height="220" viewBox="0 0 200 220" aria-hidden="true">
      <rect x="40" y="120" width="120" height="80" rx="8" fill="#E8F4F8" stroke="#D4D4D8" />
      <rect x="55" y="95" width="90" height="30" rx="4" fill="#FFFFFF" stroke="#D4D4D8" />
      <rect x="70" y="140" width="24" height="40" rx="2" fill="#FFFFFF" stroke="#E4E4E7" />
      <rect x="106" y="140" width="24" height="40" rx="2" fill="#FFFFFF" stroke="#E4E4E7" />
      <circle cx="100" cy="72" r="28" fill="#2F2F34" />
      <rect x="88" y="58" width="24" height="16" rx="4" fill="#FFFFFF" />
      <circle cx="93" cy="66" r="3" fill="#2F2F34" />
      <circle cx="107" cy="66" r="3" fill="#2F2F34" />
      <rect x="82" y="100" width="36" height="20" rx="6" fill="#783AFB" opacity="0.85" />
      <path d="M64 78 L76 92" stroke="#783AFB" strokeWidth="3" strokeLinecap="round" />
      <path d="M136 78 L124 92" stroke="#783AFB" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function GrowthKeepItUpIllustration() {
  return (
    <svg width="200" height="160" viewBox="0 0 200 160" aria-hidden="true">
      <circle cx="100" cy="78" r="52" fill="#E8F8EF" stroke="#B8E6CC" strokeWidth="2" />
      <circle cx="100" cy="78" r="36" fill="#FFFFFF" stroke="#D4D4D8" strokeWidth="2" />
      <circle cx="100" cy="78" r="20" fill="#1AB25E" opacity="0.15" />
      <circle cx="100" cy="78" r="8" fill="#1AB25E" />
      <path
        d="M100 30 L108 54 H124 L112 66 L116 84 L100 74 L84 84 L88 66 L76 54 H92 Z"
        fill="#1AB25E"
        opacity="0.85"
      />
      <path d="M58 98 L72 112" stroke="#1AB25E" strokeWidth="3" strokeLinecap="round" />
      <path d="M142 98 L128 112" stroke="#1AB25E" strokeWidth="3" strokeLinecap="round" />
      <circle cx="52" cy="52" r="6" fill="#1AB25E" opacity="0.35" />
      <circle cx="148" cy="48" r="5" fill="#1AB25E" opacity="0.25" />
    </svg>
  );
}

export function AiRepliesEnabledIllustration() {
  return (
    <svg fill="none" height="124" viewBox="0 0 124 124" width="124" aria-hidden="true">
      <path
        d="m61.0589 5.21283-25.6581 26.79647-33.69762 15.8073c-.68422.3382-.940801 1.1835-.59869 1.7752l17.78961 32.46 4.875 36.6022c.0856.761.7698 1.268 1.5395 1.099l36.6911-6.763 36.6911 6.763c.7697.169 1.4542-.338 1.5392-1.099l4.875-36.6022 17.79-32.3755c.342-.6762.085-1.5215-.599-1.7751l-33.6974-15.8919-25.6581-26.79647c-.4276-.59172-1.3684-.59172-1.8816 0z"
        fill="#45e0a8"
      />
      <path
        d="m83.4669 14.2576-53.4544 12.9333c-2.2237.5072-4.1053 3.2967-4.1053 6.0862v48.4365c0 2.7895 1.7961 4.3111 4.0198 3.2967l8.8093-4.142 5.3026 10.4819 5.4738-15.4693 32.5002-14.962c2.2237-1.0144 4.0198-3.6349 4.1053-5.8327l1.2829-37.87c.0856-2.1133-1.625-3.4658-3.9342-2.9586z"
        fill="#fff"
        stroke="#000"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m26.2301 42.446 60.8288-16.6075s1.2829-10.651-1.1974-11.6654c-2.4803-.9298-58.2005 13.9652-58.2005 13.9652-1.9078 4.2923-2.1151 9.2358-1.4309 14.3077z" fill="#45e0a8" />
      <path
        d="m96.4677 65.9062s-6.2434-16.8218-21.9804-16.3991l-6.2871-5.1536-9.8775 1.0116 2.4803 9.6365s-5.8159 3.6349-6.5856 5.8327c-.8018 3.55 3.9342 1.9442 3.9342 1.9442s-4.2763 6.0863-3.1645 7.6078c1.1119 1.5216 4.0198-1.1834 4.0198-1.1834s-3.25 3.1277-1.454 6.5089c1.8816 3.3813 7.0133-5.9172 7.0133-5.9172l15.908 13.6941z"
        fill="#45e0a8"
      />
      <path d="m107.5 91.6039c-3.25 3.3812-7.612 4.3956-9.7501 2.3669-.0856-.0846-.1711-.1691-.2566-.3382-1.7961-2.1132-.8553-6.2553 2.2237-9.4675 3.25-3.3812 7.612-4.3956 9.75-2.3668 2.138 2.0287 1.197 6.4243-1.967 9.8056zm-5.987-1.5216c.77.6763 2.309.3381 3.421-.8453s1.454-2.705.684-3.4658c-.769-.6762-2.309-.3381-3.421.8453-1.112 1.1835-1.454 2.705-.684 3.4658z" fill="#fff" />
      <path d="m104.592 89.4906c-1.112 1.1835-2.651 1.5216-3.421.8453-.77-.6762-.428-2.2823.684-3.4657 1.112-1.1835 2.652-1.5216 3.421-.8454.77.7608.513 2.2824-.684 3.4658z" fill="#000" />
    </svg>
  );
}
