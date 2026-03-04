import { AuthContainer } from "@/components/auth/AuthContainer"
import { RegisterForm } from "@/components/auth/RegisterForm"

export default function CadastroClientePage() {
  return (
    <AuthContainer title="Cadastro de cliente">
      <RegisterForm onboardingIntent="CLIENT" />
    </AuthContainer>
  )
}
