export const imageExtensionFromUri = (imageUri: string) => {
  const idx = imageUri.lastIndexOf('.')
  return idx === -1 ? 'bin' : imageUri.slice(idx + 1)
}
