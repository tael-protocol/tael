import type { ProductContent } from "@tael/database";
import { AddContentForms } from "./add-content-forms";
import { ContentList } from "./content-list";

/** Train → Content: add docs/snippets/FAQs/website sync and manage the list. */
export function TrainContentPanel({
  productId,
  items,
}: {
  productId: string;
  items: ProductContent[];
}) {
  return (
    <section className="space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-base font-semibold">Content</h2>
        <p className="text-sm text-muted-foreground">
          What this agent knows. Enabled items are used when someone chats with it.
        </p>
      </div>
      <AddContentForms productId={productId} />
      <ContentList items={items} />
    </section>
  );
}
