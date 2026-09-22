---
name: tdd-node
description: Implementa regras da API (Node.js/Express/SQLite) e da Interface (React/Vite/MSW) em TDD estrito — teste primeiro (vermelho), código mínimo (verde), commit por regra no formato M<n>-R<m>. Use quando for implementar uma spec, regras de negócio ou componentes da Semana Acadêmica.
---

# TDD — API (Node.js + Express + SQLite) e App (React + Vite)

O ciclo é inegociável:
**um teste que falha (vermelho) → código mínimo para passar (verde) → refatoração → commit da regra.**

Nada de escrever múltiplos testes de uma vez. Nada de escrever código de produção sem teste falhando antes. Sem contrato, verde não significa nada.

---

## As Regras Invioláveis

1. **O suspeito é sempre o código de produção.**
   Nunca edite um teste existente para fazê-lo passar ou deixá-lo verde. Se o teste falhou, corrija a implementação. Só se altera um teste quando a **spec** do módulo foi oficialmente alterada.
2. **`contrato-api.md` é imutável.**
   Rotas, verbos, payloads, códigos de erro e status HTTP são contratos fixos. Não invente rotas ou formatos diferentes.
3. **Nome do teste começa com a regra:**
   Obrigatoriamente no formato: `'M<n>-R<m>: descrição em português'`
   Exemplo: `it('M1-R2: recusa conflito de sala no mesmo horário', async () => { ... })`
4. **Um commit por regra:**
   Assim que a regra estiver verde (e a suíte inteira passando), faça o commit imediatamente com a mensagem no padrão:
   `"M<n>-R<m>: descrição"` (ex: `git commit -m "M1-R2: recusa conflito de sala"`).

---

## O Ciclo por Regra (Passo a Passo)

Para cada regra da spec (`M<n>-R<m>`), execute estritamente nesta ordem:

1. **Escreva UM teste** que prova aquela regra específica.
2. **Rode o teste e mostre a falha (VERMELHO):**
   Execute o comando de teste (`npm test`) e observe a falha esperada no terminal. Teste que passa antes do código de produção existir é falso positivo ou tautologia — pare e investigue antes de prosseguir.
3. **Escreva o código mínimo de produção:**
   Implemente apenas o suficiente para transformar a falha em sucesso. Não antecipe a regra seguinte.
4. **Rode a suíte completa (VERDE):**
   Garanta que o novo teste passou e nenhum teste anterior quebrou.
5. **Refatore (se necessário):**
   Limpe duplicações e melhore a legibilidade mantendo a suíte verde.
6. **Commit da regra:**
   Faça o commit no padrão `"M<n>-R<m>: descrição"`.

---

## 1. Testes da API (Node.js + Express + SQLite)

### Onde os testes moram e comandos
- Diretório: `api/` (em pasta de testes, ex: `api/test/` ou `api/testes/`).
- Comando de execução: `cd api && npm test` (utilizando o runner nativo `node --test` e `node:assert/strict`).

### Borda pública HTTP
- O teste valida **comportamento pela interface pública HTTP**, nunca funções internas.
- Suba o Express e faça chamadas com `fetch` nativo (servidor em porta efêmera) ou `supertest(app)`.
- **Nunca** importe repositórios, serviços ou modelos diretamente dentro do arquivo de teste.

### Isolamento de Banco de Dados
- Cada teste (ou suíte) deve operar sobre uma instância isolada do SQLite em memória (`:memory:`) ou arquivo temporário descartável.
- Nenhum teste pode herdar resíduos ou dados criados por outro teste.

### Modo de Teste e Controle do Relógio (`contrato-api.md`)
- A API deve rodar com a variável de ambiente `MODO_TESTE=1`.
- **Nunca use o relógio real do sistema (`new Date()` real)** quando em modo de teste. O relógio fica estático e só se move sob comando.
- Use os endpoints de teste definidos no contrato:
  - `POST /_teste/reset` (204): limpa todos os dados, recarrega dados iniciais (usuários/salas fixos) e posiciona o relógio em `2026-10-13T09:00:00-03:00`.
  - `PUT /_teste/relogio` (200): envia `{"agora": "<ISO>"}` para avançar o relógio simulado.
  - `GET /_teste/relogio` (200): retorna o instante atual do relógio simulado.
- Inicie cada cenário ou suíte chamando `POST /_teste/reset`.

### Convenções do Contrato da API
- **Cabeçalho de Autenticação:** Envie `X-Usuario: <id>` em todas as requisições autenticadas.
- **Ordem das validações:** 401 (`USUARIO_DESCONHECIDO`) → 403 (`SOMENTE_ORGANIZACAO`, etc.) → 404 (`NAO_ENCONTRADO`) → 422 (`DADOS_INVALIDOS`) → regras do recurso.
- **Formato de erro:** Sempre `{"erro": "CODIGO", "mensagem": "..."}`.

### Exemplo de Teste da API (`node --test`)
```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarApp } from '../src/app.js'; // ou fetch com servidor ouvindo em porta efêmera

describe('Módulo 1 — Atividades', () => {
  let app;

  beforeEach(async () => {
    process.env.MODO_TESTE = '1';
    app = criarApp({ database: ':memory:' });
    await request(app).post('/_teste/reset');
  });

  it('M1-R9: recusa conflito de sala com intervalo inferior a 15 minutos', async () => {
    // 1. Cadastra primeira atividade no auditório (termina às 12:00)
    const res1 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra de Abertura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          {
            inicio: '2026-10-19T10:00:00-03:00',
            fim: '2026-10-19T12:00:00-03:00'
          }
        ]
      });
    assert.equal(res1.status, 201);

    // 2. Tenta cadastrar outra palestra na mesma sala iniciando às 12:10 (intervalo de 10 min < 15 min)
    const res2 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra de Inteligência Artificial',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 80,
        encontros: [
          {
            inicio: '2026-10-19T12:10:00-03:00',
            fim: '2026-10-19T13:30:00-03:00'
          }
        ]
      });

    assert.equal(res2.status, 409);
    assert.equal(res2.body.erro, 'CONFLITO_DE_SALA');
  });
});
```

---

## 2. Testes da Interface (React + Vite + Vitest + MSW)

### Onde os testes moram e comandos
- Diretório: `app/` (em `app/src/**/*.test.jsx` ou `app/src/**/*.spec.jsx`).
- Comando de execução: `cd app && npm test` (Vitest com ambiente jsdom/happy-dom).

### Mock da API com MSW (Mock Service Worker)
- **Nunca chame a API real nos testes do app.**
- Intercepte requisições via `msw/node` usando handlers que respeitam estritamente o `contrato-api.md`.
- No `beforeEach`, resete os handlers do MSW para o estado padrão do teste.
- O MSW deve validar se o cabeçalho `X-Usuario` foi enviado e responder com os mesmos códigos e payloads da API.

### O que o teste de interface verifica
- Verifica o **comportamento visível pelo usuário** (Testing Library):
  - Preenchimento de formulários via `userEvent`.
  - Mensagens de erro exibidas ao receber erros da API (`{"erro": "CONFLITO_DE_SALA", ...}`).
  - Habilitação/desabilitação de botões e transições de tela.
- **Nunca acople o teste ao estado interno** do componente (não acesse `state`, hooks ou props privadas). Busque elementos por acessibilidade (`screen.getByRole`, `screen.getByLabelText`).

### Exemplo de Teste da Interface (Vitest + Testing Library + MSW)
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { CadastroAtividade } from '../components/CadastroAtividade.jsx';

describe('Módulo 1 — Interface de Atividades', () => {
  it('M1-R9: exibe alerta quando há conflito de sala', async () => {
    // Configura o MSW para simular o erro 409 (CONFLITO_DE_SALA) do contrato
    server.use(
      http.post('/atividades', () => {
        return HttpResponse.json(
          { erro: 'CONFLITO_DE_SALA', mensagem: 'Conflito de horário ou intervalo inferior a 15 minutos na sala.' },
          { status: 409 }
        );
      })
    );

    const user = userEvent.setup();
    render(<CadastroAtividade usuarioId="org-ana" />);

    await user.type(screen.getByLabelText(/título/i), 'Palestra de Inteligência Artificial');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/intervalo inferior a 15 minutos|conflito de sala/i);
  });
});
```

---

## Anti-padrões: Testes que Não Valem Nada

1. **Acoplado à implementação:**
   - Na API: importar repositório ou inspecionar tabela do SQLite em vez de fazer requisição HTTP e checar o retorno da rota.
   - No App: testar se a variável de estado mudou em vez de verificar o texto na tela.
2. **Tautológico:**
   - Calcular o valor esperado usando a mesma função ou lógica do código de produção. O valor esperado vem explicitamente da spec (`assert.equal(res.status, 409)`).
3. **Frouxo:**
   - Conferir apenas `assert.equal(res.status, 200)` e ignorar o corpo. Um retorno vazio com status 200 passa num teste frouxo, mas quebra o sistema.
   - No App, verificar apenas que o componente não deu crash (`expect(container).toBeDefined()`) sem testar nenhuma interação.

---

## Checklist de Conclusão de Regra

Antes de passar para a regra seguinte:
- [ ] O teste foi escrito antes do código de produção.
- [ ] O teste falhou visivelmente no terminal antes da implementação.
- [ ] O código mínimo foi escrito e o teste passou.
- [ ] Nenhum teste existente foi alterado para passar.
- [ ] O nome do teste começa com `"M<n>-R<m>: ..."`.
- [ ] A suíte completa roda 100% verde.
- [ ] O commit foi realizado com a mensagem `"M<n>-R<m>: descrição"`.
