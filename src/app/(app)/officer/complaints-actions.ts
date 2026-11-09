"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recalculateBusinessRisk } from "@/lib/risk-service";

const ALLOWED = new Set(["under_review", "resolved"]);

/**
 * Advance a complaint's workflow status while recording the lifecycle
 * timestamps that the analytics engines rely on:
 *
 *   createdAt → assignedAt → investigationStartedAt → resolvedAt
 *
 * Existing timestamps are never overwritten, so re-saving a status is
 * idempotent and historical stage durations stay stable. Status changes that
 * touch a registered business also refresh its deterministic risk score and,
 * where material, write a risk snapshot.
 */
export async function updateComplaintStatusAction(formData: FormData) {
  const officer = await requireRole("food_officer");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !ALLOWED.has(status)) return;

  const complaint = await db.complaint.findUnique({
    where: { id },
    select: {
      id: true,
      businessId: true,
      assignedAt: true,
      investigationStartedAt: true,
      resolvedAt: true,
    },
  });
  if (!complaint) return;

  const now = new Date();
  const data: Prisma.ComplaintUncheckedUpdateInput = {
    status,
    assignedOfficerId: officer.id,
  };
  if (!complaint.assignedAt) data.assignedAt = now;
  if (!complaint.investigationStartedAt) data.investigationStartedAt = now;
  if (status === "resolved" && !complaint.resolvedAt) data.resolvedAt = now;

  await db.$transaction(async (tx) => {
    await tx.complaint.update({ where: { id }, data });
    if (complaint.businessId) {
      await recalculateBusinessRisk(complaint.businessId, { client: tx });
    }
  });

  revalidatePath("/officer/queue");
  revalidatePath("/officer/dashboard");
  revalidatePath(`/officer/complaint/${id}`);
  revalidatePath("/citizen/my-complaints");
  revalidatePath("/officer/intelligence");
  revalidatePath("/officer/intelligence/risk");
  revalidatePath("/officer/intelligence/process");
  revalidatePath("/officer/intelligence/quality");
  revalidatePath("/officer/intelligence/reports");
  revalidatePath("/officer/analytics");
}
