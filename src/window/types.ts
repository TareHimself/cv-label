

declare global {
    interface Window {
        debugHitTest: boolean
        exportCollisionCanvas: () => Promise<string>
    }
}

export { }