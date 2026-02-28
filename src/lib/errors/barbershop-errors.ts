// src/lib/errors/barbershop-errors.ts

export type BarbershopField =
  | "name"
  | "description"
  | "cnpj"
  | "cpf"
  | "phone"
  | "email"
  | "address"
  | "addressNumber"
  | "neighborhood"
  | "city"
  | "state"
  | "zipCode"
  | "slug"

export type BarbershopErrorCode =
  | "REQUIRED"
  | "MIN_LENGTH"
  | "MAX_LENGTH"
  | "INVALID_FORMAT"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_UF"
  | "INVALID_ZIP"
  | "INVALID_CNPJ"
  | "DUPLICATE"
  | "DOMAIN_RULE"
  | "INTEGRATION"

export const BARBERSHOP_ERRORS = {
  NAME_MIN: {
    field: "name" as const,
    code: "MIN_LENGTH" as const,
    message: "Nome deve ter no mínimo 3 caracteres.",
  },
  NAME_MAX: {
    field: "name" as const,
    code: "MAX_LENGTH" as const,
    message: "Nome deve ter no máximo 30 caracteres.",
  },

  DESCRIPTION_MAX: {
    field: "description" as const,
    code: "MAX_LENGTH" as const,
    message: "Descrição deve ter no máximo 500 caracteres.",
  },

  PHONE_REQUIRED: {
    field: "phone" as const,
    code: "REQUIRED" as const,
    message: "Telefone é obrigatório.",
  },
  PHONE_INVALID: {
    field: "phone" as const,
    code: "INVALID_PHONE" as const,
    message: "Telefone inválido.",
  },

  ADDRESS_REQUIRED: {
    field: "address" as const,
    code: "REQUIRED" as const,
    message: "Endereço é obrigatório.",
  },
  ADDRESS_MAX: {
    field: "address" as const,
    code: "MAX_LENGTH" as const,
    message: "Endereço deve ter no máximo 120 caracteres.",
  },

  ADDRESS_NUMBER_REQUIRED: {
    field: "addressNumber" as const,
    code: "REQUIRED" as const,
    message: "Número é obrigatório.",
  },
  ADDRESS_NUMBER_MAX: {
    field: "addressNumber" as const,
    code: "MAX_LENGTH" as const,
    message: "Número deve ter no máximo 20 caracteres.",
  },

  NEIGHBORHOOD_REQUIRED: {
    field: "neighborhood" as const,
    code: "REQUIRED" as const,
    message: "Bairro é obrigatório.",
  },
  NEIGHBORHOOD_MAX: {
    field: "neighborhood" as const,
    code: "MAX_LENGTH" as const,
    message: "Bairro deve ter no máximo 60 caracteres.",
  },

  CITY_REQUIRED: {
    field: "city" as const,
    code: "REQUIRED" as const,
    message: "Cidade é obrigatória.",
  },
  CITY_MAX: {
    field: "city" as const,
    code: "MAX_LENGTH" as const,
    message: "Cidade deve ter no máximo 60 caracteres.",
  },

  UF_REQUIRED: {
    field: "state" as const,
    code: "REQUIRED" as const,
    message: "UF é obrigatória.",
  },
  UF_INVALID: {
    field: "state" as const,
    code: "INVALID_UF" as const,
    message: "UF inválida.",
  },

  ZIP_REQUIRED: {
    field: "zipCode" as const,
    code: "REQUIRED" as const,
    message: "CEP é obrigatório.",
  },
  ZIP_INVALID: {
    field: "zipCode" as const,
    code: "INVALID_ZIP" as const,
    message: "CEP inválido (formato esperado 00000-000).",
  },
  ZIP_NOT_FOUND: {
    field: "zipCode" as const,
    code: "INTEGRATION" as const,
    message: "CEP não encontrado.",
  },
  ZIP_SERVICE_UNAVAILABLE: {
    field: "zipCode" as const,
    code: "INTEGRATION" as const,
    message: "Serviço de CEP indisponível no momento.",
  },

  CNPJ_INVALID: {
    field: "cnpj" as const,
    code: "INVALID_CNPJ" as const,
    message: "CNPJ inválido.",
  },
  CNPJ_NOT_FOUND: {
    field: "cnpj" as const,
    code: "INTEGRATION" as const,
    message: "CNPJ não encontrado.",
  },
  CNPJ_INACTIVE: {
    field: "cnpj" as const,
    code: "INTEGRATION" as const,
    message: "CNPJ encontrado, mas está inativo.",
  },
  CNPJ_SERVICE_UNAVAILABLE: {
    field: "cnpj" as const,
    code: "INTEGRATION" as const,
    message: "Serviço de CNPJ indisponível no momento.",
  },

  EMAIL_INVALID: {
    field: "email" as const,
    code: "INVALID_EMAIL" as const,
    message: "E-mail inválido.",
  },

  OWNER_ALREADY_HAS_BARBERSHOP: {
    field: undefined,
    code: "DOMAIN_RULE" as const,
    message: "Este usuário já possui uma barbearia vinculada como OWNER.",
  },

  GEOCODING_NOT_FOUND: {
    field: undefined,
    code: "INTEGRATION" as const,
    message: "Não foi possível geolocalizar o endereço informado.",
  },
  GEOCODING_SERVICE_UNAVAILABLE: {
    field: undefined,
    code: "INTEGRATION" as const,
    message: "Serviço de geolocalização indisponível no momento.",
  },

  SLUG_ALREADY_EXISTS: {
    field: "slug" as const,
    code: "DUPLICATE" as const,
    message: "Essa URL já está em uso. Tente outra.",
  },

  CNPJ_ALREADY_EXISTS: {
    field: "cnpj" as const,
    code: "DUPLICATE" as const,
    message: "Já existe uma barbearia cadastrada com esse CNPJ.",
  },
  CPF_ALREADY_EXISTS: {
    field: "cpf" as const,
    code: "DUPLICATE" as const,
    message: "Já existe uma barbearia cadastrada com esse CPF.",
  },
} as const