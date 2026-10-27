import test from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  quantity,
  demo,
  blank,
  validate,
  balance,
  net,
  available,
  ruleAmount,
  recovery,
  entries,
  today,
  forecast,
  uid,
} from "../../src/lib/finance.ts";
test("centavos exactos, rechaza flotantes ambiguos y cantidades fraccionarias", () => {
  assert.equal(cents("1,234.56"), 123456);
  assert.equal(cents("0.10") + cents("0.20"), 30);
  for (const raw of ["1.001", "-1", "1e3", "NaN", ""])
    assert.throws(() => cents(raw));
  assert.throws(() => quantity("1.5"));
});
test("compra reduce efectivo una sola vez y venta cobrada lo aumenta", () => {
  const s = demo();
  const l = s.lots[0];
  assert.equal(balance(s), 14530000);
  assert.equal(entries(s).filter((e) => e.kind === "purchase").length, 3);
  assert.equal(available(l, l.products[0]), 2);
  assert.equal(net(l), 360000);
  assert.equal(recovery(l), 250000);
});
test("venta a crédito reduce inventario y no es efectivo hasta cobrar", () => {
  const s = demo();
  const l = s.lots[0];
  const id = uid();
  l.sales.push({
    id,
    productId: l.products[2].id,
    units: 1,
    price: 100000,
    date: today(),
  });
  validate(s);
  assert.equal(balance(s), 14530000);
  assert.equal(available(l, l.products[2]), 3);
  l.sales.find((x) => x.id === id)!.paidDate = today();
  assert.equal(balance(s), 14630000);
  assert.equal(entries(s).filter((e) => e.sourceId === id).length, 1);
});
test("no permite vender más unidades ni referencias a productos inexistentes", () => {
  for (const productId of [demo().lots[0].products[0].id, "missing"]) {
    const s = demo();
    s.lots[0].sales.push({
      id: uid(),
      productId,
      units: 99,
      price: 80000,
      date: today(),
    });
    assert.throws(() => validate(s));
  }
});
test("reglas se aplican al total una vez, pago se congela y afecta efectivo", () => {
  const s = demo();
  const l = s.lots[0];
  l.rules = [
    { id: uid(), name: "Envío", type: "fixed", value: 80000, base: "sales" },
    { id: uid(), name: "Comisión", type: "percent", value: 300, base: "sales" },
  ];
  validate(s);
  assert.equal(ruleAmount(l, l.rules[1]), 32400);
  assert.equal(net(l), 247600);
  assert.equal(balance(s), 14530000);
  l.rules[0].paidDate = today();
  l.rules[0].paidAmount = 80000;
  validate(s);
  assert.equal(balance(s), 14450000);
  assert.equal(recovery(l), 170000);
  l.rules[1].paidDate = today();
  l.rules[1].paidAmount = 32400;
  l.products[2].price = 200000;
  validate(s);
  assert.equal(balance(s), 14417600);
  assert.equal(l.rules[1].paidAmount, 32400);
});
test("planes solo afectan proyección, pago no se descuenta dos veces", () => {
  const s = demo();
  const p = s.plans[0];
  const cash = balance(s);
  assert.equal(balance(s), cash);
  assert.ok(
    forecast(s).some((x) => x.projected !== null && x.projected < cash / 100),
  );
  p.movementId = uid();
  s.movements.push({
    id: p.movementId,
    amount: -p.amount,
    concept: p.concept,
    category: p.category,
    date: today(),
  });
  validate(s);
  assert.equal(balance(s), cash - p.amount);
  const last = forecast(s).at(-1)!;
  assert.equal(last.projected, balance(s) / 100);
});
test("anular venta repone unidades y quita el cobro sin borrar registro", () => {
  const s = demo();
  const l = s.lots[0];
  l.sales[0].voided = true;
  validate(s);
  assert.equal(available(l, l.products[0]), 4);
  assert.equal(balance(s), 14370000);
  assert.equal(l.sales.length, 2);
});
test("rechaza IDs duplicados, importes no enteros, compras futuras y datos corruptos", () => {
  const s = demo();
  s.movements.push({
    id: s.lots[0].id,
    amount: 100,
    date: today(),
    concept: "A",
    category: "B",
  });
  assert.throws(() => validate(s));
  const n = demo();
  n.lots[0].products[0].cost = 0.1;
  assert.throws(() => validate(n));
  const f = demo();
  f.lots[0].products[0].date = "2099-01-01";
  assert.throws(() => validate(f));
  assert.throws(() => validate({} as never));
  assert.doesNotThrow(() => validate(blank("Zay", 0, today())));
});
test("plan de mercancía se consume con compras sin duplicar el egreso", () => {
  const s = demo();
  const p = s.plans[0];
  p.lotId = s.lots[0].id;
  validate(s);
  const future = forecast(s).at(-1)!;
  assert.equal(balance(s), 14530000);
  assert.equal(future.projected, (14530000 - 180000) / 100);
  assert.equal(entries(s).filter((e) => e.kind === "movement").length, 0);
});
