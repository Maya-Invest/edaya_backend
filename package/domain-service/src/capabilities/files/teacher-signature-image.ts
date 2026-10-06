import { Buffer } from 'node:buffer'
import { BusinessRuleViolationError } from '@edaya/core'
import pngjs from 'pngjs/browser.js'

const { PNG } = pngjs

function decodeTeacherSignaturePng(bytes: Uint8Array) {
  try {
    const data = Buffer.from(bytes)
    // Bound decoded allocation before invoking the CRC-aware PNG decoder.
    if (data.length < 33 || data.toString('ascii', 12, 16) !== 'IHDR')
      throw new Error('Missing PNG header')
    const width = data.readUInt32BE(16)
    const height = data.readUInt32BE(20)
    if (!width || !height || width > 1024 || height > 1024 || data[24] !== 8 || data[28] !== 0)
      throw new Error('Signature dimensions exceed the editor bounds')
    let offset = 8
    let ended = false
    while (offset + 12 <= data.length) {
      const length = data.readUInt32BE(offset)
      const type = data.toString('ascii', offset + 4, offset + 8)
      if (length > data.length - offset - 12 || (type === 'IHDR' && (offset !== 8 || length !== 13)) || type === 'acTL')
        throw new Error('Invalid static PNG structure')
      offset += length + 12
      if (type === 'IEND') {
        ended = length === 0 && offset === data.length
        break
      }
    }
    if (!ended)
      throw new Error('Incomplete PNG')
    return PNG.sync.read(data, { checkCRC: true })
  }
  catch {
    throw new BusinessRuleViolationError('ATTACHMENT_CONTENT_INVALID', 'Signature must be a valid bounded PNG image')
  }
}

export function validateTeacherSignaturePng(bytes: Uint8Array): void {
  decodeTeacherSignaturePng(bytes)
}

/** Four times the template's display bounds, keeping repeated inline images inexpensive. */
export function teacherSignatureDocumentPng(bytes: Uint8Array): Uint8Array {
  const source = decodeTeacherSignaturePng(bytes)
  const scale = Math.min(1, 304 / source.width, 112 / source.height)
  if (scale === 1)
    return bytes
  const target = new PNG({ width: Math.max(1, Math.floor(source.width * scale)), height: Math.max(1, Math.floor(source.height * scale)) })
  for (let y = 0; y < target.height; y++) {
    const top = Math.floor(y * source.height / target.height)
    const bottom = Math.floor((y + 1) * source.height / target.height)
    for (let x = 0; x < target.width; x++) {
      const left = Math.floor(x * source.width / target.width)
      const right = Math.floor((x + 1) * source.width / target.width)
      let red = 0
      let green = 0
      let blue = 0
      let alpha = 0
      for (let sy = top; sy < bottom; sy++) {
        for (let sx = left; sx < right; sx++) {
          const offset = (sy * source.width + sx) * 4
          const opacity = source.data[offset + 3]!
          alpha += opacity
          red += source.data[offset]! * opacity
          green += source.data[offset + 1]! * opacity
          blue += source.data[offset + 2]! * opacity
        }
      }
      const offset = (y * target.width + x) * 4
      target.data[offset] = alpha ? Math.round(red / alpha) : 0
      target.data[offset + 1] = alpha ? Math.round(green / alpha) : 0
      target.data[offset + 2] = alpha ? Math.round(blue / alpha) : 0
      target.data[offset + 3] = Math.round(alpha / ((right - left) * (bottom - top)))
    }
  }
  return PNG.sync.write(target)
}
