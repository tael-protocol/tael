import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /studio → Train (single-agent Studio). */
export default function StudioIndexPage() {
  redirect("/studio/train");
}
