# Zay · Finanzas de Zayris

PWA de acceso privado para iPhone 13. El código es público por autorización de Uriel para publicar en GitHub Pages. Interfaz oscura basada en los conceptos aprobados: Poppins, carmín Nexvora, grafito y acentos dorados.

## Funciones

- Capital inicial, ingresos, egresos y consulta por mes.
- Efectivo real y proyección mensual a partir de planes pendientes.
- Gastos planeados, pago único, cancelación y vinculación de compras de mercancía a un lote.
- Lotes y productos con cámara/galería, unidades, costo, precio y margen.
- Ventas parciales, cobros pendientes, cobro posterior y anulación con historial.
- Recuperación del costo de compra con cobros netos de gastos pagados.
- Reglas opcionales sobre el **total del lote**, monto fijo o porcentaje de ventas/costo. Los importes pagados se congelan.
- IndexedDB, respaldo/restauración JSON y sincronización privada de un único patrimonio compartido por Zayris y Uriel mediante control de revisiones.
- PWA con caché del programa, fuentes locales e iconos de instalación. Nunca cachea solicitudes de Supabase.

## Desarrollo

Node 24.13 o posterior. `npm ci`, copiar `.env.example` a `.env.local` y completar las variables públicas.

- `npm run dev -- --port 4178`: simulador en `/`; aplicación nativa en `/pwa.html`.
- `npm test`: cálculos y migración SQL ejecutada con PostgreSQL embebido, RLS y concurrencia.
- `npm run build:pwa`: aplicación instalable en `dist/pwa` (entrada `index.html`).
- `npm run build`: simulador preservado, compatible con Sites.
- `npm run check:runtime` y `npm run test:sites`: verificaciones del simulador.

## Supabase

Proyecto existente **FARO OS**, referencia `lkwuyrowslitxbftkbqx`. Migración aplicada: `supabase/migrations/202610270001_zay.sql`. No modifica las tablas de FaroOS ni su configuración de autenticación.

Crea `public.zay_accounts`, `public.zay_account_versions`, validación `zay_validate_state` y escritura atómica `zay_save_account`. Solo los dos usuarios provisionados con claims administrativas de Zay pueden leer el patrimonio compartido; las escrituras solo pasan por RPC, con comprobación de revisión. Conserva hasta 20 versiones anteriores por usuario. Un respaldo contiene todo el estado, incluidas fotos JPEG optimizadas. Límite de snapshot: 20 MB; foto: 800,000 caracteres.

Se reutiliza Supabase Auth del proyecto compartido, con dos cuentas nuevas exclusivas de Zay: usuarios `zayris` y `uriel`. No se alteran usuarios, contraseñas, registro o proveedores de FaroOS. No hay registro abierto en Zay. La migración `202610270002_shared_private_access.sql` limita tanto lectura como escritura al workspace asignado en `app_metadata` por Auth Admin. `user_metadata` no concede acceso. Las dos cuentas tienen acceso de lectura y edición al mismo patrimonio.

Las contraseñas se entregan fuera del repositorio. No están en este código, el frontend, los workflows ni los artefactos públicos. Los alias de correo internos `.invalid` son identificadores de acceso, no buzones; no se envían invitaciones ni recuperación por correo a esos alias. Una recuperación se realiza por administración, verificando la identidad de la usuaria. Los scripts `provision-zay-users.mjs` y `verify-zay-access.mjs` se ejecutan solo localmente con una clave administrativa temporal externa al repositorio. Nunca configurar esa clave en VITE.

Solo `VITE_SUPABASE_URL` y la clave pública publishable/anon llegan al navegador. **Nunca** usar `service_role`, contraseña de PostgreSQL o tokens administrativos en variables VITE, Git o el cliente.

## Instalación

GitHub Pages se publica desde la rama `gh-pages`. `npm run build:pages` prepara `dist/pwa` con base `/FinanzasZay/`, manifest, iconos y service worker bajo esa ruta. Para hosting en raíz: `npm run build:pwa`. En iPhone: Safari → Compartir → Agregar a pantalla de inicio. El build genera el alcance y las rutas del manifest y service worker según `ZAY_BASE_PATH`; no configurar rutas absolutas de raíz en el frontend.

La persistencia sin conexión es local. Safari puede eliminar los datos si se borra el almacenamiento del sitio; usar cuenta en nube y descargar respaldos. La UI marca cambios pendientes; un conflicto entre equipos requiere elección explícita desde Ajustes. No se aplica last-write-wins silenciosamente.

## Criterios contables

Todos los importes se guardan como enteros en centavos MXN. Los porcentajes usan centésimas de punto porcentual y se redondean una vez al centavo sobre el total elegido. El efectivo se deriva de un registro único: apertura + movimientos + cobros − compras − gastos de lote pagados. Las ganancias esperadas y las ventas por cobrar no son efectivo.

La proyección excluye ingresos hipotéticos de inventario no vendido. Las reglas de lote sin fecha afectan la utilidad estimada; no comprometen una fecha de egreso hasta registrar el pago. Moneda base actual: MXN; no hay conversión automática para operaciones en Cuba.

## Validación y límites

Ver `design-qa.md` y `docs/verification.md`. El proyecto incluye un modo de ejemplo separado del espacio real. La validación en escritorio y viewport 390 × 844 no reemplaza una prueba física final de cámara, almacenamiento e instalación en el iPhone 13.
