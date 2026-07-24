declare module '*.css' {
  const content: string
  export default content
}

declare module '*.hbs' {
  const content: string
  export default content
}

declare module '*.precompiled.js' {
  const spec: object
  export default spec
}
