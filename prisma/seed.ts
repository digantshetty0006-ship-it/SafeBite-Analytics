import { PrismaClient, type Business, type User } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";
import { calculateRiskScore } from "../src/lib/risk";

function dbUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;
  let file = url.slice("file:".length);
  if (file.startsWith("./")) {
    file = path.resolve(process.cwd(), file.slice(2));
  }
  return file;
}

function isPostgres(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

const seedUrl = process.env.DATABASE_URL ?? "file:./dev.db";

const prisma = new PrismaClient({
  adapter: isPostgres(seedUrl)
    ? new PrismaPg({ connectionString: seedUrl })
    : new PrismaBetterSqlite3({ url: dbUrl() }),
});

const DISTRICTS = [
  { name: "Mumbai", center: [19.076, 72.8777] },
  { name: "Thane", center: [19.2183, 72.9781] },
  { name: "Navi Mumbai", center: [19.033, 73.0297] },
  { name: "Pune", center: [18.5204, 73.8567] },
  { name: "Nashik", center: [19.9975, 73.7898] },
  { name: "Nagpur", center: [21.1458, 79.0882] },
];

const CATEGORIES = [
  "restaurant",
  "restaurant",
  "restaurant",
  "street_vendor",
  "street_vendor",
  "manufacturer",
  "manufacturer",
  "warehouse",
  "warehouse",
  "meat_poultry",
  "meat_poultry",
  "bakery",
  "catering",
  "packaged_retail",
];

const NAME_TEMPLATES = [
  "Hotel {x}",
  "{x} Bhojanalaya",
  "{x} Family Restaurant",
  "{x} Sweets & Snacks",
  "{x} Fresh Mart",
  "The {x} Grill",
  "{x} Food Corner",
  "{x} Spice House",
  "Shree {x} Foods",
  "{x} Caterers",
  "{x} Cold Storage",
  "{x} Bake House",
  "{x} Meat Shop",
  "{x} Food Products",
  "{x} Kitchen",
  "{x} Dairy & Store",
  "{x} Halwai",
  "{x} Delivery Kitchen",
];

const NAME_SEEDS = [
  "Anand", "Shree Sai", "Blue Diamond", "Maharashtra", "Ganesh", "Sagar", "Udupi", "Bombay",
  "Rajdhani", "Chai Point", "Guru Kripa", "Swad", "Golden", "Sai Prasad", "Kamal", "Rameshwar",
  "Durga", "Shivaji", "Om", "Punjab", "Taj", "Krishna", "Laxmi", "Amrut", "Sarovar", "Vandana",
  "Green Leaf", "Royal", "Indrayani", "Bhagwati", "Annapurna", "Maa", "Vijay", "Sanjay",
];

const SUPPLIERS = [
  "FreshPro Produce",
  "Maharashtra Dairy Co-op",
  "Sunrise Cold Storage",
  "Pune Agro Supplies",
  "Coastal Seafood Exports",
  "SpiceLink Wholesalers",
  "GreenValley Vegetables",
  "Krishna Flour Mills",
  "Western Meat Packers",
  "Godavari Poultry",
];

  // Shared supplier pool used to seed the Supplier Network. Multiple
  // businesses reference the same supplier so the inspector view can show
  // "Used by N restaurants". A few suppliers carry realistic compliance
  // issues so the inspector "Supplier Alerts" panel has data to surface.
  const SUPPLIER_DEFS: { name: string; category: string; products: string; location: string; licence: string }[] = [
    { name: "FreshWater Co.", category: "Water", products: "Packaged drinking water, cooler refills", location: "Bhiwandi, Thane", licence: "12724002000012" },
    { name: "GreenValley Vegetables", category: "Vegetables", products: "Seasonal vegetables, leafy greens", location: "APMC Vashi Market, Navi Mumbai", licence: "12724002000023" },
    { name: "Maharashtra Dairy Co-op", category: "Dairy", products: "Milk, paneer, butter, curd", location: "Dadar, Mumbai", licence: "12724002000034" },
    { name: "Western Meat Packers", category: "Meat", products: "Chicken, mutton, processed cuts", location: "Deonar Abattoir, Mumbai", licence: "12724002000045" },
    { name: "Coastal Seafood Exports", category: "Seafood", products: "Fresh fish, prawns, frozen seafood", location: "Sassoon Dock, Mumbai", licence: "12724002000056" },
    { name: "Krishna Flour Mills", category: "Grains", products: "Wheat flour, rice, pulses, besan", location: "Sangli, Maharashtra", licence: "12724002000067" },
    { name: "SpiceLink Wholesalers", category: "Spices", products: "Whole & ground spices, masala mixes", location: "Crawford Market, Mumbai", licence: "12724002000078" },
    { name: "Beverage Distributors Hub", category: "Beverages", products: "Soft drinks, juices, syrups", location: "Kandivali, Mumbai", licence: "12724002000089" },
    { name: "PackFresh Foods", category: "Packaged Food", products: "Packaged snacks, sauces, edible oils", location: "MIDC, Thane", licence: "12724002000090" },
    { name: "Riverside Bakery Supply", category: "Packaged Food", products: "Bread, buns, bakery premixes", location: "Grant Road, Mumbai", licence: "12724002000101" },
  ];
  // Suppliers flagged with compliance issues so the inspector alerts panel
  // has real examples: missing FSSAI licence / stale deliveries.
  const MISSING_LICENCE = new Set(["Western Meat Packers", "SpiceLink Wholesalers"]);
  const STALE_DELIVERY = new Set(["GreenValley Vegetables", "Riverside Bakery Supply"]);

// Real, operating food businesses (name, category, district, address, lat, lng)
// so the demo map and lookup show actual places citizens would recognise.
const REAL_RESTAURANTS: { name: string; category: string; district: string; address: string; lat: number; lng: number }[] = [
  { name: "Britannia & Co.", category: "restaurant", district: "Mumbai", address: "16 Wakefield House, Ballard Estate, Fort, Mumbai 400001", lat: 18.9336, lng: 72.8338 },
  { name: "Bademiya", category: "restaurant", district: "Mumbai", address: "Tulloch Road, Apollo Bandar, Colaba, Mumbai 400039", lat: 18.9139, lng: 72.8311 },
  { name: "Leopold Cafe", category: "restaurant", district: "Mumbai", address: "Shahid Bhagat Singh Road, Colaba Causeway, Mumbai 400001", lat: 18.9168, lng: 72.8319 },
  { name: "Kyani & Co.", category: "bakery", district: "Mumbai", address: "Jer Mahal, Dhobi Talao, Mumbai 400002", lat: 18.9495, lng: 72.8298 },
  { name: "Trishna", category: "restaurant", district: "Mumbai", address: "Rustom Sidhwa Marg, Kalaghoda, Mumbai 400001", lat: 18.9278, lng: 72.8314 },
  { name: "Mahesh Lunch Home", category: "restaurant", district: "Mumbai", address: "8-B, Cawasji Patel Street, Fort, Mumbai 400001", lat: 18.9341, lng: 72.8335 },
  { name: "Gajalee", category: "restaurant", district: "Mumbai", address: "Link Road, Vile Parle West, Mumbai 400056", lat: 19.1023, lng: 72.8259 },
  { name: "K. Rustom Ice Cream", category: "packaged_retail", district: "Mumbai", address: "Jeroo Building, M. G. Road, Churchgate, Mumbai 400020", lat: 18.9281, lng: 72.8273 },
  { name: "Sardar Pav Bhaji", category: "street_vendor", district: "Mumbai", address: "48-B, Tardeo Road, Mumbai 400007", lat: 18.9712, lng: 72.8152 },
  { name: "Guru Kripa", category: "restaurant", district: "Mumbai", address: "Subhash Chandra Bose Marg, Sion, Mumbai 400022", lat: 19.0419, lng: 72.8581 },
  { name: "Cafe Mysore", category: "restaurant", district: "Mumbai", address: "Dr. Ambedkar Road, Matunga East, Mumbai 400019", lat: 19.0262, lng: 72.8512 },
  { name: "Aaram Vada Pav", category: "street_vendor", district: "Mumbai", address: "Opposite CST Station, Fort, Mumbai 400001", lat: 18.9401, lng: 72.834 },
  { name: "Louis Burgers", category: "restaurant", district: "Mumbai", address: "Wodehouse Road, Colaba, Mumbai 400005", lat: 18.9123, lng: 72.8298 },
  { name: "Jimi's Burger", category: "restaurant", district: "Mumbai", address: "Linking Road, Bandra West, Mumbai 400050", lat: 19.0597, lng: 72.8297 },
  { name: "Elco Popsicle", category: "packaged_retail", district: "Mumbai", address: "Hill Road, Bandra West, Mumbai 400050", lat: 19.0555, lng: 72.828 },
  { name: "Candies", category: "restaurant", district: "Mumbai", address: "Pali Hill, Bandra West, Mumbai 400050", lat: 19.0605, lng: 72.8253 },
  { name: "Gulshan-e-Iran", category: "bakery", district: "Mumbai", address: "Linking Road, Bandra West, Mumbai 400050", lat: 19.0603, lng: 72.8306 },
  { name: "Vaishali", category: "restaurant", district: "Pune", address: "Fergusson College Road, Shivajinagar, Pune 411004", lat: 18.524, lng: 73.8377 },
  { name: "Marz-O-Rin", category: "bakery", district: "Pune", address: "1A, Moledina Road, Camp, Pune 411001", lat: 18.512, lng: 73.8767 },
  { name: "Cafe Goodluck", category: "restaurant", district: "Pune", address: "Fergusson College Road, Shivajinagar, Pune 411004", lat: 18.5236, lng: 73.8379 },
  { name: "Haldiram's", category: "restaurant", district: "Nagpur", address: "Sitabuldi Main Road, Nagpur 440012", lat: 21.1515, lng: 79.0837 },
  { name: "Tarri Poha Center", category: "street_vendor", district: "Nagpur", address: "Near SFS School, Fetri, Nagpur 440030", lat: 21.0968, lng: 79.0156 },
  { name: "Hotel Trikal", category: "restaurant", district: "Nashik", address: "College Road, Nashik 422005", lat: 20.007, lng: 73.786 },
  { name: "Sadhana Misal", category: "street_vendor", district: "Nashik", address: "Sharanpur Road, Nashik 422002", lat: 20.005, lng: 73.79 },
];

const VIOLATION_TYPES = ["expired_stock", "pest_control", "temperature", "licensing", "hygiene", "food_handling", "water_quality", "labeling", "adulteration"];

// Deterministic PRNG so reseeding gives identical data.
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260805);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const range = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const DAY_MS = 24 * 3600 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);
const daysAhead = (days: number) => new Date(Date.now() + days * DAY_MS);

/**
 * Complaint categories carry a service-level target. Targets are policy
 * values used for SLA reporting, not estimates produced by a model.
 */
const COMPLAINT_TYPES: { type: string; slaDays: number }[] = [
  { type: "hygiene", slaDays: 7 },
  { type: "expired_stock", slaDays: 5 },
  { type: "temperature", slaDays: 5 },
  { type: "food_poisoning", slaDays: 3 },
  { type: "adulteration", slaDays: 3 },
  { type: "pest", slaDays: 5 },
  { type: "licensing", slaDays: 10 },
  { type: "labeling", slaDays: 7 },
];

/** Existing statuses constrain how old a complaint must be to be plausible. */
const STATUS_AGE_RANGE: Record<string, [number, number]> = {
  submitted: [0, 14],
  under_review: [3, 35],
  inspection_scheduled: [6, 60],
  resolved: [14, 240],
};

interface ComplaintLifecycle {
  assignedAt: Date | null;
  investigationStartedAt: Date | null;
  inspectionAt: Date | null;
  resolvedAt: Date | null;
}

function complaintLifecycle(
  status: string,
  createdAt: Date,
  slaDays: number,
  late: boolean
): ComplaintLifecycle {
  const ageDays = (Date.now() - createdAt.getTime()) / DAY_MS;
  if (status === "submitted") {
    return {
      assignedAt: null,
      investigationStartedAt: null,
      inspectionAt: null,
      resolvedAt: null,
    };
  }
  const assignedAt = new Date(
    createdAt.getTime() + Math.min(0.5, Math.max(0.1, ageDays * 0.05)) * DAY_MS
  );
  const investigationStartedAt = new Date(
    assignedAt.getTime() + Math.min(0.8, Math.max(0.2, ageDays * 0.05)) * DAY_MS
  );
  let inspectionAt: Date | null = null;
  if (status === "inspection_scheduled" || status === "resolved") {
    inspectionAt = new Date(
      investigationStartedAt.getTime() + Math.min(1.5, Math.max(0.4, ageDays * 0.08)) * DAY_MS
    );
  }
  let resolvedAt: Date | null = null;
  if (status === "resolved") {
    const targetDays = late ? slaDays + range(1, 3) : Math.max(1, range(1, slaDays));
    const maxDays = Math.max(1, ageDays - 0.3);
    const actualDays = Math.min(targetDays, maxDays);
    resolvedAt = new Date(createdAt.getTime() + actualDays * DAY_MS);
    if (inspectionAt && inspectionAt >= resolvedAt) {
      inspectionAt = new Date(resolvedAt.getTime() - 0.2 * DAY_MS);
    }
  }
  return { assignedAt, investigationStartedAt, inspectionAt, resolvedAt };
}

const CHECKLIST_DEF: { key: string; label: string }[] = [
  { key: "hygiene", label: "General hygiene & cleanliness" },
  { key: "storage_temperature", label: "Storage temperature control" },
  { key: "licensing", label: "Valid FSSAI license displayed" },
  { key: "pest_control", label: "Pest control measures in place" },
  { key: "expiry_dates", label: "No expired / stale stock" },
  { key: "staff_hygiene", label: "Staff hygiene (gloves, headgear)" },
  { key: "food_handling", label: "Safe food handling & separation" },
  { key: "water_quality", label: "Potable water supply" },
  { key: "waste_management", label: "Waste management & disposal" },
  { key: "allergen_management", label: "Allergen labeling & management" },
];

const VIOLATION_TO_CHECKLIST: Record<string, string[]> = {
  expired_stock: ["expiry_dates"],
  pest_control: ["pest_control"],
  temperature: ["storage_temperature"],
  licensing: ["licensing"],
  hygiene: ["hygiene", "staff_hygiene", "waste_management"],
  food_handling: ["food_handling"],
  water_quality: ["water_quality"],
  labeling: ["allergen_management"],
  adulteration: ["expiry_dates", "allergen_management"],
};

const PHOTOS = ["/uploads/photo-kitchen.svg", "/uploads/photo-storage.svg", "/uploads/photo-stall.svg", "/uploads/photo-packaging.svg"];

function makeChecklist(
  violations: string[]
): { key: string; label: string; passed: boolean; notes: string }[] {
  const failed = new Set(violations.flatMap((v) => VIOLATION_TO_CHECKLIST[v] ?? []));
  return CHECKLIST_DEF.map((item) => ({
    key: item.key,
    label: item.label,
    passed: !failed.has(item.key),
    notes: failed.has(item.key)
      ? pick(["Observed non-compliance", "Minor lapses noted", "Repeat finding", "Needs corrective action"])
      : "Compliant",
  }));
}

function severityRoll(r: number): string {
  if (r < 0.12) return "critical";
  if (r < 0.4) return "high";
  if (r < 0.8) return "medium";
  return "low";
}

async function main() {
  console.log("Resetting database...");
  await prisma.riskSnapshot.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.violation.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.document.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  // ---- Users ----
  await prisma.user.create({
    data: { name: "Anita Deshmukh", email: "officer@demo.in", password: "demo1234", role: "food_officer", district: "Maharashtra" },
  });  const officer1 = await prisma.user.create({
    data: { name: "Rahul Patil", email: "inspector@demo.in", password: "demo1234", role: "food_officer", district: "Mumbai" },
  });
  const officer2 = await prisma.user.create({
    data: { name: "Sneha Kulkarni", email: "inspector.pune@demo.in", password: "demo1234", role: "food_officer", district: "Pune" },
  });
  const officer3 = await prisma.user.create({
    data: { name: "Vikram Rao", email: "inspector.nagpur@demo.in", password: "demo1234", role: "food_officer", district: "Nagpur" },
  });
  const demoCitizen = await prisma.user.create({
    data: { name: "Meera Joshi", email: "citizen@demo.in", password: "demo1234", role: "citizen", district: "Mumbai" },
  });
  const citizens: User[] = [];
  for (const nm of ["Arnav Patel", "Sana Sheikh", "Kunal Desai", "Ritika Verma", "Aditya Kumar"]) {
    citizens.push(
      await prisma.user.create({
        data: { name: nm, email: `${nm.split(" ")[0].toLowerCase()}${citizens.length + 1}@citizen.in`, password: "demo1234", role: "citizen" },
      })
    );
  }
  const demoOwner = await prisma.user.create({
    data: { name: "Rajesh Sharma", email: "owner@demo.in", password: "demo1234", role: "business_owner", district: "Mumbai" },
  });

  const officers = [officer1, officer2, officer3];
  const owners: User[] = [demoOwner];
  const OWNER_NAMES = [
    "Suresh Iyer", "Farida Khan", "Manish Gupta", "Deepa Nair", "Arjun Singh",
    "Pooja Reddy", "Imran Shaikh", "Ganesh Bapat", "Kavita Menon", "Sunil Jadhav",
    "Rohit Verma", "Nisha Pillai",
  ];
  for (const nm of OWNER_NAMES) {
    owners.push(
      await prisma.user.create({
        data: { name: nm, email: `${nm.split(" ")[0].toLowerCase()}${owners.length}@business.in`, password: "demo1234", role: "business_owner" },
      })
    );
  }

  // ---- Businesses ----
  const businesses: { biz: Business; category: string; riskProfile: number }[] = [];

  // Real restaurants first (real names, addresses, coordinates).
  let serial = 100001;
  for (const r of REAL_RESTAURANTS) {
    const owner = owners[Math.floor(rng() * owners.length)];
    const riskProfile = rng();
    const biz = await prisma.business.create({
      data: {
        name: r.name,
        category: r.category,
        licenseNumber: `12724002${String(serial++).padStart(6, "0")}`,
        address: r.address,
        district: r.district,
        lat: r.lat + (rng() - 0.5) * 0.004,
        lng: r.lng + (rng() - 0.5) * 0.004,
        supplier: rng() < 0.6 ? pick(SUPPLIERS) : null,
        ownerId: owner.id,
        status: riskProfile > 0.94 ? "suspended" : "active",
        registeredAt: daysAgo(range(120, 2400)),
      },
    });
    businesses.push({ biz, category: r.category, riskProfile });
  }

  // Generated businesses round out the remaining districts.
  let templateIdx = 0;
  for (const dist of DISTRICTS) {
    const count = dist.name === "Mumbai" ? 6 : dist.name === "Pune" ? 6 : dist.name === "Thane" ? 7 : dist.name === "Navi Mumbai" ? 6 : dist.name === "Nashik" ? 3 : 4;
    for (let i = 0; i < count; i++) {
      const category = pick(CATEGORIES);
      const tpl = NAME_TEMPLATES[templateIdx % NAME_TEMPLATES.length];
      templateIdx++;
      const name = tpl.replace("{x}", pick(NAME_SEEDS) + (rng() > 0.5 ? ` ${pick(["Inn", "House", "Express", "Supreme", "Corner"])}` : ""));
      const lat = dist.center[0] + (rng() - 0.5) * 0.12;
      const lng = dist.center[1] + (rng() - 0.5) * 0.14;
      const owner = owners[Math.floor(rng() * owners.length)];
      const hasSupplier = rng() < 0.65;
      const riskProfile = rng();
      const biz = await prisma.business.create({
        data: {
          name,
          category,
          licenseNumber: `12724002${String(serial++).padStart(6, "0")}`,
          address: `${range(1, 400)}, ${pick(["MG Road", "Station Road", "Linking Road", "Market Chowk", "MIDC Area", "Main Bazaar"])}, ${dist.name}`,
          district: dist.name,
          lat,
          lng,
          supplier: hasSupplier ? pick(SUPPLIERS) : null,
          ownerId: owner.id,
          status: riskProfile > 0.94 ? "suspended" : "active",
          registeredAt: daysAgo(range(60, 1100)),
        },
      });
      businesses.push({ biz, category, riskProfile });
    }
  }

  console.log(`Created ${businesses.length} businesses.`);

  // ---- Suppliers ----
  let supplierCount = 0;
  for (const { biz } of businesses) {
    const n = range(2, 5);
    const chosen = new Map<string, typeof SUPPLIER_DEFS[number]>();
    for (let s = 0; s < n && chosen.size < SUPPLIER_DEFS.length; s++) {
      const def = pick(SUPPLIER_DEFS);
      chosen.set(def.name, def);
    }
    for (const def of chosen.values()) {
      const missingLicence = MISSING_LICENCE.has(def.name);
      const stale = STALE_DELIVERY.has(def.name);
      await prisma.supplier.create({
        data: {
          businessId: biz.id,
          name: def.name,
          category: def.category,
          products: def.products,
          location: def.location,
          licenceNumber: missingLicence ? null : def.licence,
          lastDeliveryAt: stale ? daysAgo(range(45, 150)) : daysAgo(range(0, 30)),
        },
      });
      supplierCount++;
    }
  }
  console.log(`Created ${supplierCount} suppliers.`);

  // ---- Documents ----
  for (const { biz, riskProfile } of businesses) {
    const isHotspot = riskProfile > 0.8;
    const nDocs = isHotspot ? 2 : range(0, 2);
    const expiredChance = riskProfile < 0.4 ? 0.12 : riskProfile < 0.75 ? 0.28 : 0.55;
    for (let d = 0; d < nDocs; d++) {
      const type = pick(["license", "lab_certificate", "health_certificate"]);
      await prisma.document.create({
        data: {
          businessId: biz.id,
          type,
          fileUrl: `/uploads/doc-${type}.svg`,
          uploadedAt: daysAgo(range(10, 300)),
          expiresAt: rng() < expiredChance ? daysAgo(range(1, 60)) : daysAhead(range(30, 500)),
        },
      });
    }
  }

  // ---- Inspections + Violations ----
  const inspectionNotes = [
    "Overall compliance adequate, minor hygiene lapses.",
    "Refrigeration units running above safe limits.",
    "Found expired stock on open shelves. Immediate disposal advised.",
    "No visible pest control records.",
    "License displayed, staff trained. Good compliance.",
    "Raw and cooked items stored in same fridge.",
    "Water quality test certificates unavailable.",
    "Repeat finding — temperature logs not maintained.",
    "Kitchen in clean condition. Satisfactory.",
  ];

  let createdInspections = 0;
  for (const { biz, riskProfile } of businesses) {
    const intent = riskProfile;
    const isHotspot = intent > 0.8;
    const nInsp = intent < 0.3 ? 1 : intent < 0.7 ? range(1, 2) : isHotspot ? 3 : range(2, 3);

    const hotspotPlans: { age: number; vtypes: string[]; severities: string[] }[] = [
      { age: 700, vtypes: ["temperature", "pest_control"], severities: ["high", "medium"] },
      { age: 210, vtypes: ["expired_stock", "hygiene", "temperature"], severities: ["critical", "medium", "high"] },
      { age: 30, vtypes: ["expired_stock", "adulteration", "pest_control", "temperature"], severities: ["critical", "critical", "high", "high"] },
    ];

    for (let idx = 0; idx < nInsp; idx++) {
      const officer = officers[Math.floor(rng() * officers.length)];
      const plan = isHotspot ? hotspotPlans[idx] : null;
      const completed = isHotspot ? true : rng() < 0.85;
      const scheduledAt = plan ? daysAgo(plan.age) : daysAgo(range(10, 400));

      let violationTypes: string[] = [];
      let violationData: { type: string; severity: string; description: string }[] = [];
      if (plan) {
        violationData = plan.vtypes.map((t, i) => ({
          type: t,
          severity: plan.severities[i] ?? severityRoll(rng()),
          description: pick([
            `${t.replace(/_/g, " ")} — observed during inspection`,
            `Repeat finding on ${t.replace(/_/g, " ")}`,
            `Non-compliance on ${t.replace(/_/g, " ")}`,
          ]),
        }));
        violationTypes = plan.vtypes;
      } else {
        const violationCount =
          intent < 0.3 ? 0 : intent < 0.55 ? range(0, 1) : intent < 0.8 ? range(1, 2) : range(2, 4);
        for (let v = 0; v < violationCount; v++) {
          const t = pick(VIOLATION_TYPES);
          if (!violationTypes.includes(t)) violationTypes.push(t);
        }
        const r = intent > 0.75 ? rng() * 0.75 : rng();
        violationData = violationTypes.map((t) => ({
          type: t,
          severity: severityRoll(r),
          description: pick([
            `${t.replace(/_/g, " ")} — observed during inspection`,
            `Repeat finding on ${t.replace(/_/g, " ")}`,
            `Non-compliance on ${t.replace(/_/g, " ")}`,
          ]),
        }));
      }

      const insp = await prisma.inspection.create({
        data: {
          businessId: biz.id,
          officerId: officer.id,
          scheduledAt,
          completedAt: completed ? (plan ? daysAgo(plan.age) : daysAgo(range(5, 390))) : null,
          checklist: makeChecklist(violationTypes),
          notes: violationData.length ? pick(inspectionNotes) : "Fully compliant inspection.",
          photos: rng() < 0.6 ? JSON.stringify([pick(PHOTOS), pick(PHOTOS)]) : JSON.stringify([pick(PHOTOS)]),
          status: completed ? "completed" : rng() < 0.4 ? "missed" : "scheduled",
        },
      });
      for (const v of violationData) {
        await prisma.violation.create({
          data: {
            inspectionId: insp.id,
            type: v.type,
            severity: v.severity,
            description: v.description,
          },
        });
      }
      createdInspections++;
    }
  }
  console.log(`Created ${createdInspections} inspections.`);

  // ---- Complaints ----
  const complaintTemplates: { type: string; description: string }[] = [
    { type: "hygiene", description: "Found a hair in my food while dining. Concerned about hygiene practices." },
    { type: "expired_stock", description: "The packaged snack I bought had expired date clearly visible. Tasted stale." },
    { type: "food_poisoning", description: "Served undercooked chicken — worried about food poisoning." },
    { type: "hygiene", description: "Kitchen area visible from counter looked dirty with no staff wearing gloves." },
    { type: "temperature", description: "Strong chemical smell in the storage area behind the shop." },
    { type: "adulteration", description: "Suspected adulteration in the milk products purchased last week." },
    { type: "pest", description: "Rats seen near the food storage entrance." },
    { type: "temperature", description: "Cold items served lukewarm — refrigeration may be broken." },
    { type: "licensing", description: "No FSSAI license displayed at the premises." },
    { type: "food_poisoning", description: "Complaint of stomach upset after eating here; suspect stale ingredients." },
    { type: "labeling", description: "Allergen information missing from the packaged item label." },
    { type: "hygiene", description: "Staff handling food without washing hands after clearing tables." },
  ];
  const complaintStatusPool = [
    "submitted",
    "under_review",
    "inspection_scheduled",
    "resolved",
    "under_review",
    "resolved",
    "inspection_scheduled",
  ];

  function complaintData(
    biz: { id: string; address: string; district: string; lat: number; lng: number } | null,
    status: string,
    opts: {
      citizenId?: string | null;
      anonymous?: boolean;
      withPhoto?: boolean;
      createdAt?: Date;
      typeDef?: { type: string; slaDays: number };
      assignedOfficerId?: string | null;
      resolvedAtOverride?: Date | null;
    } = {}
  ) {
    const template = pick(complaintTemplates);
    const typeDef =
      opts.typeDef ??
      COMPLAINT_TYPES.find((t) => t.type === template.type) ??
      COMPLAINT_TYPES[0];
    const age = STATUS_AGE_RANGE[status] ?? [0, 30];
    const createdAt = opts.createdAt ?? daysAgo(range(age[0], age[1]));
    const lifecycle = complaintLifecycle(status, createdAt, typeDef.slaDays, rng() < 0.22);
    const anonymous = opts.anonymous ?? rng() < 0.3;
    const assignedOfficerId =
      status === "submitted"
        ? null
        : opts.assignedOfficerId ?? officers[Math.floor(rng() * officers.length)].id;
    return {
      businessId: biz?.id ?? null,
      citizenId: anonymous
        ? null
        : opts.citizenId ?? citizens[Math.floor(rng() * citizens.length)].id,
      assignedOfficerId,
      anonymous,
      description: template.description,
      type: typeDef.type,
      photos: opts.withPhoto || rng() < 0.4 ? JSON.stringify([pick(PHOTOS)]) : "[]",
      status,
      createdAt,
      ...lifecycle,
      resolvedAt:
        opts.resolvedAtOverride !== undefined
          ? opts.resolvedAtOverride
          : lifecycle.resolvedAt,
      slaDays: typeDef.slaDays,
      address: biz?.address ?? null,
      district: biz?.district ?? pick(DISTRICTS).name,
      lat: anonymous ? null : biz ? biz.lat + (rng() - 0.5) * 0.02 : null,
      lng: anonymous ? null : biz ? biz.lng + (rng() - 0.5) * 0.02 : null,
    };
  }

  const hotspots = businesses.filter(({ riskProfile }) => riskProfile > 0.8);
  const weightedTargets = businesses.flatMap(({ biz, riskProfile }) => {
    const copies = riskProfile < 0.4 ? 1 : riskProfile < 0.75 ? 2 : 4;
    return Array.from({ length: copies }, () => biz);
  });

  for (let i = 0; i < 28; i++) {
    const status = pick(complaintStatusPool);
    const biz = rng() < 0.9 ? pick(weightedTargets) : null;
    await prisma.complaint.create({
      data: complaintData(biz, status, { withPhoto: rng() < 0.45 }),
    });
  }

  // Archived resolved complaints keep the previous-period comparison meaningful.
  for (let i = 0; i < 24; i++) {
    const biz = pick(weightedTargets);
    await prisma.complaint.create({
      data: complaintData(biz, "resolved", {
        createdAt: daysAgo(range(95, 330)),
        withPhoto: rng() < 0.3,
      }),
    });
  }

  // Hotspot businesses carry multiple, mostly-substantiated complaints.
  const hotspotStatuses = ["under_review", "inspection_scheduled", "resolved", "resolved", "submitted"];
  for (const { biz } of hotspots) {
    const n = range(2, 4);
    for (let c = 0; c < n; c++) {
      await prisma.complaint.create({
        data: complaintData(biz, pick(hotspotStatuses), { withPhoto: rng() < 0.5 }),
      });
    }
  }

  const demoComplaintBusiness = businesses.find(({ riskProfile }) => riskProfile > 0.8)?.biz ?? null;
  await prisma.complaint.create({
    data: complaintData(demoComplaintBusiness, "under_review", {
      citizenId: demoCitizen.id,
      anonymous: false,
      withPhoto: true,
      createdAt: daysAgo(2),
    }),
  });

  // ---- Deliberate data-quality edge cases ---------------------------------
  // These are real records in the demo database so the Data Quality workspace
  // has findings to show. Normal anonymous complaints are NOT flagged: only
  // contradictory anonymity data (anonymous flag + citizen identity) is.
  const anomalyBusiness = demoComplaintBusiness ?? businesses[0].biz;
  const conflictingAnonymity = complaintData(anomalyBusiness, "under_review", {
    anonymous: true,
    createdAt: daysAgo(4),
  });
  await prisma.complaint.create({
    data: { ...conflictingAnonymity, citizenId: demoCitizen.id },
  });

  const missingResolution = complaintData(anomalyBusiness, "resolved", {
    createdAt: daysAgo(20),
  });
  await prisma.complaint.create({
    data: { ...missingResolution, resolvedAt: null },
  });

  const negativeResolution = complaintData(anomalyBusiness, "resolved", {
    createdAt: daysAgo(30),
  });
  await prisma.complaint.create({
    data: { ...negativeResolution, resolvedAt: daysAgo(32) },
  });

  console.log("Complaints created.");

  // ---- Deliberate integrity issues for the Data Quality workspace --------
  const anomalyInspection = await prisma.inspection.findFirst({
    where: { status: "completed" },
    orderBy: { scheduledAt: "desc" },
    select: { id: true, scheduledAt: true },
  });
  if (anomalyInspection) {
    await prisma.inspection.update({
      where: { id: anomalyInspection.id },
      data: {
        completedAt: new Date(anomalyInspection.scheduledAt.getTime() - 2 * DAY_MS),
      },
    });
  }

  const licenceRows = await prisma.business.findMany({
    select: { id: true, licenseNumber: true },
    orderBy: { registeredAt: "asc" },
    take: 2,
  });
  if (licenceRows.length === 2) {
    await prisma.business.update({
      where: { id: licenceRows[1].id },
      data: { licenseNumber: licenceRows[0].licenseNumber },
    });
  }

  // ---- Compute risk scores from actual data (transparent scoring) ----
  const allBusinesses = await prisma.business.findMany({ include: { inspections: { include: { violations: true } }, complaints: true, documents: true } });
  for (const b of allBusinesses) {
    const r = calculateRiskScore(b);
    await prisma.business.update({
      where: { id: b.id },
      data: { riskScore: r.score, riskTier: r.tier },
    });
  }

  // ---- Point-in-time risk snapshots --------------------------------------
  // Six monthly snapshots make period-over-period risk KPIs genuinely
  // historical rather than reconstructed from today's scores.
  const now = new Date();
  const snapshotRows: {
    businessId: string;
    score: number;
    tier: string;
    factors: Record<string, number>;
    snapshotAt: Date;
  }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const asOf =
      offset === 0
        ? now
        : new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 0, 23, 59, 59)
          );
    for (const b of allBusinesses) {
      if (b.registeredAt > asOf) continue;
      const r = calculateRiskScore(b, asOf);
      snapshotRows.push({
        businessId: b.id,
        score: r.score,
        tier: r.tier,
        factors: r.factors,
        snapshotAt: asOf,
      });
    }
  }
  await prisma.riskSnapshot.createMany({ data: snapshotRows });
  console.log(`Created ${snapshotRows.length} risk snapshots.`);

  const tierCounts = allBusinesses.reduce<Record<string, number>>((acc, b) => {
    const t = scoreToTier(calculateRiskScore(b).score);
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Risk tier distribution:", tierCounts);
  console.log("Seed complete.");
}

function scoreToTier(s: number): string {
  if (s <= 25) return "A";
  if (s <= 50) return "B";
  if (s <= 75) return "C";
  return "D";
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
