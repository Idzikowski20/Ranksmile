/** Stacking context tokens — overlays, chrome, feedback. */

export const zIndex = {
  base: 1,
  sticky: 100,
  header: 1000,
  dropdown: 1020,
  popover: 1030,
  drawer: 9999,
  modal: 10000,
  toast: 10001,
  tour: 10002,
  tooltip: 10003,
} as const;
