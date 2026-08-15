// TypeScript's bundled lib.d.ts doesn't have types for the Uint8Array base64/hex methods
// yet, even though Electron's renderer (Chromium 133+) has shipped them for a while - see
// arrayBufferToBase64 in utils.ts. Optional, not everywhere this code type-checks against
// actually has it at runtime (e.g. this project's own dev/test Node) - callers feature-detect.
export {}

declare global {
  interface Uint8Array {
    toBase64?(): string
  }
}
