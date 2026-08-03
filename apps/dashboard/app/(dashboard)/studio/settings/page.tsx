import { notFound } from "next/navigation";
import { PageHeader } from "../../../../components/page-header";
import { ProductSettingsForm } from "../../../../features/products/product-settings-form";
import { getOrCreateProduct } from "../../../../features/products/queries";

export const dynamic = "force-dynamic";

export default async function StudioSettingsPage() {
  const product = await getOrCreateProduct();
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Name, brand, greeting, and whether this agent is live on your site."
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
      <ProductSettingsForm product={product} />
    </div>
  );
}
