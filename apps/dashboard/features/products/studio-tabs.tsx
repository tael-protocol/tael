"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@tael/ui";
import type { Product, ProductAction, ProductContent } from "@tael/database";
import { ProductSettingsForm } from "./product-settings-form";
import { TrainContentPanel } from "./train-content-panel";
import { TrainActionsPanel } from "./train-actions-panel";
import { DeployPanel } from "./deploy-panel";

const TABS = [
  { id: "train", label: "Train" },
  { id: "test", label: "Test" },
  { id: "deploy", label: "Deploy" },
  { id: "analyze", label: "Analyze" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-14 text-center">
      <h3 className="font-medium">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Tab shells for Train / Test / Deploy / Analyze. */
export function StudioTabs({
  product,
  content,
  actions,
}: {
  product: Product;
  content: ProductContent[];
  actions: ProductAction[];
}) {
  const [tab, setTab] = useState<TabId>("train");

  let body: ReactNode;
  switch (tab) {
    case "train":
      body = (
        <div className="space-y-6">
          <TrainContentPanel productId={product.id} items={content} />
          <TrainActionsPanel productId={product.id} items={actions} />
          <ProductSettingsForm product={product} />
        </div>
      );
      break;
    case "test":
      body = (
        <ComingSoon
          title="Test preview"
          description="Chat with your agent here before it goes live. Coming soon."
        />
      );
      break;
    case "deploy":
      body = <DeployPanel product={product} />;
      break;
    case "analyze":
      body = (
        <ComingSoon
          title="Conversations"
          description="Inbox for chats, actions taken, and live handoff. Coming soon."
        />
      );
      break;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b" role="tablist" aria-label="Agent sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground" />
            ) : null}
          </button>
        ))}
      </div>
      <div role="tabpanel">{body}</div>
    </div>
  );
}
