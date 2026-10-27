# Verificación

- 10 pruebas automatizadas de cálculo y base de datos PostgreSQL embebida.
- Validación TypeScript.
- Integridad de los 28 archivos del runtime de simulador.
- Navegador real, viewport 390 × 844: egreso de 850.10, reglas de envío 800 y comisión 3%, utilidad neta 2,476; venta por cobrar, cobro posterior, saldo tras cobro y persistencia al recargar; plan personal de 1,200 y pago único.
- Migración aplicada en proyecto FARO OS mediante SQL Editor con transacción. La creación inicial se comprobó antes de aplicarla (no existían tablas zay_).
- No se migraron datos reales ni se alteraron tablas, proveedores de auth o usuarios de FaroOS.

Supabase real: tablas `zay_accounts` y `zay_account_versions` verificadas con RLS=true, lectura anon=false e inserción directa authenticated=false.

Pendientes de validar en servicio real: login de la cuenta final y sincronización de dos dispositivos con esa cuenta. Las mismas reglas RLS, RPC y conflictos se probaron en PostgreSQL local. Instalación y cámara física de iPhone deben comprobarse con la usuaria.

Carga de foto de galería validada en navegador: compresión JPEG, 2 unidades a 1,000, venta 1,500, compra 2,000 y margen 1,000. Plan de inventario redujo de 9,000 a 7,000 sin doble egreso.

Modo sin servidor probado: se apagó el servidor de producción, se recargó la PWA, se registró un egreso de 1.25 y se volvió a recargar. Saldo conservado: 145,298.75. El servidor se reinició al terminar. Evidencia: `docs/screenshots/arranque-sin-servidor.jpg`.

## Dos accesos privados

Se crearon usuarios exclusivos zayris y uriel (sin alterar contraseñas ni usuarios de FaroOS). Login real de ambos verificado con Auth. Escritura temporal desde zayris y lectura desde uriel confirmaron el mismo patrimonio; la prueba se retiró sin dejar saldo ficticio. Las solicitudes anónimas quedaron denegadas. Doce pruebas locales incluyen un usuario no autorizado, claims administrativas, RLS compartida y conflicto de revisión entre usuarios. Las claves administrativas temporales se eliminaron.
