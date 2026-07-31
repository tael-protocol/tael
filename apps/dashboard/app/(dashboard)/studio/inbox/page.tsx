import { PageHeader } from "../../../../components/page-header";
import { getOrCreateProduct } from "../../../../features/products/queries";

export const dynamic = "force-dynamic";

export default async function StudioInboxPage() {
  // Ensure the single agent exists so nav into Inbox is consistent with other Studio pages.
  await getOrCreateProduct();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Inbox"
        description="Conversations from your embedded agent will show up here."
      />
      <div className="rounded-xl border border-dashed px-6 py-14 text-center">
        <h3 className="font-medium">Conversations coming soon</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Chats, actions taken, and live handoff will land here in a later task.
        </p>
      </div>
    </div>
  );
}
