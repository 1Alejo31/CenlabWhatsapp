const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const { buscarTelefonos, updateStatus } = require('./consultas');
const P = require("pino");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { enviarCorreoConAdjuntos } = require('./mailer');
const express = require('express');

let isRunning = false;
let isProcessing = true;

// Variables para el perfil de usuario y estado de conexión
let userProfileData = {
  name: 'Esperando conexión...',
  phone: 'Pendiente de escanear QR',
  profilePicture: null,
  status: 'Desconectado',
  connected: false
};

// 📂 Carpeta donde se guardan las credenciales
const authDir = path.resolve(__dirname, "auth_info");

// Función para resetear la carpeta de sesión
function resetAuthFolder() {
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true }); // 🔥 borra todo
    console.log("🗑️ Carpeta auth_info eliminada.");
  }
  fs.mkdirSync(authDir);
  console.log("📂 Carpeta auth_info creada nuevamente.");
}

function extraerTelefonos(cadena) {
  if (!cadena) return [];
  return cadena.split(',').map(num => {
    const numeroLimpio = num.trim().replace(/\D/g, '');
    if (numeroLimpio.length >= 10) {
      return numeroLimpio.startsWith('57') ? numeroLimpio : `57${numeroLimpio}`;
    }
    return null;
  }).filter(num => num !== null);
}

// Función para validar correos electrónicos
function esCorreoValido(correo) {
  if (!correo || typeof correo !== 'string') return false;

  // Eliminar espacios en blanco
  correo = correo.trim();

  // Verificar que no sea un valor placeholder
  const valoresInvalidos = ['na', 'n/a', 'no aplica', 'sin correo', 'ninguno', ''];
  if (valoresInvalidos.includes(correo.toLowerCase())) return false;

  // Validación básica de formato de correo
  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regexCorreo.test(correo);
}

function verificarConexion(sock) {
  return sock && sock.user;
}

// Función para enviar WhatsApp con reintentos
async function enviarWhatsAppConReintentos(sock, jid, contenido, maxReintentos = 20) {
  for (let intento = 1; intento <= maxReintentos; intento++) {
    try {
      // Verificar conexión antes de enviar
      if (!verificarConexion(sock)) {
        console.log(`⚠️ Conexión no disponible, esperando... (intento ${intento}/${maxReintentos})`);
        await new Promise(r => setTimeout(r, 3000)); // Esperar 3 segundos
        continue;
      }

      await sock.sendMessage(jid, contenido);
      return { success: true, intento };
    } catch (error) {
      console.log(`⚠️ Error en intento ${intento}/${maxReintentos}:`, error.message);

      if (intento < maxReintentos) {
        // Esperar más tiempo entre reintentos (backoff exponencial)
        const tiempoEspera = Math.min(5000 * Math.pow(2, intento - 1), 30000);
        console.log(`⏳ Esperando ${tiempoEspera / 1000}s antes del siguiente intento...`);
        await new Promise(r => setTimeout(r, tiempoEspera));
      } else {
        return { success: false, error };
      }
    }
  }
  return { success: false, error: 'Máximo de reintentos alcanzado' };
}

async function procesarContactos(sock) {
  while (true) {
    try {
      const contactos = await buscarTelefonos();

      if (contactos.length === 0) {
        console.log("⚠️ No hay contactos, esperando 10 segundos...");
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      console.log(`Se encontraron ${contactos.length} contactos para enviar mensajes`);

      for (const contacto of contactos) {
        if (!isProcessing) break;

        const telefonosArray = extraerTelefonos(contacto.TELEFONO);
        const todosLosTelefonos = [...new Set(telefonosArray)];

        if (todosLosTelefonos.length === 0 && !contacto.CORREO) {
          console.log(`Contacto ID ${contacto.ID} no tiene teléfonos ni correos válidos, saltando...`);
          continue;
        }

        // Contadores
        let whatsappEnviados = 0;
        let whatsappTotal = todosLosTelefonos.length;
        let emailEnviados = 0;
        let emailTotal = contacto.CORREO ? 1 : 0;

        // Variables para el mensaje
        const nombre = contacto.NOMBRE_PACIENTE || 'Estimado(a) paciente';
        const tipo = contacto.TIPO || 'examen médico';
        const examen = contacto.EXAMENES || 'exámenes médicos';
        const empresa = contacto.NOMBRE_EMPRESA || 'su empresa';
        const fechaAtencion_formateada = contacto.FECHA || 'fecha por confirmar';
        const lugar = contacto.LUGAR || 'Centro Médico Cenlab';
        const ciudad = contacto.CIUDAD || '';
        const seccion_recomendaciones = contacto.RECOMENDACIONES ?
          `📋 *Recomendaciones importantes:*\n${contacto.RECOMENDACIONES}\n` : '';

        const message = `
🏥 *CENTRO MÉDICO CENLAB*
                
👋 Hola ${nombre}, Soy Vicky!!! Su asistente virtual del Centro Médico CENLAB
                
                
🤖 Le escribo para recordarle su examen de ${tipo}.
Estamos muy contentos de poder atenderle en nuestro centro médico.
                
Somos los encargados de realizar los exámenes.

🔬 *Exámenes a realizar:*
• ${examen}
                
🎯 Le hemos programado una cita para la realización del exámen, requerido por la empresa {empresa}
                
${seccion_recomendaciones}
                
📅 *Detalles de la cita:*
• Fecha: ${fechaAtencion_formateada}
• Lugar: ${lugar} - ${ciudad}
• Teléfono de contacto: 3112780473

                
⏰ Agradecemos su puntualidad. Si tiene alguna inquietud, comuníquese con nosotros al número 3112780473 o al correo Info@cenlab.co`;

        // Enviar WhatsApp

        for (const numero of todosLosTelefonos) {
          if (!isProcessing) break;
          const telefono = numero.startsWith('57') ? numero : `57${numero}`;
          const jid = `${telefono}@s.whatsapp.net`;

          try {
            if (!isProcessing) break;

            // Enviar mensaje de texto con reintentos
            const resultadoTexto = await enviarWhatsAppConReintentos(sock, jid, { text: message });

            if (!resultadoTexto.success) {
              console.error(`❌ Error al enviar texto a ${numero} después de reintentos:`, resultadoTexto.error);
              continue;
            }

            if (!isProcessing) break;

            console.log(`✅ WhatsApp enviado a ${numero} (intentos: img=${resultadoImagen.intento}, txt=${resultadoTexto.intento}, pdf=${resultadoPDF.intento})`);
            whatsappEnviados++;
          } catch (error) {
            console.error(`❌ Error general al enviar WhatsApp a ${numero}:`, error);
          }

          await new Promise(r => setTimeout(r, 5000));
        }

        // Enviar correos
        const asunto = `Cenlab - Examen de ${contacto.TIPO} - ${contacto.NOMBRE_EMPRESA}`;
        const adjuntos = [];

        // Preparar correos de copia (CC)
        const correosCC = [
          contacto.CORREO_COPIA,
          contacto.CORREO_COPIA_S,
          contacto.CORREO_COPIA_T
        ].filter(correo => correo && esCorreoValido(correo));

        // Filtrar correo principal válido
        const correosPrincipales = [contacto.CORREO].filter(correo => correo && esCorreoValido(correo));

        if (correosPrincipales.length === 0) {
          console.log(`⚠️ Contacto ID ${contacto.ID}: No tiene correo principal válido`);
        } else {
          // Log de información de correos
          console.log(`📧 Contacto ID ${contacto.ID}: Correo principal: ${correosPrincipales[0]}`);
          if (correosCC.length > 0) {
            console.log(`📧 Contacto ID ${contacto.ID}: CC: ${correosCC.join(', ')}`);
          }

          for (const correo of correosPrincipales) {
            try {
              const resultado = await enviarCorreoConAdjuntos(
                correo,
                asunto,
                message,
                adjuntos,
                correosCC.length > 0 ? correosCC : null
              );

              if (resultado.success) {
                console.log(`✅ Correo enviado a ${correo}`);
                if (correosCC.length > 0) {
                  console.log(`📧 Con copia a: ${correosCC.join(', ')}`);
                }
                emailEnviados++;
              } else {
                console.error(`❌ Error al enviar correo a ${correo}: ${resultado.error}`);
              }
            } catch (error) {
              console.error(`❌ Error inesperado al enviar correo a ${correo}:`, error.message);
            }
          }
        }

        // Guardar estado
        const ahora = new Date();
        const fechaHora = ahora.toISOString().replace('T', ' ').substring(0, 19);
        const estadoDetalle = `PROCESADO_${fechaHora} - WhatsApp:${whatsappEnviados}/${whatsappTotal} Email:${emailEnviados}/${emailTotal}`;
        await updateStatus(contacto.ID, 'GESTIONADO', estadoDetalle);

        await new Promise(r => setTimeout(r, 2000));
      }

      console.log("✅ Proceso completado, listo para la siguiente ejecución");

    } catch (error) {
      console.error("❌ Error en el proceso:", error);
    }

    await new Promise(r => setTimeout(r, 25000));
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    browser: ["Cenlab Bot", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    getMessage: async () => undefined
  });

  sock.ev.on("creds.update", saveCreds);

  // Escuchar actualizaciones de conexión
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrPath = path.resolve(__dirname, "bot.qr.png");
      await QRCode.toFile(qrPath, qr, {
        type: "png",
        width: 300,
        margin: 2
      });
      console.log("⚡ Nuevo QR generado y guardado en:", qrPath);

      // Actualizar estado del usuario
      userProfileData.status = 'Esperando escaneo de QR';
      userProfileData.connected = false;
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Sesión cerrada. Reintentando...");
      isProcessing = false;
      isRunning = false;

      // Actualizar estado del usuario
      userProfileData.status = 'Desconectado';
      userProfileData.connected = false;
      userProfileData.name = 'Esperando conexión...';
      userProfileData.phone = 'Pendiente de escanear QR';

      // ✅ Si fue logout, borramos credenciales
      if (!shouldReconnect) {
        resetAuthFolder();
      }
      // 🔄 Reconectar
      connectToWhatsApp();
    }

    if (connection === "open") {
      if (!isRunning) {
        isRunning = true;
        isProcessing = true;
        console.log("✅ Bot conectado a WhatsApp");

        // Actualizar información del usuario conectado
        try {
          const userInfo = sock.user;
          userProfileData.name = userInfo.name || 'Usuario WhatsApp';
          userProfileData.phone = userInfo.id.split(':')[0] || 'No disponible';
          userProfileData.status = 'Conectado';
          userProfileData.connected = true;

          console.log(`👤 Usuario conectado: ${userProfileData.name} (${userProfileData.phone})`);
        } catch (error) {
          console.log("⚠️ No se pudo obtener información del usuario");
        }

        procesarContactos(sock);
      }
    }
  });

  // Guardar credenciales en cambios
  sock.ev.on("creds.update", saveCreds);
}

// Configuración de Express y rutas de la interfaz web
const app = express();
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'index.html')));
app.get('/qr', (req, res) => res.sendFile(path.join(__dirname, 'bot.qr.png')));
app.get('/user-profile', (req, res) => res.json(userProfileData));
app.get('/status', (req, res) => res.json({ status: userProfileData.connected ? 'connected' : 'disconnected', user: userProfileData }));
app.get('/profile-picture', (req, res) => res.sendFile(path.join(__dirname, '..', 'assets', 'photo.webp')));
app.listen(3010, () => console.log('🌐 Frontend personalizado en http://localhost:3010'));

// Iniciar
connectToWhatsApp();