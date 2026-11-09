"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recalculateBusinessRisk } from "@/lib/risk-service";

export interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function uploadInspectionPhotoAction(formData: FormData): Promise<UploadResult> {
  await requireRole("food_officer");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Only image files are allowed." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Image must be under 8 MB." };

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(uploadDir, name), bytes);
  return { ok: true, url: `/uploads/${name}` };
}

export async function completeInspectionAction(formData: FormData) {
  const officer = await requireRole("food_officer");
  const id = String(formData.get("inspectionId") ?? "");
  if (!id) return;

  const existing = await db.inspection.findUnique({
    where: { id },
    include: { business: true },
  });
  if (!existing || existing.officerId !== officer.id) return;

  const checklist = JSON.parse(String(formData.get("checklist") ?? "[]"));
  const notes = String(formData.get("notes") ?? "");
  const photos = JSON.stringify(JSON.parse(String(formData.get("photos") ?? "[]")));
  const aiSummary = String(formData.get("aiSummary") ?? "");
  const riskDelta = Number(formData.get("riskDelta") ?? 0) || 0;
  const violationsRaw = JSON.parse(String(formData.get("violations") ?? "[]")) as {
    type: string;
    severity: string;
    description: string;
  }[];

  await db.$transaction(async (tx) => {
    await tx.inspection.update({
      where: { id },
      data: {
        checklist,
        notes,
        photos,
        aiSummary,
        riskDelta,
        status: "completed",
        completedAt: new Date(),
      },
    });
    await tx.violation.deleteMany({ where: { inspectionId: id } });
    for (const v of violationsRaw) {
      await tx.violation.create({ data: { inspectionId: id, type: v.type, severity: v.severity, description: v.description } });
    }

    const business = await tx.business.findUnique({
      where: { id: existing.businessId },
      select: { id: true },
    });
    if (business) {
      // A completed inspection is a material risk event: recalculate from the
      // records just written and force a snapshot so the intelligence pages can
      // show movement against the previous score.
      await recalculateBusinessRisk(business.id, { client: tx, forceSnapshot: true });
    }
  });

  revalidatePath(`/officer/inspection/${id}`);
  revalidatePath(`/officer/business/${existing.businessId}`);
  revalidatePath("/officer/queue");
  revalidatePath("/officer/dashboard");
  revalidatePath("/officer/analytics");
  revalidatePath("/officer/intelligence");
  revalidatePath("/officer/intelligence/risk");
  revalidatePath("/officer/intelligence/process");
  revalidatePath("/officer/intelligence/quality");
  revalidatePath("/officer/intelligence/reports");
  redirect(`/officer/inspection/${id}?done=1`);
}
