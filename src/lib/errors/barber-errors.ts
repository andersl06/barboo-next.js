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
  EMAIL_ALREADY_EXISTS: {
    field: "email" as const,
    code: "DUPLICATE" as const,
    message: "Email já cadastrado.",
  },
  CPF_ALREADY_EXISTS: {
    field: "cpf" as const,
    code: "DUPLICATE" as const,
    message: "CPF já cadastrado.",
  },
} as const
