import { notFound } from "next/navigation";
import { PageHeader } from "../../../../components/page-header";
import { ProductSettingsForm } from "../../../../features/products/product-settings-form";
import { TrainActionsPanel } from "../../../../features/products/train-actions-panel";
import { TrainContentPanel } from "../../../../features/products/train-content-panel";
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
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Train"
        description="Teach your agent with content and connect the actions it can propose."
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
      <TrainContentPanel productId={product.id} items={content} />
      <TrainActionsPanel productId={product.id} items={actions} />
      <ProductSettingsForm product={product} />
    </div>
  );
}
