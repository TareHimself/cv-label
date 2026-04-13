import { fileURLToPath } from 'url'
import path from 'path'
export const isEntryFile = (url: string) => fileURLToPath(url) === path.resolve(process.argv[1])
