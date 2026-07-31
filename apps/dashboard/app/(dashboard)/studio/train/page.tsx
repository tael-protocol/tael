import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "../../../../components/page-header";
import { AddContentForms } from "../../../../features/products/add-content-forms";
import { ContentList } from "../../../../features/products/content-list";
import { TrainActionsPanel } from "../../../../features/products/train-actions-panel";
import { TestPreviewPanel } from "../../../../features/products/test-preview-panel";
import {
  getOrCreateProduct,
  listActions,
  listContent,
} from "../../../../features/products/queries";

export const dynamic = "force-dynamic";

/** Placeholder rows shown while a list streams in. */
function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

/** The "Your content" list, fetched on its own so it streams in after the shell. */
async function ContentListSection({ productId }: { productId: string }) {
  const items = await listContent(productId);
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Your content</h2>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "source" : "sources"}
        </span>
      </div>
      <ContentList items={items} />
    </div>
  );
}

/** The actions panel, fetched on its own so it streams in after the shell. */
async function ActionsSection({ productId }: { productId: string }) {
  const items = await listActions(productId);
  return <TrainActionsPanel productId={productId} items={items} />;
}

export default async function StudioTrainPage() {
  // Resolve the product once (needed for the preview + status). The content and
  // actions lists stream in via Suspense, so the shell + preview paint right
  // away instead of blocking on every DB round-trip up front.
  const product = await getOrCreateProduct();
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Train"
        description="Add content and actions on the left. Preview the live agent on the right."
        action={
          product.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Draft
            </span>
          )
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <section className="space-y-6">
            <div>
              <h2 className="text-base font-semibold">Add content</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sources your agent can learn from. Enabled items are used in chat.
              </p>
            </div>
            <AddContentForms productId={product.id} />
            <Suspense fallback={<ListSkeleton />}>
              <ContentListSection productId={product.id} />
            </Suspense>
          </section>

          <Suspense fallback={<ListSkeleton />}>
            <ActionsSection productId={product.id} />
          </Suspense>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6">
          <TestPreviewPanel product={product} className="w-full" />
        </aside>
      </div>
    </div>
  );
}
