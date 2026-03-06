💈 Barboo

Plataforma SaaS para gestão e agendamento online de barbearias.

O Barboo conecta clientes a barbearias próximas, permitindo busca por geolocalização, visualização de serviços, escolha de barbeiro e agendamento em tempo real.
Além disso, oferece um painel administrativo completo para gestão operacional da barbearia.

🎯 Objetivo do Projeto

Criar um sistema moderno e escalável que permita:

📍 Descoberta de barbearias por localização

📅 Agendamento online com cálculo inteligente de disponibilidade

👤 Gestão de barbeiros e serviços

🏪 Estrutura multi-tenant (várias barbearias no mesmo sistema)

💰 Modelo de monetização via comissão/faturas (em desenvolvimento)

🏗 Arquitetura
Backend

Node.js

Prisma ORM

PostgreSQL

JWT para autenticação

Estrutura multi-tenant via Membership

Banco de Dados

Principais entidades:

User → Autenticação

Barbershop → Barbearia

Membership → Relaciona usuário à barbearia (OWNER / BARBER)

BarberProfile → Perfil profissional do barbeiro

Category → Categorias de serviço

Service → Serviços oferecidos

Appointment → Agendamentos

🔐 Sistema de Autenticação

Registro com validação de dados

Senha criptografada

JWT com expiração

Middleware de proteção

Estrutura multi-tenant

Controle por Membership (não por role global)

🏪 Módulo Barbearia
Onboarding

Criação da barbearia

Endereço completo

Geolocalização (latitude/longitude)

URL personalizada

Upload de logo e capa

Definição se o owner atua como barbeiro

Estrutura Operacional

Categorias

Serviços

Vinculação de serviços ao barbeiro

Horários de funcionamento

Horários individuais por barbeiro

📍 Experiência do Cliente

Solicitação de geolocalização

Busca por barbearias próximas

Página pública da barbearia

Seleção de serviço

Seleção de barbeiro

Seleção de horário

Agendamento

Cancelamento com regra de 30 minutos

👨‍🔧 Experiência do Barbeiro

Dashboard com agenda do dia

Visualização de próximos atendimentos

Marcar como concluído

Marcar como não compareceu

Criar agendamento manual para clientes presenciais

⚙️ Status do Projeto
✅ Concluído

Estrutura inicial do banco

Conexão com PostgreSQL via Docker

Prisma configurado

Registro de usuário

Estrutura multi-tenant base

🚧 Em desenvolvimento

Login robusto

Onboarding completo da barbearia

Sistema de disponibilidade

Fluxo completo de agendamento

🔜 Planejado

Realtime para agenda

Sistema financeiro (comissão e faturas)

Avaliações

Notificações

Dashboard analítico

🧠 Conceitos Técnicos Importantes
Multi-tenant

Cada usuário pode pertencer a uma ou mais barbearias via Membership.
Permissões não ficam no usuário, mas na relação com a barbearia.

Disponibilidade Inteligente

O sistema de agenda considera:

Horário da barbearia

Horário individual do barbeiro

Bloqueios

Duração do serviço

Sobreposição de agendamentos

🚀 Como rodar o projeto
1️⃣ Subir banco via Docker
docker run --name barboo-postgres \
-e POSTGRES_USER=postgres \
-e POSTGRES_PASSWORD=postgres \
-e POSTGRES_DB=barboo \
-p 5432:5432 \
-d postgres:15
2️⃣ Configurar .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barboo"
JWT_SECRET="sua_chave_secreta"
3️⃣ Sincronizar banco
npx prisma db push
4️⃣ Rodar projeto
npm run dev
🗺 Roadmap (Visão Macro)

Finalizar fluxo de agendamento

Implementar realtime

Criar dashboard do barbeiro

Estruturar financeiro

Implementar avaliações

Lançar versão beta

## Password reset por email

Foi implementado o fluxo de recuperacao de senha com App Router + Prisma:

- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- Paginas:
  - `/auth/forgot-password`
  - `/auth/reset-password?token=...`

### Variaveis de ambiente

Adicione no seu `.env`:

```env
APP_URL="http://localhost:3000"
EMAIL_PROVIDER="console" # console | resend
EMAIL_FROM="Barboo <no-reply@seu-dominio.com>"
RESEND_API_KEY=""
PASSWORD_RESET_TOKEN_SECRET="troque-por-um-segredo-forte"
PASSWORD_RESET_TOKEN_TTL_MINUTES="30"
```

Observacoes:

- Em desenvolvimento, com `EMAIL_PROVIDER=console`, o link de reset eh logado no terminal.
- Em producao, use `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM`.

### Como testar localmente

1. Rode as migrations:

```bash
npx prisma migrate dev
```

2. Suba o app:

```bash
npm run dev
```

3. Acesse:

- `http://localhost:3000/auth/forgot-password`
- informe o email do usuario
- copie o link exibido no terminal (provider `console`)
- abra `.../auth/reset-password?token=...`
- defina a nova senha
- faca login normalmente

### Producao (Vercel + Neon)

1. No Neon, garanta `DATABASE_URL` de producao.
2. Na Vercel, configure as envs:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `APP_URL` (url publica do app)
   - `EMAIL_PROVIDER=resend`
   - `EMAIL_FROM`
   - `RESEND_API_KEY`
   - `PASSWORD_RESET_TOKEN_SECRET`
   - `PASSWORD_RESET_TOKEN_TTL_MINUTES`
3. Aplique migrations em producao:

```bash
npx prisma migrate deploy
```

4. Redeploy na Vercel e teste o fluxo completo.

### Deploy quando houver alteracoes no banco (Prisma)

Se voce alterou `schema.prisma`, **nao use `db push` em producao**. O fluxo correto e:

1. Localmente, criar migration:

```bash
npx prisma migrate dev --name nome_da_mudanca
```

2. Subir o codigo com a pasta `prisma/migrations` versionada no Git.
3. No ambiente de deploy (ou CI), aplicar migrations pendentes:

```bash
npx prisma migrate deploy
```

4. Gerar o client Prisma:

```bash
npx prisma generate
```

5. Fazer o build da aplicacao:

```bash
npm run build
```

Exemplo de comando unico para pipeline/servidor:

```bash
npx prisma migrate deploy && npx prisma generate && npm run build
```

## Cobranca semanal via AbacatePay (PIX)

Fluxo implementado para OWNER em `/owner/finance`:

- Botao `Pagar fatura` cria cobranca PIX no backend.
- Modal mostra QR Code, codigo copia e cola, valor e expiracao.
- Polling de status a cada 1s por ate 5 minutos (com backoff leve em 429).
- Quando pago, a fatura muda para `PAID`.
- Se nao confirmar em 5 minutos, a fatura continua pendente e o modal permite gerar novo QR.

### Variavel de ambiente

```env
ABACATEPAY_API_KEY="seu-token-abacatepay"
```

### Endpoints

- `POST /api/billing/invoices/:invoiceId/pay`
- `GET /api/billing/charges/:chargeId/status`

### Teste rapido em desenvolvimento

1. Gere uma fatura semanal em `/owner/finance`.
2. Clique em `Pagar fatura` em uma fatura `OPEN/OVERDUE`.
3. Pague o PIX pelo QR ou copia e cola.
4. Aguarde o status virar `PAID` no modal e na lista.
