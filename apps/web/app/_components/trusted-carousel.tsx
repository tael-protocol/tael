"use client";

import { useEffect, useRef, useState } from "react";

const TESTIMONIALS = [
  {
    id: "coverfi",
    name: "CoverFI",
    type: "@coverfidotspace",
    avatar: "https://pbs.twimg.com/profile_images/2078152453476986880/pKcn_PEz_normal.jpg",
    href: "https://x.com/coverfidotspace/status/2080962381090336897",
    text: "We're excited to announce our collaboration with @Taelprotocol!\n\nAt Coverfi, we're building decentralized protection on Stellar. Tael is building the payment layer for autonomous agents.\n\nTogether, we're exploring how AI agents can interact with decentralized financial systems.",
  },
  {
    id: "fianza",
    name: "Fianza",
    type: "@0xTrustLine",
    avatar: "https://pbs.twimg.com/profile_images/2081029410392825856/B5W5U7Cc_normal.jpg",
    href: "https://x.com/0xTrustLine/status/2079814569334288595",
    text: "@0xTrustLine x @Taelprotocol\n\nThe Agentic Economy era begins on @StellarOrg",
  },
  {
    id: "nebula",
    name: "Nebula Onchain",
    type: "@nebulamcp",
    avatar: "https://pbs.twimg.com/profile_images/2078574100403171328/6LTCWjtI_normal.jpg",
    href: "https://x.com/nebulamcp/status/2079441848452735352",
    text: "Nebula is partnering with @Taelprotocol, now you can access the Nebula features from Tael Protocol.",
  },
  {
    id: "mayank",
    name: "Mayank",
    type: "@Mayanklll",
    avatar: "https://pbs.twimg.com/profile_images/1898412715510808576/EjzO1ptY_normal.jpg",
    href: "https://x.com/Mayanklll/status/2078404139697222031",
    text: "AI agents can do the work.\n\nNow they can pay for it too.\n\nIntroducing Tael, the payment layer for autonomous AI agents.",
  },
  {
    id: "qian",
    name: "Qian",
    type: "@MiArtyiee",
    avatar: "https://pbs.twimg.com/profile_images/2027399489846456320/Fga5CnIg_normal.jpg",
    href: "https://x.com/MiArtyiee/status/2078166745299480919",
    text: "We keep building smarter AI.\n\nBut most agents still can't spend $0.02 on an API without humans wiring together billing.\n\nAI needs native payments.\n\nThat's why we built @Taelprotocol.",
  },
  {
    id: "tael",
    name: "Tael",
    type: "@Taelprotocol",
    avatar: "https://pbs.twimg.com/profile_images/2080526346175049729/roMy-vDA_normal.jpg",
    href: "https://x.com/Taelprotocol/status/2080931881978413448",
    text: "Big things happening!\n\nAt Tael, we're building the payment layer for AI agents. Vayyl is building the privacy layer for @StellarOrg.\n\nTogether, we're exploring how privacy and intelligent execution can complement each other to unlock entirely new possibilities.\n\nVayyl x Tael",
  },
  {
    id: "vayyl",
    name: "Vayyl",
    type: "@Vayylstellar",
    avatar: "/testimonial-avatar.png",
    href: "https://x.com/Vayylstellar/status/2081009779431121340?s=20",
    text: "Vayyl x Tael\n\nVayyl is building the privacy layer for Stellar. Tael is building the payment layer for autonomous agents.\n\nTogether, we're exploring how privacy and intelligent execution can unlock new on-chain possibilities.",
  },
];

export function TrustedCarousel() {
  const rowRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const [fadeEdges, setFadeEdges] = useState({ left: false, right: false });
  const [activeSide, setActiveSide] = useState<"left" | "right" | null>("right");
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function updateFadeEdges() {
    const row = rowRef.current;
    if (!row) return;

    const maxScrollLeft = row.scrollWidth - row.clientWidth;
    const isAtStart = row.scrollLeft <= 1;
    const isAtEnd = row.scrollLeft >= maxScrollLeft - 1;
    setFadeEdges({
      left: !isAtStart,
      right: !isAtEnd,
    });

    if (isAtStart) {
      setActiveSide("right");
    } else if (isAtEnd) {
      setActiveSide("left");
    } else {
      setActiveSide(null);
    }
  }

  useEffect(() => {
    updateFadeEdges();
    window.addEventListener("resize", updateFadeEdges);

    return () => {
      window.removeEventListener("resize", updateFadeEdges);
    };
  }, []);

  function moveCards(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;

    const firstCard = row.querySelector<HTMLElement>("[data-testimonial-card]");
    const gap = Number.parseFloat(
      window.getComputedStyle(row.firstElementChild as Element).columnGap,
    );
    const cardStep = firstCard
      ? firstCard.getBoundingClientRect().width + (Number.isNaN(gap) ? 32 : gap)
      : 458;

    setActiveSide(null);
    row.scrollBy({ left: cardStep * direction, behavior: "smooth" });
  }

  function stopDragging(pointerId?: number) {
    const row = rowRef.current;
    if (row && pointerId != null && row.hasPointerCapture(pointerId)) {
      row.releasePointerCapture(pointerId);
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }

  const leftActive = activeSide === "left";
  const rightActive = activeSide === "right";
  const leftHighlighted = leftActive || (activeSide === null && hoverSide === "left");
  const rightHighlighted = rightActive || (activeSide === null && hoverSide === "right");

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-0 md:gap-[72px]">
      <div className="flex items-end justify-between gap-4 px-6 md:px-0 md:pl-9">
        <h2 className="text-center text-[36px] font-medium leading-[42px] tracking-[-0.035em] text-white md:text-[48px] md:leading-[60px] md:tracking-[-0.0508em]">
          Trusted by
        </h2>

        <div className="flex h-12 shrink-0 items-start gap-1.5 overflow-hidden rounded-[1000px] bg-[#1F1F20] p-1">
          <button
            type="button"
            aria-label="Previous testimonials"
            className={`flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
              leftHighlighted ? "bg-black" : ""
            }`}
            onMouseEnter={() => setHoverSide("left")}
            onMouseLeave={() => setHoverSide(null)}
            onClick={() => moveCards(-1)}
          >
            <img
              src={
                leftHighlighted
                  ? "/testimonial-arrow-active.svg"
                  : "/testimonial-arrow-inactive.svg"
              }
              alt=""
              aria-hidden="true"
              className="size-7"
            />
          </button>
          <button
            type="button"
            aria-label="Next testimonials"
            className={`flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
              rightHighlighted ? "bg-black" : ""
            }`}
            onMouseEnter={() => setHoverSide("right")}
            onMouseLeave={() => setHoverSide(null)}
            onClick={() => moveCards(1)}
          >
            <img
              src={
                rightHighlighted
                  ? "/testimonial-arrow-active.svg"
                  : "/testimonial-arrow-inactive.svg"
              }
              alt=""
              aria-hidden="true"
              className="size-7 rotate-180"
            />
          </button>
        </div>
      </div>

      <div className="relative w-full">
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-24 bg-gradient-to-r from-[#141415] to-transparent transition-opacity duration-200 md:block ${
            fadeEdges.left ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-24 bg-gradient-to-l from-[#141415] to-transparent transition-opacity duration-200 md:block ${
            fadeEdges.right ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          ref={rowRef}
          className={`marketing-card-scroll w-full overflow-hidden ${isDragging ? "is-dragging" : ""}`}
          onScroll={updateFadeEdges}
          onPointerDown={(event) => {
            if (event.button !== 0 || !rowRef.current) return;

            rowRef.current.setPointerCapture(event.pointerId);
            dragStart.current = {
              x: event.clientX,
              scrollLeft: rowRef.current.scrollLeft,
            };
            isDraggingRef.current = true;
            didDragRef.current = false;
            setIsDragging(true);
          }}
          onPointerMove={(event) => {
            if (!isDraggingRef.current || !rowRef.current) return;

            const deltaX = event.clientX - dragStart.current.x;
            if (Math.abs(deltaX) > 5) {
              didDragRef.current = true;
            }
            rowRef.current.scrollLeft = dragStart.current.scrollLeft - deltaX;
          }}
          onPointerUp={(event) => stopDragging(event.pointerId)}
          onPointerCancel={(event) => stopDragging(event.pointerId)}
          onLostPointerCapture={() => stopDragging()}
          onDragStart={(event) => event.preventDefault()}
          onWheel={(event) => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
              event.preventDefault();
            }
          }}
        >
          <div className="flex w-max gap-4 pl-4 pr-4 md:gap-8 md:pl-0 md:pr-0">
            {TESTIMONIALS.map((testimonial) => (
              <a
                key={testimonial.id}
                href={testimonial.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testimonial-card
                aria-label={`Open ${testimonial.name} post on X`}
                className="flex h-[520px] w-[calc(100vw-48px)] shrink-0 flex-col justify-between overflow-hidden rounded-[24px] bg-[#1F1F20] p-8 transition-colors duration-200 ease-out hover:bg-[#242425] md:h-[320px] md:w-[426px] md:p-9"
                onClick={(event) => {
                  if (didDragRef.current) {
                    event.preventDefault();
                  }
                }}
              >
                <div className="flex h-12 items-center gap-3">
                  <img
                    src={testimonial.avatar}
                    alt=""
                    aria-hidden="true"
                    className="size-12 rounded-full object-cover"
                  />
                  <div className="flex flex-col gap-1 text-[14px] leading-5">
                    <p className="whitespace-nowrap font-medium text-white">{testimonial.name}</p>
                    <p className="whitespace-nowrap font-normal text-[#C2C2C2]">
                      {testimonial.type}
                    </p>
                  </div>
                </div>

                <p className="testimonial-post-text w-full text-[14px] font-normal leading-6 text-white md:max-w-[292px]">
                  {testimonial.text}
                </p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
