"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportSummaryDTO } from "@/lib/analytics/reports";

export function PdfExportButton({ summary }: { summary: ReportSummaryDTO }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = 44;

      const ensure = (needed: number) => {
        if (y + needed > pageHeight - 46) {
          doc.addPage();
          y = 44;
        }
      };

      const heading = (title: string) => {
        ensure(34);
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(16, 82, 62);
        doc.text(title, margin, y);
        y += 14;
        doc.setDrawColor(200, 220, 210);
        doc.line(margin, y - 6, pageWidth - margin, y - 6);
      };

      const paragraph = (text: string, size = 9) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(text, contentWidth) as string[];
        ensure(lines.length * (size + 2) + 4);
        doc.text(lines, margin, y);
        y += lines.length * (size + 2) + 4;
      };

      const table = (
        headers: string[],
        rows: string[][],
        widths: number[],
        alignRightFrom = 1
      ) => {
        const totalWidth = widths.reduce((a, b) => a + b, 0);
        const drawHeader = () => {
          ensure(18);
          doc.setFillColor(238, 246, 242);
          doc.rect(margin, y - 9, totalWidth, 15, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(30, 70, 55);
          let x = margin;
          headers.forEach((header, i) => {
            const text = doc.splitTextToSize(header, widths[i] - 4)[0] ?? header;
            if (i >= alignRightFrom) {
              doc.text(text, x + widths[i] - 3, y, { align: "right" });
            } else {
              doc.text(text, x + 2, y);
            }
            x += widths[i];
          });
          y += 13;
        };
        drawHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(55, 55, 55);
        for (const row of rows) {
          ensure(14);
          let x = margin;
          row.forEach((cell, i) => {
            const value = String(cell ?? "");
            const clipped = doc.splitTextToSize(value, widths[i] - 4)[0] ?? value;
            if (i >= alignRightFrom) {
              doc.text(clipped, x + widths[i] - 3, y, { align: "right" });
            } else {
              doc.text(clipped, x + 2, y);
            }
            x += widths[i];
          });
          y += 12;
          doc.setDrawColor(230, 234, 232);
          doc.line(margin, y - 7, margin + totalWidth, y - 7);
        }
        y += 3;
      };

      // Title block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(12, 70, 52);
      doc.text("SafeBite management report", margin, y);
      y += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text("Risk intelligence and business analytics · Food Safety Officer workspace", margin, y);
      y += 16;
      doc.setFontSize(8.5);
      doc.text(`Reporting period: ${summary.periodLabel}`, margin, y);
      y += 11;
      doc.text(`Comparison period: ${summary.previousLabel}`, margin, y);
      y += 11;
      doc.text(`Generated: ${summary.generatedAt} · Prepared by: ${summary.generatedBy}`, margin, y);
      y += 11;
      doc.text(
        `Scope: ${summary.scope.businesses} premises · ${summary.scope.complaints} complaints on record · ${summary.scope.inspections} inspections on record`,
        margin,
        y
      );
      y += 14;

      heading("Filters");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      for (const filter of summary.filters) {
        ensure(12);
        doc.text(`${filter.label}: ${filter.value}`, margin, y);
        y += 11;
      }

      heading("KPI summary");
      table(
        ["Metric", "Current", "Previous", "Change", "Assessment"],
        summary.kpis.map((kpi) => [
          kpi.name,
          kpi.current,
          kpi.previous,
          kpi.change,
          kpi.favourable,
        ]),
        [190, 62, 62, 60, 70]
      );

      heading("District scorecard");
      table(
        ["District", "Premises", "High risk", "Avg risk", "Insp.", "Compl.", "Resolved", "Overdue"],
        summary.districts.map((d) => [
          d.district,
          String(d.businesses),
          String(d.highRisk),
          d.averageRisk,
          String(d.inspections),
          String(d.complaints),
          String(d.resolved),
          String(d.overdue),
        ]),
        [85, 52, 52, 50, 44, 46, 52, 48],
        1
      );

      heading("Top risk premises");
      table(
        ["Business", "District", "Category", "Score", "Tier", "30d", "Top driver"],
        summary.riskTop.map((r) => [
          r.name,
          r.district,
          r.category,
          String(r.score),
          r.tier,
          r.delta,
          r.topFactor,
        ]),
        [140, 62, 75, 34, 30, 32, 112],
        3
      );

      if (summary.notes.length > 0) {
        heading("Data notes");
        for (const note of summary.notes) paragraph(`• ${note}`, 8.5);
      }

      heading("Interpretation and disclaimer");
      paragraph(
        "Risk scores are deterministic, weighted policy rules with an explainable factor breakdown. They are not a trained machine-learning model and do not estimate the probability of illness. This report is a prioritisation aid; officers must verify records before regulatory action.",
        8.5
      );
      paragraph(
        "The demonstration database contains synthetic operational records. This report is not official government statistics and does not imply government endorsement. Figures respect the filters shown above and the Asia/Kolkata reporting-period boundaries.",
        8.5
      );

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `SafeBite · synthetic demo data · page ${i} of ${pages}`,
          margin,
          pageHeight - 24
        );
      }

      doc.save(summary.filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" onClick={generate} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {busy ? "Building PDF…" : "Export PDF"}
    </Button>
  );
}
