const nodemailer = require('nodemailer');

// Configuración de email
const EMAIL_USER = 'no-reply@cenlab.co';
const EMAIL_PASSWORD = 'KofiMan5';

// Función para obtener configuración SMTP basada en el dominio
function getSMTPConfig(email) {
    const domain = email.split('@')[1].toLowerCase();
    
    const smtpConfigs = {
        'gmail.com': { host: 'smtp.gmail.com', port: 587 },
        'outlook.com': { host: 'smtp-mail.outlook.com', port: 587 },
        'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587 },
        'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 587 },
        'icloud.com': { host: 'smtp.mail.me.com', port: 587 }
    };
    
    if (smtpConfigs[domain]) {
        console.log(`✅ Proveedor detectado: ${domain}`);
        return smtpConfigs[domain];
    } else {
        console.log(`⚠️ Dominio personalizado: ${domain}, usando mail.${domain}`);
        return { host: `mail.${domain}`, port: 587 };
    }
}

// Obtener configuración SMTP para el email configurado
const smtpConfig = getSMTPConfig(EMAIL_USER);

// Configuración del transporter con detección automática de proveedor
const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: false,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * Envía un correo electrónico simple
 * @param {string} destinatario - Correo del destinatario
 * @param {string} asunto - Asunto del correo
 * @param {string} mensaje - Contenido del correo (texto plano)
 * @param {Array} cc - Array de correos para copia (opcional)
 * @returns {Promise} - Promesa con el resultado del envío
 */
async function enviarCorreo(destinatario, asunto, mensaje, cc = null) {
    try {
        const mailOptions = {
            from: `"Cenlab" <${EMAIL_USER}>`,
            to: destinatario,
            subject: asunto,
            text: mensaje
        };

        // Agregar CC si se proporciona
        if (cc && Array.isArray(cc)) {
            const validCC = cc.filter(email => email && email !== "nan" && email.includes("@"));
            if (validCC.length > 0) {
                mailOptions.cc = validCC.join(', ');
                console.log(`📧 CC agregado: ${validCC.join(', ')}`);
            }
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo enviado correctamente a ${destinatario}`);
        if (mailOptions.cc) {
            console.log(`📧 Con copia a: ${mailOptions.cc}`);
        }
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error al enviar correo:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Envía un correo electrónico con contenido HTML
 * @param {string} destinatario - Correo del destinatario
 * @param {string} asunto - Asunto del correo
 * @param {string} mensajeTexto - Contenido del correo en texto plano (alternativa)
 * @param {string} mensajeHTML - Contenido del correo en formato HTML
 * @param {Array} cc - Array de correos para copia (opcional)
 * @returns {Promise} - Promesa con el resultado del envío
 */
async function enviarCorreoHTML(destinatario, asunto, mensajeTexto, mensajeHTML, cc = null) {
    try {
        const mailOptions = {
            from: `"Cenlab" <${EMAIL_USER}>`,
            to: destinatario,
            subject: asunto,
            text: mensajeTexto,
            html: mensajeHTML
        };

        // Agregar CC si se proporciona
        if (cc && Array.isArray(cc)) {
            const validCC = cc.filter(email => email && email !== "nan" && email.includes("@"));
            if (validCC.length > 0) {
                mailOptions.cc = validCC.join(', ');
                console.log(`📧 CC agregado: ${validCC.join(', ')}`);
            }
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo HTML enviado correctamente a ${destinatario}`);
        if (mailOptions.cc) {
            console.log(`📧 Con copia a: ${mailOptions.cc}`);
        }
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error al enviar correo HTML:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Envía un correo electrónico con archivos adjuntos
 * @param {string} destinatario - Correo del destinatario
 * @param {string} asunto - Asunto del correo
 * @param {string} mensaje - Contenido del correo (texto plano)
 * @param {Array} adjuntos - Array de objetos con los archivos adjuntos
 * @param {Array} cc - Array de correos para copia (opcional)
 * @returns {Promise} - Promesa con el resultado del envío
 */
async function enviarCorreoConAdjuntos(destinatario, asunto, mensaje, adjuntos, cc = null) {
    try {
        const mailOptions = {
            from: `"Cenlab" <${EMAIL_USER}>`,
            to: destinatario,
            subject: asunto,
            text: mensaje,
            attachments: adjuntos
        };

        // Agregar CC si se proporciona
        if (cc && Array.isArray(cc)) {
            const validCC = cc.filter(email => email && email !== "nan" && email.includes("@"));
            if (validCC.length > 0) {
                mailOptions.cc = validCC.join(', ');
                console.log(`📧 CC agregado: ${validCC.join(', ')}`);
            }
        }

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Correo con adjuntos enviado correctamente a ${destinatario}`);
        if (adjuntos && adjuntos.length > 0) {
            console.log(`📎 Adjuntos: ${adjuntos.length} archivo(s)`);
        }
        if (mailOptions.cc) {
            console.log(`📧 Con copia a: ${mailOptions.cc}`);
        }
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error al enviar correo con adjuntos:', error);
        return { success: false, error: error.message };
    }
}

// Exportar las funciones
module.exports = {
    enviarCorreo,
    enviarCorreoHTML,
    enviarCorreoConAdjuntos
};
