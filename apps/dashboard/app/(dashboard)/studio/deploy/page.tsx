import { notFound } from "next/navigation";
import { PageHeader } from "../../../../components/page-header";
import { DeployPanel } from "../../../../features/products/deploy-panel";
import { getOrCreateProduct } from "../../../../features/products/queries";

export const dynamic = "force-dynamic";

export default async function StudioDeployPage() {
  const product = await getOrCreateProduct();
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Deploy"
        description="Grab the embed snippet and choose where this agent shows up."
      />
      <DeployPanel product={product} />
    </div>
  );
}
