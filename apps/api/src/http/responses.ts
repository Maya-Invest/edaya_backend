import type { Context } from 'hono'
import type { AppBindings } from '@/http/bindings'

import { BusinessRuleViolationError, DomainValidationError } from '@edaya/core'
import * as HttpStatusCodes from 'stoker/http-status-codes'

type ResponseDetails = Record<string, unknown>

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error'
}

export function isAuthorizationError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && error.name === 'AuthorizationError'
}

export function isDomainValidationError(error: unknown): error is DomainValidationError {
  return error instanceof DomainValidationError
}

export function isBusinessRuleViolationError(error: unknown): error is BusinessRuleViolationError {
  return error instanceof BusinessRuleViolationError
}

export function unauthorizedResponse(c: Context<AppBindings>) {
  c.header('WWW-Authenticate', 'Bearer')
  return c.json({ message: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
}

export function badRequestResponse(c: Context<AppBindings>, message: string, details: ResponseDetails = {}) {
  return c.json({ message, ...details }, HttpStatusCodes.BAD_REQUEST)
}

export function conflictResponse(c: Context<AppBindings>, error: BusinessRuleViolationError) {
  return c.json({
    message: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  }, HttpStatusCodes.CONFLICT)
}

export function forbiddenResponse(c: Context<AppBindings>, error: Error & { code?: string }) {
  return c.json({
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
  }, HttpStatusCodes.FORBIDDEN)
}

export function notFoundResponse(c: Context<AppBindings>, message: string) {
  return c.json({ message }, HttpStatusCodes.NOT_FOUND)
}

export function methodNotAllowedResponse(c: Context<AppBindings>, message: string) {
  return c.json({ message }, HttpStatusCodes.METHOD_NOT_ALLOWED)
}

export function routeErrorResponse(c: Context<AppBindings>, error: unknown) {
  if (isAuthorizationError(error)) {
    return forbiddenResponse(c, error)
  }

  if (isDomainValidationError(error)) {
    return badRequestResponse(c, error.message)
  }

  if (isBusinessRuleViolationError(error)) {
    return conflictResponse(c, error)
  }

  c.var.logger?.error({ err: error }, 'Unhandled API route error')
  return c.json({ message: 'Internal server error occurred' }, HttpStatusCodes.INTERNAL_SERVER_ERROR)
}
