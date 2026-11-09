import test from "node:test";
import assert from "node:assert/strict";
import { DATA_QUALITY_RULES, isAnonymityConflict } from "../src/lib/quality";

test("the quality catalogue exposes 20 documented rules", () => {
  assert.equal(Object.keys(DATA_QUALITY_RULES).length, 20);
  assert.ok(DATA_QUALITY_RULES["C-ANON-CONFLICT"]);
  assert.ok(DATA_QUALITY_RULES["C-RES-MISSING"]);
});

test("legitimate anonymous complaints are not anonymity conflicts", () => {
  assert.equal(
    isAnonymityConflict({ anonymous: true, citizenId: null }),
    false,
    "anonymous with no citizen link must pass"
  );
  assert.equal(
    isAnonymityConflict({ anonymous: false, citizenId: "citizen-1" }),
    false,
    "identified complaints are not anonymous"
  );
  assert.equal(
    isAnonymityConflict({ anonymous: false, citizenId: null }),
    false
  );
});

test("anonymous complaints carrying a citizen identity are contradictions", () => {
  assert.equal(
    isAnonymityConflict({ anonymous: true, citizenId: "citizen-1" }),
    true
  );
});

test("the anonymity rule documents the false-positive control", () => {
  const rule = DATA_QUALITY_RULES["C-ANON-CONFLICT"];
  assert.match(rule.description, /no citizen link/i);
  assert.match(rule.recommendation, /anonymous/i);
  assert.equal(rule.severity, "high");
});

test("data-quality scoring is rule-based, not record-count based", () => {
  assert.match(
    DATA_QUALITY_RULES["C-ANON-CONFLICT"].check,
    /anonymous = true AND citizenId IS NOT NULL/
  );
  const ids = Object.keys(DATA_QUALITY_RULES);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[A-Z]-[A-Z-]+$/.test(id)));
});
