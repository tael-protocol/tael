import Link from "next/link";
import type { Product } from "@tael/database";

export function ProductsList({ products }: { products: Product[] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Slug</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link href={`/studio/${p.id}`} className="flex items-center gap-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.status === "live" ? "#10b981" : "#94a3b8" }}
                    aria-hidden
                  />
                  <span className="font-medium">{p.name}</span>
                </Link>
              </td>
              <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
                {p.slug}
              </td>
              <td className="px-4 py-3">
                {p.status === "live" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Draft
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
