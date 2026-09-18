import React from 'react';
import { Icon as KoalaIcon } from '../koala/icons/Icon';

type IconProps = {
  type: string;
  size?: number;
  color?: string;
  title?: string;
  classes?: string;
};

/* Custom Ranksmile logo — kept as is since it's the app's brand identity */
const LogoIcon = ({ size, color }: { size: number; color: string }) => (
  <svg
    width={size}
    viewBox="0 0 1484.32 1348.5"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <path
      fill={color}
      d="M1406.23,604.17s-44-158.18,40.43-192.67,195,97.52,195,97.52,314-65.41,534,0c0,0,122.16-105.61,214.68-80.28,99.9,27.36,32.7,181.38,32.7,181.38s228.36,384.15,239.06,737.38c0,0-346.1,346.09-746.9,406.75,0,0-527.47-106.44-737.38-449.57C1177.88,1304.68,1169.55,1008.54,1406.23,604.17Z"
      transform="translate(-1177.84 -405.75)"
    />
    <path
      fill="white"
      d="M1920.79,873S1659,855,1635,1275c0,0-19,182,304.82,178.35,244-2.75,260.55-118.61,266.41-182C2212,1209,2131,874,1920.79,873Z"
      transform="translate(-1177.84 -405.75)"
    />
    <path
      fill={color}
      d="M1930.07,1194.67s143.91,5.95,116.55,94-118.93,83.25-118.93,83.25-96.34,0-134.4-95.15C1764.45,1204.62,1930.07,1194.67,1930.07,1194.67Z"
      transform="translate(-1177.84 -405.75)"
    />
  </svg>
);

/* Custom Dashboard icon */
const DashboardIcon = ({ size, color }: { size: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12H21M12 3V21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* Custom Research icon */
const ResearchIcon = ({ size, color }: { size: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.13515 11.189L3.3304 4.38052C2.89291 3.59765 2.67417 3.20621 2.71103 2.88573C2.7432 2.60611 2.8917 2.353 3.1201 2.18852C3.38188 2 3.83029 2 4.72711 2H6.96193C7.29523 2 7.46187 2 7.61135 2.04813C7.74362 2.09073 7.86556 2.16042 7.96939 2.25276C8.08674 2.35712 8.17132 2.5007 8.3405 2.78788L12.0001 9L15.6597 2.78788C15.8289 2.5007 15.9135 2.35712 16.0308 2.25276C16.1347 2.16042 16.2566 2.09073 16.3889 2.04813C16.5383 2 16.705 2 17.0383 2H19.2731C20.1699 2 20.6183 2 20.8801 2.18852C21.1085 2.353 21.257 2.60611 21.2892 2.88573C21.326 3.20621 21.1073 3.59765 20.6698 4.38052L16.8651 11.189M10.5001 14L12.0001 13V18M10.7501 18H13.2501M16.5963 10.9038C19.1347 13.4422 19.1347 17.5578 16.5963 20.0962C14.0579 22.6346 9.94232 22.6346 7.40391 20.0962C4.8655 17.5578 4.8655 13.4422 7.40391 10.9038C9.94231 8.3654 14.0579 8.3654 16.5963 10.9038Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CUSTOM = {
  logo: LogoIcon,
  research: ResearchIcon,
  domains: DashboardIcon,
} as const;

/** Legacy `type` string -> Koala Icon_Bold (Phosphor) name. */
const PHOSPHOR: Record<string, string> = {
  loading: 'CircleNotch',
  menu: 'List',
  hamburger: 'List',
  keywords: 'List',
  close: 'X',
  download: 'DownloadSimple',
  trash: 'Trash',
  edit: 'PencilSimple',
  check: 'Check',
  error: 'Warning',
  question: 'QuestionMark',
  'caret-left': 'ArrowLeft',
  'caret-right': 'ArrowRight',
  'caret-down': 'ArrowDown',
  'caret-up': 'ArrowUp',
  search: 'MagnifyingGlass',
  settings: 'Gear',
  'settings-alt': 'Gear',
  logout: 'SignOut',
  reload: 'ArrowsClockwise',
  dots: 'DotsThree',
  star: 'Star',
  'star-filled': 'Star',
  link: 'Link',
  'link-alt': 'LinkSimple',
  integration: 'LinkSimple',
  clock: 'Clock',
  sort: 'ArrowsDownUp',
  desktop: 'Desktop',
  mobile: 'DeviceMobile',
  tags: 'Tag',
  filter: 'Funnel',
  idea: 'Lightbulb',
  tracking: 'ChartLine',
  google: 'GoogleLogo',
  adwords: 'Megaphone',
  cursor: 'Cursor',
  eye: 'Eye',
  'eye-closed': 'EyeSlash',
  target: 'Target',
  help: 'Question',
  date: 'Calendar',
  email: 'Envelope',
  scraper: 'Robot',
  city: 'Buildings',
  lock: 'Lock',
  image: 'Image',
};

const Icon = ({ type, color = 'currentColor', size = 16, title = '', classes = '' }: IconProps) => {
  const Custom = CUSTOM[type as keyof typeof CUSTOM];
  return (
    <span className={`icon inline-block relative ${classes}`} title={title}>
      {Custom
        ? <Custom size={size} color={color} />
        : (
          <KoalaIcon
            name={PHOSPHOR[type] ?? 'Question'}
            size={size}
            color={color}
            weight={type === 'star-filled' ? 'fill' : 'bold'}
          />
        )}
    </span>
  );
};

export default Icon;
