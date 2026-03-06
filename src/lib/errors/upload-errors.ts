export const UPLOAD_ERRORS = {
  IMAGE_REQUIRED: {
    code: "IMAGE_REQUIRED" as const,
    message: "Imagem é obrigatória.",
    field: "file" as const,
  },
  IMAGE_INVALID_TYPE: {
    code: "IMAGE_INVALID_TYPE" as const,
    message: "Formato inválido. Envie PNG, JPEG ou WEBP.",
    field: "file" as const,
  },
  IMAGE_TOO_LARGE: {
    code: "IMAGE_TOO_LARGE" as const,
    message: "Imagem excede o tamanho máximo permitido.",
    field: "file" as const,
  },
  STORAGE_UNAVAILABLE: {
    code: "STORAGE_UNAVAILABLE" as const,
    message: "Serviço de storage indisponível no momento.",
    field: undefined,
  },
} as const
