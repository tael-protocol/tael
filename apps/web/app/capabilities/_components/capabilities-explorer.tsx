"use client";

import { useMemo, useState, type RefObject } from "react";
import {
  Chip,
  HeroUIProvider,
  Spinner,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
} from "@heroui/react";
import { useInfiniteScroll } from "@heroui/use-infinite-scroll";

export interface Capability {
  slug: string;
  name: string;
  description: string;
  kind: string;
  price: string;
  verified: boolean;
}
export interface CapabilityRequest {
  name: string;
  route: string | null;
  url: string;
}

const PAGE = 8;

/** Reveal a client-side list in pages, loading more as the sentinel scrolls in. */
function usePaged<T>(all: T[]) {
  const [count, setCount] = useState(() => Math.min(PAGE, all.length));
  const hasMore = count < all.length;
  const [loaderRef, scrollerRef] = useInfiniteScroll({
    hasMore,
    onLoadMore: () => setCount((c) => Math.min(c + PAGE, all.length)),
  });
  return {
    items: all.slice(0, count),
    hasMore,
    loaderRef: loaderRef as RefObject<HTMLDivElement>,
    scrollerRef: scrollerRef as RefObject<HTMLDivElement>,
  };
}

const tableClassNames = {
  base: "max-h-[560px] overflow-auto",
  table: "min-w-full",
  th: "bg-transparent text-[11px] uppercase tracking-[0.1em] text-white/35 font-medium border-b border-white/10 first:rounded-none last:rounded-none",
  td: "text-[14px] text-white/80 py-4 border-b border-white/[0.06] group-data-[last=true]:border-0",
  tr: "transition-colors data-[hover=true]:bg-white/[0.03]",
} as const;

function VerifiedTick() {
  return (
    <span
      title="Verified by Tael"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function AvailableTable({ capabilities }: { capabilities: Capability[] }) {
  const { items, hasMore, loaderRef, scrollerRef } = usePaged(capabilities);
  return (
    <Table
      aria-label="Available capabilities"
      isHeaderSticky
      removeWrapper
      baseRef={scrollerRef}
      classNames={tableClassNames}
      bottomContent={
        hasMore ? (
          <div ref={loaderRef} className="flex justify-center py-4">
            <Spinner size="sm" color="white" />
          </div>
        ) : null
      }
    >
      <TableHeader>
        <TableColumn>Capability</TableColumn>
        <TableColumn className="hidden md:table-cell">Description</TableColumn>
        <TableColumn>Type</TableColumn>
        <TableColumn align="end">Price</TableColumn>
      </TableHeader>
      <TableBody
        items={items}
        emptyContent={<span className="text-white/40">The catalog is warming up.</span>}
      >
        {(c) => (
          <TableRow key={c.slug}>
            <TableCell>
              <a
                href={`https://mainnet.taelprotocol.xyz/marketplace/${c.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 font-medium text-white"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[11px] text-accent">
                  {"{}"}
                </span>
                <span className="whitespace-nowrap group-hover:text-white/80">{c.name}</span>
                {c.verified ? <VerifiedTick /> : null}
              </a>
            </TableCell>
            <TableCell className="hidden max-w-[48ch] align-top md:table-cell">
              <span className="line-clamp-2 leading-[1.5] text-white/45">{c.description}</span>
            </TableCell>
            <TableCell>
              <Chip
                variant="bordered"
                size="sm"
                classNames={{
                  base: "border-white/15",
                  content: "text-[11px] uppercase tracking-wide text-white/55",
                }}
              >
                {c.kind}
              </Chip>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {Number(c.price) > 0 ? (
                <span className="font-medium text-white">from ${Number(c.price)}</span>
              ) : (
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[12px] font-medium text-emerald-400">
                  Free
                </span>
              )}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function RequestsTable({ requests }: { requests: CapabilityRequest[] }) {
  const { items, hasMore, loaderRef, scrollerRef } = usePaged(requests);
  return (
    <Table
      aria-label="Requested capabilities"
      isHeaderSticky
      removeWrapper
      baseRef={scrollerRef}
      classNames={tableClassNames}
      bottomContent={
        hasMore ? (
          <div ref={loaderRef} className="flex justify-center py-4">
            <Spinner size="sm" color="white" />
          </div>
        ) : null
      }
    >
      <TableHeader>
        <TableColumn>Capability</TableColumn>
        <TableColumn className="hidden sm:table-cell">Endpoint</TableColumn>
        <TableColumn align="end">Build</TableColumn>
      </TableHeader>
      <TableBody
        items={items}
        emptyContent={<span className="text-white/40">No open requests right now.</span>}
      >
        {(r) => (
          <TableRow key={r.url}>
            <TableCell className="font-medium text-white/90">{r.name}</TableCell>
            <TableCell className="hidden sm:table-cell">
              {r.route ? (
                <code className="font-mono text-[13px] text-white/45">{r.route}</code>
              ) : (
                <span className="text-white/30">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent transition-transform hover:translate-x-0.5"
              >
                Build
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** A tab label with a count badge that flips readable in both states:
 *  white-on-dark when idle, dark-on-white when the tab is selected. */
function TabTitle({ label, count }: { label: string; count: number }) {
  return (
    <span className="flex items-center gap-2">
      {label}
      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] font-semibold tabular-nums text-white/50 group-data-[selected=true]:bg-black/[0.08] group-data-[selected=true]:text-black/70">
        {count}
      </span>
    </span>
  );
}

/** The toggle (Available / Requests) + a HeroUI table for the active tab. */
export function CapabilitiesExplorer({
  capabilities,
  requests,
}: {
  capabilities: Capability[];
  requests: CapabilityRequest[];
}) {
  const counts = useMemo(
    () => ({ available: capabilities.length, requests: requests.length }),
    [capabilities.length, requests.length],
  );

  return (
    <HeroUIProvider>
      <div className="dark mt-10">
        <Tabs
          aria-label="Capabilities"
          variant="solid"
          radius="full"
          classNames={{
            tabList: "bg-white/[0.06] p-1",
            cursor: "!bg-white shadow-sm",
            tabContent: "text-white/55 group-data-[selected=true]:text-black font-medium",
            tab: "px-4 h-9",
          }}
        >
          <Tab key="available" title={<TabTitle label="Available" count={counts.available} />}>
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              <AvailableTable capabilities={capabilities} />
            </div>
          </Tab>
          <Tab key="requests" title={<TabTitle label="Requests" count={counts.requests} />}>
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              <RequestsTable requests={requests} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/tael-protocol/tael/issues/new?labels=good-first-capability&title=good-first-capability%3A%20"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.97]"
              >
                Request a capability
              </a>
              <a
                href="/docs/become-a-capability"
                className="rounded-full border border-white/15 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Publish your own
              </a>
            </div>
          </Tab>
        </Tabs>
      </div>
    </HeroUIProvider>
  );
}
