/** PNG's browser build uses portable, bounded inflation in Workers as well as Node. */
declare module 'pngjs/browser.js' {
  import * as pngjs from 'pngjs'

  export default pngjs
}
