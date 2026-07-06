# Finanzas SZR / Yair OS

Repositorio de apps web PWA para uso personal.

## Apps

### Finanzas / Yair OS

Aplicación web PWA para gestionar finanzas personales, pendientes, memoria GPT e integraciones.

URL principal:

`https://romuloyair-lang.github.io/Finanzas-/`

### Body RO Tracker

Aplicación para tablet enfocada en enderezado y reparación:

- ROs actuales
- ROs terminados
- Estados del coche
- Armado esperando piezas / suplemento
- Horas semanales por RO
- Checklist body
- Hardware y materiales
- Sin precios y sin procesos de pintura
- Integración opcional con Google Sheets + Apps Script

URL cuando esté publicado en GitHub Pages:

`https://romuloyair-lang.github.io/Finanzas-/body-ro/`

Documentación:

`body-ro/README.md`

Backend Apps Script:

`body-ro/apps-script/Code.gs`

Schema base para Custom GPT Action:

`body-ro/apps-script/openapi.yaml`

## Requisitos

- Navegador web moderno
- LocalStorage habilitado
- Para sincronización: Google Sheets + Apps Script desplegado como Web App

## Privacidad

La app funciona en modo local sin nube. Para sincronización, los datos se guardan en una Google Sheet propia mediante Apps Script. No publiques tu API key privada en GitHub.
