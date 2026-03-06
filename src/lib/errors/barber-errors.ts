export const BARBER_ERRORS = {
  BARBERSHOP_NOT_FOUND: {
    field: undefined,
    code: "DOMAIN_RULE" as const,
    message: "Barbearia não encontrada.",
  },
  BARBERSHOP_SUSPENDED: {
    field: undefined,
    code: "DOMAIN_RULE" as const,
    message: "Barbearia suspensa.",
  },
} as const
