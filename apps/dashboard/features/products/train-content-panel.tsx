import type { ProductContent } from "@tael/database";
import { AddContentForms } from "./add-content-forms";
import { ContentList } from "./content-list";

/** Train → Content: Fin-style add cards + your content list. */
export function TrainContentPanel({
  productId,
  items,
}: {
  productId: string;
  items: ProductContent[];
}) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Add content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sources your agent can learn from. Enabled items are used in chat.
        </p>
      </div>
      <AddContentForms productId={productId} />

      <div className="space-y-3 pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Your content</h2>
          <span className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "source" : "sources"}
          </span>
        </div>
        <ContentList items={items} />
      </div>
    </section>
  );
}
