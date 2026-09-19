# Diretrizes do Projeto — Semana Acadêmica

## Stack Escolhida
- **API:** Node.js + Express + SQLite (`better-sqlite3` ou `node:sqlite`).
- **Testes da API:** `node --test`.
- **Interface (app):** React + Vite.
- **Testes da Interface:** Vitest com mocks via MSW (Mock Service Worker).

## Estrutura de Pastas
- `api/`: Backend, rotas, lógica e testes da API.
- `app/`: Frontend React, componentes e testes de interface.
- `specs/`: Especificações dos módulos.
- `entrevistas/`: Registro das rodadas de entrevista dos módulos.
- `auditorias/`: Relatórios de auditoria e revisão de contrato.
- `evidencias/`: Scripts e relatórios de sessões e TDD.
- `.opencode/`: Skills e configurações de subagentes.

## Comandos Principais
- **API:**
  - Instalar: `cd api && npm install`
  - Iniciar: `cd api && npm start`
  - Testar: `cd api && npm test`
- **App:**
  - Instalar: `cd app && npm install`
  - Iniciar: `cd app && npm run dev`
  - Testar: `cd app && npm test`

## Convenção de Commits
- Formato obrigatório: `"M<n>-R<m>: descrição"` (ex: `"M1-R3: valida conflito de sala"`).
- O prefixo indica o módulo e a regra tratada.

## Regras Fundamentais
- `contrato-api.md` é imutável e não pode ser alterado.
- Nunca edite um teste existente para fazê-lo passar ou ficar verde.
- Se um teste falhar, corrija o código de produção, nunca o teste.
- O desenvolvimento da API deve seguir estritamente o ciclo TDD (vermelho -> verde).
