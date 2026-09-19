# Diretrizes da API

## Stack
- Node.js e Express.
- Banco de dados SQLite (`better-sqlite3` ou `node:sqlite`).
- Testes automatizados com `node --test`.

## Comandos
- Instalar: `npm install`
- Iniciar: `npm start`
- Testar: `npm test`

## Regras da API
- Siga estritamente o `contrato-api.md` (rotas, verbos, campos e status HTTP).
- Cabeçalho `X-Usuario` obrigatório em todas as rotas (exceto isentas no contrato).
- Suporte a `MODO_TESTE=1` com endpoints sob `/_teste/*`.
- Nunca utilize o relógio real do sistema sob `MODO_TESTE=1`.
- Validação em ordem: 401 -> 403 -> 404 -> 422 -> regras do recurso.
- Respostas de erro no formato: `{"erro": "CODIGO", "mensagem": "..."}`.

## Testes e TDD
- Ciclo obrigatório TDD: escreva o teste antes da implementação.
- Nunca edite um teste existente para deixá-lo verde; ajuste a implementação.
- Commits no padrão: `"M<n>-R<m>: descrição"`.
