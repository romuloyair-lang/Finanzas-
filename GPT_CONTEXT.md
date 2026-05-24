# Contexto para GPT / Codex

Este repositorio contiene una app web PWA llamada **Finanzas SZR**. La app está pensada para funcionar desde navegador móvil, especialmente iPhone, y también puede agregarse a la pantalla de inicio como una app.

## Objetivo de la app

Crear una herramienta sencilla de finanzas personales para Yair / SZR que permita:

- Registrar ingresos.
- Registrar gastos.
- Ver balance actual.
- Ver ingresos totales.
- Ver gastos totales.
- Ver dinero libre.
- Registrar metas de ahorro.
- Exportar movimientos en CSV.
- Guardar información localmente en el dispositivo usando `localStorage`.

## Archivos principales

- `index.html`: estructura visual de la app. Contiene las secciones, botones, formulario, metas y lista de movimientos.
- `styles.css`: estilos visuales. Usa diseño tipo iPhone, tarjetas, glassmorphism, responsive design y tema claro/oscuro.
- `app.js`: lógica de funcionamiento. Maneja movimientos, cálculos, localStorage, tema, metas, botones y exportación CSV.
- `manifest.json`: configuración PWA para instalar la app en móvil.
- `icon.svg`: ícono de la app.

## Reglas importantes para modificar

1. Mantener la app simple. No convertirla en un framework si no es necesario.
2. No eliminar `localStorage`, porque la app está diseñada para guardar datos localmente en el dispositivo.
3. No agregar backend ni base de datos externa sin pedir confirmación.
4. Mantener compatibilidad con iPhone/Safari.
5. Usar JavaScript vanilla, HTML y CSS salvo que se indique lo contrario.
6. Evitar cambios que rompan GitHub Pages.
7. Si se actualizan `app.js` o `styles.css`, actualizar también los parámetros de caché en `index.html`, por ejemplo `app.js?v=...` y `styles.css?v=...`, para que el navegador cargue la versión nueva.
8. Antes de cambiar lógica, revisar que todos los `id` usados en `app.js` existan en `index.html`.
9. Los botones deben tener `type="button"` cuando no sean para enviar formularios.
10. El botón principal de guardar movimiento debe seguir usando `type="submit"`.

## Comportamiento esperado

### Botones principales

- `+ Ingreso`: selecciona ingreso y lleva al usuario al formulario.
- `− Gasto`: selecciona gasto y lleva al usuario al formulario.
- `Exportar`: descarga un archivo CSV con los movimientos.
- `Guardar movimiento`: guarda el ingreso o gasto en localStorage y actualiza el balance.
- `Actualizar meta`: guarda nombre, meta y cantidad ahorrada.
- `Limpiar`: borra todos los movimientos después de confirmar.
- Botón de tema: alterna entre modo oscuro y claro.

## Diseño deseado

La app debe verse como una app moderna de iPhone:

- Tarjetas grandes.
- Botones fáciles de tocar.
- Buen espaciado.
- Compatible con pantallas pequeñas.
- Estilo oscuro/claro.
- Apariencia limpia, no saturada.

## Prioridades futuras

Ideas que se pueden agregar después:

- Filtros por mes.
- Categorías editables.
- Presupuesto mensual.
- Resumen por categoría.
- Gráfica simple de gastos.
- Botón para borrar un solo movimiento.
- Botón para editar un movimiento.
- Copia de seguridad/exportación JSON.
- Importar CSV o JSON.
- Separar gastos personales, vehículo, casa, herramientas y negocio.

## Advertencia de privacidad

Esta app guarda datos financieros personales en el navegador del usuario. No subir datos reales al repositorio. No agregar ejemplos con información privada real.

## Instrucción para GPT

Cuando ayudes a modificar este proyecto:

1. Lee primero este archivo.
2. Revisa `index.html`, `app.js` y `styles.css` antes de proponer cambios.
3. Explica de forma sencilla qué vas a cambiar.
4. Haz cambios pequeños y verificables.
5. Después de modificar, indica qué archivo cambió y qué debe probar el usuario en el navegador.
