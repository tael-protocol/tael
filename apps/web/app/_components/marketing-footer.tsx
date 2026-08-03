"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Guide", href: "/docs" },
      { label: "Try Now", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Faqs", href: "/coming-soon" },
      { label: "White Paper", href: "#" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X", href: "https://x.com/taelprotocol?s=21" },
      { label: "Discord", href: "https://discord.gg/tcb6b7ZYha" },
      { label: "Youtube", href: "#" },
      { label: "Github", href: "https://github.com/tael-protocol/tael" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/taelprotocol?s=21", icon: XIcon },
  { label: "npm", href: "#", icon: NpmIcon },
  { label: "Discord", href: "https://discord.gg/tcb6b7ZYha", icon: DiscordIcon },
  { label: "GitHub", href: "https://github.com/tael-protocol/tael", icon: GitHubIcon },
  { label: "YouTube", href: "#", icon: YouTubeIcon },
];

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M15.2706 1.58594H18.0818L11.9401 8.60551L19.1654 18.1576H13.5081L9.07706 12.3643L4.00699 18.1576H1.19406L7.76323 10.6494L0.832031 1.58594H6.63296L10.6382 6.88121L15.2706 1.58594ZM14.284 16.4749H15.8417L5.78653 3.18021H4.11492L14.284 16.4749Z"
        fill="currentColor"
      />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M26.6667 4C27.4027 4 28 4.59733 28 5.33333V26.6667C28 27.4027 27.4027 28 26.6667 28H5.33333C4.59733 28 4 27.4027 4 26.6667V5.33333C4 4.59733 4.59733 4 5.33333 4H26.6667ZM22.6667 9.33333H9.33333V22.6667H16V12.6667H19.3333V22.6667H22.6667V9.33333Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M25.2424 7.51108C23.5428 6.73122 21.7202 6.15664 19.8145 5.82755C19.7798 5.8212 19.7451 5.83707 19.7273 5.86882C19.4929 6.28573 19.2332 6.82962 19.0514 7.25712C17.0017 6.95025 14.9626 6.95025 12.955 7.25712C12.7731 6.8201 12.5041 6.28573 12.2686 5.86882C12.2507 5.83813 12.2161 5.82226 12.1814 5.82755C10.2768 6.15558 8.45415 6.73016 6.75345 7.51108C6.73874 7.51742 6.72613 7.52801 6.71772 7.54176C3.26063 12.7066 2.31358 17.7445 2.77817 22.7199C2.78027 22.7443 2.79394 22.7675 2.81286 22.7824C5.09376 24.4574 7.30318 25.4743 9.47162 26.1483C9.5063 26.1589 9.54309 26.1462 9.56517 26.1177C10.0781 25.4172 10.5353 24.6786 10.9274 23.9019C10.9505 23.8564 10.9285 23.8024 10.8812 23.7844C10.1559 23.5093 9.46531 23.1739 8.80101 22.7929C8.74846 22.7623 8.74425 22.6871 8.7926 22.6511C8.9324 22.5464 9.0722 22.4374 9.20569 22.3274C9.22986 22.3072 9.2635 22.303 9.29188 22.3157C13.6561 24.3082 18.3808 24.3082 22.6935 22.3157C22.7219 22.302 22.7555 22.3062 22.7807 22.3263C22.9142 22.4363 23.054 22.5464 23.1949 22.6511C23.2432 22.6871 23.2401 22.7623 23.1875 22.7929C22.5232 23.1813 21.8326 23.5093 21.1063 23.7834C21.059 23.8014 21.038 23.8564 21.0611 23.9019C21.4616 24.6775 21.9188 25.4161 22.4223 26.1166C22.4433 26.1462 22.4812 26.1589 22.5159 26.1483C24.6948 25.4743 26.9042 24.4574 29.1851 22.7824C29.2051 22.7675 29.2177 22.7453 29.2198 22.721C29.7758 16.9689 28.2885 11.9723 25.2771 7.54282C25.2698 7.52801 25.2571 7.51742 25.2424 7.51108ZM11.5791 19.6904C10.2652 19.6904 9.18256 18.4841 9.18256 17.0027C9.18256 15.5213 10.2442 14.315 11.5791 14.315C12.9245 14.315 13.9966 15.5319 13.9756 17.0027C13.9756 18.4841 12.914 19.6904 11.5791 19.6904ZM20.4399 19.6904C19.126 19.6904 18.0434 18.4841 18.0434 17.0027C18.0434 15.5213 19.105 14.315 20.4399 14.315C21.7853 14.315 22.8575 15.5319 22.8364 17.0027C22.8364 18.4841 21.7853 19.6904 20.4399 19.6904Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.9989 4C9.37254 4 4 9.37254 4 16.0004C4 21.3022 7.43804 25.7996 12.2065 27.3871C12.8069 27.4969 13.0257 27.1263 13.0257 26.8081C13.0257 26.5237 13.0154 25.7686 13.0095 24.7675C9.67163 25.4924 8.96737 23.1586 8.96737 23.1586C8.4215 21.7729 7.63473 21.4038 7.63473 21.4038C6.5452 20.6591 7.71724 20.6738 7.71724 20.6738C8.9217 20.7593 9.55523 21.9107 9.55523 21.9107C10.6256 23.7443 12.3642 23.2146 13.0478 22.9081C13.1568 22.1324 13.4662 21.6035 13.8095 21.3037C11.145 21.0009 8.34341 19.971 8.34341 15.3727C8.34341 14.0629 8.8112 12.9918 9.57881 12.1527C9.45505 11.8492 9.04325 10.6293 9.69594 8.97695C9.69594 8.97695 10.7037 8.65428 12.9962 10.2072C13.9532 9.94125 14.9801 9.80791 16.0004 9.80349C17.0192 9.80791 18.0461 9.94125 19.0045 10.2072C21.2956 8.65428 22.3011 8.97695 22.3011 8.97695C22.956 10.6293 22.5442 11.8492 22.4205 12.1527C23.1895 12.9918 23.6544 14.0629 23.6544 15.3727C23.6544 19.9828 20.8484 20.9972 18.175 21.2941C18.606 21.6646 18.9898 22.3969 18.9898 23.5166C18.9898 25.1204 18.975 26.4147 18.975 26.8081C18.975 27.1293 19.1909 27.5027 19.8001 27.3856C24.5649 25.7951 28 21.3007 28 16.0004C28 9.37254 22.6267 4 15.9989 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M28.9439 9.20798C28.6325 8.05148 27.7206 7.13962 26.5641 6.82825C24.4513 6.25 15.9999 6.25 15.9999 6.25C15.9999 6.25 7.54858 6.25 5.43574 6.80601C4.30148 7.11738 3.36738 8.05148 3.05601 9.20798C2.5 11.3208 2.5 15.7022 2.5 15.7022C2.5 15.7022 2.5 20.1058 3.05601 22.1964C3.36738 23.3529 4.27923 24.2647 5.43574 24.5761C7.57082 25.1544 15.9999 25.1544 15.9999 25.1544C15.9999 25.1544 24.4513 25.1544 26.5641 24.5984C27.7206 24.287 28.6325 23.3751 28.9439 22.2186C29.4999 20.1058 29.4999 15.7244 29.4999 15.7244C29.4999 15.7244 29.5221 11.3208 28.9439 9.20798Z"
        fill="currentColor"
      />
      <path d="M13.3086 19.5955L20.3366 15.5478L13.3086 11.5V19.5955Z" fill="#141415" />
    </svg>
  );
}

function FooterLink({ label, href }: { label: string; href: string }) {
  const external = href.startsWith("http");

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="marketing-pressable marketing-footer-link rounded-[6px] px-2 py-1 text-[14px] font-medium leading-5 text-white"
    >
      {label}
    </a>
  );
}

function SocialLink({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: ReactNode;
}) {
  const external = href.startsWith("http");

  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="marketing-pressable marketing-social-button flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#29292B] text-[#B7B5BA]"
    >
      {children}
    </a>
  );
}

export function MarketingFooter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [isShattering, setIsShattering] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const showSubscribe = (email.length > 0 || isShattering) && !subscribed;

  useEffect(() => {
    if (!isShattering) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSubscribed(true);
      setIsShattering(false);
    }, 620);

    return () => window.clearTimeout(timeout);
  }, [isShattering]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (cleanEmail.length === 0 || subscribed || isShattering) {
      return;
    }

    setEmail(cleanEmail);
    setSubmittedEmail(cleanEmail);
    setIsShattering(true);
  }

  return (
    <footer className="relative overflow-hidden bg-[#141415] px-4 py-4 xl:min-h-[891px] xl:px-0 xl:pb-0 xl:pt-[168px]">
      <div className="mx-auto flex max-w-[640px] flex-col gap-10 overflow-hidden rounded-[24px] bg-[#1F1F20] p-6 xl:relative xl:h-[658px] xl:max-w-[1344px] xl:p-0">
        <p className="pl-7 font-display text-[96px] font-normal leading-none tracking-[0.2px] text-[#156DFC] xl:absolute xl:left-[72px] xl:top-[84px] xl:pl-0 xl:text-[164px] xl:leading-[164px]">
          t
        </p>

        <div className="flex min-h-[210px] w-full flex-col items-start justify-between overflow-hidden rounded-[20px] bg-[#141415] p-6 sm:p-8 xl:absolute xl:left-[572px] xl:top-12 xl:h-[210px] xl:w-[676px]">
          <form className="flex w-full items-center gap-4 overflow-hidden" onSubmit={handleSubmit}>
            {subscribed ? (
              <p className="thank-you-reveal min-w-0 flex-1 truncate text-[32px] font-medium leading-10 tracking-normal text-white sm:text-[40px] sm:leading-[48px]">
                Thank you...
              </p>
            ) : (
              <div className="relative min-w-0 flex-1 overflow-hidden">
                <input
                  aria-label="Email address"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isShattering}
                  maxLength={72}
                  placeholder="enter your email"
                  className={`w-full truncate border-0 bg-transparent p-0 text-[32px] font-medium leading-10 tracking-normal text-white outline-none placeholder:text-[#848089] sm:text-[40px] sm:leading-[48px] ${
                    isShattering ? "opacity-0" : ""
                  }`}
                />
                {isShattering ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 block whitespace-nowrap text-[32px] font-medium leading-10 tracking-normal text-white sm:text-[40px] sm:leading-[48px]"
                  >
                    <span className="email-shard email-shard-one block w-full truncate">
                      {submittedEmail}
                    </span>
                    <span className="email-shard email-shard-two absolute inset-0 block w-full truncate">
                      {submittedEmail}
                    </span>
                    <span className="email-shard email-shard-three absolute inset-0 block w-full truncate">
                      {submittedEmail}
                    </span>
                    <span className="email-shard email-shard-four absolute inset-0 block w-full truncate">
                      {submittedEmail}
                    </span>
                  </span>
                ) : null}
              </div>
            )}
            {showSubscribe ? (
              <button
                type="submit"
                disabled={isShattering}
                className="marketing-pressable marketing-primary-button h-10 shrink-0 rounded-full bg-white px-[18px] text-[16px] font-medium leading-6 text-[#141415] sm:h-[56px] sm:px-8 sm:text-[18px]"
              >
                Subscribe
              </button>
            ) : null}
          </form>
          <p className="max-w-full text-left text-[16px] font-medium leading-6 text-[#CACACA] sm:whitespace-nowrap sm:text-center sm:text-[18px]">
            Sign up for our newsletter and join the growing Tael community.
          </p>
        </div>

        <div className="order-last flex gap-4 xl:absolute xl:left-[72px] xl:top-[498px] xl:order-none">
          {SOCIAL_LINKS.map((social) => (
            <SocialLink key={social.label} label={social.label} href={social.href}>
              <social.icon />
            </SocialLink>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 xl:absolute xl:left-[604px] xl:top-[342px] xl:flex xl:items-start xl:gap-[72px]">
          {FOOTER_LINKS.map((column) => (
            <div key={column.title} className="flex flex-col items-start gap-4 xl:w-[103px]">
              <p className="rounded-[6px] px-2 py-1 text-[14px] font-medium leading-5 text-[#848089]">
                {column.title}
              </p>
              {column.links.map((link) => (
                <FooterLink key={link.label} label={link.label} href={link.href} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
