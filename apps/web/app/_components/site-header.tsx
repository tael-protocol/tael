const NAV_LINKS = ["Products", "Docs", "Community"];

// Real destinations for nav links that have one; others fall back to "#".
const NAV_HREFS: Record<string, string> = {
  Products: "/capabilities",
  Docs: "/docs",
  Community: "https://discord.gg/tcb6b7ZYha",
};

const DASHBOARD_URL = "https://mainnet.taelprotocol.xyz";

const linkBase =
  "marketing-pressable marketing-nav-link flex h-9 items-center justify-center rounded-[100px] px-4 text-[14px] font-medium leading-5 tracking-normal whitespace-nowrap";

export function SiteHeader() {
  const idleLink = "text-white";

  return (
    <header className="sticky top-0 z-50 bg-[#101010]">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 md:px-[120px]">
        <a href="/" className="flex items-center gap-1">
          <span className="font-display text-[20px] leading-none text-accent">t</span>
          <span className="text-[20px] font-medium tracking-normal text-white">tael</span>
        </a>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((label, i) => {
            const href = NAV_HREFS[label] ?? "#";
            const external = href.startsWith("http");
            return (
              <a
                key={i}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={`${linkBase} ${idleLink}`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="marketing-pressable marketing-primary-button flex h-[38px] items-center justify-center rounded-[28px] bg-white px-5 text-[14px] font-medium leading-5 tracking-normal whitespace-nowrap text-black"
        >
          Connect Wallet
        </a>
      </div>
    </header>
  );
}
