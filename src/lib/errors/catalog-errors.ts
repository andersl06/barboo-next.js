export const CATALOG_ERRORS = {
  CATEGORY_NAME_REQUIRED: {
    field: "name" as const,
    code: "CATEGORY_NAME_REQUIRED" as const,
    message: "Nome da categoria é obrigatório.",
  },
  CATEGORY_NAME_MAX: {
    field: "name" as const,
    code: "CATEGORY_NAME_MAX" as const,
    message: "Nome da categoria deve ter no máximo 60 caracteres.",
  },
  CATEGORY_NAME_MIN: {
    field: "name" as const,
    code: "CATEGORY_NAME_REQUIRED" as const,
    message: "Nome da categoria deve ter no mínimo 2 caracteres.",
  },
  CATEGORY_DESCRIPTION_MAX: {
    field: "description" as const,
    code: "CATEGORY_DESCRIPTION_MAX" as const,
    message: "Descrição da categoria deve ter no máximo 200 caracteres.",
  },
  CATEGORY_DUPLICATE: {
    field: "name" as const,
    code: "CATEGORY_DUPLICATE" as const,
    message: "Já existe uma categoria com esse nome nessa barbearia.",
  },
  CATEGORY_NOT_FOUND: {
    field: undefined,
    code: "CATEGORY_NOT_FOUND" as const,
    message: "Categoria não encontrada.",
  },

  SERVICE_NAME_REQUIRED: {
    field: "name" as const,
    code: "SERVICE_NAME_REQUIRED" as const,
    message: "Nome do serviço é obrigatório.",
  },
  SERVICE_NAME_MAX: {
    field: "name" as const,
    code: "SERVICE_NAME_MAX" as const,
    message: "Nome do serviço deve ter no máximo 80 caracteres.",
  },
  SERVICE_NAME_MIN: {
    field: "name" as const,
    code: "SERVICE_NAME_REQUIRED" as const,
    message: "Nome do serviço deve ter no mínimo 2 caracteres.",
  },
  SERVICE_DESCRIPTION_MAX: {
    field: "description" as const,
    code: "SERVICE_DESCRIPTION_MAX" as const,
    message: "Descrição do serviço deve ter no máximo 500 caracteres.",
  },
  SERVICE_DUPLICATE: {
    field: "name" as const,
    code: "SERVICE_DUPLICATE" as const,
    message: "Já existe um serviço com esse nome nessa barbearia.",
  },
  SERVICE_INVALID_PRICE: {
    field: "priceCents" as const,
    code: "SERVICE_INVALID_PRICE" as const,
    message: "Preço inválido. Informe um valor em centavos maior ou igual a 0.",
  },
  SERVICE_INVALID_DURATION: {
    field: "durationMinutes" as const,
    code: "SERVICE_INVALID_DURATION" as const,
    message: "Duração inválida. Informe entre 5 e 480 minutos.",
  },
  SERVICE_NOT_FOUND: {
    field: undefined,
    code: "SERVICE_NOT_FOUND" as const,
    message: "Serviço não encontrado.",
  },
} as const