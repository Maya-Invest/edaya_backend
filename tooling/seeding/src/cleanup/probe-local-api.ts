import { createConnection } from 'node:net'

export async function probeLocalApiReachable(baseUrl: string): Promise<boolean> {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Local reset requires an HTTP loopback API URL')
  const hosts = url.hostname === 'localhost' ? ['127.0.0.1', '::1'] : [url.hostname.replace(/^\[|\]$/g, '')]
  // A wedged or HTTP-500 API can still hold PGlite open. Check its listener,
  // independently of application readiness, on both localhost address families.
  const listening = await Promise.all(hosts.map(host => new Promise<boolean>((resolve) => {
    const socket = createConnection({ host, port: Number(url.port || 80) })
    const finish = (active: boolean) => {
      socket.destroy()
      resolve(active)
    }
    socket.setTimeout(2000)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })))
  return listening.some(Boolean)
}
