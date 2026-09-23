---
name: telas-react
description: Regras para desenvolvimento de telas e componentes React + Vite com fetch centralizado, exibição exata de erros da API e TDD estrito com Vitest, Testing Library e MSW. Use ao criar ou alterar telas, componentes e testes no app.
---

# Diretrizes para Telas React + Vite

## 1. Arquitetura de Componentes
- **Componentes pequenos:** Cada componente deve ter responsabilidade única e tamanho reduzido. Quebre telas em subcomponentes reutilizáveis e fáceis de isolar.
- **Composição:** Telas complexas são montadas pela composição de pequenos componentes, evitando arquivos monolíticos.
- **Estado enxuto:** Mantenha o estado local restrito ao menor escopo necessário.

## 2. Chamadas de API Centralizadas (`app/src/api.js`)
- **Centralização obrigatória:** Toda comunicação HTTP deve residir exclusivamente em `app/src/api.js`. Componentes nunca chamam `fetch` diretamente.
- **URL base configurável:** A URL base deve ser configurável via variável de ambiente (ex: `import.meta.env.VITE_API_URL`), com fallback padrão.
- **Cabeçalho de autenticação:** Envie obrigatoriamente `X-Usuario: <id>` em todas as requisições autenticadas.
- **Propagação de erros:** Erros da API devem ser propagados preservando a estrutura devolvida (`{ erro, mensagem }`).

## 3. Exibição de Erros da API
- **Exatidão obrigatória:** Apresente na tela o **código (`erro`)** e a **mensagem (`mensagem`)** exatamente como retornados pela API.
- **Sem mascaramento:** Não substitua erros da API por textos genéricos nem tente traduzir ou esconder o código retornado.
- **Acessibilidade:** Renderize mensagens de erro em elementos semânticos e acessíveis (ex: container com `role="alert"`).

## 4. Testes com Vitest + Testing Library + MSW
- **Stack obrigatória:** Vitest, `@testing-library/react`, `@testing-library/user-event` e MSW (`msw/node`).
- **Isolamento total com MSW:** Nunca execute chamadas à API real nos testes. Simule todas as respostas (sucessos e erros) via MSW de acordo com o `contrato-api.md`.
- **Foco na experiência do usuário:**
  - Interaja usando `userEvent` (cliques, digitação).
  - Consulte elementos por papéis e rótulos acessíveis (`screen.getByRole`, `screen.getByLabelText`, `screen.findByRole`).
  - Nunca acople testes ao estado interno, hooks privados ou implementação do componente.

## 5. TDD Estrito: Um Componente por Vez
- **Teste antes do código:** O teste deve ser escrito e falhar (vermelho) antes de qualquer código de produção do componente ser implementado.
- **Um componente por ciclo:** Implemente e teste um componente/comportamento por vez. É proibido criar múltiplos componentes ou telas inteiras em lote sem testes prévios.
- **Código mínimo:** Escreva apenas o código necessário para fazer o teste atual passar (verde).
- **Integridade dos testes:** Nunca altere um teste existente para fazê-lo passar. Se o teste falhar, corrija o código de produção do componente.
