import * as React from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  DocumentData,
  runTransaction,
  doc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { sendBookingEmail } from "@/lib/email";

type Booking = {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  name: string;
  phone: string;
  email?: string;
  service?: string;
  price?: string;
  status: "booked" | "cancelled" | "completed" | string;
  slotId?: string; // "YYYY-MM-DD_HHmm"
  createdAt?: any;
};

type SettingsDoc = {
  slotDuration: number; // 30/60/90…
  monFriOpen: string;
  monFriClose: string;
  satOpen: string;
  satClose: string;
  sunClosed: boolean;
  sunOpen?: string;
  sunClose?: string;
};

// ---------- date helpers (local) ----------
const pad2 = (n: number) => n.toString().padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayLocalStr = () => ymd(new Date());

// Monday–Sunday week
const startOfThisWeek = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7; // Mon=0
  d.setDate(d.getDate() - diffToMon);
  return ymd(d);
};
const endOfThisWeek = () => {
  const d = new Date();
  const day = d.getDay();
  const diffToSun = 7 - ((day + 6) % 7) - 1;
  d.setDate(d.getDate() + diffToSun);
  return ymd(d);
};
const startOfThisMonth = () => {
  const d = new Date();
  d.setDate(1);
  return ymd(d);
};
const endOfThisMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0); // last day of current month
  return ymd(d);
};

// ---------- time helpers ----------
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (mins: number) => {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};
const compact = (hhmm: string) => hhmm.replace(":", ""); // "09:30" -> "0930"

// ---------- settings hook ----------
function useSettings(): SettingsDoc | null {
  const [settings, setSettings] = React.useState<SettingsDoc | null>(null);
  React.useEffect(() => {
    const ref = doc(db, "settings", "default");
    getDoc(ref).then((snap) => {
      if (snap.exists()) setSettings(snap.data() as SettingsDoc);
    });
  }, []);
  return settings;
}

type RangeFilter = "today" | "week" | "month" | "past" | "all";

export default function BookingsPage() {
  const [bookings, setBookings] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState<RangeFilter>("week");
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // edit modal state
  const settings = useSettings();
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<{
    name: string;
    phone: string;
    email: string;
    service: string;
    date: string;
    time: string;
    price: string;
  }>({
    name: "",
    phone: "",
    email: "",
    service: "",
    date: "",
    time: "",
    price: "",
  });

  const [times, setTimes] = React.useState<string[]>([]);
  const [takenTimes, setTakenTimes] = React.useState<Set<string>>(new Set());

  // ---------- range query subscription ----------
  React.useEffect(() => {
    setLoading(true);
    const base = collection(db, "bookings");

    let qRef: any;
    if (range === "today") {
      const t = todayLocalStr();
      qRef = query(base, where("date", "==", t), orderBy("time", "asc"));
    } else if (range === "week") {
      const start = startOfThisWeek();
      const end = endOfThisWeek();
      qRef = query(
        base,
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "asc"),
        orderBy("time", "asc")
      );
    } else if (range === "month") {
      const start = startOfThisMonth();
      const end = endOfThisMonth();
      qRef = query(
        base,
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "asc"),
        orderBy("time", "asc")
      );
    } else if (range === "past") {
      const t = todayLocalStr();
      qRef = query(
        base,
        where("date", "<", t),
        orderBy("date", "desc"),
        orderBy("time", "desc")
      );
    } else {
      // "all"
      qRef = query(base, orderBy("date", "asc"), orderBy("time", "asc"));
    }

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows: Booking[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as DocumentData;
          rows.push({
            id: docSnap.id,
            date: data.date,
            time: data.time,
            name: data.name,
            phone: data.phone,
            email: data.email,
            service: data.service,
            price: data.price,
            status: data.status ?? "booked",
            slotId: data.slotId,
            createdAt: data.createdAt,
          });
        });
        setBookings(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load bookings:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [range]);

  // ---------- times from settings ----------
  const generateTimesForDate = React.useCallback(
    (dateStr: string) => {
      if (!settings || !dateStr) return [];
      const d = new Date(dateStr + "T00:00:00");
      const day = d.getDay(); // 0=Sun .. 6=Sat
      let open = "";
      let close = "";

      if (day === 0) {
        if (settings.sunClosed) return [];
        open = settings.sunOpen || "";
        close = settings.sunClose || "";
      } else if (day >= 1 && day <= 5) {
        open = settings.monFriOpen;
        close = settings.monFriClose;
      } else if (day === 6) {
        open = settings.satOpen;
        close = settings.satClose;
      }

      if (!open || !close) return [];
      const out: string[] = [];
      const step = settings.slotDuration;
      for (let t = toMinutes(open); t + step <= toMinutes(close); t += step) {
        out.push(fromMinutes(t));
      }
      return out;
    },
    [settings]
  );

  // when editForm.date changes, update candidates & taken (live)
  React.useEffect(() => {
    if (!editId || !editForm.date || !settings) {
      setTimes([]);
      setTakenTimes(new Set());
      return;
    }
    const candidates = generateTimesForDate(editForm.date);
    setTimes(candidates);

    // live taken slots for selected date
    const qSlots = query(
      collection(db, "slots"),
      where("date", "==", editForm.date),
      where("booked", "==", true)
    );
    const unsub = onSnapshot(
      qSlots,
      (snap) => {
        const taken = new Set<string>();
        snap.forEach((s) => {
          const data = s.data() as {
            time?: string;
            booked?: boolean;
            bookingId?: string;
          };
          // exclude the time owned by the booking we're editing
          if (data.booked && data.time && data.bookingId !== editId) {
            taken.add(data.time);
          }
        });
        setTakenTimes(taken);

        // if currently selected time became invalid/taken, clear it
        if (
          editForm.time &&
          (taken.has(editForm.time) || !candidates.includes(editForm.time))
        ) {
          setEditForm((f) => ({ ...f, time: "" }));
        }
      },
      (err) => console.error("Edit listener error:", err)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, editForm.date, settings, generateTimesForDate]);

  // ---------- actions ----------
  const cancelBooking = async (b: Booking) => {
    if (!b.slotId) {
      alert("Missing slotId on this booking.");
      return;
    }
    if (!confirm(`Cancel booking for ${b.name} on ${b.date} ${b.time}?`))
      return;

    setBusyId(b.id);
    try {
      await runTransaction(db, async (tx) => {
        const bookingRef = doc(db, "bookings", b.id);
        const bookingSnap = await tx.get(bookingRef);
        if (!bookingSnap.exists()) throw new Error("Booking not found.");
        const data = bookingSnap.data() as Booking;
        if (data.status !== "booked")
          throw new Error("Only booked items can be cancelled.");

        const slotRef = doc(db, "slots", b.slotId!);
        tx.delete(slotRef); // simplest: delete the lock doc
        tx.set(
          bookingRef,
          { status: "cancelled", updatedAt: serverTimestamp() },
          { merge: true }
        );
      });
      // fire-and-forget cancellation email
      sendBookingEmail("booking.cancelled", {
        name: b.name,
        email: b.email,
        phone: b.phone,
        service: b.service,
        price: b.price,
        date: b.date,
        time: b.time,
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to cancel.");
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (b: Booking) => {
    setEditId(b.id);
    setEditForm({
      name: b.name || "",
      phone: b.phone || "",
      email: b.email || "",
      service: b.service || "",
      date: b.date,
      time: b.time,
      price: b.price || "",
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    const original = bookings.find((x) => x.id === editId);
    if (!original) return;

    const dateChanged = original.date !== editForm.date;
    const timeChanged = original.time !== editForm.time;
    const moveSlot = dateChanged || timeChanged;

    // basic validation
    if (!editForm.name || !editForm.phone || !editForm.email) {
      alert("Name, phone, and email are required.");
      return;
    }
    if (!editForm.date || !editForm.time) {
      alert("Pick date and time.");
      return;
    }

    setBusyId(editId);
    try {
      await runTransaction(db, async (tx) => {
        const bookingRef = doc(db, "bookings", editId);
        const bookingSnap = await tx.get(bookingRef);
        if (!bookingSnap.exists()) throw new Error("Booking not found.");
        const current = bookingSnap.data() as Booking;

        // allow info edits on any status; but moving slot requires booked
        if (moveSlot && current.status !== "booked") {
          throw new Error("Only 'booked' items can be rescheduled.");
        }

        let newSlotId = current.slotId;
        if (moveSlot) {
          const nextSlotId = `${editForm.date}_${compact(editForm.time)}`;

          // ensure new slot is free
          const newSlotRef = doc(db, "slots", nextSlotId);
          const newSlotSnap = await tx.get(newSlotRef);
          if (newSlotSnap.exists() && (newSlotSnap.data() as any).booked) {
            throw new Error("New time is already taken.");
          }

          // free old slot if exists
          if (current.slotId) {
            tx.delete(doc(db, "slots", current.slotId));
          }

          // lock new slot
          tx.set(newSlotRef, {
            date: editForm.date,
            time: editForm.time,
            booked: true,
            bookingId: editId,
            createdAt: serverTimestamp(),
          });

          newSlotId = nextSlotId;
        }

        // update booking doc
        tx.set(
          bookingRef,
          {
            name: editForm.name,
            phone: editForm.phone,
            email: editForm.email,
            service: editForm.service,
            price: editForm.price,
            date: editForm.date,
            time: editForm.time,
            slotId: newSlotId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
      // email depends on whether date/time changed
      const eventName =
        original.date !== editForm.date || original.time !== editForm.time
          ? "booking.rescheduled"
          : "booking.updated";

      sendBookingEmail(eventName, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        service: editForm.service,
        price: editForm.price,
        date: editForm.date,
        time: editForm.time,
      });

      setEditId(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to update.");
    } finally {
      setBusyId(null);
    }
  };

  // ---------- render ----------
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bookings</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Filter:</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeFilter)}
            className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </div>
      </header>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {/* table header */}
        <div className="grid grid-cols-[110px_80px_1fr_1fr_1fr_100px_110px_210px] gap-3 px-4 py-2 bg-gray-900 text-xs text-gray-400">
          <div>Date</div>
          <div>Time</div>
          <div>Customer</div>
          <div>Contact</div>
          <div>Service</div>
          <div>Price</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {/* table body */}
        <div className="divide-y divide-gray-800">
          {loading && (
            <div className="px-4 py-4 text-sm text-gray-400">Loading…</div>
          )}
          {!loading && bookings.length === 0 && (
            <div className="px-4 py-4 text-sm text-gray-400">
              No bookings for this range.
            </div>
          )}

          {!loading &&
            bookings.map((b) => {
              const rowBusy = busyId === b.id;
              const canCancel = b.status === "booked" && !rowBusy;
              const canEdit = !rowBusy && b.status !== "cancelled";
              return (
                <div
                  key={b.id}
                  className="grid grid-cols-[110px_80px_1fr_1fr_1fr_100px_110px_210px] gap-3 px-4 py-3 text-sm"
                >
                  <div className="text-gray-200">{b.date}</div>
                  <div className="text-gray-200">{b.time}</div>
                  <div className="text-gray-300">{b.name || "—"}</div>
                  <div className="text-gray-400">
                    <div>{b.phone || "—"}</div>
                    <div className="text-xs">{b.email || ""}</div>
                  </div>
                  <div className="text-gray-300">{b.service || "—"}</div>
                  <div className="text-gray-300">{b.price || "—"}</div>{" "}
                  {/* NEW */}
                  <div>
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-md text-xs",
                        b.status === "booked"
                          ? "bg-green-600/20 text-green-300 border border-green-700/40"
                          : b.status === "cancelled"
                            ? "bg-red-600/20 text-red-300 border border-red-700/40"
                            : "bg-gray-600/20 text-gray-300 border border-gray-700/40",
                      ].join(" ")}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100 disabled:opacity-50"
                      disabled={!canEdit}
                      onClick={() => openEdit(b)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                      disabled={!canCancel}
                      onClick={() => cancelBooking(b)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Showing <span className="font-medium">{range}</span> bookings. Updates
        in real time.
      </p>

      {/* Edit / Reschedule Modal */}
      {editId && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-950 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit booking</h3>
              <button
                className="px-2 py-1 text-sm text-gray-400 hover:text-white"
                onClick={() => setEditId(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                Name
                <input
                  className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                Phone
                <input
                  className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                Service
                <input
                  className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                  value={editForm.service}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, service: e.target.value }))
                  }
                />
              </label>

              <label className="text-sm">
                Price
                <input
                  className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="$25 / wheel"
                />
              </label>

              <label className="text-sm">
                Date
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="mt-1 w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-2 text-sm"
                />
              </label>

              {editForm.date && (
                <div className="text-sm">
                  <div className="mt-2 text-gray-300">Available times</div>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {times.length === 0 && (
                      <div className="col-span-full text-gray-400">
                        No times for this day.
                      </div>
                    )}
                    {times.map((t) => {
                      // keep original time even if taken by this same booking
                      const currentlyOwned = t === editForm.time;
                      const taken = takenTimes.has(t) && !currentlyOwned;
                      const selected = editForm.time === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={taken || busyId === editId}
                          onClick={() =>
                            setEditForm((f) => ({ ...f, time: t }))
                          }
                          className={[
                            "px-3 py-2 rounded-xl border text-sm",
                            taken
                              ? "opacity-40 cursor-not-allowed border-neutral-800 bg-neutral-900"
                              : selected
                                ? "border-red-500 bg-red-600 text-white"
                                : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
                          ].join(" ")}
                          aria-pressed={selected}
                          title={taken ? "Taken" : "Available"}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-100"
                onClick={() => setEditId(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                disabled={
                  !editForm.name ||
                  !editForm.phone ||
                  !editForm.email ||
                  !editForm.date ||
                  !editForm.time ||
                  busyId === editId
                }
                onClick={saveEdit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
