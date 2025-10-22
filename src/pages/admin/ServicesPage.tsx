import * as React from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Wrench,
  Gauge,
  Settings,
  Car,
  ShieldCheck,
  Hammer,
  Sparkles,
  Zap,
  BatteryCharging,
  LucideIcon,
} from "lucide-react";

/**
 * ─────────────────────────────────────────────────────────────
 * Admin → Services
 * - Two Firestore collections: "services", "pricing"
 * - CRUD + enable/disable + reorder (order: number)
 * - Real-time updates via onSnapshot
 * - Icon picker (fixed whitelist)
 * ─────────────────────────────────────────────────────────────
 */

type ServiceDoc = {
  id: string;
  iconKey: IconKey;
  title: string;
  desc: string;
  priceLabel: string; // the small subtitle line under each service card (e.g., "from $25 / wheel")
  active: boolean;
  order: number;
  createdAt?: any;
  updatedAt?: any;
};

type PricingDoc = {
  id: string;
  name: string; // title line, e.g., "Tire Swap (on rims)"
  price: string; // free string, e.g., "$25 / wheel"
  details: string[]; // exactly 3 bullet points (we'll enforce in UI)
  currency?: string; // "CAD" default
  active: boolean;
  order: number;
  createdAt?: any;
  updatedAt?: any;
};

// ── Icons whitelist ──────────────────────────────────────────
const ICONS = {
  Wrench,
  Gauge,
  Settings,
  Car,
  ShieldCheck,
  Hammer,
  Sparkles,
  Zap,
  BatteryCharging,
} as const;

type IconKey = keyof typeof ICONS;

const ICON_OPTIONS: IconKey[] = [
  "Wrench",
  "Gauge",
  "Settings",
  "Car",
  "ShieldCheck",
  "Hammer",
  "Sparkles",
  "Zap",
  "BatteryCharging",
];

// get icon component safely
function IconByKey({ icon, className }: { icon: IconKey; className?: string }) {
  const Cmp: LucideIcon = ICONS[icon] ?? Wrench;
  return <Cmp className={className ?? "w-4 h-4"} aria-hidden />;
}

// util: make next order (place at end)
const nextOrder = (arr: { order: number }[]) =>
  (arr.length ? Math.max(...arr.map((x) => x.order || 0)) : 0) + 1000;

// ── ServicesPage component ───────────────────────────────────
export default function ServicesPage() {
  const [loading, setLoading] = React.useState(true);

  // services
  const [services, setServices] = React.useState<ServiceDoc[]>([]);
  // pricing
  const [pricing, setPricing] = React.useState<PricingDoc[]>([]);

  // selection/edit modals
  const [editingService, setEditingService] = React.useState<ServiceDoc | null>(
    null
  );
  const [editingPricing, setEditingPricing] = React.useState<PricingDoc | null>(
    null
  );

  // subscriptions
  React.useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, "services"), orderBy("order", "asc")),
      (snap) => {
        const rows: ServiceDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<ServiceDoc, "id">;
          rows.push({ id: d.id, ...(data as any) });
        });
        setServices(rows);
        setLoading(false);
      }
    );
    const unsub2 = onSnapshot(
      query(collection(db, "pricing"), orderBy("order", "asc")),
      (snap) => {
        const rows: PricingDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<PricingDoc, "id">;
          rows.push({ id: d.id, ...(data as any) });
        });
        setPricing(rows);
      }
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // ── CRUD: Services ─────────────────────────────────────────
  const createService = async () => {
    const payload: Omit<ServiceDoc, "id"> = {
      iconKey: "Wrench",
      title: "New Service",
      desc: "Describe the service.",
      priceLabel: "from $.. / ..",
      active: true,
      order: nextOrder(services),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "services"), payload as any);
    const created: ServiceDoc = { id: ref.id, ...payload };
    setEditingService(created);
  };

  const saveService = async (docIn: ServiceDoc) => {
    const { id, ...data } = docIn;
    await setDoc(
      doc(db, "services", id),
      { ...data, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setEditingService(null);
  };

  const deleteService = async (row: ServiceDoc) => {
    if (!confirm(`Delete service: "${row.title}"?`)) return;
    await deleteDoc(doc(db, "services", row.id));
  };

  const toggleService = async (row: ServiceDoc) => {
    await updateDoc(doc(db, "services", row.id), {
      active: !row.active,
      updatedAt: serverTimestamp(),
    });
  };

  const moveService = async (id: string, dir: "up" | "down") => {
    const idx = services.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= services.length) return;

    const a = services[idx];
    const b = services[swapIdx];
    // swap order values
    await Promise.all([
      updateDoc(doc(db, "services", a.id), {
        order: b.order,
        updatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, "services", b.id), {
        order: a.order,
        updatedAt: serverTimestamp(),
      }),
    ]);
  };

  // ── CRUD: Pricing ──────────────────────────────────────────
  const createPricing = async () => {
    const payload: Omit<PricingDoc, "id"> = {
      name: "New Package",
      price: "$..",
      details: ["Point one", "Point two", "Point three"],
      currency: "CAD",
      active: true,
      order: nextOrder(pricing),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "pricing"), payload as any);
    const created: PricingDoc = { id: ref.id, ...payload };
    setEditingPricing(created);
  };

  const savePricing = async (docIn: PricingDoc) => {
    const { id, ...data } = docIn;
    // normalize details length to 3 on save
    const details = (data.details ?? []).slice(0, 3);
    while (details.length < 3) details.push("");
    await setDoc(
      doc(db, "pricing", id),
      { ...data, details, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setEditingPricing(null);
  };

  const deletePricing = async (row: PricingDoc) => {
    if (!confirm(`Delete pricing card: "${row.name}"?`)) return;
    await deleteDoc(doc(db, "pricing", row.id));
  };

  const togglePricing = async (row: PricingDoc) => {
    await updateDoc(doc(db, "pricing", row.id), {
      active: !row.active,
      updatedAt: serverTimestamp(),
    });
  };

  const movePricing = async (id: string, dir: "up" | "down") => {
    const idx = pricing.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= pricing.length) return;

    const a = pricing[idx];
    const b = pricing[swapIdx];
    await Promise.all([
      updateDoc(doc(db, "pricing", a.id), {
        order: b.order,
        updatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, "pricing", b.id), {
        order: a.order,
        updatedAt: serverTimestamp(),
      }),
    ]);
  };

  // ── Render helpers ─────────────────────────────────────────
  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
      {children}
    </div>
  );

  // ── UI ─────────────────────────────────────────────────────
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Services & Pricing</h2>
      {loading && <div className="text-sm text-gray-400">Loading…</div>}

      {/* Services Manager */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Services (What we do)</h3>
          <button
            onClick={createService}
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm"
          >
            + Add Service
          </button>
        </div>

        <div className="mt-3 divide-y divide-gray-800">
          {services.length === 0 && (
            <div className="py-3 text-sm text-gray-400">No services yet.</div>
          )}

          {services.map((s, i) => (
            <div
              key={s.id}
              className="py-3 grid grid-cols-[28px_1fr_1fr_220px_210px] gap-3 items-center"
            >
              <div className="grid place-items-center">
                <IconByKey icon={s.iconKey} className="w-4 h-4 text-red-400" />
              </div>

              <div className="truncate">
                <div className="text-gray-100 font-medium truncate">
                  {s.title || "—"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {s.desc || "—"}
                </div>
              </div>

              <div className="text-sm text-gray-400 truncate">
                {s.priceLabel || "—"}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm"
                  onClick={() => setEditingService(s)}
                >
                  Edit
                </button>
                <button
                  className={[
                    "px-2 py-1 rounded-md text-sm",
                    s.active
                      ? "bg-green-700/30 text-green-300"
                      : "bg-gray-700/40 text-gray-300",
                  ].join(" ")}
                  onClick={() => toggleService(s)}
                >
                  {s.active ? "Active" : "Disabled"}
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm disabled:opacity-40"
                  disabled={i === 0}
                  onClick={() => moveService(s.id, "up")}
                >
                  ↑
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm disabled:opacity-40"
                  disabled={i === services.length - 1}
                  onClick={() => moveService(s.id, "down")}
                >
                  ↓
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-red-700 hover:bg-red-600 text-white text-sm"
                  onClick={() => deleteService(s)}
                >
                  Delete
                </button>
              </div>

              <div className="text-xs text-gray-500 justify-self-end pr-1">
                #{s.order}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pricing Manager */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Pricing (Cards)</h3>
          <button
            onClick={createPricing}
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm"
          >
            + Add Pricing
          </button>
        </div>

        <div className="mt-3 divide-y divide-gray-800">
          {pricing.length === 0 && (
            <div className="py-3 text-sm text-gray-400">
              No pricing cards yet.
            </div>
          )}

          {pricing.map((p, i) => (
            <div
              key={p.id}
              className="py-3 grid grid-cols-[28px_1fr_1fr_220px_210px] gap-3 items-center"
            >
              {/* 1) icon spacer to match Services' first 28px column */}
              <div className="w-4 h-4" />

              {/* 2) title/details — aligns with Services col 2 */}
              <div>
                <div className="text-gray-100 font-medium truncate">
                  {p.name || "—"}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {p.details?.filter(Boolean).join(" • ") || "—"}
                </div>
              </div>

              {/* 3) price — aligns with Services' price/label column (col 3) */}
              <div className="text-gray-100 truncate">
                {p.price || "—"}{" "}
                <span className="text-xs text-gray-500">
                  {p.currency || "CAD"}
                </span>
              </div>

              {/* 4) actions — same width & column as Services */}
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm"
                  onClick={() => setEditingPricing(p)}
                >
                  Edit
                </button>
                <button
                  className={[
                    "px-2 py-1 rounded-md text-sm",
                    p.active
                      ? "bg-green-700/30 text-green-300"
                      : "bg-gray-700/40 text-gray-300",
                  ].join(" ")}
                  onClick={() => togglePricing(p)}
                >
                  {p.active ? "Active" : "Disabled"}
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm disabled:opacity-40"
                  disabled={i === 0}
                  onClick={() => movePricing(p.id, "up")}
                >
                  ↑
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm disabled:opacity-40"
                  disabled={i === pricing.length - 1}
                  onClick={() => movePricing(p.id, "down")}
                >
                  ↓
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-red-700 hover:bg-red-600 text-white text-sm"
                  onClick={() => deletePricing(p)}
                >
                  Delete
                </button>
              </div>

              {/* 5) order tag — same column as Services */}
              <div className="text-xs text-gray-500 justify-self-end pr-1">
                #{p.order}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SERVICE MODAL */}
      {editingService && (
        <EditServiceModal
          value={editingService}
          onClose={() => setEditingService(null)}
          onSave={saveService}
        />
      )}

      {/* PRICING MODAL */}
      {editingPricing && (
        <EditPricingModal
          value={editingPricing}
          onClose={() => setEditingPricing(null)}
          onSave={savePricing}
        />
      )}
    </section>
  );
}

/* ──────────────────────
 * Modals
 * ────────────────────── */

function EditServiceModal({
  value,
  onSave,
  onClose,
}: {
  value: ServiceDoc;
  onSave: (v: ServiceDoc) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = React.useState<ServiceDoc>(value);
  React.useEffect(() => setForm(value), [value]);

  const update = <K extends keyof ServiceDoc>(k: K, v: ServiceDoc[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-800 bg-gray-950 p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Edit Service</h4>
          <button
            className="px-2 py-1 text-sm text-gray-400 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            Icon
            <div className="mt-1 grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update("iconKey", key)}
                  className={[
                    "flex items-center gap-2 px-2 py-1 rounded-md border text-sm",
                    form.iconKey === key
                      ? "border-red-500 bg-red-600/20 text-red-200"
                      : "border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-600",
                  ].join(" ")}
                  title={key}
                >
                  <IconByKey icon={key} />
                  <span className="truncate">{key}</span>
                </button>
              ))}
            </div>
          </label>

          <label className="text-sm">
            Title
            <input
              className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </label>

          <label className="text-sm">
            Description
            <textarea
              className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
              rows={3}
              value={form.desc}
              onChange={(e) => update("desc", e.target.value)}
            />
          </label>

          <label className="text-sm">
            Subtitle / Price label (small line)
            <input
              className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
              value={form.priceLabel}
              onChange={(e) => update("priceLabel", e.target.value)}
              placeholder="e.g., from $25 / wheel"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            Active
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
            disabled={!form.title?.trim() || !form.desc?.trim()}
            onClick={() => onSave(form)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPricingModal({
  value,
  onSave,
  onClose,
}: {
  value: PricingDoc;
  onSave: (v: PricingDoc) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = React.useState<PricingDoc>(value);
  React.useEffect(() => setForm(value), [value]);

  const update = <K extends keyof PricingDoc>(k: K, v: PricingDoc[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const details = form.details ?? ["", "", ""];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-800 bg-gray-950 p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Edit Pricing</h4>
          <button
            className="px-2 py-1 text-sm text-gray-400 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            Title
            <input
              className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g., Tire Swap (on rims)"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Price (string)
              <input
                className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                value={form.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="$60 or $25 / wheel"
              />
            </label>
            <label className="text-sm">
              Currency
              <input
                className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                value={form.currency || "CAD"}
                onChange={(e) => update("currency", e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-2">
            <div className="text-sm text-gray-400">Bullet points (3)</div>
            {Array.from({ length: 3 }).map((_, i) => (
              <input
                key={i}
                className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                value={details[i] ?? ""}
                onChange={(e) => {
                  const copy = [...details];
                  copy[i] = e.target.value;
                  update("details", copy);
                }}
                placeholder={`Point ${i + 1}`}
              />
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            Active
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
            disabled={!form.name?.trim() || !form.price?.trim()}
            onClick={() => onSave(form)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
