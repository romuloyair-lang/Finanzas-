# Body RO Tracker

Aplicación web para controlar ROs de enderezado y reparación desde tablet.

## Flujo

1. El GPT personalizado en iPhone escanea la foto del RO.
2. El GPT extrae solo datos útiles para body repair.
3. El GPT manda JSON a Google Apps Script.
4. Apps Script guarda o actualiza la fila en Google Sheets.
5. La app en GitHub Pages lee Google Sheets y muestra los ROs en la tablet.

## Qué incluye

- ROs actuales
- ROs terminados
- Reingreso de un RO terminado si el carro vuelve al taller
- Estados: intacto, desarmado revisión, desarmado aprobado, en proceso, esperando piezas, en pintura, armado, entregado
- Armado esperando piezas / suplemento sin perder el estado principal `Armado`
- Horas semanales por RO
- Checklist body
- Hardware y materiales
- Sync manual con Google Sheets

## Conexión con Google Sheets

En la app abre **Configurar Sheets / Apps Script** y guarda:

- URL de la Web App de Apps Script, terminada en `/exec`
- API key privada configurada en `apps-script/Code.gs`

La app guarda esa conexión solo en `localStorage` de la tablet. La API key no se publica en GitHub.

## Despliegue de Apps Script

1. Crea una Google Sheet.
2. Abre **Extensions → Apps Script**.
3. Copia el contenido de `apps-script/Code.gs`.
4. Cambia `API_KEY = 'CHANGE_ME_PRIVATE_KEY'` por una clave privada tuya.
5. Deploy → New deployment → Web app.
6. Execute as: Me.
7. Who has access: Anyone with the link.
8. Copia la URL `/exec` y configúrala en la app.

## Custom GPT Action

`apps-script/openapi.yaml` es la base para configurar la Action del GPT personalizado.

El GPT debe enviar solo datos estructurados. La foto del RO se usa dentro de ChatGPT para extraer información, pero no se guarda en la nube.

## URL esperada en GitHub Pages

Cuando el branch se mergee a `main` y GitHub Pages esté activo, la app quedará en:

`https://romuloyair-lang.github.io/Finanzas-/body-ro/`
