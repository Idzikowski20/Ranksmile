import type { NextPage } from 'next';
import { PricingPage } from '../components/pricing/PricingPage';

// Public marketing pricing page — no auth gate (registered in lib/isPublicPath + accessPolicy).
// Distinct from /plans (the in-app Stripe pricing surface).
const Pricing: NextPage = () => <PricingPage />;
export default Pricing;
