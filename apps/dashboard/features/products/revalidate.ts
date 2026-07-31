import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Revalidate every Studio page after a product mutation. Kept out of the
 * "use server" action modules because a server-actions file may only export
 * async server actions, and this is a plain server-side helper.
 */
export function revalidateStudioPaths() {
  revalidatePath("/studio");
  revalidatePath("/studio/train");
  revalidatePath("/studio/test");
  revalidatePath("/studio/deploy");
  revalidatePath("/studio/inbox");
}
