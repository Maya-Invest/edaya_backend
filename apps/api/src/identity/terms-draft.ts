import type { TermsDocument, TermsLocale } from "@edaya/account";

/** Review material only. Never add this draft to the published registry. */
export const draftTerms: Record<TermsLocale, Omit<TermsDocument, "documentHash">> = {
  en: {
    version: "draft-2026-10-25",
    locale: "en",
    status: "draft",
    title: "Terms of Use — draft for review",
    sections: [
      { heading: "About EDAYA", paragraphs: ["EDAYA helps schools, staff, teachers and guardians manage school activities and communicate. The service is operated by [LEGAL OPERATOR], at [REGISTERED ADDRESS]. This draft is not a published agreement."] },
      { heading: "Using your account", paragraphs: ["Use accurate contact information and only an account you are entitled to access. Keep verification codes, authenticator secrets and recovery codes private. Contact [SUPPORT EMAIL] if you suspect unauthorized access."] },
      { heading: "Acceptable use", paragraphs: ["Use EDAYA for authorized school activities. Do not impersonate others, harass users, distribute unlawful content, attempt unauthorized access or interfere with the service."] },
      { heading: "School information", paragraphs: ["Access and share school information only within your responsibilities and permissions. Check the accuracy of information you enter and contact the school to request corrections. Schools determine their educational and administrative decisions; EDAYA provides tools to support them.", "Personal information handling, retention, responsibilities and privacy contacts must be described in [APPROVED PRIVACY NOTICE]. These Terms of Use do not substitute for that notice or request separate marketing consent."] },
      { heading: "Availability and changes", paragraphs: ["The service may change or be interrupted for maintenance. Contact your school for urgent matters. Updated terms will have a new version and will be presented at your next explicit sign-in. [INSERT APPROVED NOTICE AND SERVICE COMMITMENTS]."] },
      { heading: "Ending access", paragraphs: ["You can stop using EDAYA and sign out. Contact your school or [SUPPORT EMAIL] about account closure and school records. [INSERT APPROVED SUSPENSION, TERMINATION, DATA EXPORT AND RETENTION CONDITIONS]."] },
      { heading: "Legal details and contact", paragraphs: ["Operator: [LEGAL OPERATOR]. Address: [REGISTERED ADDRESS]. Support: [SUPPORT EMAIL]. Governing law and dispute process: [GOVERNING JURISDICTION AND APPROVED DISPUTE TERMS]. [INSERT APPROVED LIABILITY AND APPLICABLE USER RIGHTS]."] },
    ],
  },
  fr: {
    version: "draft-2026-10-25",
    locale: "fr",
    status: "draft",
    title: "Conditions d’utilisation — projet à relire",
    sections: [
      { heading: "À propos d’EDAYA", paragraphs: ["EDAYA aide les établissements, le personnel, les enseignants et les responsables légaux à gérer les activités scolaires et à communiquer. Le service est exploité par [EXPLOITANT LÉGAL], à [ADRESSE DU SIÈGE]. Ce projet n’est pas un accord publié."] },
      { heading: "Utilisation de votre compte", paragraphs: ["Utilisez des coordonnées exactes et uniquement un compte auquel vous êtes autorisé à accéder. Gardez vos codes de vérification, secrets d’authentification et codes de récupération confidentiels. Contactez [E-MAIL D’ASSISTANCE] si vous soupçonnez un accès non autorisé."] },
      { heading: "Usages autorisés", paragraphs: ["Utilisez EDAYA pour les activités scolaires autorisées. N’usurpez pas l’identité d’autrui, ne harcelez pas les utilisateurs, ne diffusez pas de contenu illicite, ne tentez pas d’accès non autorisé et ne perturbez pas le service."] },
      { heading: "Informations scolaires", paragraphs: ["Consultez et partagez les informations scolaires uniquement dans le cadre de vos responsabilités et autorisations. Vérifiez les informations saisies et contactez l’établissement pour demander une correction. Les établissements prennent leurs décisions pédagogiques et administratives ; EDAYA fournit les outils qui les accompagnent.", "Le traitement des données personnelles, leur conservation, les responsabilités et les contacts doivent être décrits dans [NOTICE DE CONFIDENTIALITÉ APPROUVÉE]. Ces conditions ne remplacent pas cette notice et ne demandent pas de consentement distinct à la prospection."] },
      { heading: "Disponibilité et modifications", paragraphs: ["Le service peut évoluer ou être interrompu pour maintenance. Contactez votre établissement pour les questions urgentes. Les nouvelles conditions porteront un nouveau numéro de version et seront présentées lors de votre prochaine connexion explicite. [INSÉRER LES ENGAGEMENTS APPROUVÉS DE NOTIFICATION ET DE SERVICE]."] },
      { heading: "Fin de l’accès", paragraphs: ["Vous pouvez cesser d’utiliser EDAYA et vous déconnecter. Contactez votre établissement ou [E-MAIL D’ASSISTANCE] au sujet de la fermeture du compte et des dossiers scolaires. [INSÉRER LES CONDITIONS APPROUVÉES DE SUSPENSION, RÉSILIATION, EXPORT ET CONSERVATION]."] },
      { heading: "Mentions légales et contact", paragraphs: ["Exploitant : [EXPLOITANT LÉGAL]. Adresse : [ADRESSE DU SIÈGE]. Assistance : [E-MAIL D’ASSISTANCE]. Droit applicable et règlement des litiges : [JURIDICTION ET CLAUSES APPROUVÉES]. [INSÉRER LES CLAUSES APPROUVÉES DE RESPONSABILITÉ ET LES DROITS APPLICABLES]."] },
    ],
  },
};
