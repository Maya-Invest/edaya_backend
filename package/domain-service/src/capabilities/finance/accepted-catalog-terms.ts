import type { AcceptedServiceTerms, CatalogService } from '@edaya/core'

/** Shared by review previews and the authoritative enrollment command. */
export function acceptedCatalogTerms(catalog: CatalogService, priceOverride?: number): AcceptedServiceTerms {
  return {
    catalogServiceId: catalog.id,
    name: catalog.name,
    category: catalog.category,
    currency: catalog.defaultPrice.currency,
    price: priceOverride ?? catalog.defaultPrice.amount,
    billingKind: 'one_time',
    billingTerms: catalog.billingTerms,
    installmentTemplates: catalog.billingTerms.installments,
  }
}
