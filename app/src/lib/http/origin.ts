/** Compare against the browser-facing Host, including the reverse-proxy port.
 * Next.js request.url can retain the internal development-server address.
 * Do not trust X-Forwarded-Host supplied on direct requests.
 */
export function hasInvalidOrigin(request:Request):boolean {
  if(request.headers.get('sec-fetch-site')==='cross-site')return true
  const origin=request.headers.get('origin')
  if(origin===null)return false
  try {
    const internal=new URL(request.url)
    const host=request.headers.get('host')??internal.host
    if(/[\s,/\\?#@]/.test(host))return true
    const external=new URL(`${internal.protocol}//${host}`)
    return origin!==external.origin
  } catch {return true}
}
