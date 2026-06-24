export interface AuthContact {
  email?: string
  phone?: string
}

export interface AuthContactResolverPort {
  resolveBySubjectId: (subjectId: string) => Promise<AuthContact | undefined>
}
