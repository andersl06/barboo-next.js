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
    message: "Credenciais inválidas",
  },
  TEMP_TOKEN_INVALID: {
    field: undefined,
    code: "UNAUTHORIZED" as const,
    message: "Token temporário inválido ou expirado",
  },
  PASSWORD_CONFIRM_MISMATCH: {
    field: "confirmPassword" as const,
    code: "VALIDATION_ERROR" as const,
    message: "Confirmação de senha não confere",
  },
} as const
