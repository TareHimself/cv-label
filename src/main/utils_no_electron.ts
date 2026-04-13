import { createHash } from 'node:crypto'
export const sha512 = (items: string[]) => {
  return items.map((c) => {
    const hash = createHash('sha256')
    hash.update(Buffer.from(c, 'base64'))
    const digest = hash.digest()
    return digest.toString('hex')
  })
}
