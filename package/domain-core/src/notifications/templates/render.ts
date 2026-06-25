const TEMPLATE_VARIABLE_PATTERN = /\{\{(\w+)\}\}/g

/** Minimal `{{key}}` substitution; unknown keys are left unchanged. */
export function renderTemplateString(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (match, key: string) => variables[key] ?? match)
}
