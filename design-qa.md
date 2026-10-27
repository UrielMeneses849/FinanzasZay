# QA visual de Zay

final result: passed

## Referencias y evidencia

- Fuente visual: `/Users/urielmeneses/.codex/generated_images/01a17c00-ecc6-7930-b81a-6b87d3d951e4/exec-a2324b00-0de7-4cd7-a8c3-e18fd548d250.png` (Inversión aprobada).
- Fuente original: 853 × 1844 px; normalizada a 390 × 844 CSS px para comparar.
- Implementación compilada: `http://localhost:4179/`, viewport 390 × 844, captura 390 × 844 px.
- Estado igualado: lote de 12 mochilas, 3 vendidas, 9 disponibles; compra 7,200, cobrado 2,500, ganancia prevista 3,600. Sin reglas adicionales.
- Captura: `docs/screenshots/inversion-produccion.jpg`.
- Comparación conjunta completa: `docs/screenshots/comparacion-inversion-final.jpg`.
- Comparación conjunta de recuperación y CTA: `docs/screenshots/comparacion-recuperacion.jpg`.
- Evidencia inicial de desviación: `docs/screenshots/comparacion-inversion-antes.jpg`.

## Historial de comparación

1. P2: demasiado espacio vertical y tarjeta de lote alta ocultaban recuperación y acción principal. Se redujeron huecos entre título/subtítulo, altura de la fotografía, espaciados del resumen y del indicador; el aviso de ejemplo pasó al encabezado.
2. P2: el indicador activo de navegación aumentaba la altura de la barra y tapaba parte de la CTA. Se posicionó el indicador dentro de la altura de navegación. La captura final compilada muestra el botón completo antes del borde de la barra.
3. Comparación final conjunta, incluida la región de recuperación: sin P0/P1/P2 pendientes.

## Superficies revisadas

- Tipografía: Poppins local, pesos 400/500/600/700; jerarquía, saltos de línea e importes tabulares comprobados.
- Espaciado: radios 22 px, tarjetas y contenido alineados, CTA de 49 px visible. Alineación y altura global comparadas con la fuente.
- Color: carbón #0d0d10, grafito #17171c, rojo #e32636, dorado #d7af71; verde reservado a cobros positivos.
- Imágenes: fotografías reales generadas para el concepto, colocadas con object-fit sin deformación; icono Z generado, iconografía de Phosphor.
- Contenido: cifras consistentes con el escenario, recuperación mostrada como 34.7% en lugar del 35% redondeado del concepto, formato monetario con centavos.

## Interacciones y verificación

- Egreso, venta pendiente, cobro, reglas fija/porcentaje, utilidad neta, plan y pago único comprobados en navegador real.
- Foto de galería, compresión JPEG y compra de producto dentro de un plan comprobados.
- Recarga conserva el estado. Se verificó arranque, guardado y segunda recarga con servidor apagado (service worker).
- Sin errores de consola de la implementación; durante HMR se detectó una advertencia por recreación del cliente auth y se añadió singleton de desarrollo y clave de sesión específica de Zay.
- 10 pruebas de cálculo/PostgreSQL embebido, TypeScript, integridad del simulador y pruebas Sites.

## Diferencias aceptadas / P3

- La cabecera incluye aviso de datos ficticios y estado de guardado, necesarios en la aplicación real.
- Fotografía nueva inspirada en el concepto e iconos equivalentes de Phosphor.
- El porcentaje y los importes muestran precisión adicional.
- Cámara e instalación en iPhone físico, login final y sincronización de dos equipos siguen pendientes de validación con la cuenta de la usuaria; no se consideran validados por una captura de escritorio.
