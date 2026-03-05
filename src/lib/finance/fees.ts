const SERVICE_FEE_PERCENT = 0.03
const MIN_SERVICE_FEE_CENTS = 100

export function calculateServiceFeeCents(servicePriceCents: number) {
  const percentageFee = Math.round(servicePriceCents * SERVICE_FEE_PERCENT)
  return Math.max(percentageFee, MIN_SERVICE_FEE_CENTS)
}

export function calculateAppointmentTotals(servicePriceCents: number) {
  const serviceFeeCents = calculateServiceFeeCents(servicePriceCents)
  return {
    servicePriceCents,
    serviceFeeCents,
    totalPriceCents: servicePriceCents + serviceFeeCents,
  }
}

