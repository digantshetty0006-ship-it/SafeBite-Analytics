"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/officer/intelligence", label: "Overview", icon: BarChart3 },
  { href: "/officer/intelligence/risk", label: "Risk explorer", icon: ShieldAlert },
  { href: "/officer/intelligence/quality", label: "Data quality", icon: DatabaseZap },
  { href: "/officer/intelligence/process", label: "Process efficiency", icon: Activity },
  { href: "/officer/intelligence/reports", label: "Reports", icon: FileText },
  { href: "/officer/intelligence/methodology", label: "Methodology", icon: ClipboardCheck },
];

export function IntelligenceNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : "";

  return (
    <nav
      aria-label="Intelligence workspace"
      className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 ring-1 ring-foreground/10"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/officer/intelligence"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={`${item.href}${suffix}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
