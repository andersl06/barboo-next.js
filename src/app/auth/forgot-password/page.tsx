import { AuthContainer } from "@/components/auth/AuthContainer"
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm"

export default function ForgotPasswordPage() {
  return (
    <AuthContainer
      title="Recuperar senha"
      subtitle="Informe seu email para receber o link de redefinicao."
    >
      <ForgotPasswordForm />
    </AuthContainer>
  )
}
