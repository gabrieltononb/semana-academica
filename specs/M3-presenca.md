# Spec — M3: Presença por QR

## 1. Objetivo
Resolve o controle, registro e comprovação de frequência de participantes nos encontros presenciais da Semana Acadêmica 2026. A solução permite que a organização gere e projete códigos QR dinâmicos com rotação a cada minuto e tolerância para oscilações, e que participantes com inscrição confirmada registrem sua presença via aplicativo de forma online ou offline (com sincronização resiliente e validação retrospectiva pelo horário da leitura). Em situações excepcionais de falha de dispositivo ou conectividade, permite que a organização lance presenças manuais devidamente justificadas, com teto percentual de segurança, fornecendo a listagem auditável e ordenada de presenças por encontro.

## 2. Fora de escopo
(P-13, Requisitos Seções 6 e 7):
- Autenticação por credenciais (login/senha): a identificação é realizada exclusivamente pelo cabeçalho `X-Usuario`.
- Check-out ou controle de saída de participantes ao término dos encontros.
- Suporte a múltiplos eventos (o escopo restringe-se à Semana Acadêmica 2026).
- Notificações ativas aos usuários (e-mail, SMS ou notificações push).
- Validação física ou biométrica, verificação de endereço IP ou coordenadas de geolocalização (GPS).
- Edição, cancelamento ou exclusão de presenças já registradas (os registros de presença são estritamente imutáveis).
- Validação de critérios e emissão de certificados de participação (escopo do Módulo M4).
- Cálculo acumulado de assiduidade, percentual de frequência e bloqueio por infrequência (escopo do Módulo M5).

## 3. Modelo

### CodigoDoEncontro
Representa o código dinâmico gerado para projeção em sala e leitura via aplicativo.
- `encontroId`: string — identificador do encontro consultado (referência).
- `codigo`: string — código alfanumérico dinâmico de 6 caracteres gerado para projeção/leitura (calculado).
- `trocaEm`: string (ISO 8601 com fuso) — instante exato de virada do relógio em que a tela da organização deve buscar o próximo código (calculado).
- `validoAte`: string (ISO 8601 com fuso) — primeiro instante no qual este código expira e deixa de ser aceito pela API (calculado).

### Presenca
Representa a comprovação de comparecimento de um participante a um encontro específico.
- `id`: string — identificador único no padrão `pre_` seguido de 8 caracteres hexadecimais minúsculos (calculado/gerado).
- `encontroId`: string — identificador do encontro ao qual a presença pertence (informado na URL).
- `participanteId`: string — identificador do participante (`p-*`) extraído de `X-Usuario` (nas rotas de participante) ou informado no corpo da requisição (na rota manual) (informado/extraído).
- `origem`: string (`"qr"` | `"qr_offline"` | `"manual"`) — canal de registro determinado pelo servidor: `"manual"` via rota manual; `"qr_offline"` se recebido com `lidoEm`; `"qr"` se leitura online sem `lidoEm` (calculado).
- `lidoEm`: string (ISO 8601 com fuso) — instante efetivo considerado pelas regras: informado pelo cliente em leitura offline (salvo se futuro em relação ao envio) ou fixado como o instante do relógio da API no recebimento (online e manual) (informado/calculado).
- `registradaEm`: string (ISO 8601 com fuso) — instante do relógio da API em que o registro foi persistido no banco de dados (calculado).
- `justificativa`: string ou null — texto com no mínimo 10 caracteres preenchido pela organização para presenças manuais; obrigatoriamente `null` para presenças de origem `"qr"` ou `"qr_offline"` (informado/calculado).

## 4. Endpoints

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| `GET` | `/encontros/:id/codigo` | organização | `200 CodigoDoEncontro` |
| `POST` | `/encontros/:id/presencas` | participante | `201 Presenca` na 1ª vez; `200 Presenca` depois |
| `POST` | `/encontros/:id/presencas/manual` | organização | `201 Presenca` na 1ª vez; `200 Presenca` depois |
| `GET` | `/encontros/:id/presencas` | organização | `200 [Presenca]` |

### Payloads de Entrada
- `POST /encontros/:id/presencas`:
  ```json
  {
    "codigo": "K7M2QX",
    "lidoEm": "2026-10-19T19:05:00-03:00"
  }
  ```
  `codigo` é obrigatório (string, 6 caracteres). `lidoEm` é opcional (string ISO 8601, utilizado para leitura offline).

- `POST /encontros/:id/presencas/manual`:
  ```json
  {
    "participanteId": "p-carla",
    "justificativa": "Participante sem bateria no smartphone durante o credenciamento"
  }
  ```
  `participanteId` e `justificativa` são obrigatórios.

## 5. Regras

- **R1 — Janela para obter código QR (P-01; RN-301, RN-302)**: O código dinâmico do encontro só pode ser consultado pela organização entre 15 minutos antes do início do encontro até 30 minutos depois do início do encontro (`[inicio - 15min, inicio + 30min]`), com as bordas incluídas. Se a consulta for feita fora dessa janela temporal, ou se a atividade vinculada ao encontro estiver cancelada (`situacao == "cancelada"`), a requisição é recusada com status HTTP `422 FORA_DA_JANELA`.
- **R2 — Rotação, troca e validade do QR Code (P-02; RN-303, RN-304)**: O código alfanumérico (6 caracteres) muda a cada minuto em janelas alinhadas ao relógio (de `hh:mm:00` a `hh:mm:59`). O campo `trocaEm` indica o início do minuto seguinte (`hh:mm+1:00`), e `validoAte` indica o término do minuto seguinte (`hh:mm+2:00`). O backend aceita como válido tanto o código gerado para o minuto do instante avaliado quanto o código do minuto imediatamente anterior (tolerância de grace period de 1 minuto). Qualquer outro código, código expirado ou código pertencente a outro encontro é recusado com status HTTP `422 CODIGO_INVALIDO`.
- **R3 — Janela para registro de presença online pelo participante (P-03; RN-301)**: O registro de presença online (`POST /encontros/:id/presencas` sem `lidoEm`) só é permitido entre 15 minutos antes do início do encontro e 30 minutos depois do início do encontro (`[inicio - 15min, inicio + 30min]`), considerando o relógio do sistema no momento da requisição, bordas incluídas. Requisições fora dessa janela são recusadas com status HTTP `422 FORA_DA_JANELA`.
- **R4 — Exigência de inscrição confirmada (P-04; RN-306, RN-311)**: Apenas participantes que possuam inscrição com status `confirmada` na atividade do encontro correspondente podem ter presença registrada (seja via QR online, QR offline ou manual). Se o participante não possuir inscrição na atividade, ou se a inscrição estiver em qualquer outro status (`em_espera`, `convocada`, `cancelada` ou `expirada`), a requisição é recusada com status HTTP `403 NAO_INSCRITO`.
- **R5 — Idempotência estrita e reenvio de presença (P-05; RN-307, RN-314)**: A presença é estritamente única por par `(participanteId, encontroId)`. Se o participante já possuir presença registrada no encontro informado, qualquer nova requisição com o mesmo participante (seja via QR online, QR offline ou manual) retorna status HTTP `200 OK` acompanhado dos dados do registro original existente, sem reavaliar janela, validade de código ou limite de manuais. O primeiro registro com sucesso retorna status HTTP `201 Created`.
- **R6 — Validação temporal de leitura offline e prazo de sincronização (P-06; RN-308, RN-309, RN-310)**:
  - Quando o participante envia a requisição contendo o campo `lidoEm`, a checagem da janela de presença (R3) e da validade do código (R2) é realizada tomando como referência o instante `lidoEm`.
  - Se o `lidoEm` informado for posterior ao relógio do sistema no momento do envio (dispositivo do usuário adiantado), o instante de referência adotado para validação e persistência é o próprio horário do recebimento da requisição.
  - A sincronização offline deve ser recebida em até 2 horas após o término do encontro (`tempoRequisicao <= fim + 2h`). Envios recebidos após esse prazo limite são recusados com status HTTP `422 SINCRONIZACAO_TARDIA`.
  - Presenças aceitas via leitura offline recebem `origem: "qr_offline"`.
- **R7 — Janela estendida para presença manual (P-07; RN-312)**: A organização pode registrar presença manual (`POST /encontros/:id/presencas/manual`) desde a abertura da janela do encontro (15 minutos antes do início) até 2 horas após o horário de término do encontro (`[inicio - 15min, fim + 2h]`), com as bordas incluídas. Fora desse intervalo, a requisição é recusada com status HTTP `422 FORA_DA_JANELA`.
- **R8 — Obrigatoriedade e tamanho mínimo de justificativa na presença manual (P-08; RN-311)**: O registro manual exige o preenchimento do campo `justificativa`, que deve conter no mínimo 10 caracteres (desconsiderando espaços vazios no início e no fim). Caso o campo esteja ausente, nulo ou possua menos de 10 caracteres após trim, a operação é recusada com status HTTP `422 JUSTIFICATIVA_OBRIGATORIA`. Presenças manuais aceitas recebem `origem: "manual"`.
- **R9 — Teto percentual de presenças manuais por encontro (P-09; RN-313)**: O número total acumulado de presenças com `origem == "manual"` em um encontro não pode exceder 10% do total de inscrições confirmadas na atividade correspondente, arredondando para cima (`Math.ceil(totalInscricoesConfirmadas * 0.1)`). Ao atingir ou ultrapassar esse teto, novas requisições de presença manual são recusadas com status HTTP `422 LIMITE_DE_MANUAIS`.
- **R10 — Ordem de precedência dos erros no registro de presença por QR (P-10; RN-314)**: Ao processar `POST /encontros/:id/presencas`, quando múltiplos erros ou condições ocorrerem, a avaliação segue estritamente a seguinte ordem:
  1. Encontro inexistente → `404 NAO_ENCONTRADO`;
  2. Presença já existente para o participante no encontro → retorna `200 OK` com a presença original (idempotência);
  3. Participante não possui inscrição no status `confirmada` na atividade → recusa com `403 NAO_INSCRITO`;
  4. Sincronização offline recebida mais de 2 horas após o fim do encontro → recusa com `422 SINCRONIZACAO_TARDIA`;
  5. Instante avaliado (`lidoEm` ou relógio atual) fora da janela `[inicio - 15min, inicio + 30min]` → recusa com `422 FORA_DA_JANELA`;
  6. Código informado inválido (diferente do código do minuto avaliado e do minuto anterior) → recusa com `422 CODIGO_INVALIDO`.
- **R11 — Ordem de precedência dos erros no registro de presença manual (P-11; RN-314)**: Ao processar `POST /encontros/:id/presencas/manual`, quando múltiplos erros ou condições ocorrerem, a avaliação segue estritamente a seguinte ordem:
  1. Justificativa ausente ou com menos de 10 caracteres após trim → recusa com `422 JUSTIFICATIVA_OBRIGATORIA`;
  2. Presença já existente para o participante no encontro → retorna `200 OK` com a presença original (idempotência);
  3. Participante informado não possui inscrição no status `confirmada` na atividade → recusa com `403 NAO_INSCRITO`;
  4. Horário da requisição fora da janela estendida `[inicio - 15min, fim + 2h]` → recusa com `422 FORA_DA_JANELA`;
  5. Limite de presenças manuais por encontro atingido → recusa com `422 LIMITE_DE_MANUAIS`.
- **R12 — Ordenação cronológica e desempate da lista de presenças (P-12; contrato-api.md, RN-314)**: A listagem retornada por `GET /encontros/:id/presencas` é ordenada em ordem cronológica crescente pelo campo `registradaEm` (ascendente). Em caso de empate exato no instante de `registradaEm`, o critério de desempate é a ordenação alfabética crescente do identificador do participante (`participanteId`).
- **R13 — Autenticação e autorização por perfil (P-13; Contrato da API seção 1)**: Todas as rotas do módulo M3 exigem o cabeçalho `X-Usuario` identificando um usuário cadastrado (`401 USUARIO_DESCONHECIDO` se ausente ou não cadastrado). As rotas `GET /encontros/:id/codigo`, `POST /encontros/:id/presencas/manual` e `GET /encontros/:id/presencas` são de uso exclusivo do perfil `organizacao` (`403 SOMENTE_ORGANIZACAO` se chamado por participante). A rota `POST /encontros/:id/presencas` é de uso exclusivo do perfil `participante` (`403 SOMENTE_PARTICIPANTE` se chamado por organização).

## 6. Critérios de aceite

1. **(R1, R13)** `GET /encontros/:id/codigo` às 18:45 para encontro que inicia às 19:00 (15 min antes, borda inferior) com `X-Usuario: org-ana` → `200 OK`, objeto `CodigoDoEncontro` contendo `codigo` (6 caracteres), `trocaEm` e `validoAte`.
2. **(R1)** `GET /encontros/:id/codigo` às 18:44:59 (15 min e 1s antes do início às 19:00) → `422` com `erro: "FORA_DA_JANELA"`.
3. **(R1)** `GET /encontros/:id/codigo` às 19:30:00 (30 min após início às 19:00, borda superior) → `200 OK`.
4. **(R1)** `GET /encontros/:id/codigo` às 19:30:01 (30 min e 1s após início às 19:00) → `422` com `erro: "FORA_DA_JANELA"`.
5. **(R1)** `GET /encontros/:id/codigo` dentro da janela para atividade cancelada (`situacao: cancelada`) → `422` com `erro: "FORA_DA_JANELA"`.
6. **(R2)** Emissão de código às 19:05:20 define `trocaEm` como `2026-10-19T19:06:00-03:00` e `validoAte` como `2026-10-19T19:07:00-03:00`.
7. **(R2, R3, R4)** `POST /encontros/:id/presencas` às 19:05:10 com código do minuto 19:05 e participante com inscrição confirmada → `201 Created`, `origem: "qr"`, `lidoEm: "2026-10-19T19:05:10-03:00"`, `justificativa: null`.
8. **(R2)** `POST /encontros/:id/presencas` às 19:06:15 com código gerado no minuto 19:05 (minuto imediatamente anterior, grace period) → `201 Created`.
9. **(R2)** `POST /encontros/:id/presencas` às 19:07:01 com código gerado no minuto 19:05 (2 minutos após, fora da tolerância) → `422` com `erro: "CODIGO_INVALIDO"`.
10. **(R2)** `POST /encontros/:id/presencas` com código válido pertencente a outro encontro → `422` com `erro: "CODIGO_INVALIDO"`.
11. **(R3)** `POST /encontros/:id/presencas` às 18:44:00 (antes da janela) sem `lidoEm` → `422` com `erro: "FORA_DA_JANELA"`.
12. **(R3)** `POST /encontros/:id/presencas` às 19:31:00 (depois da janela) sem `lidoEm` → `422` com `erro: "FORA_DA_JANELA"`.
13. **(R4)** `POST /encontros/:id/presencas` com participante com status de inscrição `em_espera`, `convocada`, `cancelada`, `expirada` ou sem inscrição → `403` com `erro: "NAO_INSCRITO"`.
14. **(R4)** `POST /encontros/:id/presencas/manual` para participante sem inscrição ou com inscrição cancelada → `403` com `erro: "NAO_INSCRITO"`.
15. **(R5)** `POST /encontros/:id/presencas` repetido pelo mesmo participante que já possui presença registrada (mesmo fora da janela ou com código trocado) → `200 OK` com dados do registro original inalterados.
16. **(R5)** `POST /encontros/:id/presencas/manual` para participante que já teve presença registrada via QR ou manual anterior → `200 OK` com dados do registro original inalterados.
17. **(R6)** `POST /encontros/:id/presencas` às 20:30 com `lidoEm: "2026-10-19T19:10:00-03:00"` (dentro da janela) e código válido das 19:10 → `201 Created`, `origem: "qr_offline"`, `lidoEm: "2026-10-19T19:10:00-03:00"`.
18. **(R6)** `POST /encontros/:id/presencas` às 19:15 com `lidoEm: "2026-10-19T19:20:00-03:00"` (relógio do celular adiantado) → `201 Created` com `lidoEm` persistido como `2026-10-19T19:15:00-03:00`.
19. **(R6)** `POST /encontros/:id/presencas` para encontro terminado às 21:00 enviado às 23:00:01 (mais de 2h após o fim do encontro) com `lidoEm: "2026-10-19T19:10:00-03:00"` → `422` com `erro: "SINCRONIZACAO_TARDIA"`.
20. **(R6)** `POST /encontros/:id/presencas` com `lidoEm: "2026-10-19T19:40:00-03:00"` (leitura offline efetuada fora da janela de presença) → `422` com `erro: "FORA_DA_JANELA"`.
21. **(R7, R8, R9)** `POST /encontros/:id/presencas/manual` às 22:30 para encontro terminado às 21:00 (dentro de fim + 2h) com participante confirmado, justificativa com 15 caracteres e teto respeitado → `201 Created`, `origem: "manual"`, `justificativa: "..."`.
22. **(R7)** `POST /encontros/:id/presencas/manual` às 23:00:01 para encontro terminado às 21:00 (mais de 2h após o fim) → `422` com `erro: "FORA_DA_JANELA"`.
23. **(R7)** `POST /encontros/:id/presencas/manual` às 18:40 para encontro que inicia às 19:00 (antes de início - 15min) → `422` com `erro: "FORA_DA_JANELA"`.
24. **(R8)** `POST /encontros/:id/presencas/manual` sem campo `justificativa`, com justificativa nula ou com menos de 10 caracteres após trim ("123456789") → `422` com `erro: "JUSTIFICATIVA_OBRIGATORIA"`.
25. **(R9)** Atividade com 20 inscrições confirmadas (teto = `Math.ceil(20 * 0.1) = 2`). Tentativa de registrar a 3ª presença manual no encontro → `422` com `erro: "LIMITE_DE_MANUAIS"`.
26. **(R9)** Atividade com 5 inscrições confirmadas (teto = `Math.ceil(5 * 0.1) = 1`). A 1ª presença manual é aceita (`201 Created`); a 2ª presença manual é recusada com `422` com `erro: "LIMITE_DE_MANUAIS"`.
27. **(R10)** `POST /encontros/:id/presencas` para participante já presente enviando código inválido fora da janela → `200 OK` (idempotência avaliada antes de outros erros).
28. **(R10)** `POST /encontros/:id/presencas` com participante não inscrito enviando requisição fora da janela e com código inválido → `403` com `erro: "NAO_INSCRITO"` (precede `FORA_DA_JANELA` e `CODIGO_INVALIDO`).
29. **(R10)** `POST /encontros/:id/presencas` com participante inscrito enviando offline após 2h do fim com código inválido → `422` com `erro: "SINCRONIZACAO_TARDIA"` (precede `FORA_DA_JANELA` e `CODIGO_INVALIDO`).
30. **(R10)** `POST /encontros/:id/presencas` fora da janela com código inválido → `422` com `erro: "FORA_DA_JANELA"` (precede `CODIGO_INVALIDO`).
31. **(R11)** `POST /encontros/:id/presencas/manual` com justificativa curta (5 chars) para participante não inscrito → `422` com `erro: "JUSTIFICATIVA_OBRIGATORIA"` (precede `NAO_INSCRITO`).
32. **(R11)** `POST /encontros/:id/presencas/manual` com participante não inscrito fora da janela estendida → `403` com `erro: "NAO_INSCRITO"` (precede `FORA_DA_JANELA`).
33. **(R11)** `POST /encontros/:id/presencas/manual` fora da janela estendida quando o limite de manuais já está atingido → `422` com `erro: "FORA_DA_JANELA"` (precede `LIMITE_DE_MANUAIS`).
34. **(R12)** `GET /encontros/:id/presencas` retorna array de presenças ordenado estritamente por `registradaEm` ascendente; em caso de registros com o mesmo `registradaEm`, ordenado por `participanteId` ascendente.
35. **(R13)** Chamada a qualquer rota de M3 sem o cabeçalho `X-Usuario` ou com id inexistente → `401` com `erro: "USUARIO_DESCONHECIDO"`.
36. **(R13)** Chamada com participante (`p-carla`) para rotas administrativas (`GET /encontros/:id/codigo`, `POST /encontros/:id/presencas/manual`, `GET /encontros/:id/presencas`) → `403` com `erro: "SOMENTE_ORGANIZACAO"`.
37. **(R13)** Chamada com organização (`org-ana`) para `POST /encontros/:id/presencas` → `403` com `erro: "SOMENTE_PARTICIPANTE"`.

## 7. Como isto será verificado
- **Costura:** Verificação HTTP ponta a ponta na camada externa da API Express, consumindo os endpoints reais através do servidor de aplicação (`criarServidor()` / `app`).
- **Por que esta costura:** O `contrato-api.md` é a fronteira inviolável do sistema, e a avaliação do juiz de aceitação é 100% externa via requisições HTTP. Testar na costura externa garante a validação exata dos cabeçalhos (`X-Usuario`), parâmetros de URL, status HTTP, códigos padronizados de erro (`{"erro": "...", "mensagem": "..."}`) e formatação das entidades JSON sem criar acoplamento com detalhes internos de persistência ou funções privadas.
- **Ambiente de Teste:** Execução com `MODO_TESTE=1`, congelando o relógio e manipulando-o via `PUT /_teste/relogio` e isolando os testes a cada cenário com `POST /_teste/reset`. Testes executados pelo runner nativo `node --test` (via `npm test`).

## 8. Fatias de entrega

### Fatia 1 — Geração e Rotação de Código QR
- **Objetivo:** Permitir que a organização consulte o código dinâmico para projeção.
- **Endpoints:** `GET /encontros/:id/codigo`.
- **Regras:** R1, R2, R13.
- **Verificação:** Testes de obtenção de código dentro da janela, recusa fora da janela ou atividade cancelada, cálculo de `trocaEm` e `validoAte`, e autorização de perfil.

### Fatia 2 — Registro de Presença Online por Participante
- **Objetivo:** Permitir que participantes com inscrição confirmada leiam e registrem presença online.
- **Endpoints:** `POST /encontros/:id/presencas` (fluxo online).
- **Regras:** R2, R3, R4, R5, R10, R13.
- **Verificação:** Testes de registro com código do minuto atual e do minuto anterior (grace period), idempotência com retorno 200 para duplicatas, validação de inscrição confirmada e ordem de precedência de erros online.

### Fatia 3 — Leitura Offline e Sincronização Resiliente
- **Objetivo:** Suportar leitura sem conectividade no momento do evento e envio posterior sincronizado.
- **Endpoints:** `POST /encontros/:id/presencas` (com `lidoEm`).
- **Regras:** R6, R10.
- **Verificação:** Testes com validação do código no instante `lidoEm`, tolerância para relógio adiantado, recusa após 2 horas do fim do encontro (`SINCRONIZACAO_TARDIA`), e gravação de `origem: "qr_offline"`.

### Fatia 4 — Presença Manual e Controle de Teto
- **Objetivo:** Permitir que a organização registre presenças manuais excepcionais com justificativa e teto percentual.
- **Endpoints:** `POST /encontros/:id/presencas/manual`.
- **Regras:** R7, R8, R9, R4, R5, R11, R13.
- **Verificação:** Testes de janela estendida [início - 15min, fim + 2h], validação de justificativa (mínimo 10 chars), teto de 10% arredondado para cima (`LIMITE_DE_MANUAIS`), idempotência e precedência de erros manuais.

### Fatia 5 — Listagem e Ordenação de Presenças
- **Objetivo:** Exibir a lista oficial de presenças por encontro para a organização.
- **Endpoints:** `GET /encontros/:id/presencas`.
- **Regras:** R12, R13.
- **Verificação:** Testes de listagem ordenada por `registradaEm` crescente e desempate alfabético por `participanteId`.
