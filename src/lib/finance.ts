export type Movement = {
  id: string;
  date: string;
  concept: string;
  category: string;
  amount: number;
  voided?: boolean;
};
export type Product = {
  id: string;
  name: string;
  photo: string;
  units: number;
  cost: number;
  price: number;
  date: string;
};
export type Sale = {
  id: string;
  productId: string;
  units: number;
  price: number;
  date: string;
  paidDate?: string;
  voided?: boolean;
};
export type Rule = {
  id: string;
  name: string;
  type: "fixed" | "percent";
  value: number;
  base: "sales" | "cost";
  paidAmount?: number;
  paidDate?: string;
};
export type Lot = {
  id: string;
  name: string;
  products: Product[];
  sales: Sale[];
  rules: Rule[];
  createdAt: string;
};
export type Plan = {
  id: string;
  concept: string;
  amount: number;
  date: string;
  category: string;
  movementId?: string;
  lotId?: string;
  cancelled?: boolean;
};
export type Audit = { id: string; at: string; action: string };
export type State = {
  version: 1;
  name: string;
  currency: "MXN";
  opening: number;
  openingDate: string;
  movements: Movement[];
  lots: Lot[];
  plans: Plan[];
  audit: Audit[];
};
export const uid = () => crypto.randomUUID();
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
export function cents(raw: string) {
  const s = raw.trim().replace(/,/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s))
    throw Error("Usa un importe válido con máximo dos decimales.");
  const [a, b = ""] = s.split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n)) throw Error("Importe demasiado grande.");
  return n;
}
export function quantity(raw: string) {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000)
    throw Error("La cantidad debe ser un entero entre 1 y 100,000.");
  return n;
}
export const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export const blank = (name = "Zay", opening = 0, date = today()): State => ({
  version: 1,
  name,
  currency: "MXN",
  opening,
  openingDate: date,
  movements: [],
  lots: [],
  plans: [],
  audit: [],
});
export function sold(l: Lot, p: string) {
  return l.sales
    .filter((s) => s.productId === p && !s.voided)
    .reduce((a, s) => a + s.units, 0);
}
export const available = (l: Lot, p: Product) => p.units - sold(l, p.id);
export function ruleAmount(l: Lot, r: Rule) {
  return r.type === "fixed"
    ? r.value
    : Math.round(((r.base === "sales" ? gross(l) : cost(l)) * r.value) / 10000);
}
export const cost = (l: Lot) =>
  l.products.reduce((a, p) => a + p.cost * p.units, 0);
export function gross(l: Lot) {
  return (
    l.products.reduce((a, p) => a + available(l, p) * p.price, 0) +
    l.sales.filter((s) => !s.voided).reduce((a, s) => a + s.units * s.price, 0)
  );
}
export const fees = (l: Lot) =>
  l.rules.reduce((a, r) => a + (r.paidAmount ?? ruleAmount(l, r)), 0);
export const collected = (l: Lot) =>
  l.sales
    .filter((s) => s.paidDate && !s.voided)
    .reduce((a, s) => a + s.price * s.units, 0);
export const paidFees = (l: Lot) =>
  l.rules.reduce((a, r) => a + (r.paidAmount ?? 0), 0);
export const net = (l: Lot) => gross(l) - cost(l) - fees(l);
export const recovery = (l: Lot) => Math.max(0, collected(l) - paidFees(l));
export const pendingPlans = (s: State) =>
  s.plans
    .filter((p) => !p.cancelled && !p.movementId)
    .map((p) => ({
      ...p,
      amount: p.lotId
        ? Math.max(0, p.amount - cost(s.lots.find((l) => l.id === p.lotId)!))
        : p.amount,
    }))
    .filter((p) => p.amount > 0);
export type Entry = {
  id: string;
  date: string;
  concept: string;
  category: string;
  amount: number;
  kind: "movement" | "purchase" | "sale" | "fee";
  lotId?: string;
  sourceId: string;
};
export function entries(s: State): Entry[] {
  return [
    ...s.movements
      .filter((m) => !m.voided)
      .map((m) => ({ ...m, kind: "movement" as const, sourceId: m.id })),
    ...s.lots.flatMap((l) => [
      ...l.products.map((p) => ({
        id: "purchase-" + p.id,
        sourceId: p.id,
        date: p.date,
        concept: "Compra · " + p.name,
        category: "Inversión",
        amount: -p.cost * p.units,
        kind: "purchase" as const,
        lotId: l.id,
      })),
      ...l.sales
        .filter((v) => !v.voided && v.paidDate)
        .map((v) => ({
          id: "sale-" + v.id,
          sourceId: v.id,
          date: v.paidDate!,
          concept:
            "Venta · " + l.products.find((p) => p.id === v.productId)!.name,
          category: "Inversión",
          amount: v.units * v.price,
          kind: "sale" as const,
          lotId: l.id,
        })),
      ...l.rules
        .filter((r) => r.paidDate)
        .map((r) => ({
          id: "fee-" + r.id,
          sourceId: r.id,
          date: r.paidDate!,
          concept: r.name,
          category: "Gastos de inversión",
          amount: -r.paidAmount!,
          kind: "fee" as const,
          lotId: l.id,
        })),
    ]),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
export function balance(s: State, date = today()) {
  return (
    s.opening +
    entries(s)
      .filter((e) => e.date <= date)
      .reduce((a, e) => a + e.amount, 0)
  );
}
export function forecast(s: State, months = 6) {
  const now = today();
  const d = new Date(now + "T12:00:00");
  const list: {
    month: string;
    date: string;
    real: number | null;
    projected: number | null;
  }[] = [];
  for (let i = -2; i < months - 2; i++) {
    const end = new Date(d.getFullYear(), d.getMonth() + i + 1, 0);
    const date =
      i === 0
        ? now
        : `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    if (date < s.openingDate) continue;
    const planned =
      i > 0
        ? pendingPlans(s)
            .filter((p) => p.date <= date)
            .reduce((a, p) => a + p.amount, 0)
        : 0;
    list.push({
      month: new Intl.DateTimeFormat("es-MX", { month: "short" })
        .format(end)
        .replace(".", ""),
      date,
      real: i <= 0 ? balance(s, date) / 100 : null,
      projected: i >= 0 ? (balance(s, date) - planned) / 100 : null,
    });
  }
  return list;
}
export function audit(s: State, action: string): State {
  return {
    ...s,
    audit: [
      { id: uid(), at: new Date().toISOString(), action },
      ...s.audit,
    ].slice(0, 1000),
  };
}
export function validate(s: State) {
  const fail = (msg: string) => {
    throw Error(msg);
  };
  const amount = (n: number) => Number.isSafeInteger(n) && Math.abs(n) <= 1e14;
  if (
    !s ||
    s.version !== 1 ||
    s.currency !== "MXN" ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    !amount(s.opening) ||
    s.opening < 0 ||
    !validDate(s.openingDate)
  )
    fail("Respaldo o configuración no válidos.");
  if (
    !Array.isArray(s.movements) ||
    !Array.isArray(s.lots) ||
    !Array.isArray(s.plans) ||
    !Array.isArray(s.audit)
  )
    fail("Estructura de datos no válida.");
  const ids = new Set<string>();
  const id = (x: string) => {
    if (typeof x !== "string" || !x || ids.has(x))
      fail("Identificador duplicado.");
    ids.add(x);
  };
  const text = (x: string) =>
    typeof x === "string" && x.trim().length > 0 && x.length <= 250;
  for (const m of s.movements) {
    id(m.id);
    if (
      !amount(m.amount) ||
      m.amount === 0 ||
      !text(m.concept) ||
      !text(m.category) ||
      !validDate(m.date) ||
      m.date < s.openingDate ||
      m.date > today()
    )
      fail("Movimiento no válido. Usa Planes para fechas futuras.");
  }
  for (const l of s.lots) {
    id(l.id);
    if (
      !text(l.name) ||
      !Array.isArray(l.products) ||
      !Array.isArray(l.sales) ||
      !Array.isArray(l.rules)
    )
      fail("Lote no válido.");
    for (const p of l.products) {
      id(p.id);
      if (
        !text(p.name) ||
        !Number.isSafeInteger(p.units) ||
        p.units < 1 ||
        p.units > 100000 ||
        !amount(p.cost) ||
        p.cost < 0 ||
        !amount(p.price) ||
        p.price < 0 ||
        !validDate(p.date) ||
        p.date < s.openingDate ||
        p.date > today() ||
        typeof p.photo !== "string" ||
        p.photo.length > 800000 ||
        !(
          !p.photo ||
          p.photo.startsWith("data:image/jpeg;base64,") ||
          p.photo === "/images/mochilas.png"
        )
      )
        fail("Producto no válido.");
      if (!amount(p.cost * p.units) || !amount(p.price * p.units))
        fail("Importes de producto fuera de rango.");
    }
    for (const v of l.sales) {
      id(v.id);
      const p = l.products.find((p) => p.id === v.productId);
      if (
        !p ||
        !Number.isSafeInteger(v.units) ||
        v.units < 1 ||
        !amount(v.price) ||
        v.price < 1 ||
        !amount(v.price * v.units) ||
        !validDate(v.date) ||
        v.date < p.date ||
        v.date > today() ||
        (v.paidDate &&
          (!validDate(v.paidDate) ||
            v.paidDate < v.date ||
            v.paidDate > today()))
      )
        fail("Venta no válida.");
    }
    for (const p of l.products)
      if (available(l, p) < 0) fail("No hay suficientes unidades disponibles.");
    for (const r of l.rules) {
      id(r.id);
      if (
        !text(r.name) ||
        !["fixed", "percent"].includes(r.type) ||
        !["sales", "cost"].includes(r.base) ||
        !amount(r.value) ||
        r.value < 0 ||
        (r.type === "percent" && r.value > 10000) ||
        (r.paidAmount === undefined) !== !r.paidDate ||
        (r.paidAmount !== undefined &&
          (!amount(r.paidAmount) ||
            r.paidAmount < 0 ||
            !validDate(r.paidDate!) ||
            r.paidDate! < s.openingDate ||
            r.paidDate! > today()))
      )
        fail("Regla no válida.");
    }
  }
  for (const p of s.plans) {
    id(p.id);
    if (
      (p.lotId && (!s.lots.some((l) => l.id === p.lotId) || p.movementId)) ||
      !text(p.concept) ||
      !amount(p.amount) ||
      p.amount < 1 ||
      !validDate(p.date) ||
      p.date < s.openingDate ||
      (p.movementId &&
        !s.movements.some(
          (m) => m.id === p.movementId && !m.voided && m.amount === -p.amount,
        ))
    )
      fail("Plan no válido.");
  }
  const total =
    s.opening + entries(s).reduce((a, e) => a + Math.abs(e.amount), 0);
  if (!amount(total)) fail("El total supera el límite admitido.");
  return s;
}
export function demo(): State {
  const d = today();
  const s = blank("Zay", 15000000, d);
  const l: Lot = {
    id: uid(),
    name: "Lote de mochilas",
    createdAt: d,
    products: ["beige", "negra", "oliva"].map((n, i) => ({
      id: uid(),
      name: "Mochila " + n,
      photo: "/images/mochilas.png",
      units: 4,
      cost: 50000 + i * 10000,
      price: 80000 + i * 10000,
      date: d,
    })),
    sales: [],
    rules: [],
  };
  l.sales = [
    {
      id: uid(),
      productId: l.products[0].id,
      units: 2,
      price: 80000,
      date: d,
      paidDate: d,
    },
    {
      id: uid(),
      productId: l.products[1].id,
      units: 1,
      price: 90000,
      date: d,
      paidDate: d,
    },
  ];
  s.lots = [l];
  const future = new Date(d + "T12:00:00");
  future.setDate(future.getDate() + 20);
  s.plans = [
    {
      id: uid(),
      concept: "Compra de mercancía",
      amount: 900000,
      date: future.toISOString().slice(0, 10),
      category: "Inversión",
    },
  ];
  return validate(s);
}
