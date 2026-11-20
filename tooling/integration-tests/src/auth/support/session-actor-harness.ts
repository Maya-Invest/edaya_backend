// Integration tests must execute the same actor resolver as HTTP requests.
// Inject a test IdentityClient into the production factory; do not duplicate auth.
export { createSessionActorDependency } from '@/http/dependencies/session-actor'
