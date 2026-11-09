import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { calculateRiskScore, type RiskBreakdown } from "./risk";

type RiskClient = Pick<Prisma.TransactionClient, "business" | "riskSnapshot">;

export interface RecalculateOptions {
  client?: RiskClient;
  asOf?: Date;
  /** Force a snapshot even when the score has not moved materially. */
  forceSnapshot?: boolean;
  /** Skip writing a risk snapshot (e.g. bulk recalculation). */
  snapshot?: boolean;
}

/**
 * Recompute and persist a business's deterministic risk score from its current
 * records. A snapshot is written when the score moves by at least 2 points or
 * when no snapshot exists in the previous 24 hours. This avoids flooding the
 * history table while preserving meaningful movement.
 */
export async function recalculateBusinessRisk(
  businessId: string,
  options: RecalculateOptions = {}
): Promise<RiskBreakdown | null> {
  const client = options.client ?? db;
  const business = await client.business.findUnique({
    where: { id: businessId },
    include: {
      inspections: { include: { violations: true } },
      complaints: true,
      documents: true,
    },
  });
  if (!business) return null;

  const breakdown = calculateRiskScore(business, options.asOf);
  await client.business.update({
    where: { id: businessId },
    data: { riskScore: breakdown.score, riskTier: breakdown.tier },
  });

  if (options.snapshot !== false) {
    const latest = await client.riskSnapshot.findFirst({
      where: { businessId },
      orderBy: { snapshotAt: "desc" },
    });
    const moved = !latest || Math.abs(latest.score - breakdown.score) >= 2;
    const stale = !latest || Date.now() - latest.snapshotAt.getTime() >= 24 * 3600 * 1000;
    if (options.forceSnapshot || moved || stale) {
      await client.riskSnapshot.create({
        data: {
          businessId,
          score: breakdown.score,
          tier: breakdown.tier,
          factors: breakdown.factors,
          snapshotAt: options.asOf ?? new Date(),
        },
      });
    }
  }

  return breakdown;
}
