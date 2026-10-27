import { asset } from "./lib/assets";
import { loginEmail, workspaceOf } from "./lib/access";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  CalendarBlank,
  ChartLineUp,
  House,
  Plus,
  Receipt,
  TrendDown,
  Camera,
  Image as ImageIcon,
  Check,
  Trash,
  DownloadSimple,
  CloudCheck,
  CloudSlash,
  GearSix,
  X,
  Package,
  Lightning,
  SignOut,
  ArrowClockwise,
  WarningCircle,
  Eye,
  CheckCircle,
} from "@phosphor-icons/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { KeyboardInput, MobileScroll, useKeyboard } from "./mobile";
import {
  type State,
  type Lot,
  type Product,
  type Rule,
  blank,
  demo,
  uid,
  today,
  money,
  cents,
  quantity,
  validate,
  audit,
  entries,
  balance,
  forecast,
  pendingPlans,
  available,
  cost,
  gross,
  fees,
  net,
  collected,
  recovery,
  ruleAmount,
} from "./lib/finance";
import {
  type Saved,
  read,
  write,
  supabase,
  pull,
  push,
  download,
  photo,
} from "./lib/storage";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";

const tabs = [
  { id: "home", label: "Inicio", Icon: House },
  { id: "movements", label: "Movimientos", Icon: Receipt },
  { id: "investments", label: "Inversión", Icon: ChartLineUp },
  { id: "plans", label: "Planes", Icon: CalendarBlank },
];
type Route = { page: string; id?: string; lot?: string };
function SimInput(p: InputHTMLAttributes<HTMLInputElement>) {
  return <KeyboardInput {...p} />;
}
function Field({
  label,
  simulated,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  simulated: boolean;
}) {
  const Input = simulated ? SimInput : "input";
  return (
    <label className="field">
      <span>{label}</span>
      <Input {...props} />
    </label>
  );
}
function SimWrap({ children }: { children: ReactNode }) {
  const keyboard = useKeyboard();
  useEffect(() => () => keyboard.hide(), []);
  return <>{children}</>;
}
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d + "T12:00:00"));
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={40} weight="thin" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Chart({ s, months = 6 }: { s: State; months?: number }) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Evolución del efectivo real y proyectado en pesos mexicanos"
    >
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={forecast(s, months)}
          margin={{ left: 0, right: 12, top: 16, bottom: 0 }}
        >
          <CartesianGrid stroke="#29292f" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#aaaab6", fontSize: 12 }}
          />
          <YAxis
            width={52}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              "$" +
              new Intl.NumberFormat("es-MX", { notation: "compact" }).format(v)
            }
            domain={["auto", "auto"]}
            tick={{ fill: "#92929e", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "#222228",
              border: "1px solid #383840",
              borderRadius: 12,
              color: "#faf9f5",
            }}
            formatter={(v) => money(Number(v) * 100)}
            labelFormatter={(v) => "Mes: " + v}
          />
          <Line
            type="linear"
            dataKey="real"
            name="Real"
            stroke="#f3f0eb"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="projected"
            name="Proyectado"
            stroke="#d7af71"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="legend">
        <span>● Real</span>
        <span className="gold">● Proyectado</span>
      </div>
    </div>
  );
}
function Recovery({ l }: { l: Lot }) {
  const c = cost(l);
  const r = recovery(l);
  const pct = c ? Math.min(100, (r / c) * 100) : 0;
  return (
    <div className="recovery">
      <div className="between">
        <span>Capital recuperado</span>
        <strong className="gold">{pct.toFixed(1)}%</strong>
      </div>
      <div className="recovery-value">
        {money(r)} <small>de {money(c)}</small>
      </div>
      <progress max="100" value={pct} />
      <small>
        {r >= c && c > 0
          ? "Compra recuperada con cobros netos"
          : `Faltan ${money(Math.max(0, c - r))} por recuperar`}
      </small>
    </div>
  );
}
function ProductPhoto({ p }: { p?: Product }) {
  return p?.photo ? (
    <img
      className="product-photo"
      src={asset(p.photo)}
      alt={p.name}
      draggable={false}
    />
  ) : (
    <div className="product-photo no-photo">
      <Package size={30} />
    </div>
  );
}

export function ZayApp({ simulated = false }: { simulated?: boolean }) {
  const [scope, setScope] = useState(() =>
    import.meta.env.DEV
      ? localStorage.getItem("zay-scope") || "device"
      : "locked",
  );
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>({ page: "home" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [revisionTick, setRevisionTick] = useState(0);
  const lock = useRef(false);
  const syncLock = useRef(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    if (simulated || !import.meta.env.PROD || !("serviceWorker" in navigator))
      return;
    let active = true;
    navigator.serviceWorker.ready
      .then(() => {
        if (active) setOfflineReady(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [simulated]);
  const state = import.meta.env.DEV || user ? saved?.state : undefined;
  const go = (page: string, id?: string, lot?: string) =>
    setRoute({ page, id, lot });
  useEffect(() => {
    const h = () => setOnline(navigator.onLine);
    window.addEventListener("online", h);
    window.addEventListener("offline", h);
    return () => {
      window.removeEventListener("online", h);
      window.removeEventListener("offline", h);
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const applySession = (
      session: {
        user: { id: string; app_metadata?: Record<string, unknown> };
      } | null,
    ) => {
      const workspace = workspaceOf(session?.user);
      setUser(workspace ? session!.user.id : null);
      setScope((current) =>
        workspace
          ? "workspace:" + workspace
          : import.meta.env.DEV
            ? current.startsWith("workspace:")
              ? "device"
              : current
            : "locked",
      );
      if (session && !workspace)
        setMessage("Esta cuenta no tiene acceso a las finanzas de Zayris.");
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage(error.message);
      applySession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      applySession(session),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSaved(null);
    (async () => {
      let local = await read(scope);
      if (scope.startsWith("workspace:") && navigator.onLine) {
        try {
          const remote = await pull();
          if (remote && !local?.dirty) {
            validate(remote.state);
            local = await write(
              scope,
              remote.state,
              local?.revision ?? 0,
              remote.revision,
              false,
            );
          }
        } catch (e) {
          if (active)
            setMessage("No se pudo consultar la nube. " + (e as Error).message);
        }
      }
      if (active) {
        setSaved(local);
        setLoading(false);
      }
    })().catch((e) => {
      if (active) {
        setMessage((e as Error).message);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [scope, revisionTick]);
  useEffect(() => {
    if (!user || !online) return;
    let active = true;
    let fetching = false;
    const refresh = async () => {
      const local = savedRef.current;
      if (!local || local.dirty || lock.current || syncLock.current || fetching)
        return;
      fetching = true;
      try {
        const remote = await pull();
        if (
          active &&
          remote &&
          remote.revision > local.remoteRevision &&
          !savedRef.current?.dirty
        ) {
          const latest = await read(scope);
          if (latest && !latest.dirty && latest.revision === local.revision) {
            const updated = await write(
              scope,
              validate(remote.state),
              latest.revision,
              remote.revision,
              false,
            );
            if (active) {
              savedRef.current = updated;
              setSaved(updated);
            }
          }
        }
      } catch (e) {
        if (active)
          setSyncStatus(
            "No se pudo actualizar la nube. " + (e as Error).message,
          );
      } finally {
        fetching = false;
      }
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(() => void refresh(), 20000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [user, online, scope]);
  const commit = async (next: State, action: string) => {
    if (lock.current) throw Error("Espera a que termine el guardado.");
    lock.current = true;
    setBusy(true);
    try {
      const cur = savedRef.current;
      const result = await write(
        scope,
        validate(audit(next, action)),
        cur?.revision ?? 0,
        cur?.remoteRevision ?? 0,
      );
      savedRef.current = result;
      setSaved(result);
      setMessage("Guardado en este dispositivo");
      return result;
    } catch (e) {
      setMessage((e as Error).message);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const sync = useCallback(async () => {
    const local = savedRef.current;
    if (!user || !local?.dirty || !online || syncLock.current || lock.current)
      return;
    syncLock.current = true;
    setSyncStatus("Sincronizando…");
    try {
      const revision = await push(local.state, local.remoteRevision);
      const latest = await read(scope);
      if (!latest) throw Error("La copia local ya no está disponible.");
      const updated = await write(
        scope,
        latest.state,
        latest.revision,
        revision,
        latest.revision !== local.revision,
      );
      savedRef.current = updated;
      setSaved(updated);
      setSyncStatus("Al día en la nube");
    } catch (e) {
      setSyncStatus((e as Error).message);
    } finally {
      syncLock.current = false;
    }
  }, [user, online, scope]);
  useEffect(() => {
    if (saved?.dirty) {
      const t = setTimeout(() => void sync(), 1000);
      return () => clearTimeout(t);
    }
  }, [saved, sync]);
  const mutate = async (
    fn: (s: State) => void | Route | number,
    action: string,
    dest?: Route,
  ) => {
    if (!state) return;
    const next = structuredClone(state);
    try {
      const target = fn(next);
      await commit(next, action);
      if (dest) setRoute(dest);
      else if (target && typeof target === "object") setRoute(target);
    } catch (e) {
      setMessage((e as Error).message);
      throw e;
    }
  };
  const run = (fn: () => Promise<unknown>) => {
    void fn().catch((e) => setMessage((e as Error).message));
  };
  const [confirmation, setConfirmation] = useState<{
    message: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const confirmAction = (message: string) =>
    new Promise<boolean>((resolve) => setConfirmation({ message, resolve }));
  const answerConfirmation = (ok: boolean) => {
    confirmation?.resolve(ok);
    setConfirmation(null);
  };
  const [form, setForm] = useState<Record<string, string>>({});
  const v = (k: string, fallback = "") => form[k] ?? fallback;
  const change =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((x) => ({ ...x, [k]: e.target.value }));
  useEffect(() => {
    setForm({});
    setMessage("");
  }, [route.page, route.id, route.lot]);
  const field = (
    label: string,
    key: string,
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field
      key={key}
      label={label}
      simulated={simulated}
      value={v(key)}
      onChange={change(key)}
      {...extra}
    />
  );
  const select = (
    label: string,
    key: string,
    options: string[],
    fallback = options[0],
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={v(key, fallback)}
        onChange={change(key)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  const submit = (e: React.FormEvent, fn: () => Promise<unknown>) => {
    e.preventDefault();
    run(fn);
  };
  const button = (label: string, fn: () => void, secondary = false) => (
    <button
      type="button"
      className={secondary ? "secondary" : "primary"}
      onClick={fn}
      disabled={busy}
    >
      {label}
    </button>
  );
  const activeLot = state?.lots.find((l) => l.id === (route.lot || route.id));
  const logout = async () => {
    if (saved?.dirty && user)
      throw Error("Sincroniza o descarga un respaldo antes de cerrar sesión.");
    await supabase?.auth.signOut();
    setScope("device");
    localStorage.setItem("zay-scope", "device");
    setRoute({ page: "home" });
  };
  const localMode = (s: string) => {
    localStorage.setItem("zay-scope", s);
    setScope(s);
    go("home");
  };
  const Welcome = () => (
    <div className="welcome">
      <div className="brand">
        <img src={asset("/icons/icon-192.png")} alt="" /> Zay
      </div>
      <span className="eyebrow">TU PATRIMONIO, CON CLARIDAD</span>
      <h1>
        Cada peso.
        <br />
        <em>En su lugar.</em>
      </h1>
      <p>
        Tu efectivo, tus planes y tu negocio. Un espacio para cuidar lo que
        estás construyendo.
      </p>
      <div className="welcome-visual">
        <ChartLineUp size={46} weight="thin" />
        <div>
          Claridad para decidir.
          <br />
          <small>Control para crecer.</small>
        </div>
      </div>
      {(user || import.meta.env.DEV) &&
        button("Comenzar con mi capital", () => go("onboarding"))}
      {!user && supabase && button("Iniciar sesión", () => go("auth"))}
      {import.meta.env.DEV &&
        button(
          "Explorar con datos de ejemplo",
          () =>
            run(async () => {
              const existing = await read("demo");
              if (!existing) await write("demo", demo(), 0, 0, false);
              localMode("demo");
              setRevisionTick((x) => x + 1);
            }),
          true,
        )}
      <small className="privacy">
        <CloudSlash size={16} />{" "}
        {supabase
          ? "Acceso exclusivo para Zayris y Uriel. Ambos ven el mismo patrimonio."
          : "Conexión privada pendiente de configurar."}
      </small>
    </div>
  );
  let content: ReactNode;
  let title = "";
  let back = "home";
  let mainPage = tabs.some((t) => t.id === route.page);
  let submitLabel = "";
  if (loading)
    content = (
      <div className="empty">
        <div className="brand">
          <img src={asset("/icons/icon-192.png")} alt="" /> Zay
        </div>
        <p>Abriendo tu espacio…</p>
      </div>
    );
  else if (route.page === "auth") {
    title = "Tu cuenta";
    mainPage = false;
    content = (
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            if (!supabase) throw Error("Supabase no está configurado.");
            const result = await supabase.auth.signInWithPassword({
              email: loginEmail(v("username")),
              password: v("password"),
            });
            if (result.error) throw Error("Usuario o contraseña incorrectos.");
            if (!workspaceOf(result.data.user)) {
              await supabase.auth.signOut();
              throw Error("Esta cuenta no tiene acceso a Zay.");
            }
            go("home");
          })
        }
      >
        <p className="muted">
          Tu patrimonio privado, respaldado entre dispositivos.
        </p>
        {field("Usuario", "username", {
          type: "text",
          required: true,
          autoComplete: "username",
          autoCapitalize: "none",
          placeholder: "zayris o uriel",
        })}
        {field("Contraseña", "password", {
          type: "password",
          required: true,
          minLength: 8,
          autoComplete: "current-password",
        })}
        <button className="primary" type="submit">
          Continuar
        </button>
        <small className="muted">
          Solo dos accesos autorizados. Zayris y Uriel comparten las mismas
          finanzas; no hay registro público.
        </small>
      </form>
    );
  } else if (route.page === "onboarding" && (user || import.meta.env.DEV)) {
    title = "Tu punto de partida";
    mainPage = false;
    content = (
      <form
        onSubmit={(e) =>
          submit(e, async () => {
            const initial = blank(
              v("name", "Zayris").trim(),
              cents(v("capital", "0")),
              v("date", today()),
            );
            validate(initial);
            await commit(initial, "Capital inicial registrado");
            go("home");
          })
        }
      >
        <p className="muted">
          Registra el efectivo que tienes en la fecha de inicio. Las compras
          anteriores ya deben estar descontadas de ese saldo.
        </p>
        {field("Tu nombre", "name", {
          required: true,
          defaultValue: undefined,
          value: v("name", "Zayris"),
          maxLength: 60,
        })}
        {field("Capital inicial · MXN", "capital", {
          inputMode: "decimal",
          required: true,
          placeholder: "0.00",
        })}
        {field("Fecha de inicio", "date", {
          type: "date",
          value: v("date", today()),
          max: today(),
          required: true,
        })}
        <div className="notice">
          <Eye size={20} />
          <span>
            Empiezas con tus cifras reales. No se agregan movimientos ni gastos
            automáticamente.
          </span>
        </div>
        <button className="primary" disabled={busy}>
          Crear mi espacio
        </button>
      </form>
    );
  } else if (!state) content = <Welcome />;
  else if (route.page === "home") {
    const current = balance(state);
    const planned = pendingPlans(state).reduce((a, p) => a + p.amount, 0);
    content = (
      <>
        <div className="greeting">
          <h1>Hola, {state.name.split(" ")[0]}</h1>
        </div>
        <section className="panel balance">
          <span className="muted">Efectivo actual</span>
          <div className="amount">
            {money(current)}
            <small>MXN</small>
          </div>
          <div className="split">
            <div>
              <span>Por gastar</span>
              <strong>{money(planned)}</strong>
            </div>
            <div>
              <span>Libre de compromisos</span>
              <strong className={current - planned < 0 ? "negative" : ""}>
                {money(current - planned)}
              </strong>
            </div>
          </div>
        </section>
        <button className="primary" onClick={() => go("movement-new")}>
          <Plus size={20} />
          Registrar movimiento
        </button>
        <button
          className="text-button plan-shortcut"
          onClick={() => go("plan-new")}
        >
          <CalendarBlank size={21} />
          Planificar gasto
        </button>
        <section className="panel">
          <div className="between">
            <h2>Tu efectivo en el tiempo</h2>
            <span className="mini-pill">6 meses</span>
          </div>
          <Chart s={state} />
        </section>
        <div className="section-heading">
          <h2>Inversión</h2>
          <button
            aria-label="Ver inversiones"
            onClick={() => go("investments")}
          >
            <ArrowUpRight size={22} />
          </button>
        </div>
        {state.lots.length ? (
          state.lots.slice(0, 2).map((l) => (
            <button
              className="lot-row panel"
              key={l.id}
              onClick={() => go("lot", l.id)}
            >
              <ProductPhoto p={l.products[0]} />
              <div>
                <h3>{l.name}</h3>
                <small>
                  {l.products.reduce((a, p) => a + available(l, p), 0)}{" "}
                  disponibles · {money(cost(l))} invertidos
                </small>
              </div>
              <div className="right">
                <strong className="gold">{money(net(l))}</strong>
                <small>Ganancia estimada</small>
              </div>
            </button>
          ))
        ) : (
          <Empty
            title="Tu primera inversión"
            description="Agrega un lote y comienza con una foto de tu producto."
            action={button("Crear inversión", () => go("lot-new"), true)}
          />
        )}
      </>
    );
  } else if (route.page === "movements") {
    title = "Movimientos";
    const list = entries(state).filter((e) => e.date.startsWith(month));
    content = (
      <>
        <label className="month-picker">
          <CalendarBlank size={22} />
          <input
            aria-label="Mes de movimientos"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <section className="panel balance">
          <span className="muted">Efectivo actual</span>
          <div className="amount">
            {money(balance(state))}
            <small>MXN</small>
          </div>
          <div className="split">
            <div>
              <span>Ingresos del mes</span>
              <strong className="positive">
                {money(
                  list
                    .filter((e) => e.amount > 0)
                    .reduce((a, e) => a + e.amount, 0),
                )}
              </strong>
            </div>
            <div>
              <span>Egresos del mes</span>
              <strong>
                {money(
                  -list
                    .filter((e) => e.amount < 0)
                    .reduce((a, e) => a + e.amount, 0),
                )}
              </strong>
            </div>
          </div>
        </section>
        <div className="segments">
          {[
            ["all", "Todos"],
            ["in", "Ingresos"],
            ["out", "Egresos"],
          ].map(([id, label]) => (
            <button
              className={filter === id ? "selected" : ""}
              key={id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ledger">
          {list
            .filter(
              (e) =>
                filter === "all" ||
                (filter === "in" ? e.amount > 0 : e.amount < 0),
            )
            .map((e) => (
              <button
                className="ledger-row"
                key={e.id}
                onClick={() => go("entry", e.id)}
              >
                <span
                  className={"entry-icon " + (e.amount > 0 ? "positive" : "")}
                >
                  {e.amount > 0 ? (
                    <ArrowDownLeft size={21} />
                  ) : (
                    <ArrowUpRight size={21} />
                  )}
                </span>
                <div>
                  <h3>{e.concept}</h3>
                  <small>
                    {shortDate(e.date)} · {e.category}
                  </small>
                </div>
                <strong className={e.amount > 0 ? "positive" : "negative"}>
                  {e.amount > 0 ? "+" : ""}
                  {money(e.amount)}
                </strong>
              </button>
            ))}
        </div>
        {!list.length && (
          <Empty
            title="Sin movimientos este mes"
            description="Aquí aparecerán tus ingresos, compras, cobros y gastos."
          />
        )}
        {button("+ Registrar movimiento", () => go("movement-new"))}
      </>
    );
  } else if (route.page === "movement-new") {
    title = "Nuevo movimiento";
    back = "movements";
    const out = v("type", "Egreso") === "Egreso";
    let amount = 0;
    try {
      amount = cents(v("amount", "0"));
    } catch {}
    content = (
      <form
        onSubmit={(e) =>
          submit(e, () =>
            mutate(
              (s) => {
                const a = cents(v("amount"));
                if (a <= 0) throw Error("El importe debe ser mayor a cero.");
                s.movements.push({
                  id: uid(),
                  concept: v("concept").trim(),
                  category: v("category", "Personal"),
                  date: v("date", today()),
                  amount: out ? -a : a,
                });
              },
              "Movimiento registrado",
              { page: "movements" },
            ),
          )
        }
      >
        <div className="segments">
          {["Ingreso", "Egreso"].map((type) => (
            <button
              key={type}
              type="button"
              className={v("type", "Egreso") === type ? "selected" : ""}
              onClick={() => setForm((f) => ({ ...f, type }))}
            >
              {type === "Ingreso" ? <ArrowDownLeft /> : <ArrowUpRight />}
              {type}
            </button>
          ))}
        </div>
        {field("Monto · MXN", "amount", {
          inputMode: "decimal",
          required: true,
          placeholder: "0.00",
          className: "amount-input",
        })}
        {field("Concepto", "concept", {
          required: true,
          maxLength: 150,
          placeholder: "¿En qué se usó?",
        })}
        {field("Fecha", "date", {
          type: "date",
          required: true,
          value: v("date", today()),
          min: state.openingDate,
          max: today(),
        })}
        {select("Categoría", "category", ["Personal", "Regalo", "Otros"])}
        <div className="panel">
          <span className="muted">Tu efectivo después</span>
          <div
            className={
              "amount " +
              (balance(state) + (out ? -amount : amount) < 0 ? "negative" : "")
            }
          >
            {money(balance(state) + (out ? -amount : amount))}
          </div>
          <small>Saldo actual {money(balance(state))}</small>
        </div>
        <button className="primary" disabled={busy}>
          Guardar {out ? "egreso" : "ingreso"}
        </button>
      </form>
    );
  } else if (route.page === "entry") {
    back = "movements";
    title = "Detalle del movimiento";
    const entry = entries(state).find((e) => e.id === route.id);
    content = entry ? (
      <>
        <span className="eyebrow">{entry.category}</span>
        <h2>{entry.concept}</h2>
        <div className={"amount " + (entry.amount > 0 ? "positive" : "")}>
          {money(entry.amount)}
        </div>
        <p className="muted">{shortDate(entry.date)}</p>
        {entry.lotId ? (
          button(
            "Ver inversión relacionada",
            () => go("lot", entry.lotId),
            true,
          )
        ) : (
          <>
            <div className="notice">
              Las anulaciones se conservan en el historial; no borran el
              registro original.
            </div>
            {button(
              "Anular este movimiento",
              async () => {
                if (
                  await confirmAction(
                    "¿Anular este movimiento? El saldo se recalculará y quedará registro.",
                  )
                )
                  run(() =>
                    mutate(
                      (s) => {
                        const m = s.movements.find(
                          (m) => m.id === entry.sourceId,
                        )!;
                        m.voided = true;
                        const plan = s.plans.find((p) => p.movementId === m.id);
                        if (plan) plan.movementId = undefined;
                      },
                      "Movimiento anulado: " + entry.concept,
                      { page: "movements" },
                    ),
                  );
              },
              true,
            )}
          </>
        )}
      </>
    ) : (
      <Empty
        title="Movimiento no encontrado"
        description="Puede haber sido anulado."
      />
    );
  } else if (route.page === "plans") {
    title = "Planes";
    const pending = pendingPlans(state);
    content = (
      <>
        <p className="muted">Decide antes de gastar.</p>
        <section className="panel balance">
          <span className="muted">Gastos planeados</span>
          <div className="amount">
            {money(pending.reduce((a, p) => a + p.amount, 0))}
          </div>
          <small>Efectivo actual {money(balance(state))}</small>
        </section>
        <section className="panel">
          <h2>Tu saldo previsto</h2>
          <Chart s={state} />
        </section>
        <div className="section-heading">
          <h2>Gastos programados</h2>
        </div>
        {pending.length ? (
          pending
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((p) => (
              <button
                key={p.id}
                className="plan-row panel"
                onClick={() => go("plan", p.id)}
              >
                <CalendarBlank size={24} />
                <div>
                  <h3>{p.concept}</h3>
                  <small>{shortDate(p.date)}</small>
                </div>
                <div className="right">
                  <strong>{money(p.amount)}</strong>
                  <small className="gold">
                    {p.date < today() ? "Fecha vencida" : "Pendiente"}
                  </small>
                </div>
              </button>
            ))
        ) : (
          <Empty
            title="Sin gastos comprometidos"
            description="Planea una compra para conocer su impacto antes de pagarla."
          />
        )}
        <small className="hint">
          Lo planeado aún no se descuenta del efectivo actual.
        </small>
        {button("+ Planificar gasto", () => go("plan-new"))}
        {state.plans.some((p) => p.movementId) && (
          <p className="muted">
            {state.plans.filter((p) => p.movementId).length} planes pagados
            registrados en Movimientos.
          </p>
        )}
      </>
    );
  } else if (route.page === "plan-new") {
    title = "Planificar gasto";
    back = "plans";
    let a = 0;
    try {
      a = cents(v("amount", "0"));
    } catch {}
    content = (
      <form
        onSubmit={(e) =>
          submit(e, () =>
            mutate(
              (s) =>
                s.plans.push({
                  id: uid(),
                  concept: v("concept").trim(),
                  date: v("date", today()),
                  amount: cents(v("amount")),
                  category: v("category", "Personal"),
                }),
              "Gasto planeado",
              { page: "plans" },
            ),
          )
        }
      >
        <p className="muted">Mira cómo cambia tu efectivo.</p>
        {field("Concepto", "concept", { required: true, maxLength: 150 })}
        {field("Monto · MXN", "amount", {
          inputMode: "decimal",
          required: true,
          placeholder: "0.00",
        })}
        {field("Fecha prevista", "date", {
          type: "date",
          value: v("date", today()),
          min: today(),
          required: true,
        })}
        {select("Categoría", "category", ["Personal", "Inversión", "Otros"])}
        <section className="panel">
          <h2>Impacto en tu efectivo</h2>
          <div className="summary-row">
            <span>Disponible tras otros planes</span>
            <strong>
              {money(
                balance(state) -
                  pendingPlans(state).reduce((a, p) => a + p.amount, 0),
              )}
            </strong>
          </div>
          <div className="summary-row total">
            <span>Incluyendo este gasto</span>
            <strong>
              {money(
                balance(state) -
                  pendingPlans(state).reduce((a, p) => a + p.amount, 0) -
                  a,
              )}
            </strong>
          </div>
        </section>
        <div className="notice">
          Se incluirá en tu proyección. El efectivo cambia cuando registres el
          pago.
        </div>
        <button className="primary" disabled={busy}>
          Guardar plan
        </button>
      </form>
    );
  } else if (route.page === "plan") {
    title = "Gasto planeado";
    back = "plans";
    const p = state.plans.find((p) => p.id === route.id);
    content = p ? (
      <>
        <h2>{p.concept}</h2>
        <div className="amount">{money(p.amount)}</div>
        <p>{shortDate(p.date)}</p>
        <div className="notice">
          {p.category === "Inversión"
            ? "Agrega los productos comprados al lote. Cada compra reduce el pendiente del plan y el efectivo una sola vez."
            : "Al marcarlo como pagado se registra un egreso una sola vez."}
        </div>
        {p.category === "Inversión"
          ? button(
              p.lotId
                ? "Agregar productos al lote"
                : "Registrar compra de productos",
              () =>
                run(() =>
                  mutate((s) => {
                    const plan = s.plans.find((x) => x.id === p.id)!;
                    if (!plan.lotId) {
                      const id = uid();
                      s.lots.push({
                        id,
                        name: plan.concept,
                        createdAt: today(),
                        products: [],
                        sales: [],
                        rules: [],
                      });
                      plan.lotId = id;
                    }
                    return { page: "product-new", lot: plan.lotId };
                  }, "Plan vinculado a inversión"),
                ),
            )
          : button("Registrar pago de hoy", () =>
              run(() =>
                mutate(
                  (s) => {
                    const plan = s.plans.find((x) => x.id === p.id)!;
                    if (plan.movementId || plan.cancelled)
                      throw Error("El plan ya está resuelto.");
                    const id = uid();
                    s.movements.push({
                      id,
                      amount: -plan.amount,
                      concept: plan.concept,
                      category: plan.category,
                      date: today(),
                    });
                    plan.movementId = id;
                  },
                  "Plan pagado: " + p.concept,
                  { page: "plans" },
                ),
              ),
            )}
        {button(
          "Cancelar plan",
          async () => {
            if (
              await confirmAction("¿Cancelar este plan? No afecta tu efectivo.")
            )
              run(() =>
                mutate(
                  (s) => {
                    s.plans.find((x) => x.id === p.id)!.cancelled = true;
                  },
                  "Plan cancelado",
                  { page: "plans" },
                ),
              );
          },
          true,
        )}
      </>
    ) : null;
  } else if (route.page === "investments") {
    title = "Inversión";
    content = (
      <>
        <p className="muted">Tu dinero, producto por producto.</p>
        <section className="panel balance">
          <span className="muted">Invertido en compras</span>
          <div className="amount">
            {money(state.lots.reduce((a, l) => a + cost(l), 0))}
          </div>
          <div className="split">
            <div>
              <span>Cobrado</span>
              <strong>
                {money(state.lots.reduce((a, l) => a + collected(l), 0))}
              </strong>
            </div>
            <div>
              <span>Ganancia estimada</span>
              <strong className="gold">
                {money(state.lots.reduce((a, l) => a + net(l), 0))}
              </strong>
            </div>
          </div>
        </section>
        <h2 className="section-heading">Tus lotes</h2>
        {state.lots.map((l) => (
          <section className="panel lot-card" key={l.id}>
            <button className="lot-open" onClick={() => go("lot", l.id)}>
              {l.products[0]?.photo && (
                <img
                  className="lot-hero"
                  src={asset(l.products[0].photo)}
                  alt={l.name}
                />
              )}
              <div className="between">
                <h2>{l.name}</h2>
                <ArrowUpRight size={23} />
              </div>
              <p className="muted">
                {l.products.reduce((a, p) => a + available(l, p), 0)}{" "}
                disponibles ·{" "}
                {l.sales
                  .filter((s) => !s.voided)
                  .reduce((a, s) => a + s.units, 0)}{" "}
                vendidas
              </p>
            </button>
            <Recovery l={l} />
            <button
              className="text-button lot-link"
              onClick={() => go("lot", l.id)}
            >
              <ChartLineUp size={21} />
              Ver productos y resultado
              <ArrowUpRight size={18} />
            </button>
          </section>
        ))}
        {!state.lots.length && (
          <Empty
            title="Comienza con un lote"
            description="Agrupa una compra de productos. Cada modelo tendrá su foto, costo y precio."
          />
        )}
        {button("+ Nueva inversión", () => go("lot-new"))}
      </>
    );
  } else if (route.page === "lot-new") {
    title = "Nueva inversión";
    back = "investments";
    content = (
      <form
        onSubmit={(e) =>
          submit(e, () =>
            mutate((s) => {
              const id = uid();
              s.lots.push({
                id,
                name: v("name").trim(),
                createdAt: today(),
                products: [],
                sales: [],
                rules: [],
              });
              return { page: "product-new", lot: id };
            }, "Inversión creada"),
          )
        }
      >
        <p className="muted">
          Un lote reúne los productos de una compra y sus gastos compartidos.
        </p>
        {field("Nombre del lote", "name", {
          required: true,
          maxLength: 100,
          placeholder: "Ej. Mochilas · octubre",
        })}
        <div className="notice">
          Después agrega cada modelo con su foto, unidades y precios.
        </div>
        <button className="primary" disabled={busy}>
          Crear lote y agregar producto
        </button>
      </form>
    );
  } else if (route.page === "lot" && activeLot) {
    const l = activeLot;
    title = l.name;
    back = "investments";
    content = (
      <>
        <section className="panel">
          <Recovery l={l} />
        </section>
        <div className="section-heading">
          <h2>Productos</h2>
          <button
            className="text-button red"
            onClick={() => go("product-new", undefined, l.id)}
          >
            <Plus size={20} />
            Agregar
          </button>
        </div>
        <section className="panel product-list">
          {l.products.map((p) => (
            <button
              className="product-row"
              key={p.id}
              onClick={() => go("product", p.id, l.id)}
            >
              <ProductPhoto p={p} />
              <div>
                <h3>{p.name}</h3>
                <small>
                  {available(l, p)} disponibles · {p.units - available(l, p)}{" "}
                  vendidas
                </small>
                <small>
                  Compra {money(p.cost)} · Venta {money(p.price)}
                </small>
              </div>
            </button>
          ))}
          {!l.products.length && (
            <Empty
              title="Agrega tu primer producto"
              description="Una foto y sus precios son suficientes para comenzar."
            />
          )}
        </section>
        <section className="panel">
          <h2>Resultado estimado del lote</h2>
          {[
            ["Ventas totales previstas", gross(l)],
            ["Costo de compra", -cost(l)],
            ["Gastos adicionales", -fees(l)],
          ].map(([label, n]) => (
            <div className="summary-row" key={label}>
              <span>{label}</span>
              <strong>{money(Number(n))}</strong>
            </div>
          ))}
          <div className="summary-row total">
            <strong>Ganancia neta estimada</strong>
            <strong>{money(net(l))}</strong>
          </div>
          <small>Incluye ventas realizadas y las unidades por vender.</small>
          <button
            className="text-button"
            onClick={() => go("rules", undefined, l.id)}
          >
            <Plus size={20} />
            Gastos y reglas del total
          </button>
        </section>
        {l.sales.some((s) => !s.voided && !s.paidDate) && (
          <section className="panel">
            <h2>Ventas por cobrar</h2>
            {l.sales
              .filter((s) => !s.voided && !s.paidDate)
              .map((s) => (
                <div className="summary-row" key={s.id}>
                  <span>
                    {l.products.find((p) => p.id === s.productId)?.name}
                    <small>{money(s.price * s.units)}</small>
                  </span>
                  <button
                    className="secondary compact"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        mutate((st) => {
                          st.lots
                            .find((x) => x.id === l.id)!
                            .sales.find((x) => x.id === s.id)!.paidDate =
                            today();
                        }, "Venta cobrada"),
                      )
                    }
                  >
                    Cobrar
                  </button>
                </div>
              ))}
          </section>
        )}
        {button("Registrar venta", () => go("sale-new", undefined, l.id))}
        {l.sales.some((s) => !s.voided) && (
          <section className="panel">
            <h2>Historial de ventas</h2>
            {l.sales
              .filter((s) => !s.voided)
              .map((s) => (
                <div className="summary-row" key={s.id}>
                  <span>
                    {l.products.find((p) => p.id === s.productId)?.name}
                    <small>
                      {s.units} unid. · {s.paidDate ? "Cobrado" : "Por cobrar"}{" "}
                      · {shortDate(s.date)}
                    </small>
                  </span>
                  <strong>{money(s.units * s.price)}</strong>
                  <button
                    className="icon-button"
                    title="Anular venta"
                    aria-label={
                      "Anular venta de " +
                      l.products.find((p) => p.id === s.productId)?.name
                    }
                    onClick={async () => {
                      if (
                        await confirmAction(
                          "¿Anular esta venta y devolver las unidades al inventario? Se conservará el registro.",
                        )
                      )
                        run(() =>
                          mutate((st) => {
                            st.lots
                              .find((x) => x.id === l.id)!
                              .sales.find((x) => x.id === s.id)!.voided = true;
                          }, "Venta anulada"),
                        );
                    }}
                  >
                    <ArrowClockwise size={18} />
                  </button>
                </div>
              ))}
          </section>
        )}
      </>
    );
  } else if (route.page === "product-new" && activeLot) {
    title = "Agregar producto";
    back = "lot";
    const l = activeLot;
    let q = 0,
      c = 0,
      p = 0;
    try {
      q = quantity(v("units", "1"));
      c = cents(v("cost", "0"));
      p = cents(v("price", "0"));
    } catch {}
    const upload = async (file?: File) => {
      if (file) {
        setBusy(true);
        try {
          const url = await photo(file);
          setForm((f) => ({ ...f, photo: url }));
        } finally {
          setBusy(false);
        }
      }
    };
    content = (
      <form
        onSubmit={(e) =>
          submit(e, () =>
            mutate(
              (s) => {
                s.lots
                  .find((x) => x.id === l.id)!
                  .products.push({
                    id: uid(),
                    name: v("name").trim(),
                    photo: v("photo"),
                    units: quantity(v("units", "1")),
                    cost: cents(v("cost")),
                    price: cents(v("price")),
                    date: v("date", today()),
                  });
              },
              "Producto comprado y agregado",
              { page: "lot", id: l.id },
            ),
          )
        }
      >
        <p className="muted">{l.name}</p>
        <div className="photo-preview">
          {v("photo") ? (
            <img src={asset(v("photo"))} alt="Foto del producto" />
          ) : (
            <>
              <Camera size={44} weight="thin" />
              <span>Una foto para reconocerlo al instante</span>
            </>
          )}
        </div>
        <div className="two-fields">
          <label className="secondary upload">
            <Camera size={20} />
            Tomar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => run(() => upload(e.target.files?.[0]))}
            />
          </label>
          <label className="secondary upload">
            <ImageIcon size={20} />
            Elegir foto
            <input
              type="file"
              accept="image/*"
              onChange={(e) => run(() => upload(e.target.files?.[0]))}
            />
          </label>
        </div>
        {field("Nombre del producto", "name", {
          required: true,
          maxLength: 100,
        })}
        {field("Unidades compradas", "units", {
          type: "number",
          inputMode: "numeric",
          min: 1,
          max: 100000,
          step: 1,
          value: v("units", "1"),
          required: true,
        })}
        <div className="two-fields">
          {field("Compra por unidad", "cost", {
            inputMode: "decimal",
            required: true,
            placeholder: "0.00",
          })}
          {field("Venta por unidad", "price", {
            inputMode: "decimal",
            required: true,
            placeholder: "0.00",
          })}
        </div>
        {field("Fecha de compra", "date", {
          type: "date",
          required: true,
          value: v("date", today()),
          min: state.openingDate,
          max: today(),
        })}
        <div className="panel">
          <div className="summary-row">
            <span>Inversión</span>
            <strong>{money(c * q)}</strong>
          </div>
          <div className="summary-row">
            <span>Venta estimada</span>
            <strong>{money(p * q)}</strong>
          </div>
          <div className="summary-row total">
            <span>Ganancia estimada</span>
            <strong>{money((p - c) * q)}</strong>
          </div>
        </div>
        <div className="notice">
          Al guardar se registra la compra: tu efectivo se reduce {money(c * q)}
          . No la registres otra vez en Movimientos.
        </div>
        <button className="primary" disabled={busy}>
          Guardar producto
        </button>
      </form>
    );
  } else if (route.page === "product" && activeLot) {
    const l = activeLot;
    const p = l.products.find((p) => p.id === route.id);
    title = p?.name || "Producto";
    back = "lot";
    content = p ? (
      <>
        <div className="photo-preview">
          <ProductPhoto p={p} />
        </div>
        <div className="panel">
          <div className="summary-row">
            <span>Disponibles</span>
            <strong>{available(l, p)}</strong>
          </div>
          <div className="summary-row">
            <span>Precio de compra</span>
            <strong>{money(p.cost)}</strong>
          </div>
          <div className="summary-row">
            <span>Precio de venta actual</span>
            <strong>{money(p.price)}</strong>
          </div>
          <div className="summary-row total">
            <span>Margen por unidad</span>
            <strong>{money(p.price - p.cost)}</strong>
          </div>
        </div>
        <form
          onSubmit={(e) =>
            submit(e, () =>
              mutate((s) => {
                s.lots
                  .find((x) => x.id === l.id)!
                  .products.find((x) => x.id === p.id)!.price = cents(
                  v("price", (p.price / 100).toFixed(2)),
                );
              }, "Precio de venta actualizado"),
            )
          }
        >
          {field("Nuevo precio de venta", "price", {
            inputMode: "decimal",
            value: v("price", (p.price / 100).toFixed(2)),
            required: true,
          })}
          <button className="secondary" disabled={busy}>
            Actualizar precio
          </button>
        </form>
        {button("Registrar venta", () => go("sale-new", p.id, l.id))}
        <details className="panel correction">
          <summary>Corregir la compra registrada</summary>
          <form
            onSubmit={(e) =>
              submit(e, async () => {
                const units = quantity(v("correctUnits", String(p.units)));
                const purchase = cents(
                  v("correctCost", (p.cost / 100).toFixed(2)),
                );
                if (
                  !(await confirmAction(
                    "¿Corregir el costo y las unidades de esta compra? Se recalcularán el efectivo y el inventario, conservando un registro del cambio.",
                  ))
                )
                  return;
                await mutate(
                  (s) => {
                    const product = s.lots
                      .find((x) => x.id === l.id)!
                      .products.find((x) => x.id === p.id)!;
                    product.units = units;
                    product.cost = purchase;
                  },
                  `Compra corregida: ${p.name}; ${p.units} × ${money(p.cost)} → ${units} × ${money(purchase)}`,
                );
              })
            }
          >
            <p className="muted">
              Solo para corregir un dato capturado por error. Para una nueva
              compra, agrega otro producto.
            </p>
            {field("Unidades compradas correctas", "correctUnits", {
              type: "number",
              min: 1,
              max: 100000,
              step: 1,
              required: true,
              value: v("correctUnits", String(p.units)),
            })}
            {field("Costo correcto por unidad", "correctCost", {
              inputMode: "decimal",
              required: true,
              value: v("correctCost", (p.cost / 100).toFixed(2)),
            })}
            <button className="secondary" disabled={busy}>
              Guardar corrección
            </button>
          </form>
        </details>
        <small>
          Las ventas anteriores conservan su precio. El costo y las unidades
          compradas forman parte del registro de compra.
        </small>
      </>
    ) : null;
  } else if (route.page === "sale-new" && activeLot) {
    title = "Registrar venta";
    back = "lot";
    const l = activeLot;
    const p = l.products.find(
      (p) =>
        p.id ===
        v(
          "product",
          route.id || l.products.find((p) => available(l, p) > 0)?.id || "",
        ),
    );
    const paid = v("paid", "Cobrado") === "Cobrado";
    let qty = 1,
      price = p?.price ?? 0;
    try {
      qty = quantity(v("units", "1"));
      price = cents(v("price", ((p?.price ?? 0) / 100).toFixed(2)));
    } catch {}
    content = p ? (
      <form
        onSubmit={(e) =>
          submit(e, () =>
            mutate(
              (s) => {
                const lot = s.lots.find((x) => x.id === l.id)!;
                const product = lot.products.find((x) => x.id === p.id)!;
                const units = quantity(v("units", "1"));
                if (units > available(lot, product))
                  throw Error("No hay suficientes unidades.");
                const date = v("date", today());
                lot.sales.push({
                  id: uid(),
                  productId: p.id,
                  units,
                  price: cents(v("price", (p.price / 100).toFixed(2))),
                  date,
                  paidDate: paid ? date : undefined,
                });
              },
              "Venta registrada",
              { page: "lot", id: l.id },
            ),
          )
        }
      >
        <label className="field">
          <span>Producto</span>
          <select
            value={p.id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                product: e.target.value,
                price: (
                  (l.products.find((p) => p.id === e.target.value)?.price ??
                    0) / 100
                ).toFixed(2),
                units: "1",
              }))
            }
          >
            {l.products
              .filter((x) => available(l, x) > 0)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
        <div className="product-row panel">
          <ProductPhoto p={p} />
          <div>
            <h3>{p.name}</h3>
            <small>{available(l, p)} unidades disponibles</small>
          </div>
        </div>
        {field("Cantidad vendida", "units", {
          type: "number",
          min: 1,
          max: available(l, p),
          step: 1,
          value: v("units", "1"),
          required: true,
        })}
        {field("Precio por unidad · MXN", "price", {
          inputMode: "decimal",
          value: v("price", (p.price / 100).toFixed(2)),
          required: true,
        })}
        {field("Fecha de venta", "date", {
          type: "date",
          value: v("date", today()),
          min: p.date,
          max: today(),
          required: true,
        })}
        {select("Estado de pago", "paid", ["Cobrado", "Por cobrar"])}
        <section className="panel">
          <div className="summary-row">
            <span>Total de venta</span>
            <strong>{money(qty * price)}</strong>
          </div>
          <div className="summary-row">
            <span>Costo del producto</span>
            <strong>−{money(qty * p.cost)}</strong>
          </div>
          <div className="summary-row total">
            <strong>Ganancia de esta venta</strong>
            <strong>{money(qty * (price - p.cost))}</strong>
          </div>
          <small>Antes de gastos del lote.</small>
        </section>
        <div className="notice">
          <CheckCircle size={22} />
          <span>
            {paid
              ? `Al guardar: +${money(qty * price)} a tu efectivo.`
              : "Queda por cobrar; todavía no aumenta tu efectivo."}
            <br />
            Quedarán {Math.max(0, available(l, p) - qty)} unidades disponibles.
          </span>
        </div>
        <button className="primary" disabled={busy}>
          Guardar venta
        </button>
      </form>
    ) : (
      <Empty
        title="No hay unidades disponibles"
        description="Agrega un producto para registrar una venta."
        action={button("Agregar producto", () =>
          go("product-new", undefined, l.id),
        )}
      />
    );
  } else if (route.page === "rules" && activeLot) {
    title = "Gastos del lote";
    back = "lot";
    const l = activeLot;
    const ruleType = v("type", "Monto fijo");
    const ruleBase = v("base", "Ventas previstas");
    let value = 0;
    try {
      value = cents(v("value", "0"));
    } catch {}
    const draft: Rule = {
      id: "draft",
      name: "",
      type: ruleType === "Monto fijo" ? "fixed" : "percent",
      value,
      base: ruleBase === "Ventas previstas" ? "sales" : "cost",
    };
    const estimated = ruleAmount(l, draft);
    content = (
      <>
        <p className="muted">{l.name}</p>
        <div className="notice gold">
          <WarningCircle size={22} />
          <span>
            Se aplican una vez al total del lote. No se multiplican por
            producto.
          </span>
        </div>
        {l.rules.map((r) => (
          <section className="panel" key={r.id}>
            <div className="between">
              <h3>{r.name}</h3>
              {!r.paidDate && (
                <button
                  className="icon-button"
                  aria-label={"Eliminar regla " + r.name}
                  onClick={async () => {
                    if (await confirmAction("¿Quitar esta regla pendiente?"))
                      run(() =>
                        mutate((s) => {
                          const lot = s.lots.find((x) => x.id === l.id)!;
                          lot.rules = lot.rules.filter((x) => x.id !== r.id);
                        }, "Regla retirada"),
                      );
                  }}
                >
                  <Trash size={20} />
                </button>
              )}
            </div>
            <div className="summary-row">
              <span>
                {r.type === "fixed"
                  ? "Monto fijo"
                  : `${(r.value / 100).toFixed(2)}% de ${r.base === "sales" ? "ventas previstas" : "costo de compra"}`}
              </span>
              <strong>{money(r.paidAmount ?? ruleAmount(l, r))}</strong>
            </div>
            {r.paidDate ? (
              <>
                <small className="positive">
                  Pagado · {shortDate(r.paidDate)} · Importe congelado
                </small>
                {button(
                  "Anular este pago",
                  async () => {
                    if (
                      await confirmAction(
                        "¿Anular el pago? El gasto volverá a pendiente y se recalculará tu efectivo.",
                      )
                    )
                      run(() =>
                        mutate((s) => {
                          const rule = s.lots
                            .find((x) => x.id === l.id)!
                            .rules.find((x) => x.id === r.id)!;
                          delete rule.paidDate;
                          delete rule.paidAmount;
                        }, "Pago de gasto anulado: " + r.name),
                      );
                  },
                  true,
                )}
              </>
            ) : (
              button(
                "Registrar pago de " + money(ruleAmount(l, r)),
                async () => {
                  if (
                    await confirmAction(
                      "¿Registrar este gasto como pagado hoy? Se descontará una sola vez de tu efectivo.",
                    )
                  )
                    run(() =>
                      mutate((s) => {
                        const lot = s.lots.find((x) => x.id === l.id)!;
                        const rule = lot.rules.find((x) => x.id === r.id)!;
                        if (rule.paidDate)
                          throw Error("Este gasto ya está pagado.");
                        rule.paidAmount = ruleAmount(lot, rule);
                        rule.paidDate = today();
                      }, "Gasto de lote pagado"),
                    );
                },
                true,
              )
            )}
          </section>
        ))}
        <form
          className="panel"
          onSubmit={(e) =>
            submit(e, () =>
              mutate(
                (s) =>
                  s.lots
                    .find((x) => x.id === l.id)!
                    .rules.push({
                      ...draft,
                      id: uid(),
                      name: v("name").trim(),
                    }),
                "Regla agregada",
              ).then(() => setForm({})),
            )
          }
        >
          <h2>Agregar regla opcional</h2>
          {field("Nombre del gasto", "name", {
            required: true,
            maxLength: 100,
            placeholder: "Ej. Envío a Cuba",
          })}
          {select("Tipo", "type", ["Monto fijo", "Porcentaje"])}
          {field(
            ruleType === "Monto fijo" ? "Importe · MXN" : "Porcentaje (0–100)",
            "value",
            {
              inputMode: "decimal",
              required: true,
              placeholder: ruleType === "Monto fijo" ? "800.00" : "3.00",
            },
          )}
          {ruleType === "Porcentaje" &&
            select("Aplicar sobre el total de", "base", [
              "Ventas previstas",
              "Costo de compra",
            ])}
          <div className="summary-row">
            <span>Descuento estimado</span>
            <strong>{money(estimated)}</strong>
          </div>
          <button className="secondary" disabled={busy}>
            <Plus size={19} />
            Guardar regla
          </button>
        </form>
        <section className="panel">
          <h2>Resultado con las reglas guardadas</h2>
          <div className="summary-row">
            <span>Ventas previstas</span>
            <strong>{money(gross(l))}</strong>
          </div>
          <div className="summary-row">
            <span>Compra de productos</span>
            <strong>−{money(cost(l))}</strong>
          </div>
          <div className="summary-row">
            <span>Gastos del lote</span>
            <strong>−{money(fees(l))}</strong>
          </div>
          <div className="summary-row total">
            <strong>Ganancia neta estimada</strong>
            <strong>{money(net(l))}</strong>
          </div>
          <small>
            Las reglas pendientes solo afectan la estimación. Registra el pago
            cuando ocurra.
          </small>
        </section>
      </>
    );
  } else if (route.page === "settings") {
    title = "Tu espacio";
    content = (
      <>
        <section className="panel">
          <h2>{state.name}</h2>
          <p className="muted">
            Moneda base: MXN · Inicio {shortDate(state.openingDate)}
          </p>
          <div className="notice">
            {user ? <CloudCheck size={22} /> : <CloudSlash size={22} />}
            <span>
              {user
                ? "Cuenta privada con sincronización"
                : "Datos guardados en este navegador"}
              <br />
              <small>
                {scope === "demo"
                  ? "Modo de ejemplo. No uses cifras reales aquí."
                  : syncStatus || "Cada cambio se guarda en este dispositivo."}
              </small>
            </span>
          </div>
          {user && button("Sincronizar ahora", () => run(() => sync()), true)}
          {!user &&
            supabase &&
            button("Entrar con cuenta en la nube", () => go("auth"), true)}
        </section>
        <section className="panel">
          <h2>Respaldo y recuperación</h2>
          <p className="muted">
            El archivo incluye movimientos, fotos, planes y tu historial.
            Guárdalo en un lugar privado.
          </p>
          {button("Descargar respaldo JSON", () => download(state), true)}
          <label className="secondary upload">
            <DownloadSimple size={19} />
            Restaurar respaldo
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  run(async () => {
                    if (f.size > 20000000)
                      throw Error("El respaldo supera 20 MB.");
                    const data = JSON.parse(await f.text());
                    if (data.app !== "Zay")
                      throw Error("Elige un respaldo de Zay.");
                    validate(data.state);
                    if (
                      await confirmAction(
                        "¿Reemplazar los datos de este espacio por el respaldo? Descarga primero una copia del estado actual.",
                      )
                    )
                      await commit(data.state, "Respaldo restaurado");
                  });
              }}
            />
          </label>
        </section>
        {user && (
          <section className="panel">
            <h2>Resolver conflicto entre dispositivos</h2>
            <p className="muted">
              Descarga un respaldo antes de elegir. No se mezclan ni
              sobrescriben cuentas automáticamente.
            </p>
            {button(
              "Usar la versión de la nube",
              async () => {
                if (
                  await confirmAction(
                    "¿Reemplazar la copia de este dispositivo con la nube?",
                  )
                )
                  run(async () => {
                    const remote = await pull();
                    if (!remote) throw Error("No hay respaldo en la nube.");
                    const result = await write(
                      scope,
                      validate(remote.state),
                      saved!.revision,
                      remote.revision,
                      false,
                    );
                    setSaved(result);
                    savedRef.current = result;
                    setSyncStatus("Al día en la nube");
                  });
              },
              true,
            )}
            {button(
              "Conservar esta versión en la nube",
              async () => {
                if (
                  await confirmAction(
                    "¿Reemplazar la versión remota con esta copia?",
                  )
                )
                  run(async () => {
                    const remote = await pull();
                    const rev = await push(state, remote?.revision ?? 0);
                    const result = await write(
                      scope,
                      state,
                      saved!.revision,
                      rev,
                      false,
                    );
                    setSaved(result);
                    savedRef.current = result;
                    setSyncStatus("Al día en la nube");
                  });
              },
              true,
            )}
          </section>
        )}
        <section className="panel">
          <h2>Instalar en iPhone</h2>
          <p className="muted">
            {offlineReady
              ? "Programa preparado sin conexión"
              : "Abre la app online por primera vez para preparar el modo sin conexión."}
          </p>
          <p className="muted">
            Abre la dirección HTTPS en Safari. Pulsa Compartir y después
            “Agregar a pantalla de inicio”. Una vez abierta, puede guardar
            cambios sin conexión.
          </p>
          {!supabase && (
            <small>
              Nube pendiente: configura Supabase para respaldar fuera del
              teléfono.
            </small>
          )}
        </section>
        <section className="panel">
          <h2>Historial de cambios</h2>
          {state.audit.slice(0, 15).map((a) => (
            <div className="audit-row" key={a.id}>
              <strong>{a.action}</strong>
              <small>{new Date(a.at).toLocaleString("es-MX")}</small>
            </div>
          ))}
          {!state.audit.length && <small>Los cambios aparecerán aquí.</small>}
        </section>
        {scope === "demo" ? (
          <>
            {button(
              "Restablecer ejemplo",
              async () => {
                if (
                  await confirmAction("¿Restablecer solo los datos de ejemplo?")
                )
                  run(async () => {
                    await commit(demo(), "Ejemplo restablecido");
                    go("home");
                  });
              },
              true,
            )}
            {button(
              "Salir del ejemplo y usar mis datos",
              () => localMode("device"),
              true,
            )}
          </>
        ) : user ? (
          button("Cerrar sesión", () => run(logout), true)
        ) : null}
      </>
    );
  } else
    content = (
      <Empty
        title="Pantalla no encontrada"
        description="Regresa al inicio."
        action={button("Ir al inicio", () => go("home"))}
      />
    );
  const backClick = () => go(back, back === "lot" ? route.lot : undefined);
  const body = (
    <>
      <div className={"zay-app " + (simulated ? "simulated" : "native")}>
        <header className="zay-header">
          {(!mainPage && state) ||
          ["auth", "onboarding"].includes(route.page) ? (
            <button
              className="back-button"
              aria-label="Volver"
              onClick={backClick}
            >
              <ArrowLeft size={24} />
            </button>
          ) : (
            <button
              className="brand"
              onClick={() => go("home")}
              aria-label="Zay, inicio"
            >
              <img src={asset("/icons/icon-192.png")} alt="" />
              Zay
            </button>
          )}
          <div className="header-end">
            {state && (
              <button
                className="sync-icon"
                aria-label={
                  user ? "Estado de sincronización" : "Guardado en dispositivo"
                }
                onClick={() => go("settings")}
              >
                {user && !saved?.dirty ? (
                  <CloudCheck size={19} />
                ) : (
                  <CloudSlash size={19} />
                )}
              </button>
            )}
            {state && (
              <button
                className="avatar"
                aria-label="Abrir ajustes"
                onClick={() => go("settings")}
              >
                {state.name.slice(0, 1).toUpperCase()}
              </button>
            )}
          </div>
        </header>
        {scope === "demo" && state && (
          <div className="demo-banner">Ejemplo · cifras ficticias</div>
        )}
        {!online && (
          <div className="offline-banner">
            Sin conexión · guardamos en este dispositivo
          </div>
        )}
        {simulated ? (
          <MobileScroll
            key={route.page + route.id + route.lot}
            className="zay-scroll"
          >
            <main className="zay-content">
              {title && <h1 className="page-title">{title}</h1>}
              {content}
            </main>
          </MobileScroll>
        ) : (
          <div className="zay-scroll" key={route.page + route.id + route.lot}>
            <main className="zay-content">
              {title && <h1 className="page-title">{title}</h1>}
              {content}
            </main>
          </div>
        )}
        {state && mainPage && (
          <nav className="bottom-nav" aria-label="Navegación principal">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={route.page === id ? "active" : ""}
                onClick={() => go(id)}
              >
                <Icon
                  size={25}
                  weight={route.page === id ? "regular" : "light"}
                />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        {confirmation && (
          <div className="confirm-backdrop">
            <section
              className="confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  answerConfirmation(false);
                }
                if (e.key === "Tab") {
                  const buttons =
                    e.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button",
                    );
                  const first = buttons[0],
                    last = buttons[buttons.length - 1];
                  if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                  }
                }
              }}
            >
              <h2 id="confirm-title">Confirma el cambio</h2>
              <p>{confirmation.message}</p>
              <div className="two-fields">
                <button
                  className="secondary"
                  autoFocus
                  onClick={() => answerConfirmation(false)}
                >
                  Cancelar
                </button>
                <button
                  className="primary"
                  onClick={() => answerConfirmation(true)}
                >
                  Confirmar
                </button>
              </div>
            </section>
          </div>
        )}
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            <button aria-label="Cerrar aviso" onClick={() => setMessage("")}>
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  );
  return simulated ? <SimWrap>{body}</SimWrap> : body;
}
export default function Prototype() {
  return <ZayApp simulated />;
}
