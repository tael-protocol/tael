import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProduct, listContent } from "../../../../features/products/queries";
import { StudioTabs } from "../../../../features/products/studio-tabs";

export const dynamic = "force-dynamic";

export default async function StudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const content = await listContent(id);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/studio"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Your agents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: product.brandColor }}
              aria-hidden
            />
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{product.slug}</span>
            {product.status === "live" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Draft
              </span>
            )}
          </div>
        </div>
      </div>

      <StudioTabs product={product} content={content} />
    </div>
  );
}
