export const BARBER_PROFILE_ERRORS = {
  BIO_MAX: {
    code: "VALIDATION_ERROR" as const,
    message: "Bio deve ter no máximo 500 caracteres.",
    field: "bio" as const,
  },
  AVATAR_REQUIRED: {
    code: "AVATAR_REQUIRED" as const,
    message: "Avatar é obrigatório.",
    field: "file" as const,
  },
  AVATAR_TOO_LARGE: {
    code: "AVATAR_TOO_LARGE" as const,
    message: "Avatar excede o tamanho máximo permitido.",
    field: "file" as const,
  },
  AVATAR_INVALID_TYPE: {
    code: "AVATAR_INVALID_TYPE" as const,
    message: "Formato inválido. Envie PNG, JPEG ou WEBP.",
    field: "file" as const,
  },
  SCHEDULE_INVALID: {
    code: "SCHEDULE_INVALID" as const,
    message: "Formato de horários inválido.",
    field: "weeklySchedule" as const,
  },
  SCHEDULE_TIME_RANGE_INVALID: {
    code: "SCHEDULE_TIME_RANGE_INVALID" as const,
    message: "Horário inválido: início deve ser menor que fim.",
    field: "weeklySchedule" as const,
  },
  BARBER_PROFILE_NOT_FOUND: {
    code: "BARBER_PROFILE_NOT_FOUND" as const,
    message: "Perfil de barbeiro não encontrado.",
    field: undefined,
  },
  STORAGE_UNAVAILABLE: {
    code: "STORAGE_UNAVAILABLE" as const,
    message: "Serviço de storage indisponível no momento.",
    field: undefined,
  },
} as const
