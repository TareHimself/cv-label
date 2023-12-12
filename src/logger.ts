import log from 'electron-log/main';
import path from 'path'
export default function createLogger(name: string){
  log.transports.file.resolvePathFn = () => path.resolve(path.join('./','logs',`${name}.log`))
  log.initialize()
  Object.assign(console, log.functions);
}

