import React, { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wrench,
  Car,
  Gauge,
  Settings,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Star,
  Instagram,
  ShieldCheck,
  Mail,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

/**
 * Fast Boys Garage — One‑page site (React + Tailwind)
 * v2 — polish, a11y, SEO, safer links, JSON‑LD upgrades, minor bug fixes
 *
 * ✅ What's new vs your snippet:
 *  - Robust `mailto` builder (no double subject param, safe encoding)
 *  - Derive tel/sms links from the displayed phone (one source of truth)
 *  - Safer Instagram handle parsing (no crash if URL missing)
 *  - Better a11y (labels `htmlFor`, input `id`s, buttons `type`)
 *  - Tightened semantics (nav roles, main landmark)
 *  - Expanded LocalBusiness JSON‑LD including opening hours + socials
 *  - Small visual + content nits, same look, just cleaner
 */

const site = {
  name: "Fast Boys Garage",
  tagline: "Tires • Wheels • Brakes • Alignments",
  city: "London, Ontario",
  phone: "+1 (519) 000‑0000", // TODO: replace displayed phone
  email: "hello@fastboysgarage.ca", // TODO: replace
  instagram: "https://instagram.com/fastboysgarage", // TODO: replace
  address: "(Opening soon) — London, Ontario", // TODO: replace
  hours: [
    { d: "Mon–Fri", h: "9:00am – 6:00pm" },
    { d: "Saturday", h: "10:00am – 4:00pm" },
    { d: "Sunday", h: "Closed" },
  ],
  bookingLink: "#booking", // swap to Calendly/Google Form if you have one
};

// --- helpers ---------------------------------------------------------------
const digitsOnly = (s: string) => s.match(/\d+/g)?.join("") ?? "";
const phoneDigits = digitsOnly(site.phone);
const telHref = phoneDigits ? `tel:+${phoneDigits}` : undefined;
const smsHref = phoneDigits
  ? `sms:+${phoneDigits}?&body=${encodeURIComponent(
      "Hey Fast Boys Garage, I'd like to book a service."
    )}`
  : undefined;

function buildMailto({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const qp = new URLSearchParams({ subject, body });
  return `mailto:${to}?${qp.toString()}`;
}

const services = [
  {
    icon: <Wrench className="w-6 h-6" />,
    title: "Mount & Balance",
    desc: "Pro tire mounting, balancing, and TPMS programming for a smooth ride.",
    price: "from $25 / wheel",
  },
  {
    icon: <Gauge className="w-6 h-6" />,
    title: "Seasonal Swaps",
    desc: "Swap sets fast. Storage options available — keep your hands clean.",
    price: "from $60 / set",
  },
  {
    icon: <Settings className="w-6 h-6" />,
    title: "Brakes & Minor Repairs",
    desc: "Pads, rotors, inspections, and quick fixes that keep you safe.",
    price: "quote",
  },
  {
    icon: <Car className="w-6 h-6" />,
    title: "Wheel Sales (Used/Wholesale)",
    desc: "Pre-owned and wholesale tire sourcing on request. DM for inventory.",
    price: "request",
  },
];

const faqs = [
  {
    q: "Do you offer mobile or after‑hours service?",
    a: "We can accommodate case‑by‑case. Text us your location and we'll see what's possible.",
  },
  {
    q: "What payment methods do you take?",
    a: "Debit, credit, and e‑transfer. Receipts provided for all services.",
  },
  {
    q: "Can you source specific sizes or brands?",
    a: "Yes. Tell us your size, budget, and vibe — we'll hunt the best options.",
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label={`${site.name} logo`}>
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-red-400 shadow-lg shadow-red-800/40 grid place-items-center">
          <Wrench className="w-5 h-5 text-white" aria-hidden />
        </div>
        <div className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-black/80 ring-2 ring-white/10 grid place-items-center">
          <ShieldCheck className="w-3 h-3 text-red-400" aria-hidden />
        </div>
      </div>
      <div className="leading-tight">
        <span className="block text-white font-extrabold tracking-tight text-lg">
          {site.name}
        </span>
        <span className="block text-xs text-neutral-300">{site.city}</span>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-10">
      <div className="text-xs uppercase tracking-[0.2em] text-red-400/90">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-neutral-300">{subtitle}</p>}
    </div>
  );
}

function Divider() {
  return (
    <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent my-14" />
  );
}

type SettingsDoc = {
  slotDuration: number; // 30, 60, 90…
  monFriOpen: string; // "HH:mm"
  monFriClose: string;
  satOpen: string;
  satClose: string;
  sunClosed: boolean;
  sunOpen?: string;
  sunClose?: string;
};

// time helpers
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

const Index = () => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "", // NEW
    service: "Mount & Balance",
    date: "",
  });

  const [settings, setSettings] = useState<SettingsDoc | null>(null);
  const [times, setTimes] = useState<string[]>([]); // generated for selected date
  const [takenTimes, setTakenTimes] = useState<Set<string>>(new Set()); // "HH:mm" that are booked
  const [selectedTime, setSelectedTime] = useState<string>(""); // chosen time
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "default"));
        if (snap.exists()) setSettings(snap.data() as SettingsDoc);
        else console.warn("No settings/default in Firestore yet.");
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    })();
  }, []);

  const generateTimesForDate = useCallback(
    (dateStr: string, s: SettingsDoc) => {
      if (!dateStr) return [];
      const d = new Date(dateStr + "T00:00:00");
      const day = d.getDay(); // 0 Sun ... 6 Sat

      let open = "";
      let close = "";

      if (day === 0) {
        if (s.sunClosed) return [];
        open = s.sunOpen || "";
        close = s.sunClose || "";
      } else if (day >= 1 && day <= 5) {
        open = s.monFriOpen;
        close = s.monFriClose;
      } else if (day === 6) {
        open = s.satOpen;
        close = s.satClose;
      }

      if (!open || !close) return [];

      const out: string[] = [];
      const step = s.slotDuration;
      for (let t = toMinutes(open); t + step <= toMinutes(close); t += step) {
        out.push(fromMinutes(t));
      }
      return out;
    },
    []
  );

  useEffect(() => {
    // reset when no settings/date
    if (!settings || !form.date) {
      setTimes([]);
      setTakenTimes(new Set());
      setSelectedTime("");
      return;
    }

    // 1) generate candidate times for the selected date
    const candidates = generateTimesForDate(form.date, settings);
    setTimes(candidates);
    setLoadingTimes(true);

    // 2) subscribe to taken slots in real time
    const qSlots = query(
      collection(db, "slots"),
      where("date", "==", form.date),
      where("booked", "==", true)
    );

    const unsub = onSnapshot(
      qSlots,
      (snap) => {
        const taken = new Set<string>();
        snap.forEach((s) => {
          const data = s.data() as { time?: string; booked?: boolean };
          if (data.booked && data.time) taken.add(data.time);
        });
        setTakenTimes(taken);
        setLoadingTimes(false);

        // drop selection if it became invalid
        if (
          selectedTime &&
          (taken.has(selectedTime) || !candidates.includes(selectedTime))
        ) {
          setSelectedTime("");
        }
      },
      (err) => {
        console.error("Realtime slots subscribe failed:", err);
        setLoadingTimes(false);
      }
    );

    // cleanup on date/settings change
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, settings, generateTimesForDate]);

  const mailto = useMemo(() => {
    return buildMailto({
      to: site.email,
      subject: "Service booking request",
      body: `Name: ${form.name}\nPhone: ${form.phone}\nService: ${form.service}\nPreferred date: ${form.date}\n— Sent from ${site.name} website`,
    });
  }, [form]);

  const igHandle = (() => {
    try {
      const url = new URL(site.instagram);
      return url.pathname.replace(/\//g, "").trim() || "fastboysgarage";
    } catch {
      return (
        site.instagram
          ?.replace("https://instagram.com/", "")
          .replace(/\//g, "") || "fastboysgarage"
      );
    }
  })();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top announcement */}
      <div className="relative overflow-hidden" role="banner">
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-rose-500 text-center text-xs py-2 font-medium tracking-wide">
          <span>
            🔥 Opening soon — book early spots now. Serving {site.city}.{" "}
          </span>
        </div>
      </div>

      {/* Nav */}
      <header
        className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70 bg-neutral-950/80 border-b border-neutral-900"
        role="navigation"
        aria-label="Primary"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
            <a href="#services" className="hover:text-white">
              Services
            </a>
            <a href="#pricing" className="hover:text-white">
              Pricing
            </a>
            <a href="#gallery" className="hover:text-white">
              Gallery
            </a>
            <a href="#contact" className="hover:text-white">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {telHref && (
              <a
                href={telHref}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
              >
                <Phone className="w-4 h-4" aria-hidden />{" "}
                <span className="text-sm">Call</span>
              </a>
            )}
            {smsHref && (
              <a
                href={smsHref}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold"
              >
                <MessageCircle className="w-4 h-4" aria-hidden />{" "}
                <span className="text-sm">Text us</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main id="main" role="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10" aria-hidden>
            {/* fancy backdrop */}
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-red-600/20 blur-3xl rounded-full" />
            <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-neutral-950 to-transparent" />
            <div
              className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
              style={{
                backgroundImage: `radial-gradient(1000px 400px at 50% -20%, rgba(244,63,94,0.20), transparent),
               radial-gradient(600px 240px at 10% 10%, rgba(244,63,94,0.12), transparent),
               radial-gradient(600px 240px at 90% 10%, rgba(244,63,94,0.12), transparent)`,
              }}
            />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] uppercase tracking-widest text-neutral-300">
                <Star className="w-3 h-3 text-red-400" aria-hidden />{" "}
                High‑quality • Fast • Friendly
              </div>
              <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight">
                Keep it rolling with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-rose-400">
                  {site.name}
                </span>
              </h1>
              <p className="mt-4 text-neutral-300 max-w-xl">
                {site.tagline}. Quick turnarounds, clean installs, no sketchy
                upsells. Book a slot — we'll handle the rest.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href={site.bookingLink}
                  className="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 font-semibold"
                >
                  <Wrench className="w-4 h-4" aria-hidden /> Book service
                </a>
                <a
                  href={site.instagram}
                  className="inline-flex justify-center items-center gap-2 px-5 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                >
                  <Instagram className="w-4 h-4" aria-hidden /> See builds
                </a>
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-neutral-400">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-red-400" aria-hidden />{" "}
                  90‑day workmanship warranty
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" aria-hidden />{" "}
                  Same‑day when possible
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden ring-1 ring-neutral-800 bg-neutral-900">
                {/* Replace this gradient with your shop photo */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.07),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,0.20),transparent_40%)]" />
                <div className="absolute inset-6 rounded-2xl border border-neutral-800/80" />
                <div className="absolute inset-0 grid place-items-center">
                  <Car className="w-24 h-24 text-neutral-700" aria-hidden />
                </div>
                <div className="absolute bottom-3 right-3 text-[11px] px-2 py-1 rounded-full bg-black/60 border border-white/5">
                  Shop photo coming soon
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <Divider />

        {/* Services */}
        <section
          id="services"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        >
          <SectionTitle
            eyebrow="Services"
            title="What we do"
            subtitle="Straightforward, high‑quality work. No fluff."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                viewport={{ once: true }}
                className="group rounded-2xl p-5 bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900"
              >
                <div className="w-10 h-10 rounded-xl bg-red-600/20 grid place-items-center group-hover:bg-red-600/30 transition-colors">
                  {s.icon}
                </div>
                <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm text-neutral-300">{s.desc}</p>
                <div className="mt-3 text-xs text-neutral-400">{s.price}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <Divider />

        {/* Pricing */}
        <section
          id="pricing"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        >
          <SectionTitle
            eyebrow="Pricing"
            title="Simple, transparent rates"
            subtitle="No surprises — taxes extra."
          />
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Tire Swap (on rims)",
                price: "$60",
                details: [
                  "4 wheels on/off",
                  "Torque to spec",
                  "Pressure check",
                ],
              },
              {
                name: "Mount & Balance",
                price: "$25 / wheel",
                details: ["Standard sizes", "TPMS reset", "Stick‑on weights"],
              },
              {
                name: "Flat Repair",
                price: "$30",
                details: ["Patch + plug", "Balance check", "Road test"],
              },
            ].map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                viewport={{ once: true }}
                className="rounded-3xl p-6 bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700"
              >
                <div className="text-sm uppercase tracking-widest text-red-400/90">
                  {p.name}
                </div>
                <div className="mt-2 text-3xl font-extrabold">
                  {p.price}
                  <span className="text-base text-neutral-400 font-medium">
                    {" "}
                    CAD
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  {p.details.map((d) => (
                    <li key={d} className="flex items-center gap-2">
                      <ShieldCheck
                        className="w-4 h-4 text-red-400"
                        aria-hidden
                      />
                      {d}
                    </li>
                  ))}
                </ul>
                <a
                  href="#booking"
                  className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold"
                >
                  Book this
                </a>
              </motion.div>
            ))}
          </div>
        </section>

        <Divider />

        {/* Booking form */}
        <section
          id="booking"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        >
          <SectionTitle
            eyebrow="Bookings"
            title="Lock your spot"
            subtitle="Drop your details — we'll confirm by text."
          />
          <div className="grid md:grid-cols-2 gap-6">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  !form.name ||
                  !form.phone ||
                  !form.email ||
                  !form.service ||
                  !form.date ||
                  !selectedTime
                ) {
                  alert(
                    "Please fill name, phone, email, service, date, and pick a time."
                  );
                  return;
                }

                const slotId = `${form.date}_${compact(selectedTime)}`;
                setBookingBusy(true);
                try {
                  await runTransaction(db, async (tx) => {
                    const slotRef = doc(db, "slots", slotId);
                    const slotSnap = await tx.get(slotRef);
                    if (slotSnap.exists() && (slotSnap.data() as any).booked) {
                      throw new Error(
                        "This time was just booked. Pick another."
                      );
                    }

                    const bookingRef = doc(collection(db, "bookings"));
                    tx.set(slotRef, {
                      date: form.date,
                      time: selectedTime,
                      booked: true,
                      bookingId: bookingRef.id,
                      createdAt: serverTimestamp(),
                    });
                    tx.set(bookingRef, {
                      date: form.date,
                      time: selectedTime,
                      name: form.name,
                      phone: form.phone,
                      email: form.email,
                      service: form.service,
                      slotId,
                      status: "booked",
                      createdAt: serverTimestamp(),
                    });
                  });

                  // Optimistic: mark selected as taken now (realtime listener will confirm)
                  setTakenTimes((prev) => {
                    const next = new Set(prev);
                    next.add(selectedTime);
                    return next;
                  });

                  alert("Booked! We’ll confirm by text/email.");
                  setSelectedTime("");
                  // optionally clear form:
                  // setForm({ name:"", phone:"", email:"", service:"Mount & Balance", date:form.date });
                } catch (err: any) {
                  console.error(err);
                  alert(err?.message || "Could not book. Try another time.");
                } finally {
                  setBookingBusy(false);
                }
              }}
              className="rounded-3xl p-6 bg-neutral-900/70 border border-neutral-800"
              aria-labelledby="bookingFormTitle"
            >
              <div className="grid grid-cols-1 gap-4">
                <label className="text-sm" htmlFor="name">
                  Name
                  <input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </label>
                <label className="text-sm" htmlFor="phone">
                  Phone
                  <input
                    id="phone"
                    required
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="(519) 555‑1234"
                    className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </label>
                <label className="text-sm" htmlFor="email">
                  Email
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="you@email.com"
                    pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                    className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </label>
                <label className="text-sm" htmlFor="service">
                  Service
                  <select
                    id="service"
                    value={form.service}
                    onChange={(e) =>
                      setForm({ ...form, service: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    {services.map((s) => (
                      <option key={s.title} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm" htmlFor="date">
                  Preferred date
                  <input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </label>
                {form.date && (
                  <div className="text-sm">
                    <div className="mt-2 text-neutral-300">Available times</div>
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {loadingTimes && (
                        <div className="col-span-full text-neutral-400">
                          Loading…
                        </div>
                      )}
                      {!loadingTimes && times.length === 0 && (
                        <div className="col-span-full text-neutral-400">
                          No times for this day.
                        </div>
                      )}
                      {!loadingTimes &&
                        times.map((t) => {
                          const taken = takenTimes.has(t);
                          const selected = selectedTime === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={taken || bookingBusy}
                              onClick={() => setSelectedTime(t)}
                              className={[
                                "px-3 py-2 rounded-xl border text-sm",
                                taken
                                  ? "opacity-40 cursor-not-allowed border-neutral-800 bg-neutral-900"
                                  : selected
                                  ? "border-red-500 bg-red-600 text-white"
                                  : "border-neutral-800 bg-neutral-950 hover:border-neutral-700",
                              ].join(" ")}
                              aria-pressed={selected}
                              aria-label={`Time ${t}${taken ? " (taken)" : ""}`}
                              title={taken ? "Taken" : "Available"}
                            >
                              {t}
                            </button>
                          );
                        })}
                    </div>
                    <input type="hidden" name="time" value={selectedTime} />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={bookingBusy || !selectedTime}
                  className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Mail className="w-4 h-4" aria-hidden />{" "}
                  {bookingBusy ? "Booking…" : "Book"}
                </button>
                <p className="text-xs text-neutral-400">
                  No spam, ever. We reply fast during business hours.
                </p>
              </div>
            </form>

            <div className="rounded-3xl p-6 bg-neutral-900/40 border border-neutral-800">
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <MapPin className="w-4 h-4 text-red-400" aria-hidden />
                {site.address}
              </div>
              <div className="mt-3 flex items-start gap-2 text-sm text-neutral-300">
                <Clock className="w-4 h-4 text-red-400 mt-0.5" aria-hidden />
                <div>
                  <div className="text-neutral-400">Hours</div>
                  <ul className="mt-1 space-y-1">
                    {site.hours.map((h) => (
                      <li key={h.d} className="flex justify-between gap-4">
                        <span>{h.d}</span>
                        <span className="text-neutral-400">{h.h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {telHref && (
                  <a
                    href={telHref}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                  >
                    <Phone className="w-4 h-4" aria-hidden /> Call
                  </a>
                )}
                {smsHref && (
                  <a
                    href={smsHref}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden /> Text
                  </a>
                )}
                <a
                  href={buildMailto({
                    to: site.email,
                    subject: "Hello from website",
                    body: "Hi Fast Boys Garage,",
                  })}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                >
                  <Mail className="w-4 h-4" aria-hidden /> Email
                </a>
                <a
                  href={site.instagram}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                >
                  <Instagram className="w-4 h-4" aria-hidden /> IG
                </a>
              </div>
              <div className="mt-6 rounded-2xl overflow-hidden ring-1 ring-neutral-800">
                {/* Map placeholder (swap src with your exact address embed) */}
                <iframe
                  title="map"
                  className="w-full h-64"
                  loading="lazy"
                  allowFullScreen
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d46816.26806900732!2d-81.319!3d42.983!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x882ef19e0b5c8a2d%3A0x258b0cb7f3b0d9d7!2sLondon%2C%20ON!5e0!3m2!1sen!2sca!4v1699999999999"
                ></iframe>
              </div>
            </div>
          </div>
        </section>

        <Divider />

        {/* Gallery / IG */}
        <section
          id="gallery"
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        >
          <SectionTitle
            eyebrow="Gallery"
            title="Fresh from the shop"
            subtitle="We post before/afters, wheel setups, and tips on IG."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((id) => (
              <div
                key={id}
                className="aspect-square rounded-2xl overflow-hidden ring-1 ring-neutral-800 bg-neutral-900 grid place-items-center text-neutral-600"
              >
                {/* Replace placeholders with real images */}
                <span className="text-sm">Add your photo {id}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <a
              href={site.instagram}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
            >
              <Instagram className="w-4 h-4" aria-hidden /> Follow @{igHandle}
            </a>
          </div>
        </section>

        <Divider />

        {/* FAQs */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <SectionTitle eyebrow="FAQ" title="You asked, we answered" />
          <div className="space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-neutral-800 bg-neutral-900/60 open:bg-neutral-900 px-4 py-3"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                  <span className="font-medium text-white">{f.q}</span>
                  <span
                    className="text-red-400 group-open:rotate-45 transition-transform"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-neutral-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <Divider />
      </main>

      {/* Footer */}
      <footer
        id="contact"
        className="border-t border-neutral-900 bg-neutral-950"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid md:grid-cols-3 gap-8">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-neutral-300 max-w-sm">
              {site.tagline}. Proudly serving {site.city}. Quality work, honest
              pricing.
            </p>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Contact</div>
            <ul className="mt-2 space-y-2 text-sm">
              {telHref && (
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-red-400" aria-hidden />
                  <a href={telHref}>{site.phone}</a>
                </li>
              )}
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-400" aria-hidden />
                <a
                  href={buildMailto({
                    to: site.email,
                    subject: "Hello",
                    body: "Hi Fast Boys Garage,",
                  })}
                >
                  {site.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-400" aria-hidden />
                {site.address}
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Hours</div>
            <ul className="mt-2 space-y-1 text-sm">
              {site.hours.map((h) => (
                <li key={h.d} className="flex justify-between gap-4">
                  <span>{h.d}</span>
                  <span className="text-neutral-400">{h.h}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <a
                href={site.instagram}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
              >
                <Instagram className="w-4 h-4" aria-hidden /> Instagram
              </a>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-neutral-500 pb-8">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </div>
      </footer>

      {/* JSON‑LD for local business (edit address/phone/email) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AutomotiveBusiness",
            name: site.name,
            address: {
              "@type": "PostalAddress",
              addressLocality: "London",
              addressRegion: "ON",
              addressCountry: "CA",
            },
            telephone: site.phone,
            email: site.email,
            areaServed: site.city,
            url: "https://fastboysgarage.ca",
            sameAs: [site.instagram].filter(Boolean),
            openingHoursSpecification: site.hours.map((h) => ({
              "@type": "OpeningHoursSpecification",
              // NOTE: Use exact days when you finalize; for now we keep generic text
              description: `${h.d} ${h.h}`,
            })),
          }),
        }}
      />
    </div>
  );
};

export default Index;
