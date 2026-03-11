const SERVICE_FEE_CENTS = 100

export function calculateServiceFeeCents(servicePriceCents: number) {
  return servicePriceCents >= 0 ? SERVICE_FEE_CENTS : 0
}

export function calculateAppointmentTotals(servicePriceCents: number) {
  const serviceFeeCents = calculateServiceFeeCents(servicePriceCents)
  return {
    servicePriceCents,
    serviceFeeCents,
    totalPriceCents: servicePriceCents + serviceFeeCents,
  }
}
