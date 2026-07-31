import { Sparkles } from "lucide-react";
import { EmptyState } from "../../../components/empty-state";
import { PageHeader } from "../../../components/page-header";
import { CreateProductDialog } from "../../../features/products/create-product-dialog";
import { ProductsList } from "../../../features/products/products-list";
import { listProducts } from "../../../features/products/queries";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const products = await listProducts();

  return (
    <>
      <PageHeader
        title="Your agents"
        description="Train an agent on your content, connect actions, and embed it on your site."
        action={<CreateProductDialog />}
      />
      {products.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No agents yet"
          description="Create an agent, train it on your product content, and drop the embed on your site."
          action={<CreateProductDialog />}
        />
      ) : (
        <ProductsList products={products} />
      )}
    </>
  );
}
