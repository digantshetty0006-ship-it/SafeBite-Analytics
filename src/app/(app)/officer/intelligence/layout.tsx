import { Suspense } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { IntelligenceNav } from "@/components/intelligence/intelligence-nav";

export default async function IntelligenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("food_officer");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Risk Intelligence &amp; Business Analytics
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              Decision support
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              Synthetic demo data
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Evidence-based view of premises risk, inspection delivery, complaint resolution
            and data health. Authorised Food Safety Officers only.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <Link href="/officer/analytics" className="underline underline-offset-2 hover:text-foreground">
            Legacy analytics
          </Link>{" "}
          remains available. This workspace adds governed KPIs and exports.
        </p>
      </div>

      <Suspense fallback={<div className="h-12 animate-pulse rounded-xl border bg-muted/40" />}>
        <IntelligenceNav />
      </Suspense>

      {children}
    </div>
  );
}
