require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Verifica que la variable de entorno esté definida
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  throw new Error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS_JSON no está definida');
}

// Ruta temporal para guardar las credenciales
const tempCredentialsPath = path.join('/tmp', 'firebase.json');

// Escribir el contenido de la variable de entorno en el archivo temporal
fs.writeFileSync(tempCredentialsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

// Configurar la variable de entorno GOOGLE_APPLICATION_CREDENTIALS para que apunte al archivo temporal
process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredentialsPath;

// Inicializar Firebase Admin SDK
initializeApp({
    credential: applicationDefault(),
});

const db = getFirestore();

module.exports = {
    db,
};
