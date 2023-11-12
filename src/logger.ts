import { format, transports, createLogger } from 'winston';
import path from 'path';

export function initGlobalLogger(name: string){
    const logFile = path.join(process.cwd(),'logs',`${name}.log`);

    const globalLogger = createLogger({
        level: 'info',
        format: format.combine(
            format.splat(),
            format.simple()
          ),
        transports: [
          new transports.File({ filename: logFile }),
        ],
      });

    
    console.log = (...data) => {
        globalLogger.info(...data)
    }

    console.info = (...data) => {
        globalLogger.info(...data)
    }

    console.warn = (...data) => {
        globalLogger.warn(...data)
    }

    console.error = (...data) => {
        globalLogger.error(...data)
    }

    return globalLogger
}