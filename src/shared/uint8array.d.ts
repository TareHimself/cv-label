// lib.d.ts doesn't have types for Uint8Array's base64/hex methods yet, though Electron's renderer has shipped them - see arrayBufferToBase64. Optional since dev/test Node may lack them at runtime.
export {}

declare global {
  interface Uint8Array {
    toBase64?(): string
  }
}
