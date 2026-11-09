-- SafeBite analytics SQL library — PostgreSQL dialect
--
-- Query names, parameters and result columns match queries.sqlite.sql. Prisma
-- creates quoted PascalCase tables and camelCase columns, so every identifier
-- is double-quoted here.
--
-- Parameters are bound by scripts/run-sql.ts through Prisma; user input never
-- becomes part of the SQL text.
--
-- Interval maths uses EXTRACT(EPOCH FROM ...) / 86400.0 so results are calendar
-- days, matching the SQLite julianday() calculations.

-- name: kpi_registered_businesses
-- params: asOf
-- description: Businesses on the register at the asOf date. Closed premises are excluded.
SELECT COUNT(*) AS "registeredBusinesses"
FROM "Business"
WHERE "registeredAt" < :asOf
  AND "status" <> 'closed';

-- name: kpi_high_risk_premises
-- params: asOf, limit
-- description: Premises whose latest snapshot on or before asOf is tier C (high) or D (critical).
SELECT b."id",
       b."name",
       b."district",
       b."category",
       b."licenseNumber",
       rs."score",
       rs."tier",
       rs."snapshotAt"
FROM "Business" b
JOIN "RiskSnapshot" rs
  ON rs."businessId" = b."id"
 AND rs."snapshotAt" = (
       SELECT MAX(s."snapshotAt")
       FROM "RiskSnapshot" s
       WHERE s."businessId" = b."id"
         AND s."snapshotAt" <= :asOf
     )
WHERE b."status" <> 'closed'
  AND rs."tier" IN ('C', 'D')
ORDER BY rs."score" DESC
LIMIT :limit;

-- name: kpi_average_risk_score
-- params: asOf
-- description: Mean of each premise's latest snapshot score on or before asOf.
SELECT ROUND(AVG(rs."score"), 1) AS "averageRiskScore",
       COUNT(*) AS "ratedBusinesses"
FROM "Business" b
JOIN "RiskSnapshot" rs
  ON rs."businessId" = b."id"
 AND rs."snapshotAt" = (
       SELECT MAX(s."snapshotAt")
       FROM "RiskSnapshot" s
       WHERE s."businessId" = b."id"
         AND s."snapshotAt" <= :asOf
     )
WHERE b."status" <> 'closed'
  AND b."registeredAt" < :asOf;

-- name: kpi_inspections_completed
-- params: fromDate, toDate
-- description: Inspections with a completion timestamp inside the reporting window.
SELECT COUNT(*) AS "inspectionsCompleted"
FROM "Inspection"
WHERE "completedAt" >= :fromDate
  AND "completedAt" < :toDate;

-- name: kpi_inspection_completion_rate
-- params: fromDate, toDate
-- description: Inspections due in the window that were completed by the window end.
SELECT COUNT(*) AS "dueInspections",
       COALESCE(SUM(CASE WHEN "completedAt" IS NOT NULL AND "completedAt" < :toDate THEN 1 ELSE 0 END), 0) AS "completedInspections",
       ROUND(
         100.0 * SUM(CASE WHEN "completedAt" IS NOT NULL AND "completedAt" < :toDate THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*), 0),
         1
       ) AS "completionRatePercent"
FROM "Inspection"
WHERE "scheduledAt" >= :fromDate
  AND "scheduledAt" < :toDate;

-- name: kpi_critical_violations
-- params: fromDate, toDate
-- description: Critical-severity findings recorded by inspections completed in the window.
SELECT COUNT(*) AS "findings",
       COALESCE(SUM(CASE WHEN v."severity" = 'critical' THEN 1 ELSE 0 END), 0) AS "criticalFindings"
FROM "Violation" v
JOIN "Inspection" i ON i."id" = v."inspectionId"
WHERE i."completedAt" >= :fromDate
  AND i."completedAt" < :toDate;

-- name: kpi_violations_per_inspection
-- params: fromDate, toDate
-- description: Findings per completed inspection, including inspections with zero findings.
SELECT COUNT(DISTINCT i."id") AS "inspectionsCompleted",
       COUNT(v."id") AS "findings",
       ROUND(1.0 * COUNT(v."id") / NULLIF(COUNT(DISTINCT i."id"), 0), 2) AS "violationsPerInspection"
FROM "Inspection" i
LEFT JOIN "Violation" v ON v."inspectionId" = i."id"
WHERE i."completedAt" >= :fromDate
  AND i."completedAt" < :toDate;

-- name: kpi_repeat_violation_rate
-- params: fromDate, toDate
-- description: Share of findings whose violation type was already recorded at the same business before the window.
SELECT COUNT(*) AS "findings",
       COALESCE(SUM(
         CASE WHEN EXISTS (
           SELECT 1
           FROM "Violation" prior_v
           JOIN "Inspection" prior_i ON prior_i."id" = prior_v."inspectionId"
           WHERE prior_i."businessId" = i."businessId"
             AND prior_v."type" = v."type"
             AND prior_i."completedAt" IS NOT NULL
             AND prior_i."completedAt" < :fromDate
         ) THEN 1 ELSE 0 END
       ), 0) AS "repeatFindings",
       ROUND(
         100.0 * SUM(
           CASE WHEN EXISTS (
             SELECT 1
             FROM "Violation" prior_v
             JOIN "Inspection" prior_i ON prior_i."id" = prior_v."inspectionId"
             WHERE prior_i."businessId" = i."businessId"
               AND prior_v."type" = v."type"
               AND prior_i."completedAt" IS NOT NULL
               AND prior_i."completedAt" < :fromDate
           ) THEN 1 ELSE 0 END
         ) / NULLIF(COUNT(*), 0),
         1
       ) AS "repeatRatePercent"
FROM "Violation" v
JOIN "Inspection" i ON i."id" = v."inspectionId"
WHERE i."completedAt" >= :fromDate
  AND i."completedAt" < :toDate;

-- name: kpi_complaints_received
-- params: fromDate, toDate
-- description: Complaints created inside the reporting window.
SELECT COUNT(*) AS "complaintsReceived"
FROM "Complaint"
WHERE "createdAt" >= :fromDate
  AND "createdAt" < :toDate;

-- name: kpi_complaints_resolved
-- params: fromDate, toDate
-- description: Complaints resolved in the window with a valid resolution timestamp.
SELECT COUNT(*) AS "complaintsResolved"
FROM "Complaint"
WHERE "resolvedAt" >= :fromDate
  AND "resolvedAt" < :toDate
  AND "resolvedAt" >= "createdAt";

-- name: kpi_average_resolution_days
-- params: fromDate, toDate
-- description: Mean calendar days from creation to resolution for valid resolutions in the window.
SELECT COUNT(*) AS "evaluatedResolutions",
       ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400.0), 1) AS "averageResolutionDays"
FROM "Complaint"
WHERE "resolvedAt" >= :fromDate
  AND "resolvedAt" < :toDate
  AND "resolvedAt" >= "createdAt";

-- name: kpi_sla_compliance
-- params: fromDate, toDate
-- description: Share of valid resolutions completed within the complaint's SLA target.
SELECT COUNT(*) AS "evaluatedResolutions",
       COALESCE(SUM(CASE WHEN (EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400.0) <= "slaDays" THEN 1 ELSE 0 END), 0) AS "withinSla",
       ROUND(
         100.0 * SUM(CASE WHEN (EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400.0) <= "slaDays" THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*), 0),
         1
       ) AS "slaCompliancePercent"
FROM "Complaint"
WHERE "resolvedAt" >= :fromDate
  AND "resolvedAt" < :toDate
  AND "resolvedAt" >= "createdAt";

-- name: kpi_overdue_open_complaints
-- params: asOf
-- description: Complaints not resolved by asOf whose SLA due date has passed. Invalid lifecycles are included so they are not silently hidden.
SELECT COUNT(*) AS "overdueOpen"
FROM "Complaint"
WHERE "createdAt" < :asOf
  AND ("resolvedAt" IS NULL OR "resolvedAt" >= :asOf)
  AND ("createdAt" + ("slaDays" * INTERVAL '1 day')) < :asOf;

-- name: risk_tier_distribution
-- params: asOf
-- description: Current tier distribution from the latest snapshot per premise.
SELECT rs."tier",
       COUNT(*) AS "businesses",
       ROUND(AVG(rs."score"), 1) AS "averageScore"
FROM "Business" b
JOIN "RiskSnapshot" rs
  ON rs."businessId" = b."id"
 AND rs."snapshotAt" = (
       SELECT MAX(s."snapshotAt")
       FROM "RiskSnapshot" s
       WHERE s."businessId" = b."id"
         AND s."snapshotAt" <= :asOf
     )
WHERE b."status" <> 'closed'
GROUP BY rs."tier"
ORDER BY rs."tier";

-- name: risk_score_history
-- params: asOf
-- description: Monthly average risk score across stored snapshots (up to asOf). Useful for trend validation.
SELECT substr(CAST("snapshotAt" AS TEXT), 1, 7) AS "month",
       COUNT(DISTINCT "businessId") AS "ratedBusinesses",
       ROUND(AVG("score"), 1) AS "averageScore",
       MAX("score") AS "highestScore"
FROM "RiskSnapshot"
WHERE "snapshotAt" <= :asOf
GROUP BY substr(CAST("snapshotAt" AS TEXT), 1, 7)
ORDER BY "month";

-- name: risk_score_movers
-- params: asOf, priorDate, limit
-- description: Largest 30-day risk increases and decreases, using the latest snapshot at each date.
SELECT b."name",
       b."district",
       b."riskTier",
       (SELECT s."score" FROM "RiskSnapshot" s WHERE s."businessId" = b."id" AND s."snapshotAt" <= :asOf ORDER BY s."snapshotAt" DESC LIMIT 1) AS "currentScore",
       (SELECT s."score" FROM "RiskSnapshot" s WHERE s."businessId" = b."id" AND s."snapshotAt" <= :priorDate ORDER BY s."snapshotAt" DESC LIMIT 1) AS "priorScore",
       ROUND(
         COALESCE((SELECT s."score" FROM "RiskSnapshot" s WHERE s."businessId" = b."id" AND s."snapshotAt" <= :asOf ORDER BY s."snapshotAt" DESC LIMIT 1), 0)
         - COALESCE((SELECT s."score" FROM "RiskSnapshot" s WHERE s."businessId" = b."id" AND s."snapshotAt" <= :priorDate ORDER BY s."snapshotAt" DESC LIMIT 1), 0),
         1
       ) AS "scoreChange"
FROM "Business" b
WHERE b."status" <> 'closed'
ORDER BY "scoreChange" DESC
LIMIT :limit;

-- name: district_scorecard
-- params: fromDate, toDate, asOf
-- description: District-level premises, risk, inspection, complaint and backlog metrics.
SELECT b."district",
       COUNT(*) AS "premises",
       COALESCE(SUM(CASE WHEN rs."tier" IN ('C', 'D') THEN 1 ELSE 0 END), 0) AS "highRiskPremises",
       ROUND(AVG(rs."score"), 1) AS "averageRiskScore",
       (SELECT COUNT(*)
        FROM "Inspection" i
        JOIN "Business" b2 ON b2."id" = i."businessId"
        WHERE b2."district" = b."district"
          AND i."completedAt" >= :fromDate
          AND i."completedAt" < :toDate) AS "inspectionsCompleted",
       (SELECT COUNT(*)
        FROM "Violation" v
        JOIN "Inspection" i ON i."id" = v."inspectionId"
        JOIN "Business" b3 ON b3."id" = i."businessId"
        WHERE b3."district" = b."district"
          AND i."completedAt" >= :fromDate
          AND i."completedAt" < :toDate) AS "findings",
       (SELECT COUNT(*)
        FROM "Complaint" c
        JOIN "Business" b4 ON b4."id" = c."businessId"
        WHERE b4."district" = b."district"
          AND c."createdAt" >= :fromDate
          AND c."createdAt" < :toDate) AS "complaintsReceived",
       (SELECT COUNT(*)
        FROM "Complaint" c
        JOIN "Business" b5 ON b5."id" = c."businessId"
        WHERE b5."district" = b."district"
          AND c."resolvedAt" >= :fromDate
          AND c."resolvedAt" < :toDate
          AND c."resolvedAt" >= c."createdAt") AS "complaintsResolved",
       (SELECT COUNT(*)
        FROM "Complaint" c
        JOIN "Business" b6 ON b6."id" = c."businessId"
        WHERE b6."district" = b."district"
          AND c."createdAt" < :asOf
          AND (c."resolvedAt" IS NULL OR c."resolvedAt" >= :asOf)
          AND (c."createdAt" + (c."slaDays" * INTERVAL '1 day')) < :asOf) AS "overdueOpen"
FROM "Business" b
LEFT JOIN "RiskSnapshot" rs
  ON rs."businessId" = b."id"
 AND rs."snapshotAt" = (
       SELECT MAX(s."snapshotAt")
       FROM "RiskSnapshot" s
       WHERE s."businessId" = b."id"
         AND s."snapshotAt" <= :asOf
     )
WHERE b."status" <> 'closed'
GROUP BY b."district"
ORDER BY "highRiskPremises" DESC, "premises" DESC;

-- name: complaint_type_distribution
-- params: fromDate, toDate
-- description: Complaints received by recorded type. Missing types are surfaced as "unspecified".
SELECT COALESCE(NULLIF(TRIM("type"), ''), 'unspecified') AS "complaintType",
       COUNT(*) AS "complaints"
FROM "Complaint"
WHERE "createdAt" >= :fromDate
  AND "createdAt" < :toDate
GROUP BY COALESCE(NULLIF(TRIM("type"), ''), 'unspecified')
ORDER BY "complaints" DESC;

-- name: violation_severity_distribution
-- params: fromDate, toDate
-- description: Findings by severity for inspections completed in the window.
SELECT v."severity",
       COUNT(*) AS "findings"
FROM "Violation" v
JOIN "Inspection" i ON i."id" = v."inspectionId"
WHERE i."completedAt" >= :fromDate
  AND i."completedAt" < :toDate
GROUP BY v."severity"
ORDER BY "findings" DESC;

-- name: complaint_stage_durations
-- params: fromDate, toDate
-- description: Mean days between consecutive complaint lifecycle stages for complaints created in the window.
SELECT "stage",
       "samples",
       "averageDays"
FROM (
  SELECT 'receipt_to_assignment' AS "stage",
         COUNT(*) AS "samples",
         ROUND(AVG(EXTRACT(EPOCH FROM ("assignedAt" - "createdAt")) / 86400.0), 2) AS "averageDays"
  FROM "Complaint"
  WHERE "createdAt" >= :fromDate
    AND "createdAt" < :toDate
    AND "assignedAt" IS NOT NULL
    AND "assignedAt" >= "createdAt"

  UNION ALL

  SELECT 'assignment_to_investigation',
         COUNT(*),
         ROUND(AVG(EXTRACT(EPOCH FROM ("investigationStartedAt" - "assignedAt")) / 86400.0), 2)
  FROM "Complaint"
  WHERE "createdAt" >= :fromDate
    AND "createdAt" < :toDate
    AND "assignedAt" IS NOT NULL
    AND "investigationStartedAt" IS NOT NULL
    AND "investigationStartedAt" >= "assignedAt"

  UNION ALL

  SELECT 'investigation_to_inspection',
         COUNT(*),
         ROUND(AVG(EXTRACT(EPOCH FROM ("inspectionAt" - COALESCE("investigationStartedAt", "assignedAt", "createdAt"))) / 86400.0), 2)
  FROM "Complaint"
  WHERE "createdAt" >= :fromDate
    AND "createdAt" < :toDate
    AND "inspectionAt" IS NOT NULL
    AND "inspectionAt" >= COALESCE("investigationStartedAt", "assignedAt", "createdAt")

  UNION ALL

  SELECT 'last_stage_to_resolution',
         COUNT(*),
         ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - COALESCE("inspectionAt", "investigationStartedAt", "assignedAt", "createdAt"))) / 86400.0), 2)
  FROM "Complaint"
  WHERE "createdAt" >= :fromDate
    AND "createdAt" < :toDate
    AND "resolvedAt" IS NOT NULL
    AND "resolvedAt" >= COALESCE("inspectionAt", "investigationStartedAt", "assignedAt", "createdAt")

  UNION ALL

  SELECT 'receipt_to_resolution',
         COUNT(*),
         ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 86400.0), 2)
  FROM "Complaint"
  WHERE "createdAt" >= :fromDate
    AND "createdAt" < :toDate
    AND "resolvedAt" IS NOT NULL
    AND "resolvedAt" >= "createdAt"
) AS stages
ORDER BY "stage";

-- name: inspection_turnaround_by_district
-- params: fromDate, toDate
-- description: Average calendar days from planned date to completion, for completed inspections.
SELECT b."district",
       COUNT(*) AS "completedInspections",
       ROUND(AVG(EXTRACT(EPOCH FROM (i."completedAt" - i."scheduledAt")) / 86400.0), 1) AS "averageTurnaroundDays"
FROM "Inspection" i
JOIN "Business" b ON b."id" = i."businessId"
WHERE i."completedAt" >= :fromDate
  AND i."completedAt" < :toDate
  AND i."completedAt" >= i."scheduledAt"
GROUP BY b."district"
ORDER BY "averageTurnaroundDays" DESC;

-- name: inspection_overdue_backlog
-- params: asOf
-- description: Inspections still marked scheduled but past their planned date at asOf.
SELECT b."district",
       COUNT(*) AS "overdueInspections"
FROM "Inspection" i
JOIN "Business" b ON b."id" = i."businessId"
WHERE i."status" = 'scheduled'
  AND i."scheduledAt" < :asOf
GROUP BY b."district"
ORDER BY "overdueInspections" DESC;

-- name: data_quality_lifecycle_anomalies
-- params: limit
-- description: Impossible or contradictory complaint lifecycles. Legitimate anonymous complaints (no citizen link) are not flagged.
SELECT c."id",
       c."status",
       c."createdAt",
       c."assignedAt",
       c."investigationStartedAt",
       c."inspectionAt",
       c."resolvedAt",
       CASE
         WHEN c."status" = 'resolved' AND c."resolvedAt" IS NULL THEN 'resolved_without_timestamp'
         WHEN c."resolvedAt" IS NOT NULL AND c."resolvedAt" < c."createdAt" THEN 'resolution_before_creation'
         WHEN c."assignedAt" IS NOT NULL AND c."assignedAt" < c."createdAt" THEN 'assignment_before_creation'
         WHEN c."investigationStartedAt" IS NOT NULL AND c."assignedAt" IS NOT NULL
              AND c."investigationStartedAt" < c."assignedAt" THEN 'investigation_before_assignment'
         WHEN c."inspectionAt" IS NOT NULL AND c."investigationStartedAt" IS NOT NULL
              AND c."inspectionAt" < c."investigationStartedAt" THEN 'inspection_before_investigation'
         WHEN c."resolvedAt" IS NOT NULL AND c."inspectionAt" IS NOT NULL
              AND c."resolvedAt" < c."inspectionAt" THEN 'resolution_before_inspection'
         WHEN c."anonymous" = TRUE AND c."citizenId" IS NOT NULL THEN 'anonymity_conflict'
       END AS "issue"
FROM "Complaint" c
WHERE (c."status" = 'resolved' AND c."resolvedAt" IS NULL)
   OR (c."resolvedAt" IS NOT NULL AND c."resolvedAt" < c."createdAt")
   OR (c."assignedAt" IS NOT NULL AND c."assignedAt" < c."createdAt")
   OR (c."investigationStartedAt" IS NOT NULL AND c."assignedAt" IS NOT NULL
       AND c."investigationStartedAt" < c."assignedAt")
   OR (c."inspectionAt" IS NOT NULL AND c."investigationStartedAt" IS NOT NULL
       AND c."inspectionAt" < c."investigationStartedAt")
   OR (c."resolvedAt" IS NOT NULL AND c."inspectionAt" IS NOT NULL
       AND c."resolvedAt" < c."inspectionAt")
   OR (c."anonymous" = TRUE AND c."citizenId" IS NOT NULL)
ORDER BY c."createdAt" DESC
LIMIT :limit;

-- name: data_quality_duplicate_licences
-- params: limit
-- description: Licence numbers shared by more than one business after trimming and case-folding.
SELECT "name",
       "district",
       "licenseNumber",
       "duplicates"
FROM (
  SELECT b."name",
         b."district",
         b."licenseNumber",
         COUNT(*) OVER (PARTITION BY LOWER(TRIM(b."licenseNumber"))) AS "duplicates"
  FROM "Business" b
  WHERE LOWER(TRIM(b."licenseNumber")) IN (
    SELECT LOWER(TRIM("licenseNumber"))
    FROM "Business"
    GROUP BY LOWER(TRIM("licenseNumber"))
    HAVING COUNT(*) > 1
  )
) AS licence_groups
ORDER BY "duplicates" DESC, "licenseNumber"
LIMIT :limit;

-- name: supplier_licence_coverage
-- params: none
-- description: Supplier master completeness. Missing supplier licences are a follow-up item, not a KPI defect.
SELECT COUNT(*) AS "suppliers",
       COALESCE(SUM(CASE WHEN "licenceNumber" IS NULL OR TRIM("licenceNumber") = '' THEN 1 ELSE 0 END), 0) AS "missingLicence",
       COALESCE(SUM(CASE WHEN "licenceNumber" IS NOT NULL AND TRIM("licenceNumber") <> '' THEN 1 ELSE 0 END), 0) AS "withLicence"
FROM "Supplier";

-- name: expired_documents_by_type
-- params: asOf
-- description: Compliance documents already expired at asOf. Regulatory follow-up, not a data-quality defect.
SELECT "type",
       COUNT(*) AS "expiredDocuments"
FROM "Document"
WHERE "expiresAt" IS NOT NULL
  AND "expiresAt" < :asOf
GROUP BY "type"
ORDER BY "expiredDocuments" DESC;
