# Bitacora de actividades

Aplicacion web ligera para registrar actividades, horas, enlaces y evidencias de una practica. La interfaz se publica como sitio estatico y consulta/actualiza los registros mediante Google Apps Script y Google Sheets.

## Ejecutar localmente

Requiere Node.js. Desde esta carpeta:

```powershell
node build.mjs
node server.mjs
```

Abre `http://localhost:4173`.

## Publicacion

Netlify construye el sitio con `node build.mjs` y publica `dist-public`. La configuracion de compilacion esta en `netlify.toml`.

## Privacidad

Este repositorio contiene el codigo de la interfaz, no los registros de actividades ni sus evidencias. El servicio conectado permite lectura publica y solicita autenticacion administrativa para cambios. No publiques hojas de calculo exportadas, credenciales, PIN ni el codigo privado del backend.
