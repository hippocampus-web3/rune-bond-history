import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

// Formato para archivos
const fileFormat = printf((info) => {
    let msg = `${info.timestamp} [${info.level}]: ${info.message}`;
    const { timestamp, level, message, ...metadata } = info;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

// Formato para consola
const consoleFormat = printf((info) => {
    const timestampStr = typeof info.timestamp === 'string' ? info.timestamp.replace('T', ' ').replace('Z', '') : '';
    let msg = `\x1b[36m${timestampStr}\x1b[0m [${info.level}]: ${info.message}`;
    const { timestamp, level, message, ...metadata } = info;
    if (Object.keys(metadata).length > 0) {
        msg += ` \x1b[33m${JSON.stringify(metadata)}\x1b[0m`;
    }
    return msg;
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp(),
        colorize(),
    ),
    transports: [
        // Transporte para consola con formato personalizado
        new winston.transports.Console({
            format: consoleFormat
        }),
        // Transporte para archivo de errores
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            format: fileFormat
        }),
        // Transporte para archivo de todos los logs
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            format: fileFormat
        })
    ]
}); 