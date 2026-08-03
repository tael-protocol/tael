/* eslint-disable @next/next/no-img-element */
import { DraggableCardScroll } from "./_components/draggable-card-scroll";
import { MarketingFooter } from "./_components/marketing-footer";
import { OpenAgentButton } from "./_components/open-agent-button";
import { SiteHeader } from "./_components/site-header";
import { TrustedCarousel } from "./_components/trusted-carousel";

const HERO_LOGOS = [
  { label: "Solana", className: "bg-[#5CE1D8] text-[#10201F]" },
  { label: "Blue", className: "bg-[#5166FF] text-white" },
  { label: "Stellar", className: "bg-[#7387FF] text-white" },
  { label: "Honey", className: "bg-[#F5B82E] text-[#241906]" },
  { label: "Move", className: "bg-[#1178FF] text-white" },
  { label: "Delta", className: "bg-[#EF4C4C] text-white" },
  { label: "Arbitrum", className: "bg-[#5E7899] text-white" },
  { label: "Orbit", className: "bg-[#7A63FF] text-white" },
  { label: "Wave", className: "bg-[#43C8A7] text-[#06231D]" },
];

const DASHBOARD_URL = "https://mainnet.taelprotocol.xyz";

const FEATURES = [
  {
    title: "Own your funds",
    description:
      "Your keys, your funds. The agent acts inside your own wallet and never holds a cent of your money.",
    src: "/feature-own-funds.svg",
    imageClass:
      "left-1/2 top-1/2 h-[345px] w-[624px] -translate-x-[34%] -translate-y-1/2 -scale-y-100 lg:left-[-4px] lg:top-[-25px] lg:translate-x-0 lg:translate-y-0",
  },
  {
    title: "Just ask, it acts",
    description:
      "No menus, no steps. Say what you want in plain English, and the agent does it for you.",
    src: "/feature-just-ask-extracted.png",
    imageClass: "left-1/2 top-1/2 h-[225px] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[260px]",
  },
  {
    title: "Access anywhere",
    description:
      "One setup, every channel. Your agent lives on your site, in Discord, in Telegram, and inside Claude and ChatGPT.",
    src: "/feature-access-extracted.png",
    imageClass: "left-1/2 top-1/2 h-[242px] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[286px]",
  },
  {
    title: "Safe by design",
    description:
      "You set the spending limits, and they're locked on-chain. Even a compromised agent can't go over them.",
    src: "/feature-safe-extracted.png",
    imageClass: "left-1/2 top-1/2 h-[214px] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[240px]",
  },
  {
    title: "Nothing hidden",
    description:
      "Every action is a real transaction on Stellar. You can check any of them, anytime.",
    src: "/feature-hidden-extracted.png",
    imageClass: "left-1/2 top-1/2 h-[224px] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[260px]",
  },
  {
    title: "Low, flat fee",
    description: "A flat 0.07% on every transaction. No spreads, no surprises.",
    src: "/feature-fee-extracted.png",
    imageClass:
      "left-1/2 top-[52%] h-[238px] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[270px]",
  },
];

const KYC_STEPS = [
  {
    title: "Connect",
    description: "Sign in with your Stellar wallet or a passkey. No email, no KYC.",
    src: "/kyc-connect.svg",
    imageClass:
      "left-1/2 top-1/2 h-[345px] w-[624px] -translate-x-[51%] -translate-y-1/2 md:left-[-139px] md:top-[-13px] md:translate-x-0 md:translate-y-0",
  },
  {
    title: "Fund",
    description:
      "Load USDC into your agent's wallet from any Stellar wallet. No minimums, fees are fractions of a cent.",
    src: "/kyc-fund.svg",
    imageClass:
      "left-1/2 top-1/2 h-[345px] w-[624px] -translate-x-[45%] -translate-y-1/2 md:left-[-82px] md:top-[-25px] md:translate-x-0 md:translate-y-0",
  },
  {
    title: "All set",
    description:
      "Tell your agent to pay, run a capability, or swap. It acts on-chain instantly. No code, no delays.",
    src: "/kyc-trade.svg",
    rotated: true,
  },
];

function DummyLogo({ label, className }: { label: string; className: string }) {
  return (
    <div
      aria-label={`${label} logo placeholder`}
      className={`flex size-[30px] shrink-0 items-center justify-center rounded-[7px] ${className}`}
    >
      <span className="h-3.5 w-3.5 rounded-[4px] border-2 border-current opacity-90" />
    </div>
  );
}

function StepArtwork({
  src,
  imageClass,
  rotated = false,
}: {
  src: string;
  imageClass?: string;
  rotated?: boolean;
}) {
  if (rotated) {
    return (
      <div className="absolute left-1/2 top-[106%] flex h-[736px] w-[407px] -translate-x-[49%] -translate-y-1/2 items-center justify-center md:left-[-15px] md:top-[-38px] md:translate-x-0 md:translate-y-0">
        <div className="flex-none rotate-90">
          <img src={src} alt="" aria-hidden="true" className="h-[407px] w-[736px] max-w-none" />
        </div>
      </div>
    );
  }

  return (
    <img src={src} alt="" aria-hidden="true" className={`absolute max-w-none ${imageClass}`} />
  );
}

function FeaturesSection() {
  return (
    <section className="relative -mt-px overflow-hidden bg-[#141415] pb-20 pt-24 md:min-h-[903px] md:pb-0 md:pt-[164px]">
      <div className="mx-auto flex max-w-[1440px] flex-col">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <h2 className="max-w-[600px] text-[28px] font-medium leading-[36px] tracking-[-2.44px] text-white md:text-[48px] md:leading-[60px] md:tracking-[-0.0508em]">
            Don&apos;t choose between
            <br />
            freedom and experience.
          </h2>
          <p className="max-w-[650px] text-[14px] font-medium leading-5 tracking-normal text-[#B7B5BA]">
            Your keys, Your funds. Trade over a million token with the experience of an exchange{" "}
            <br className="hidden sm:block" />
            the freedom of wallet.
          </p>
        </div>

        <DraggableCardScroll className="mt-7 w-full overflow-visible md:mt-[72px] md:overflow-x-hidden md:overflow-y-hidden">
          <div className="flex w-full flex-col gap-14 px-4 md:w-max md:flex-row md:gap-6 md:pl-[120px] md:pr-[120px]">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="flex w-full shrink-0 flex-col gap-[23px] md:w-[400px]"
              >
                <div className="relative h-[276px] w-full overflow-hidden rounded-[24px] bg-[#1F1F20] sm:h-[320px]">
                  <img
                    src={feature.src}
                    alt=""
                    aria-hidden="true"
                    className={`absolute max-w-none ${feature.imageClass}`}
                  />
                </div>
                <div className="flex w-full flex-col gap-[9px] px-4">
                  <h3 className="text-[20px] font-medium leading-[30px] tracking-normal text-white">
                    {feature.title}
                  </h3>
                  <p className="text-[14px] font-normal leading-5 tracking-[-0.3px] text-[#B7B5BA]">
                    {feature.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </DraggableCardScroll>
      </div>
    </section>
  );
}

function KycSection() {
  return (
    <section
      id="kyc"
      className="relative -mt-px overflow-hidden bg-[#141415] pb-20 pt-20 md:pb-0 md:pt-[79px]"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col items-center px-4 md:px-6">
        <h2 className="text-center text-[36px] font-medium leading-[42px] tracking-[-0.035em] text-white md:text-[48px] md:leading-[60px] md:tracking-[-0.0508em]">
          Jump right in,
          <br />
          no KYC required.
        </h2>

        <div className="mt-12 grid w-full max-w-[1200px] grid-cols-1 gap-14 md:mt-[72px] md:grid-cols-3 md:gap-6">
          {KYC_STEPS.map((step) => (
            <article key={step.title} className="flex w-full flex-col gap-6 md:w-[384px]">
              <div className="relative h-[276px] w-full overflow-hidden rounded-[24px] bg-[#1F1F20] sm:h-[320px] md:w-[384px]">
                <StepArtwork src={step.src} imageClass={step.imageClass} rotated={step.rotated} />
              </div>
              <div className="flex w-full flex-col gap-[9px] px-4">
                <h3 className="text-[20px] font-medium leading-[30px] tracking-normal text-white">
                  {step.title}
                </h3>
                <p className="text-[14px] font-normal leading-5 tracking-[-0.3px] text-[#B7B5BA]">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustedSection() {
  return (
    <section className="relative -mt-px overflow-hidden bg-[#141415] pb-20 pt-24 md:min-h-[891px] md:pb-0 md:pt-[184px]">
      <TrustedCarousel />
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <section className="relative -mt-14 overflow-hidden bg-[#101010]">
        <img
          src="/hero-bg.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[903px] w-[1440px] max-w-none -translate-x-1/2"
        />

        <div className="relative mx-auto flex min-h-[720px] max-w-[1440px] flex-col items-center px-5 pt-[132px] text-center md:min-h-[903px] md:px-6 md:pt-[212px]">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-3 md:gap-5">
            {HERO_LOGOS.map((logo) => (
              <DummyLogo key={logo.label} label={logo.label} className={logo.className} />
            ))}
          </div>

          <div className="mt-14 flex w-full max-w-[1100px] flex-col items-center gap-10 md:mt-16 md:gap-14">
            <div className="flex w-full flex-col items-center gap-7 md:gap-9">
              <h1 className="max-w-[1100px] text-[42px] font-medium leading-[46px] tracking-normal text-white sm:text-[56px] sm:leading-[1.08] lg:whitespace-nowrap lg:text-[64px]">
                Stellar ecosystem for AI Agents
              </h1>
              <p className="max-w-[760px] text-[16px] font-medium leading-7 tracking-normal text-[#B7B5BA] sm:text-[20px] sm:leading-8">
                The on-chain action layer for AI agents on Stellar. Say what you want, your agent
                does it, non-custodial and Soroban secured.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <OpenAgentButton className="marketing-pressable marketing-muted-button flex h-12 w-[157px] items-center justify-center rounded-[28px] border border-[#565458] bg-[#3C3A3F] px-5 py-[13px] text-[15px] font-medium leading-5 tracking-normal whitespace-nowrap text-white">
                Talk to an agent
              </OpenAgentButton>
              <a
                href={DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="marketing-pressable marketing-primary-button flex h-12 w-[148px] items-center justify-center rounded-[28px] bg-white px-5 text-[15px] font-medium leading-5 tracking-normal whitespace-nowrap text-black"
              >
                Connect Wallet
              </a>
            </div>
          </div>
        </div>
      </section>

      <FeaturesSection />
      <KycSection />
      <TrustedSection />
      <MarketingFooter />
    </>
  );
}
