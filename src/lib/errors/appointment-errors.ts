export const APPOINTMENT_ERRORS = {
  BARBERSHOP_NOT_BOOKABLE: {
    code: "BARBERSHOP_NOT_BOOKABLE" as const,
    message: "Esta barbearia não está disponível para agendamento.",
  },
  BARBER_NOT_FOUND: {
    code: "BARBER_NOT_FOUND" as const,
    message: "Barbeiro não encontrado para esta barbearia.",
  },
  SERVICE_NOT_FOUND: {
    code: "SERVICE_NOT_FOUND" as const,
    message: "Serviço não encontrado para esta barbearia.",
  },
  INVALID_DATE: {
    code: "INVALID_DATE" as const,
    message: "Data inválida. Use o formato YYYY-MM-DD.",
  },
  INVALID_START_AT: {
    code: "INVALID_START_AT" as const,
    message: "Horário inválido para agendamento.",
  },
  SLOT_UNAVAILABLE: {
    code: "APPOINTMENT_SLOT_UNAVAILABLE" as const,
    message: "Esse horário acabou de ser reservado. Selecione outro.",
  },
  FORBIDDEN_CONFIRM: {
    code: "FORBIDDEN_CONFIRM_APPOINTMENT" as const,
    message: "Você não tem permissão para confirmar este agendamento.",
  },
  FORBIDDEN_CANCEL: {
    code: "FORBIDDEN_CANCEL_APPOINTMENT" as const,
    message: "Você não tem permissão para cancelar este agendamento.",
  },
  NOT_FOUND: {
    code: "APPOINTMENT_NOT_FOUND" as const,
    message: "Agendamento não encontrado.",
  },
  INVALID_STATUS: {
    code: "APPOINTMENT_INVALID_STATUS" as const,
    message: "Status atual não permite esta operação.",
  },
  CANCEL_WINDOW_EXPIRED: {
    code: "APPOINTMENT_CANCEL_WINDOW_EXPIRED" as const,
    message: "Você só pode cancelar até 30 minutos antes do horário.",
  },
} as const
