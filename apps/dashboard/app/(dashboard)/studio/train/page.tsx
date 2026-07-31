import { notFound } from "next/navigation";
import { PageHeader } from "../../../../components/page-header";
import { TrainActionsPanel } from "../../../../features/products/train-actions-panel";
import { TrainContentPanel } from "../../../../features/products/train-content-panel";
import { TestPreviewPanel } from "../../../../features/products/test-preview-panel";
import {
  getOrCreateProduct,
  listActions,
  listContent,
} from "../../../../features/products/queries";

export const dynamic = "force-dynamic";

export default async function StudioTrainPage() {
  const product = await getOrCreateProduct();
  if (!product) notFound();
  const [content, actions] = await Promise.all([listContent(product.id), listActions(product.id)]);

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
          <TrainContentPanel productId={product.id} items={content} />
          <TrainActionsPanel productId={product.id} items={actions} />
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6">
          <TestPreviewPanel product={product} className="w-full" />
        </aside>
      </div>
    </div>
  );
}
