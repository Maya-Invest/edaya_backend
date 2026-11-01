export function bytesToDataUri(bytes: Uint8Array, mimeType: string): string {
  const chunk = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}
