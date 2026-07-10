export const fileToBase64 = async (file: Blob) => {
  // use a FileReader to generate a base64 data URI:
  const buffer = await file.arrayBuffer()
  const base64url = await new Promise<string>((r) => {
    const reader = new FileReader()
    reader.onload = () => r(reader.result as string)
    reader.readAsDataURL(new Blob([buffer]))
  })
  // remove the `data:...;base64,` part from the start
  return base64url.slice(base64url.indexOf(',') + 1)
}

export const normalizeFilename = (filename: string) => {
  const idx = filename.lastIndexOf('.')
  if (idx === -1) {
    return filename
  }

  return filename.slice(0, idx)
}
