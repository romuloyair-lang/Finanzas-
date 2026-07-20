# Body RO Tracker

Aplicacion web para controlar ROs de enderezado y reparacion desde tablet.

## Flujo recomendado

1. Tomas foto de los ROs actuales desde ChatGPT.
2. Un GPT personalizado lee la foto y transcribe solo datos utiles para body repair.
3. El GPT llama la Action `upsertBodyRoFromPhoto`.
4. Google Apps Script guarda o actualiza el RO en Google Sheets.
5. La app en GitHub Pages sincroniza la Sheet y muestra los ROs actuales en la tablet.

## Que incluye

- ROs actuales
- ROs terminados
- Reingreso de un RO terminado si el carro vuelve al taller
- Estados: intacto, revision, aprobado, proceso, piezas, pintura, armado, entregado
- Armado esperando piezas / suplemento sin perder el estado principal `armado`
- Horas semanales por RO
- Checklist body
- Hardware y materiales
- Respuesta de tecnico especialista
- Subida/pegado local de texto de RO
- Sync manual con Google Sheets mediante Apps Script

## Conexion con Google Sheets

En la app abre **Config** y guarda:

- URL de la Web App de Apps Script, terminada en `/exec`
- API key privada configurada en `apps-script/Code.gs`

Luego toca **Sincronizar** para traer los ROs que el GPT haya actualizado en Google Sheets.

La app guarda esa conexion solo en `localStorage` de la tablet. La API key no se publica en GitHub.

## Despliegue de Apps Script

1. Crea una Google Sheet.
2. Abre **Extensions -> Apps Script**.
3. Copia el contenido de `apps-script/Code.gs`.
4. Cambia `API_KEY = 'CHANGE_ME_PRIVATE_KEY'` por una clave privada tuya.
5. Deploy -> New deployment -> Web app.
6. Execute as: Me.
7. Who has access: Anyone with the link.
8. Copia la URL `/exec`.
9. En la app Body RO Tracker abre **Config** y pega la URL + API key.

## Custom GPT Action

1. En ChatGPT crea un GPT personalizado.
2. En instrucciones, pega el contenido de `gpt-instructions.md`.
3. En Actions, crea una nueva Action.
4. Pega el contenido de `apps-script/openapi.yaml`.
5. Cambia `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec` por tu URL real de Apps Script.
6. Prueba la Action con un RO de ejemplo.

El GPT debe enviar datos estructurados. La foto del RO se usa dentro de ChatGPT para extraer informacion, y Apps Script guarda en Sheets solo los campos utiles del RO.

## URL esperada en GitHub Pages

`https://romuloyair-lang.github.io/Finanzas-/body-ro/`
