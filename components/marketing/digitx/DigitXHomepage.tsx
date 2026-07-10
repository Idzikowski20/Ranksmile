import Link from 'next/link';
import styles from '../../../styles/digitx-homepage.module.css';
import { digitxAssets } from '../../../lib/marketing/digitxAssets';

const NAV_LINKS = [
  { href: '#home', label: 'Home', active: true },
  { href: '#services', label: 'Services' },
  { href: '#projects', label: 'Projects' },
  { href: '#about', label: 'About Us' },
  { href: '#contact', label: 'Contact Us' },
  { href: '#careers', label: 'Careers' },
  { href: '#blogs', label: 'Blogs' },
] as const;

const REASONS = [
  {
    icon: digitxAssets.reasonIcons[0],
    title: 'Expertise That Drives Results',
    body: 'Our team of seasoned professionals brings years of experience and expertise to the table.',
  },
  {
    icon: digitxAssets.reasonIcons[1],
    title: 'Tailored Business Solutions',
    body: "We understand that every business is unique. That's why our solutions are customized.",
  },
  {
    icon: digitxAssets.reasonIcons[2],
    title: 'Cutting-Edge Web Design',
    body: 'Leave a lasting impression on your audience with our top-notch web design services.',
  },
  {
    icon: digitxAssets.reasonIcons[3],
    title: 'Mobile-First Approach',
    body: "In today's mobile-centric world, we prioritize mobile-first design to ensure your website.",
  },
  {
    icon: digitxAssets.reasonIcons[4],
    title: 'Marketing Strategies',
    body: 'Our data-driven marketing strategies allow us to target the right audience with precision',
  },
  {
    icon: digitxAssets.reasonIcons[5],
    title: 'Search Engine Optimization',
    body: '(SEO) Mastery Boost your online visibility with our expert SEO techniques.',
  },
] as const;

const SERVICES = [
  {
    icon: digitxAssets.serviceIcons[0],
    title: 'Web Development',
    body: "Unlock Your Online Potential In today's digital age, a powerful web presence is essential for any business. At DigitX, our web development services empower you to stand out in the crowded online landscape. We create responsive and dynamic websites tailored to your unique needs, ensuring seamless user experiences across all devices. From e-commerce platforms to interactive web applications, our expert developers bring your vision to life, making your online journey a resounding success.",
    abstract: digitxAssets.serviceAbstract,
  },
  {
    icon: digitxAssets.serviceIcons[1],
    title: 'Mobile App Development',
    body: "Embrace Mobility with Confidence Mobile devices have revolutionized the way we interact with the world. Our mobile app development services enable you to harness this mobility to your advantage. We design and build intuitive and high-performance mobile applications that captivate your audience and boost engagement. Whether it's iOS, Android, or cross-platform development, we ensure that your app delivers a seamless experience, leaving a lasting impression on your users.",
    abstract: digitxAssets.serviceAbstract,
  },
  {
    icon: digitxAssets.serviceIcons[2],
    title: 'Web Design',
    body: "Elevate Your Brand Aesthetics Your website's design is a reflection of your brand's identity and values. DigitX's web design services focus on creating visually striking and user-friendly interfaces that leave a lasting impact. Our creative team blends aesthetics with functionality, delivering a captivating user experience that keeps visitors coming back for more. Let us transform your online presence into an immersive journey that showcases your brand's true essence.",
    abstract: digitxAssets.serviceAbstractAlt,
  },
  {
    icon: digitxAssets.serviceIcons[3],
    title: 'Digital Marketing',
    body: 'Drive Your Business Forward In the vast digital landscape, standing out from the competition is crucial. Our digital marketing services help you rise above the noise and connect with your target audience effectively. From search engine optimization (SEO) to social media marketing and pay-per-click (PPC) campaigns, our data-driven strategies ensure that your message reaches the right people at the right time.',
    abstract: digitxAssets.serviceAbstract,
  },
] as const;

const TESTIMONIALS = [
  {
    quote: 'DigitX turned our business around! Their digital marketing strategies helped us reach new customers and increase our revenue by 30% within just a few months. Highly recommended!',
    name: 'Sarah Thompson',
    role: 'CEO of BlueBloom Fashion',
    avatar: digitxAssets.testimonialAvatars[0],
  },
  {
    quote: "Working with DigitX was a pleasure. Their web design team created a stunning website that perfectly captured our brand's essence. The feedback from our customers has been overwhelmingly positive.",
    name: 'Mark Roberts',
    role: 'Founder of GreenEarth Eco Store',
    avatar: digitxAssets.testimonialAvatars[1],
  },
  {
    quote: 'The mobile app DigitX developed for us exceeded our expectations. Its user-friendly interface and seamless functionality have earned us rave reviews from our users.',
    name: 'Lisa Williams',
    role: 'Head of Product at HealthTech Innovations',
    avatar: digitxAssets.testimonialAvatars[2],
  },
  {
    quote: 'DigitX transformed our outdated website into a modern, responsive platform. Their attention to detail and ability to understand our vision made the entire process smooth and hassle-free.',
    name: 'Michael Johnson',
    role: 'Marketing Manager at GlobalTech Solutions.',
    avatar: digitxAssets.testimonialAvatars[3],
  },
] as const;

const FOOTER_COLUMNS = [
  { title: 'Home', links: ['Benefits', 'Our Testimonials', 'Partners'] },
  { title: 'Services', links: ['Web Design', 'Website Development', 'App Development', 'Digital Marketing'] },
  { title: 'Projects', links: ['ABC Tech Solutions', 'GreenEarth Eco Store', 'HealthTech Innovations', 'GlobalTech Solutions', 'TechGuru Inc.'] },
  { title: 'About Us', links: ['Our Team', 'Achievements', 'Awards'] },
  { title: 'Careers', links: ['Job Openings', 'Benefits & Perks', 'Employee Refral'] },
  { title: 'Blogs', links: ['Our Blogs'] },
] as const;

function ArrowIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path d="M6 14h14M16 9l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LearnMoreButton() {
  return (
    <button type="button" className={[styles['digitx-btn'], styles['digitx-btn--pill-outline']].filter(Boolean).join(' ')}>
      Learn More
      <span className={styles['digitx-btn__icon-wrap']}>
        <ArrowIcon />
      </span>
    </button>
  );
}

function ServiceCard({ item }: { item: (typeof SERVICES)[number] }) {
  return (
    <article className={styles['digitx-service-card']}>
      <div className={styles['digitx-service-card__layers']} aria-hidden="true">
        <div className={styles['digitx-service-card__gradient']} />
        <img src={digitxAssets.serviceCardBg} alt="" loading="lazy" className={styles['digitx-service-card__bg']} />
      </div>
      <img src={item.abstract} alt="" loading="lazy" className={styles['digitx-service-card__abstract']} />
      <div className={styles['digitx-service-card__icon-stack']}>
        <div className={[styles['digitx-service-card__icon-ring'], styles['digitx-service-card__icon-ring--outer']].filter(Boolean).join(' ')}>
          <div className={[styles['digitx-service-card__icon-ring'], styles['digitx-service-card__icon-ring--mid']].filter(Boolean).join(' ')}>
            <div className={[styles['digitx-service-card__icon-ring'], styles['digitx-service-card__icon-ring--inner']].filter(Boolean).join(' ')}>
              <img src={item.icon} alt="" loading="lazy" />
            </div>
          </div>
        </div>
      </div>
      <div className={styles['digitx-service-card__text']}>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
      <button type="button" className={[styles['digitx-btn'], styles['digitx-btn--service']].filter(Boolean).join(' ')}>
        Learn More
        <img src={digitxAssets.serviceArrow} alt="" width={28} height={28} loading="lazy" />
      </button>
    </article>
  );
}

export default function DigitXHomepage() {
  return (
    <div className={styles['digitx-page']}>
      <header className={styles['digitx-nav']}>
        <div className={styles['digitx-nav__inner']}>
          <img src={digitxAssets.logo} alt="DigitX" className={styles['digitx-nav__logo']} loading="eager" />
          <nav className={styles['digitx-nav__links']} aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`digitx-nav__link${'active' in item && item.active ? ' digitx-nav__link--active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <section id="home" className={styles['digitx-hero']}>
          <div className={styles['digitx-hero__visual-left']} aria-hidden>
            <div style={{ position: 'absolute', inset: 0, background: `url(${digitxAssets.heroPattern}) top left / 64px 128px`, opacity: 0.1 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,15,15,0) 0%, #0f0f0f 100%)' }} />
            <img src={digitxAssets.heroVector} alt="" loading="eager" style={{ position: 'absolute', left: -280, top: '50%', transform: 'translateY(-50%)', width: 1440, maxWidth: 'none' }} />
          </div>

          <div className={styles['digitx-hero__left']}>
            <div>
              <h1 className={styles['digitx-hero__title']}>
                <span>Digital Solutions</span>
                {' That Drive Success'}
              </h1>
              <p className={styles['digitx-hero__body']}>
                At DigitX, we believe in the transformative power of digital solutions. Our team of experts is dedicated to helping businesses like yours thrive in the fast-paced digital landscape. From captivating web design to data-driven marketing strategies, we are committed to delivering results that exceed expectations.
              </p>
            </div>
            <div>
              <p className={styles['digitx-hero__cta-label']}>Unlock Your Digital Potential Today</p>
              <div className={styles['digitx-hero__actions']}>
                <Link href="#contact" className={[styles['digitx-btn'], styles['digitx-btn--primary']].filter(Boolean).join(' ')}>Get Started</Link>
                <Link href="#contact" className={[styles['digitx-btn'], styles['digitx-btn--outline']].filter(Boolean).join(' ')}>Free Consultation</Link>
              </div>
            </div>
          </div>

          <div className={styles['digitx-hero__visual-right']} aria-hidden>
            <img src={digitxAssets.heroDx} alt="" className={styles['digitx-hero__dx-image']} loading="eager" />
            <div className={styles['digitx-hero__bars']}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className={styles['digitx-hero__bar']} />
              ))}
            </div>
          </div>
        </section>

        <section className={styles['digitx-section']}>
          <div className={styles['digitx-container']}>
            <h2 className={styles['digitx-section-title']}>
              Reasons to Choose DigitX for
              <br />
              <span>Your Digital Journey</span>
            </h2>
            <p className={styles['digitx-section-subtitle']}>
              Partnering with DigitX offers a multitude of advantages. Experience increased brand visibility, improved customer engagement, and higher ROI. Our tailored solutions are designed to meet your unique business needs, ensuring lasting success.
            </p>

            <div style={{ marginTop: 100, display: 'flex', flexDirection: 'column', gap: 50 }}>
              <div className={styles['digitx-grid-3']}>
                {REASONS.slice(0, 3).map((item) => (
                  <article key={item.title} className={styles['digitx-reason-card']}>
                    <img src={item.icon} alt="" loading="lazy" className={styles['digitx-reason-card__icon']} />
                    <div>
                      <h3>{item.title}</h3>
                      <p style={{ marginTop: 20 }}>{item.body}</p>
                    </div>
                    <LearnMoreButton />
                  </article>
                ))}
              </div>
              <div className={styles['digitx-divider-h']} />
              <div className={styles['digitx-grid-3']}>
                {REASONS.slice(3).map((item) => (
                  <article key={item.title} className={styles['digitx-reason-card']}>
                    <img src={item.icon} alt="" loading="lazy" className={styles['digitx-reason-card__icon']} />
                    <div>
                      <h3>{item.title}</h3>
                      <p style={{ marginTop: 20 }}>{item.body}</p>
                    </div>
                    <LearnMoreButton />
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="services" className={styles['digitx-section']}>
          <div className={styles['digitx-container']}>
            <h2 className={styles['digitx-section-title']}>
              <span>Our</span>
              {' Services'}
            </h2>
            <p className={styles['digitx-section-subtitle']}>
              Our comprehensive range of services includes web design, mobile app development, SEO, social media marketing, and more. Whether you&apos;re a startup or an established enterprise, our experts will craft solutions that drive results.
            </p>

            <div style={{ marginTop: 80, display: 'flex', flexDirection: 'column', gap: 30 }}>
              <div className={styles['digitx-grid-2']}>
                {SERVICES.slice(0, 2).map((item) => (
                  <ServiceCard key={item.title} item={item} />
                ))}
              </div>
              <div className={styles['digitx-grid-2']}>
                {SERVICES.slice(2).map((item) => (
                  <ServiceCard key={item.title} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="projects" className={styles['digitx-section']}>
          <div className={styles['digitx-container']}>
            <h2 className={styles['digitx-section-title']}>
              <span>Our</span>
              {' Testimonials'}
            </h2>
            <p className={styles['digitx-section-subtitle']}>
              Don&apos;t just take our word for it; hear what our satisfied clients have to say about their experience with DigitX. We take pride in building lasting relationships and delivering exceptional results.
            </p>

            <div style={{ marginTop: 80, position: 'relative' }}>
              <div className={styles['digitx-testimonials-track']}>
                {TESTIMONIALS.map((item) => (
                  <article key={item.name} className={styles['digitx-testimonial']}>
                    <div className={styles['digitx-testimonial__bubble']} style={{ background: `linear-gradient(180deg, #1a1a1a 29.71%, rgba(26,26,26,0) 75.9%), url(${digitxAssets.testimonialBg}) center/cover` }}>
                      <img src={digitxAssets.testimonialQuote} alt="" width={30} height={30} loading="lazy" />
                      <p className={styles['digitx-testimonial__quote']}>{item.quote}</p>
                    </div>
                    <img src={digitxAssets.testimonialTail} alt="" width={66} height={23} loading="lazy" />
                    <div className={styles['digitx-testimonial__author']}>
                      <img src={item.avatar} alt="" loading="lazy" className={styles['digitx-testimonial__avatar']} />
                      <div>
                        <p className={styles['digitx-testimonial__name']}>{item.name}</p>
                        <p className={styles['digitx-testimonial__role']}>{item.role}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className={styles['digitx-section']}>
          <div className={styles['digitx-container']}>
            <div className={styles['digitx-cta']} style={{ background: `linear-gradient(180deg, #1a1a1a 138.96%, #0f0f0f 100%), url(${digitxAssets.ctaBg}) center/cover` }}>
              <img src={digitxAssets.ctaAbstractLeft} alt="" loading="lazy" style={{ position: 'absolute', left: -1, top: -1, width: 788, maxWidth: '45%', pointerEvents: 'none' }} />
              <img src={digitxAssets.ctaAbstractRight} alt="" loading="lazy" style={{ position: 'absolute', right: -1, top: -1, width: 788, maxWidth: '45%', pointerEvents: 'none' }} />

              <div className={styles['digitx-cta__content']}>
                <div>
                  <h2 className={styles['digitx-section-title']}>Ready to Transform Your Digital Presence?</h2>
                  <p className={styles['digitx-section-subtitle']} style={{ marginTop: 20 }}>
                    Take the first step towards digital success with DigitX by your side. Our team of experts is eager to craft tailored solutions that drive growth for your business.
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 20, margin: '0 0 20px' }}>Unlock Your Digital Potential Today</p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="#contact" className={[styles['digitx-btn'], styles['digitx-btn--primary']].filter(Boolean).join(' ')}>Get Started</Link>
                    <Link href="#contact" className={[styles['digitx-btn'], styles['digitx-btn--outline']].filter(Boolean).join(' ')}>Free Consultation</Link>
                  </div>
                </div>
              </div>

              <div className={styles['digitx-cta__logo-wrap']}>
                <img src={digitxAssets.ctaLogo} alt="DigitX" loading="lazy" className={styles['digitx-cta__logo']} />
                <div className={styles['digitx-hero__bars']} style={{ height: 243 }}>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className={styles['digitx-hero__bar']} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={[styles['digitx-footer'], styles['digitx-container']].filter(Boolean).join(' ')}>
        <div className={styles['digitx-footer__top']}>
          <img src={digitxAssets.footerLogo} alt="DigitX" loading="lazy" style={{ height: 54, width: 75 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <span>Follow Us On Social Media</span>
            <div className={styles['digitx-social']}>
              <a href="https://linkedin.com" className={styles['digitx-social__btn']} aria-label="LinkedIn">
                <img src={digitxAssets.socialLinkedin} alt="" width={24} height={24} loading="lazy" />
              </a>
              <a href="https://instagram.com" className={styles['digitx-social__btn']} aria-label="Instagram">
                <img src={digitxAssets.socialInstagram} alt="" width={24} height={24} loading="lazy" />
              </a>
              <a href="https://twitter.com" className={styles['digitx-social__btn']} aria-label="Twitter">
                <img src={digitxAssets.socialTwitter} alt="" width={24} height={24} loading="lazy" />
              </a>
            </div>
          </div>
        </div>

        <div className={styles['digitx-footer__columns']}>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className={styles['digitx-footer__column']}>
              <h4>{col.title}</h4>
              {col.links.map((link) => (
                <a key={link} href="#">{link}</a>
              ))}
            </div>
          ))}
        </div>

        <div className={styles['digitx-footer__bottom']}>
          <span>@2023 Digitax. All Rights Reserved.</span>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms & Conditions</a>
            <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Cookie Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
