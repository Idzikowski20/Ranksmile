import fs from 'node:fs';

const A = {
  logo: 'https://www.figma.com/api/mcp/asset/2aa19d8a-3bb2-4253-a0eb-db17abfa4749',
  heroPattern: 'https://www.figma.com/api/mcp/asset/c317a0b6-026e-41c9-a719-51aef0213e63',
  heroDx: 'https://www.figma.com/api/mcp/asset/4bf6500b-09b7-47bf-a80a-f412516fe06a',
  heroVector: 'https://www.figma.com/api/mcp/asset/caed80bd-c963-4371-8f0c-07363adbb2eb',
  reasonIcons: [
    'https://www.figma.com/api/mcp/asset/7e987449-023b-42d0-b135-9b4f7f3421f8',
    'https://www.figma.com/api/mcp/asset/e6e3c47b-2d17-446e-9c5a-5d4a0c831248',
    'https://www.figma.com/api/mcp/asset/0f5c5612-d962-46c1-87d1-3d5ec9243a62',
    'https://www.figma.com/api/mcp/asset/95f2f832-2035-42bc-af92-88392526c892',
    'https://www.figma.com/api/mcp/asset/7ce1095d-8e49-47cb-a4a8-6886aaac41bf',
    'https://www.figma.com/api/mcp/asset/c8ec8817-7e4f-40ce-8d0e-175e2357ec14',
  ],
  serviceCardBg: 'https://www.figma.com/api/mcp/asset/d528c86f-5319-41be-97ac-37db2df3ea73',
  serviceAbstract: 'https://www.figma.com/api/mcp/asset/e18f81eb-f2d2-4c6e-9175-4796fa5de150',
  serviceAbstractAlt: 'https://www.figma.com/api/mcp/asset/21d8b6d9-566f-492b-b8b3-665b82701ddc',
  serviceIcons: [
    'https://www.figma.com/api/mcp/asset/d9e9cafd-a426-45cb-a656-ab5b5d4e310d',
    'https://www.figma.com/api/mcp/asset/0bfb7117-75ec-41cd-afa1-c2f6d3a24dc5',
    'https://www.figma.com/api/mcp/asset/eb39d962-e7ff-4671-92f0-75eb31ebeaef',
    'https://www.figma.com/api/mcp/asset/fd841426-c3b9-4764-b6b1-95146c7909d2',
  ],
  serviceArrow: 'https://www.figma.com/api/mcp/asset/cef57e57-9db8-4dd7-8596-17416d5485f9',
  testimonialBg: 'https://www.figma.com/api/mcp/asset/d27765f1-5a0f-4ce4-bbc2-ad6f2a55cc11',
  testimonialQuote: 'https://www.figma.com/api/mcp/asset/d375b18a-29fe-4977-b1b3-b8e07a8498e8',
  testimonialTail: 'https://www.figma.com/api/mcp/asset/6e4a8230-cd09-411c-bcbf-99c114cb430a',
  testimonialAvatars: [
    'https://www.figma.com/api/mcp/asset/ff168958-4be6-48d1-8b10-da62ae76022e',
    'https://www.figma.com/api/mcp/asset/4c8bec39-7530-474d-a088-fdd39b9d391a',
    'https://www.figma.com/api/mcp/asset/e4120222-315c-4a85-b0b2-c587e703ad60',
    'https://www.figma.com/api/mcp/asset/ba22c631-692b-47c0-b052-e743c4521ef0',
  ],
  ctaBg: 'https://www.figma.com/api/mcp/asset/255954cb-a8d7-4537-9ce9-9a151d4b5db3',
  ctaAbstractLeft: 'https://www.figma.com/api/mcp/asset/28fb260b-d8fa-4cbe-b5cc-b7306a9bee12',
  ctaAbstractRight: 'https://www.figma.com/api/mcp/asset/ca481e9e-e913-4473-a6bc-2aa25f953cad',
  ctaLogo: 'https://www.figma.com/api/mcp/asset/e0a9374b-4d25-4fdb-a339-1180dbc0fbd4',
  footerLogo: 'https://www.figma.com/api/mcp/asset/ad96d164-d345-4f25-80f0-13d1bf836d5c',
  socialLinkedin: 'https://www.figma.com/api/mcp/asset/2b83a30b-e757-4e89-8c83-6436a0f27a4e',
  socialInstagram: 'https://www.figma.com/api/mcp/asset/6dcd5e93-4b8a-4bfe-8ca0-66d1e443f87a',
  socialTwitter: 'https://www.figma.com/api/mcp/asset/ffc20ac4-851b-4ebf-983f-c985b94430c6',
};

const bars = (n) => '<div class="digitx-hero__bar"></div>'.repeat(n);
const arrow = '<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M6 14h14M16 9l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const learnMore = `<button type="button" class="digitx-btn digitx-btn--pill-outline">Learn More<span class="digitx-btn__icon-wrap">${arrow}</span></button>`;

const reasons = [
  ['Expertise That Drives Results', 'Our team of seasoned professionals brings years of experience and expertise to the table.'],
  ['Tailored Business Solutions', "We understand that every business is unique. That's why our solutions are customized."],
  ['Cutting-Edge Web Design', 'Leave a lasting impression on your audience with our top-notch web design services.'],
  ['Mobile-First Approach', "In today's mobile-centric world, we prioritize mobile-first design to ensure your website."],
  ['Marketing Strategies', 'Our data-driven marketing strategies allow us to target the right audience with precision'],
  ['Search Engine Optimization', '(SEO) Mastery Boost your online visibility with our expert SEO techniques.'],
];

const services = [
  ['Web Development', "Unlock Your Online Potential In today's digital age, a powerful web presence is essential for any business. At DigitX, our web development services empower you to stand out in the crowded online landscape. We create responsive and dynamic websites tailored to your unique needs, ensuring seamless user experiences across all devices. From e-commerce platforms to interactive web applications, our expert developers bring your vision to life, making your online journey a resounding success.", A.serviceAbstract],
  ['Mobile App Development', "Embrace Mobility with Confidence Mobile devices have revolutionized the way we interact with the world. Our mobile app development services enable you to harness this mobility to your advantage. We design and build intuitive and high-performance mobile applications that captivate your audience and boost engagement. Whether it's iOS, Android, or cross-platform development, we ensure that your app delivers a seamless experience, leaving a lasting impression on your users.", A.serviceAbstract],
  ['Web Design', "Elevate Your Brand Aesthetics Your website's design is a reflection of your brand's identity and values. DigitX's web design services focus on creating visually striking and user-friendly interfaces that leave a lasting impact. Our creative team blends aesthetics with functionality, delivering a captivating user experience that keeps visitors coming back for more. Let us transform your online presence into an immersive journey that showcases your brand's true essence.", A.serviceAbstractAlt],
  ['Digital Marketing', 'Drive Your Business Forward In the vast digital landscape, standing out from the competition is crucial. Our digital marketing services help you rise above the noise and connect with your target audience effectively. From search engine optimization (SEO) to social media marketing and pay-per-click (PPC) campaigns, our data-driven strategies ensure that your message reaches the right people at the right time.', A.serviceAbstract],
];

const testimonials = [
  ['DigitX turned our business around! Their digital marketing strategies helped us reach new customers and increase our revenue by 30% within just a few months. Highly recommended!', 'Sarah Thompson', 'CEO of BlueBloom Fashion', 0],
  ["Working with DigitX was a pleasure. Their web design team created a stunning website that perfectly captured our brand's essence. The feedback from our customers has been overwhelmingly positive.", 'Mark Roberts', 'Founder of GreenEarth Eco Store', 1],
  ['The mobile app DigitX developed for us exceeded our expectations. Its user-friendly interface and seamless functionality have earned us rave reviews from our users.', 'Lisa Williams', 'Head of Product at HealthTech Innovations', 2],
  ['DigitX transformed our outdated website into a modern, responsive platform. Their attention to detail and ability to understand our vision made the entire process smooth and hassle-free.', 'Michael Johnson', 'Marketing Manager at GlobalTech Solutions.', 3],
];

const reasonCard = (i) => {
  const [t, b] = reasons[i];
  return `<article class="digitx-reason-card"><img src="${A.reasonIcons[i]}" alt="" class="digitx-reason-card__icon"/><div><h3>${t}</h3><p style="margin-top:20px">${b}</p></div>${learnMore}</article>`;
};

const serviceCard = (i) => {
  const [t, b, abstract] = services[i];
  return `<article class="digitx-service-card"><div class="digitx-service-card__layers" aria-hidden="true"><div class="digitx-service-card__gradient"></div><img src="${A.serviceCardBg}" alt="" class="digitx-service-card__bg"/></div><img src="${abstract}" alt="" class="digitx-service-card__abstract"/><div class="digitx-service-card__icon-stack"><div class="digitx-service-card__icon-ring digitx-service-card__icon-ring--outer"><div class="digitx-service-card__icon-ring digitx-service-card__icon-ring--mid"><div class="digitx-service-card__icon-ring digitx-service-card__icon-ring--inner"><img src="${A.serviceIcons[i]}" alt="" width="44" height="44"/></div></div></div></div><div class="digitx-service-card__text"><h3>${t}</h3><p>${b}</p></div><button type="button" class="digitx-btn digitx-btn--service">Learn More<img src="${A.serviceArrow}" alt="" width="28" height="28"/></button></article>`;
};

const testimonialCard = (i) => {
  const [q, n, r, a] = testimonials[i];
  return `<article class="digitx-testimonial"><div class="digitx-testimonial__bubble" style="background:linear-gradient(180deg,#1a1a1a 29.71%,rgba(26,26,26,0) 75.9%),url(${A.testimonialBg}) center/cover"><img src="${A.testimonialQuote}" alt="" width="30" height="30"/><p class="digitx-testimonial__quote">${q}</p></div><img src="${A.testimonialTail}" alt="" width="66" height="23"/><div class="digitx-testimonial__author"><img src="${A.testimonialAvatars[a]}" alt="" class="digitx-testimonial__avatar"/><div><p class="digitx-testimonial__name">${n}</p><p class="digitx-testimonial__role">${r}</p></div></div></article>`;
};

const css = fs.readFileSync('styles/digitx-homepage.css', 'utf8')
  .replace("@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600&display=swap');", '');

const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600&display=swap"/><style>${css}</style><div class="digitx-page"><header class="digitx-nav"><div class="digitx-nav__inner"><img src="${A.logo}" alt="DigitX" class="digitx-nav__logo"/><nav class="digitx-nav__links"><a href="#home" class="digitx-nav__link digitx-nav__link--active">Home</a><a href="#services" class="digitx-nav__link">Services</a><a href="#projects" class="digitx-nav__link">Projects</a><a href="#about" class="digitx-nav__link">About Us</a><a href="#contact" class="digitx-nav__link">Contact Us</a><a href="#careers" class="digitx-nav__link">Careers</a><a href="#blogs" class="digitx-nav__link">Blogs</a></nav></div></header><main><section id="home" class="digitx-hero"><div class="digitx-hero__visual-left" aria-hidden="true"><div style="position:absolute;inset:0;background:url(${A.heroPattern}) top left/64px 128px;opacity:.1"></div><div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,15,15,0) 0%,#0f0f0f 100%)"></div><img src="${A.heroVector}" alt="" style="position:absolute;left:-280px;top:50%;transform:translateY(-50%);width:1440px;max-width:none"/></div><div class="digitx-hero__left"><div><h1 class="digitx-hero__title"><span>Digital Solutions</span> That Drive Success</h1><p class="digitx-hero__body">At DigitX, we believe in the transformative power of digital solutions. Our team of experts is dedicated to helping businesses like yours thrive in the fast-paced digital landscape. From captivating web design to data-driven marketing strategies, we are committed to delivering results that exceed expectations.</p></div><div><p class="digitx-hero__cta-label">Unlock Your Digital Potential Today</p><div class="digitx-hero__actions"><a href="#contact" class="digitx-btn digitx-btn--primary">Get Started</a><a href="#contact" class="digitx-btn digitx-btn--outline">Free Consultation</a></div></div></div><div class="digitx-hero__visual-right" aria-hidden="true"><img src="${A.heroDx}" alt="" class="digitx-hero__dx-image"/><div class="digitx-hero__bars">${bars(20)}</div></div></section><section class="digitx-section"><div class="digitx-container"><h2 class="digitx-section-title">Reasons to Choose DigitX for<br/><span>Your Digital Journey</span></h2><p class="digitx-section-subtitle">Partnering with DigitX offers a multitude of advantages. Experience increased brand visibility, improved customer engagement, and higher ROI. Our tailored solutions are designed to meet your unique business needs, ensuring lasting success.</p><div style="margin-top:100px;display:flex;flex-direction:column;gap:50px"><div class="digitx-grid-3">${reasonCard(0)}${reasonCard(1)}${reasonCard(2)}</div><div class="digitx-divider-h"></div><div class="digitx-grid-3">${reasonCard(3)}${reasonCard(4)}${reasonCard(5)}</div></div></div></section><section id="services" class="digitx-section"><div class="digitx-container"><h2 class="digitx-section-title"><span>Our</span> Services</h2><p class="digitx-section-subtitle">Our comprehensive range of services includes web design, mobile app development, SEO, social media marketing, and more. Whether you&apos;re a startup or an established enterprise, our experts will craft solutions that drive results.</p><div style="margin-top:80px;display:flex;flex-direction:column;gap:30px"><div class="digitx-grid-2">${serviceCard(0)}${serviceCard(1)}</div><div class="digitx-grid-2">${serviceCard(2)}${serviceCard(3)}</div></div></div></section><section id="projects" class="digitx-section"><div class="digitx-container"><h2 class="digitx-section-title"><span>Our</span> Testimonials</h2><p class="digitx-section-subtitle">Do not just take our word for it; hear what our satisfied clients have to say about their experience with DigitX. We take pride in building lasting relationships and delivering exceptional results.</p><div style="margin-top:80px"><div class="digitx-testimonials-track">${testimonialCard(0)}${testimonialCard(1)}${testimonialCard(2)}${testimonialCard(3)}</div></div></div></section><section id="contact" class="digitx-section"><div class="digitx-container"><div class="digitx-cta" style="background:linear-gradient(180deg,#1a1a1a 138.96%,#0f0f0f 100%),url(${A.ctaBg}) center/cover"><img src="${A.ctaAbstractLeft}" alt="" style="position:absolute;left:-1px;top:-1px;width:788px;max-width:45%;pointer-events:none"/><img src="${A.ctaAbstractRight}" alt="" style="position:absolute;right:-1px;top:-1px;width:788px;max-width:45%;pointer-events:none"/><div class="digitx-cta__content"><div><h2 class="digitx-section-title">Ready to Transform Your Digital Presence?</h2><p class="digitx-section-subtitle" style="margin-top:20px">Take the first step towards digital success with DigitX by your side. Our team of experts is eager to craft tailored solutions that drive growth for your business.</p></div><div><p style="font-size:20px;margin:0 0 20px">Unlock Your Digital Potential Today</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a href="#contact" class="digitx-btn digitx-btn--primary">Get Started</a><a href="#contact" class="digitx-btn digitx-btn--outline">Free Consultation</a></div></div></div><div class="digitx-cta__logo-wrap"><img src="${A.ctaLogo}" alt="DigitX" class="digitx-cta__logo"/><div class="digitx-hero__bars" style="height:243px">${bars(24)}</div></div></div></div></section></main><footer class="digitx-footer digitx-container"><div class="digitx-footer__top"><img src="${A.footerLogo}" alt="DigitX" style="height:54px;width:75px"/><div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap"><span>Follow Us On Social Media</span><div class="digitx-social"><a href="https://linkedin.com" class="digitx-social__btn" aria-label="LinkedIn"><img src="${A.socialLinkedin}" alt="" width="24" height="24"/></a><a href="https://instagram.com" class="digitx-social__btn" aria-label="Instagram"><img src="${A.socialInstagram}" alt="" width="24" height="24"/></a><a href="https://twitter.com" class="digitx-social__btn" aria-label="Twitter"><img src="${A.socialTwitter}" alt="" width="24" height="24"/></a></div></div></div><div class="digitx-footer__columns"><div class="digitx-footer__column"><h4>Home</h4><a href="#">Benefits</a><a href="#">Our Testimonials</a><a href="#">Partners</a></div><div class="digitx-footer__column"><h4>Services</h4><a href="#">Web Design</a><a href="#">Website Development</a><a href="#">App Development</a><a href="#">Digital Marketing</a></div><div class="digitx-footer__column"><h4>Projects</h4><a href="#">ABC Tech Solutions</a><a href="#">GreenEarth Eco Store</a><a href="#">HealthTech Innovations</a><a href="#">GlobalTech Solutions</a><a href="#">TechGuru Inc.</a></div><div class="digitx-footer__column"><h4>About Us</h4><a href="#">Our Team</a><a href="#">Achievements</a><a href="#">Awards</a></div><div class="digitx-footer__column"><h4>Careers</h4><a href="#">Job Openings</a><a href="#">Benefits &amp; Perks</a><a href="#">Employee Refral</a></div><div class="digitx-footer__column"><h4>Blogs</h4><a href="#">Our Blogs</a></div></div><div class="digitx-footer__bottom"><span>@2023 Digitax. All Rights Reserved.</span><div style="display:flex;gap:20px;flex-wrap:wrap"><a href="#" style="color:inherit;text-decoration:none">Privacy Policy</a><a href="#" style="color:inherit;text-decoration:none">Terms &amp; Conditions</a><a href="#" style="color:inherit;text-decoration:none">Cookie Policy</a></div></div></footer></div>`;

fs.writeFileSync('scripts/digitx-instatic-payload.json', JSON.stringify({
  parentId: 'V6C8yHmNcgXJZsdgNjtAW',
  html,
}));

console.log('Wrote payload, bytes:', Buffer.byteLength(html));
