# Diretrizes da Interface (App)

## Stack
- React com Vite.
- Testes com Vitest.
- Mock de API com MSW (Mock Service Worker).

## Comandos
- Instalar: `npm install`
- Iniciar: `npm run dev`
- Testar: `npm test`

## Regras da Interface
- Siga estritamente o `contrato-api.md` ao consumir a API.
- Envie o cabeçalho `X-Usuario` em todas as requisições autenticadas.
- Trate erros no padrão `{"erro": "CODIGO", "mensagem": "..."}`.
- Use MSW para interceptar e mockar requisições em testes e desenvolvimento.

## Testes
- Escreva testes de componentes e páginas utilizando Vitest.
- Nunca edite um teste existente para deixá-lo verde; ajuste o componente.
- Commits no padrão: `"M<n>-R<m>: descrição"`.
