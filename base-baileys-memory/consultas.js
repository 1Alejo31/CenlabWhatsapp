const { query } = require('./database');

async function buscarTelefonos() {
    const sql = `SELECT
        GS_CODIGO AS ID,
        GS_DETALLE1 AS NOMBRE_EMPRESA,
        GS_DETALLE2 AS NOMBRE_PACIENTE,
        GS_DETALLE3 AS DOCUMENTO,
        GS_DETALLE4 AS TELEFONO,
        GS_DETALLE5 AS TIPO,
        GS_DETALLE6 AS RECOMENDACIONES,
        GS_DETALLE7 AS CORREO,
        GS_DETALLE8 AS CORREO_COPIA,
        GS_DETALLE9 AS CORREO_COPIA_S,
        GS_DETALLE10 AS CORREO_COPIA_T,
        GS_DETALLE11 AS EXAMENES,
        GS_DETALLE12 AS FECHA,
        GS_DETALLE13 AS CIUDAD,
        GS_DETALLE14 AS LUGAR
        FROM
        db_general.tbl_gestor_mensaje
        WHERE
        GS_USUARIO_CREACION = '1'
        AND GS_DETALLE = 'PUBLICIDAD-E'
        AND GS_ESTATUS = 'SIN GESTION'
        ORDER BY GS_CODIGO ASC
        LIMIT 50`
    try {
        const resultados = await query(sql);
        return resultados;
    } catch (error) {
        console.error('Error al buscar contactos:', error);
        return null;
    }
}

async function updateStatus(id, estatus, detalle) {
    const sql = 'UPDATE db_general.tbl_gestor_mensaje SET GS_ESTATUS = ?, GS_DETALLE16 = ? WHERE GS_CODIGO = ?';
    try {
        const resultados = await query(sql, [estatus, detalle, id]);
        return resultados;
    } catch (error) {
        console.error('Error al actualizar estatus:', error);
        return null;
    }
}

module.exports = {
    buscarTelefonos,
    updateStatus

};