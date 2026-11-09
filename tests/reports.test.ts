import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, reportFilename, rowsToCsv } from "../src/lib/analytics/reports";
import type { AnalyticsDataset } from "../src/lib/analytics/types";

test("CSV cells neutralise spreadsheet formula injection", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("+SUM(A1:A2)"), '"\'+SUM(A1:A2)"');
  assert.equal(csvCell("-2"), '"\'-2"');
  assert.equal(csvCell("@cmd"), '"\'@cmd"');
  assert.equal(csvCell("\tpayload"), '"\'\tpayload"');
  assert.equal(csvCell("\rpayload"), "\"'\rpayload\"");
});

test("CSV cells quote normal text and escape embedded quotes", () => {
  assert.equal(csvCell("Mumbai"), '"Mumbai"');
  assert.equal(csvCell('A "quoted" name'), '"A ""quoted"" name"');
  assert.equal(csvCell(42), '"42"');
  assert.equal(csvCell(null), '""');
});

test("rowsToCsv starts with a UTF-8 BOM and uses CRLF", () => {
  const csv = rowsToCsv([
    ["name", "count"],
    ["Mumbai", 2],
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"name","count"'));
  assert.ok(csv.includes('"Mumbai","2"'));
  assert.ok(csv.includes("\r\n"));
});

test("report filenames include the report name, district and date", () => {
  const dataset = {
    filters: { district: "Navi Mumbai" },
  } as unknown as AnalyticsDataset;
  const filename = reportFilename("risk_register", dataset);
  assert.match(
    filename,
    /^safebite_risk_register_navi-mumbai_\d{4}-\d{2}-\d{2}\.csv$/
  );
});
