export const APPOINTMENT_ERRORS = {
  BARBERSHOP_NOT_BOOKABLE: {
    code: "BARBERSHOP_NOT_BOOKABLE" as const,
    message: "Esta barbearia nao esta disponivel para agendamento.",
  },
  BARBER_NOT_FOUND: {
    code: "BARBER_NOT_FOUND" as const,
    message: "Barbeiro nao encontrado para esta barbearia.",
  },
  SERVICE_NOT_FOUND: {
    code: "SERVICE_NOT_FOUND" as const,
    message: "Servico nao encontrado para esta barbearia.",
  },
  INVALID_DATE: {
    code: "INVALID_DATE" as const,
    message: "Data invalida. Use o formato YYYY-MM-DD.",
  },
  INVALID_START_AT: {
    code: "INVALID_START_AT" as const,
    message: "Horario invalido para agendamento.",
  },
  SLOT_UNAVAILABLE: {
    code: "APPOINTMENT_SLOT_UNAVAILABLE" as const,
    message: "Esse horario acabou de ser reservado. Selecione outro.",
  },
  FORBIDDEN_CONFIRM: {
    code: "FORBIDDEN_CONFIRM_APPOINTMENT" as const,
    message: "Voce nao tem permissao para confirmar este agendamento.",
  },
  FORBIDDEN_CANCEL: {
    code: "FORBIDDEN_CANCEL_APPOINTMENT" as const,
    message: "Voce nao tem permissao para cancelar este agendamento.",
  },
  NOT_FOUND: {
    code: "APPOINTMENT_NOT_FOUND" as const,
    message: "Agendamento nao encontrado.",
  },
  INVALID_STATUS: {
    code: "APPOINTMENT_INVALID_STATUS" as const,
    message: "Status atual nao permite esta operacao.",
  },
  CANCEL_WINDOW_EXPIRED: {
    code: "APPOINTMENT_CANCEL_WINDOW_EXPIRED" as const,
    message: "Voce so pode cancelar ate 30 minutos antes do horario.",
  },
} as const
