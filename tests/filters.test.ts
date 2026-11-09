import test from "node:test";
import assert from "node:assert/strict";
import {
  average,
  endOfIstDay,
  istWeekStart,
  parseAnalyticsFilters,
  pct,
  resolvePeriod,
  startOfIstDay,
} from "../src/lib/analytics/filters";
import type { AnalyticsFilters } from "../src/lib/analytics/types";

const NOW = new Date("2026-11-08T12:00:00.000Z");

test("IST day boundaries convert to the correct UTC instants", () => {
  assert.equal(startOfIstDay("2026-11-08").toISOString(), "2026-11-07T18:30:00.000Z");
  assert.equal(endOfIstDay("2026-11-08").toISOString(), "2026-11-08T18:30:00.000Z");
  assert.equal(istWeekStart(NOW).toISOString(), "2026-11-01T18:30:00.000Z");
});

test("last 90 days uses IST boundaries and an equal-length previous period", () => {
  const filters = parseAnalyticsFilters({ period: "last90" });
  const period = resolvePeriod(filters, NOW);

  assert.equal(period.start.toISOString(), "2026-08-10T18:30:00.000Z");
  assert.equal(period.end.toISOString(), NOW.toISOString());
  assert.equal(period.days, 90);
  assert.equal(period.previousEnd.getTime(), period.start.getTime());
  assert.equal(
    period.end.getTime() - period.start.getTime(),
    period.previousEnd.getTime() - period.previousStart.getTime()
  );
  assert.match(period.label, /11 Aug 2026/);
  assert.match(period.label, /8 Nov 2026/);
});

test("custom range includes the whole end date in IST", () => {
  const filters = parseAnalyticsFilters({
    period: "custom",
    from: "2026-08-11",
    to: "2026-11-08",
  });
  const period = resolvePeriod(filters, NOW);

  assert.equal(period.custom, true);
  assert.equal(period.start.toISOString(), "2026-08-10T18:30:00.000Z");
  assert.equal(period.end.toISOString(), "2026-11-08T18:30:00.000Z");
  assert.equal(period.days, 90);
  assert.equal(period.previousStart.toISOString(), "2026-05-12T18:30:00.000Z");
});

test("invalid custom dates fall back to the last 30 days", () => {
  const filters = parseAnalyticsFilters({
    period: "custom",
    from: "not-a-date",
    to: "also-not-a-date",
  });
  const period = resolvePeriod(filters, NOW);

  assert.equal(period.key, "last30");
  assert.equal(period.custom, false);
  assert.equal(period.days, 30);
});

test("current and previous month resolve to the correct IST month starts", () => {
  const current = resolvePeriod(
    parseAnalyticsFilters({ period: "current_month" }),
    NOW
  );
  assert.equal(current.start.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(current.end.toISOString(), NOW.toISOString());

  const previous = resolvePeriod(
    parseAnalyticsFilters({ period: "previous_month" }),
    NOW
  );
  assert.equal(previous.start.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(previous.days, 31);
});

test("grouping defaults to weekly for a long range when unset", () => {
  const filters = parseAnalyticsFilters({ period: "last90" });
  const period = resolvePeriod(
    { ...filters, grouping: "" } as unknown as AnalyticsFilters,
    NOW
  );
  assert.equal(period.grouping, "week");
});

test("query parsing clamps unknown values and normalises risk tiers", () => {
  const filters = parseAnalyticsFilters({
    period: "forever",
    district: "  Mumbai  ",
    riskTier: "c",
    grouping: "quarterly",
    from: ["2026-01-01"],
  });
  assert.equal(filters.period, "last30");
  assert.equal(filters.district, "Mumbai");
  assert.equal(filters.riskTier, "C");
  assert.equal(filters.grouping, "day");
  assert.equal(filters.from, "2026-01-01");
});

test("percentage and average helpers return null for empty denominators", () => {
  assert.equal(pct(1, 0), null);
  assert.equal(pct(1, 4), 25);
  assert.equal(average([]), null);
  assert.equal(average([2, 4, 6]), 4);
});
