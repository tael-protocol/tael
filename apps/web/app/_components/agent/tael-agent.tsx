"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AGENT_NAME,
  AGENT_TAGLINE,
  DEMO_PROMPT_MESSAGE,
  GREETING,
  INTRO_BODY,
  INTRO_MESSAGE,
  SUGGESTED_QUESTIONS,
} from "./knowledge";
import { useAgentChat } from "./use-agent-chat";
import { MessageBubble } from "./message-bubble";
import { ChatSmileIcon, ChevronDownIcon, CloseIcon, SendIcon, TaelLogoMark } from "./icons";
import { ensureNotifyPermission, playChime, sendBrowserNotification } from "./notify";
import type { TaelAgentProps } from "./types";

/** One-tap suggestion chip; turns solid white on hover (per the design). */
const CHIP_CLASS =
  "rounded-full border border-white/10 bg-[#2c2d31] px-3 py-1.5 text-xs text-white/90 shadow-sm transition-colors duration-150 ease-out hover:border-white hover:bg-white hover:text-[#14161a] active:scale-[0.97]";

/**
 * The Tael Agent: a floating, self-contained support widget. Drop `<TaelAgent />`
 * anywhere (it renders its own fixed launcher, proactive teaser, and panel) and
 * it answers questions about Tael, streamed from /api/agent. No app-specific UI
 * deps, so it's reusable across surfaces — pass props to retheme or repoint it.
 */
export function TaelAgent({
  endpoint = "/api/agent",
  name = AGENT_NAME,
  tagline = AGENT_TAGLINE,
  intro = INTRO_MESSAGE,
  suggestions = SUGGESTED_QUESTIONS,
}: TaelAgentProps) {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [introStep, setIntroStep] = useState(0);
  const { messages, streaming, send } = useAgentChat(endpoint);
  const isFreshChat = messages.length === 0;
  const showStoredIntro = !isFreshChat;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasStreaming = useRef(false);
  const askedPermission = useRef(false);
  // Once the teaser has been shown or dismissed, never auto-pop it again.
  const teaserDone = useRef(false);
  // The teaser's tick can be autoplay-blocked on a fresh load; flush it on the
  // visitor's first gesture instead.
  const teaserSoundPending = useRef(false);
  const openedFromKyc = useRef(false);
  const lastScrollY = useRef(0);
  const introTimers = useRef<number[]>([]);

  const clearIntroTimers = useCallback(() => {
    introTimers.current.forEach((timer) => window.clearTimeout(timer));
    introTimers.current = [];
  }, []);

  const runIntroSequence = useCallback(() => {
    clearIntroTimers();
    setIntroStep(0);
    introTimers.current = [
      window.setTimeout(() => setIntroStep(1), 650),
      window.setTimeout(() => setIntroStep(2), 1150),
      window.setTimeout(() => setIntroStep(3), 1900),
    ];
  }, [clearIntroTimers]);

  const openAgent = useCallback(() => {
    teaserDone.current = true;
    setTeaser(false);
    setUnread(0);
    setOpen(true);
    if (messages.length === 0) {
      runIntroSequence();
    } else {
      clearIntroTimers();
      setIntroStep(0);
    }
  }, [clearIntroTimers, messages.length, runIntroSequence]);

  const showTeaser = useCallback(() => {
    if (open || messages.length > 0) return;
    teaserDone.current = true;
    setTeaser(true);
    setUnread(1);
    void playChime().then((ok) => {
      if (!ok) teaserSoundPending.current = true;
    });
  }, [messages.length, open]);

  useEffect(() => {
    return clearIntroTimers;
  }, [clearIntroTimers]);

  // Site CTAs can open the floating panel without coupling the marketing page
  // to this component's internal state.
  useEffect(() => {
    window.addEventListener("tael-agent:open", openAgent);
    return () => window.removeEventListener("tael-agent:open", openAgent);
  }, [openAgent]);

  // When the visitor scrolls down into the KYC section, open the side chat once.
  useEffect(() => {
    const kycSection = document.getElementById("kyc");
    if (!kycSection) return;
    lastScrollY.current = window.scrollY;

    let frame = 0;
    const checkKycPosition = () => {
      frame = 0;
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;
      lastScrollY.current = currentScrollY;

      if (!scrollingDown || openedFromKyc.current) return;

      const rect = kycSection.getBoundingClientRect();
      const triggerLine = window.innerHeight * 0.65;
      if (rect.top <= triggerLine && rect.bottom > triggerLine) {
        openedFromKyc.current = true;
        showTeaser();
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(checkKycPosition);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [showTeaser]);

  // Browsers block audio before the first interaction, so the teaser tick above
  // may be silenced on a fresh load. Play it on the visitor's first gesture.
  useEffect(() => {
    const flush = () => {
      if (teaserSoundPending.current) {
        teaserSoundPending.current = false;
        void playChime();
      }
      window.removeEventListener("pointerdown", flush);
      window.removeEventListener("keydown", flush);
      window.removeEventListener("scroll", flush);
    };
    window.addEventListener("pointerdown", flush);
    window.addEventListener("keydown", flush);
    window.addEventListener("scroll", flush, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", flush);
      window.removeEventListener("keydown", flush);
      window.removeEventListener("scroll", flush);
    };
  }, []);

  // Keep the transcript pinned to the latest message as it streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, introStep]);

  // Let the static greeting feel like a real conversation:
  // typing, first line, typing, then the follow-up prompt.
  useEffect(() => {
    if (!open) {
      setIntroStep(0);
      clearIntroTimers();
      return;
    }

    if (messages.length > 0) {
      clearIntroTimers();
      setIntroStep(0);
      return;
    }

    runIntroSequence();
    return clearIntroTimers;
  }, [clearIntroTimers, messages.length, open, runIntroSequence]);

  // On open: focus the input, clear the teaser + unread dot, and ask once for
  // permission to send browser notifications (to nudge when the panel is closed).
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    setUnread(0);
    setTeaser(false);
    teaserDone.current = true;
    if (!askedPermission.current) {
      askedPermission.current = true;
      void ensureNotifyPermission();
    }
  }, [open]);

  // When a reply finishes streaming, chime. If the panel is closed or the tab is
  // in the background, also raise the unread count and a browser notification.
  useEffect(() => {
    const finished = wasStreaming.current && !streaming;
    wasStreaming.current = streaming;
    if (!finished) return;
    void playChime();
    const away = !open || (typeof document !== "undefined" && document.hidden);
    if (away) {
      setUnread((n) => n + 1);
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.content) {
        sendBrowserNotification("Tael assistant", last.content);
      }
    }
  }, [streaming, open, messages]);

  function submit(text: string) {
    if (streaming || !text.trim()) return;
    void playChime();
    void send(text);
    setDraft("");
  }

  /** From the teaser: open the panel and send the tapped suggestion. */
  function ask(question: string) {
    setTeaser(false);
    setOpen(true);
    submit(question);
  }

  return (
    <>
      {/* Proactive teaser: greeting card + suggestions, above the launcher. */}
      <AnimatePresence>
        {teaser && !open && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-24 right-5 z-[60] flex w-[calc(100vw-2.5rem)] flex-col items-end gap-2 sm:w-[404px]"
          >
            <div className="group relative w-full rounded-[20px] border border-white/10 bg-[#14161a] p-4 text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)]">
              <button
                type="button"
                onClick={() => {
                  setTeaser(false);
                  setUnread(0);
                }}
                aria-label="Dismiss"
                className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#1c1c1f] text-white/70 opacity-0 shadow transition-opacity duration-150 hover:text-white group-hover:opacity-100"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                  <TaelLogoMark className="text-[20px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{GREETING}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-white/90">
                    {INTRO_BODY}
                  </span>
                  <span className="mt-1.5 block text-xs text-white/40">{name} • Just now</span>
                </span>
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {suggestions.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)} className={CHIP_CLASS}>
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the Tael assistant" : "Open the Tael assistant"}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#14161a] shadow-lg shadow-black/25 transition-transform duration-150 ease-out active:scale-95"
        whileHover={{ scale: 1.04 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "down" : "chat"}
            initial={{ opacity: 0, rotate: -20, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 20, scale: 0.7 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            {open ? <ChevronDownIcon className="h-6 w-6" /> : <ChatSmileIcon className="h-7 w-7" />}
          </motion.span>
        </AnimatePresence>
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-[#F98D8D] px-1 text-[11px] font-semibold text-white">
            {unread}
          </span>
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-24 right-5 z-[60] flex h-[80vh] max-h-[720px] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[20px] bg-[#14161a] text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] sm:w-[404px]"
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                <TaelLogoMark className="text-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{name}</p>
                <p className="truncate text-xs text-white/50">{tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </header>

            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {isFreshChat && introStep === 0 && (
                <MessageBubble message={{ id: "intro-typing", role: "assistant", content: "" }} />
              )}
              {isFreshChat && introStep >= 1 && (
                <MessageBubble message={{ id: "intro", role: "assistant", content: intro }} />
              )}
              {isFreshChat && introStep === 2 && (
                <MessageBubble message={{ id: "demo-typing", role: "assistant", content: "" }} />
              )}
              {isFreshChat && introStep >= 3 && (
                <MessageBubble
                  message={{
                    id: "demo-prompt",
                    role: "assistant",
                    content: DEMO_PROMPT_MESSAGE,
                  }}
                />
              )}
              {showStoredIntro && (
                <>
                  <MessageBubble
                    message={{ id: "stored-intro", role: "assistant", content: intro }}
                  />
                  <MessageBubble
                    message={{
                      id: "stored-demo-prompt",
                      role: "assistant",
                      content: DEMO_PROMPT_MESSAGE,
                    }}
                  />
                </>
              )}

              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  showMeta={
                    i === messages.length - 1 && m.role === "assistant" && m.content.length > 0
                  }
                />
              ))}
            </div>

            {isFreshChat && introStep >= 3 && (
              <div className="px-3 pt-2">
                <div className="-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max gap-2">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => submit(q)}
                        className={`${CHIP_CLASS} whitespace-nowrap`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
              className="p-3"
            >
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-white/25">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(draft);
                    }
                  }}
                  rows={1}
                  placeholder="Ask about Tael…"
                  className="max-h-28 flex-1 resize-none bg-transparent text-[13.5px] text-white placeholder:text-white/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || streaming}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#14161a] transition-all duration-150 ease-out hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10.5px] text-white/30">
                Tael assistant can make mistakes. Verify important details.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
