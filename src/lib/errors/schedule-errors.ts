export const SCHEDULE_ERRORS = {
  OPENING_HOURS_REQUIRED: {
    field: "openingHours" as const,
    code: "REQUIRED" as const,
    message: "Horários de funcionamento são obrigatórios.",
  },
  OPENING_HOURS_INVALID: {
    field: "openingHours" as const,
    code: "INVALID_FORMAT" as const,
    message: "Horários de funcionamento inválidos.",
  },
  BLOCK_INVALID_RANGE: {
    field: "endTime" as const,
    code: "INVALID_FORMAT" as const,
    message: "Intervalo inválido: endTime deve ser maior que startTime.",
  },
  BARBER_CANNOT_MANAGE_BLOCKS: {
    field: undefined,
    code: "DOMAIN_RULE" as const,
    message: "Barbeiro não tem permissão para gerenciar bloqueios.",
  },
  BARBER_BLOCK_NOT_FOUND: {
    field: undefined,
    code: "DOMAIN_RULE" as const,
    message: "Bloqueio não encontrado.",
  },
  BARBERSHOP_SUSPENDED: {
    field: undefined,
    code: "DOMAIN_RULE" as const,
    message: "Barbearia suspensa.",
  },
} as const
