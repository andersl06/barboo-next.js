export const AUTH_ERRORS = {
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
  INVALID_CREDENTIALS: {
    field: undefined,
    code: "INVALID_CREDENTIALS" as const,
    message: "Email ou senha inválidos",
  },
} as const
