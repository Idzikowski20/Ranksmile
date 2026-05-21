import React from 'react';
import {
  Loading01Icon,
  Menu01Icon,
  Cancel01Icon,
  Download01Icon,
  Delete01Icon,
  Edit01Icon,
  Tick01Icon,
  Alert01Icon,
  QuestionIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Search01Icon,
  Settings01Icon,
  Logout01Icon,
  RefreshIcon,
  MoreHorizontalIcon,
  StarIcon,
  Link01Icon,
  Link02Icon,
  Clock01Icon,
  Sorting01Icon,
  ComputerIcon,
  SmartPhone01Icon,
  TagsIcon,
  FilterIcon,
  BulbIcon,
  Analytics01Icon,
  GoogleIcon,
  AdvertisimentIcon,
  Cursor01Icon,
  EyeIcon,
  ViewOffIcon,
  Target01Icon,
  HelpCircleIcon,
  Calendar01Icon,
  Mail01Icon,
  City01Icon,
  GlobeIcon,
  LockIcon,
  BotIcon,
} from 'hugeicons-react';

type IconProps = {
  type: string;
  size?: number;
  color?: string;
  title?: string;
  classes?: string;
};

/* Custom SerpBear logo — kept as is since it's the app's brand identity */
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

const hugeiconsProps = (size: number, color: string) => ({
  size,
  color,
});

const Icon = ({ type, color = 'currentColor', size = 16, title = '', classes = '' }: IconProps) => {
  const props = hugeiconsProps(size, color);

  const renderIcon = () => {
    switch (type) {
      case 'logo':
        return <LogoIcon size={size} color={color} />;
      case 'loading':
        return <Loading01Icon {...props} />;
      case 'menu':
        return <Menu01Icon {...props} />;
      case 'close':
        return <Cancel01Icon {...props} />;
      case 'download':
        return <Download01Icon {...props} />;
      case 'trash':
        return <Delete01Icon {...props} />;
      case 'edit':
        return <Edit01Icon {...props} />;
      case 'check':
        return <Tick01Icon {...props} />;
      case 'error':
        return <Alert01Icon {...props} />;
      case 'question':
        return <QuestionIcon {...props} />;
      case 'caret-left':
        return <ArrowLeft01Icon {...props} />;
      case 'caret-right':
        return <ArrowRight01Icon {...props} />;
      case 'caret-down':
        return <ArrowDown01Icon {...props} />;
      case 'caret-up':
        return <ArrowUp01Icon {...props} />;
      case 'search':
        return <Search01Icon {...props} />;
      case 'settings':
      case 'settings-alt':
        return <Settings01Icon {...props} />;
      case 'logout':
        return <Logout01Icon {...props} />;
      case 'reload':
        return <RefreshIcon {...props} />;
      case 'dots':
        return <MoreHorizontalIcon {...props} />;
      case 'hamburger':
        return <Menu01Icon {...props} />;
      case 'star':
        return <StarIcon {...props} />;
      case 'star-filled':
        return <StarIcon {...props} color={color} />;
      case 'link':
        return <Link01Icon {...props} />;
      case 'link-alt':
        return <Link02Icon {...props} />;
      case 'clock':
        return <Clock01Icon {...props} />;
      case 'sort':
        return <Sorting01Icon {...props} />;
      case 'desktop':
        return <ComputerIcon {...props} />;
      case 'mobile':
        return <SmartPhone01Icon {...props} />;
      case 'tags':
        return <TagsIcon {...props} />;
      case 'filter':
        return <FilterIcon {...props} />;
      case 'idea':
        return <BulbIcon {...props} />;
      case 'tracking':
        return <Analytics01Icon {...props} />;
      case 'google':
        return <GoogleIcon {...props} />;
      case 'adwords':
        return <AdvertisimentIcon {...props} />;
      case 'keywords':
        return <Menu01Icon {...props} />;
      case 'integration':
        return <Link02Icon {...props} />;
      case 'cursor':
        return <Cursor01Icon {...props} />;
      case 'eye':
        return <EyeIcon {...props} />;
      case 'eye-closed':
        return <ViewOffIcon {...props} />;
      case 'target':
        return <Target01Icon {...props} />;
      case 'help':
        return <HelpCircleIcon {...props} />;
      case 'date':
        return <Calendar01Icon {...props} />;
      case 'email':
        return <Mail01Icon {...props} />;
      case 'scraper':
        return <BotIcon {...props} />;
      case 'city':
        return <City01Icon {...props} />;
      case 'research':
        return <Search01Icon {...props} />;
      case 'domains':
        return <GlobeIcon {...props} />;
      case 'lock':
        return <LockIcon {...props} />;
      case 'image':
        return <QuestionIcon {...props} />;
      default:
        return <QuestionIcon {...props} />;
    }
  };

  return (
    <span className={`icon inline-block relative top-[2px] ${classes}`} title={title}>
      {renderIcon()}
    </span>
  );
};

export default Icon;
