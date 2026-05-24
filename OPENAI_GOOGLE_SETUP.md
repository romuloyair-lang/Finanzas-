# Yair OS — OpenAI + Google Setup

## Arquitectura

Frontend:
- GitHub Pages
- HTML/CSS/JS

Backend:
- Google Apps Script
- OpenAI Proxy API

Base de datos:
- Google Sheets

## Google Apps Script

1. Ve a:
https://script.google.com

2. Crea un nuevo proyecto.

3. Pega esto:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.openById('10QO4QxXxmsVPoD1wk75uu_U3ivzvbs6vgsjKXjzhhCU');
  const data = JSON.parse(e.postData.contents);

  const tab = sheet.getSheetByName('Finanzas');

  tab.appendRow([
    new Date(),
    data.type,
    data.category,
    data.description,
    data.paymentMethod,
    '',
    data.amount
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Deploy:
- Deploy
- New deployment
- Web App
- Anyone

5. Copia la URL y pégala en la app.

## OpenAI Proxy

Nunca pongas tu API Key en GitHub Pages.

Usa:
- Vercel
- Railway
- Render

Ejemplo Node.js:

```js
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

Variables:

```env
OPENAI_API_KEY=sk-...
```

## Funciones futuras

- GPT memory
- Nóminas OCR
- Calendar sync
- Push notifications
- iPhone widgets
- Voice assistant
- Gmail organization
- AI financial analysis
