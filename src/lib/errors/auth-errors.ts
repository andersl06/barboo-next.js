export const AUTH_ERRORS = {
  EMAIL_ALREADY_EXISTS: {
    field: "email" as const,
    code: "DUPLICATE" as const,
    message: "Email ja cadastrado.",
  },
  CPF_ALREADY_EXISTS: {
    field: "cpf" as const,
    code: "DUPLICATE" as const,
    message: "CPF ja cadastrado.",
  },
  INVALID_CREDENTIALS: {
    field: undefined,
    code: "INVALID_CREDENTIALS" as const,
    message: "Credenciais invalidas",
  },
  TEMP_TOKEN_INVALID: {
    field: undefined,
    code: "UNAUTHORIZED" as const,
    message: "Token temporario invalido ou expirado",
  },
  PASSWORD_CONFIRM_MISMATCH: {
    field: "confirmPassword" as const,
    code: "VALIDATION_ERROR" as const,
    message: "Confirmacao de senha nao confere",
  },
  PASSWORD_RESET_TOKEN_INVALID: {
    field: "token" as const,
    code: "RESET_TOKEN_INVALID_OR_EXPIRED" as const,
    message: "Token invalido ou expirado",
  },
  PASSWORD_RESET_REQUEST_ACCEPTED: {
    field: undefined,
    code: "OK" as const,
    message: "Se existir uma conta com este email, enviaremos um link de recuperacao.",
  },
} as const
