# Entrevista — Módulo M3 (Presença por QR)

## Tabela de Rastreabilidade

| # | Pergunta | Resposta | Fonte |
|---|---|---|---|
| P-01 | Janela para obter código QR (`GET /encontros/:id/codigo`) | De 15 min antes a 30 min depois do início do encontro (bordas incluídas). Fora da janela ou com atividade cancelada retorna 422 `FORA_DA_JANELA`. | RN-301, RN-302 |
| P-02 | Frequência de rotação e tolerância do QR Code (`trocaEm` e `validoAte`) | Muda a cada minuto em janelas alinhadas ao relógio (hh:mm:00 a hh:mm:59). Validação aceita código do minuto atual e do anterior; outros códigos retornam 422 `CODIGO_INVALIDO`. | RN-303, RN-304 |
| P-03 | Janela para registro de presença online pelo participante (`POST /encontros/:id/presencas`) | Mesma janela: de 15 min antes a 30 min depois do início do encontro (bordas incluídas). Fora desse período retorna 422 `FORA_DA_JANELA`. | RN-301 |
| P-04 | Status de inscrição válido para registrar presença (`NAO_INSCRITO`) | Apenas com status `confirmada`. Sem inscrição ou em outro status (`em_espera`, `convocada`, `cancelada`, `expirada`) retorna 403 `NAO_INSCRITO`. | RN-306, RN-311 |
| P-05 | Idempotência e reenvio de presença | Idempotência estrita: presença única por participante e encontro. Repetir envio devolve 200 com dados originais antes de qualquer regra de M3. 1º registro devolve 201. | RN-307, RN-314 |
| P-06 | Leitura offline (`lidoEm`) e prazo de sincronização (`SINCRONIZACAO_TARDIA`) | Validade conferida no instante `lidoEm` (se posterior ao envio, vale o envio). Sincronização em até 2h após o fim do encontro; após isso retorna 422 `SINCRONIZACAO_TARDIA`. | RN-308, RN-309, RN-310 |
| P-07 | Janela para presença manual pela organização (`POST /encontros/:id/presencas/manual`) | Prazo estendido: de 15 min antes do início até 2 horas depois do fim do encontro. Fora do intervalo retorna 422 `FORA_DA_JANELA`. | RN-312 |
| P-08 | Justificativa para presença manual (`JUSTIFICATIVA_OBRIGATORIA`) | Obrigatória e com no mínimo 10 caracteres. Se ausente ou menor que 10 caracteres retorna 422 `JUSTIFICATIVA_OBRIGATORIA`. | RN-311 |
| P-09 | Teto de presenças manuais (`LIMITE_DE_MANUAIS`) | No máximo 10% das inscrições confirmadas por encontro, arredondando para cima (`Math.ceil`). Atingido o teto retorna 422 `LIMITE_DE_MANUAIS`. | RN-313 |
| P-10 | Ordem de precedência dos erros em `POST /encontros/:id/presencas` | 1. 404 Inexistente → 2. Presença já existente (200 com dados originais) → 3. 403 `NAO_INSCRITO` → 4. 422 `SINCRONIZACAO_TARDIA` → 5. 422 `FORA_DA_JANELA` → 6. 422 `CODIGO_INVALIDO`. | RN-314 |
| P-11 | Ordem de precedência dos erros em `POST /encontros/:id/presencas/manual` | 1. 422 `JUSTIFICATIVA_OBRIGATORIA` → 2. Presença já existente (200 com dados originais) → 3. 403 `NAO_INSCRITO` → 4. 422 `FORA_DA_JANELA` → 5. 422 `LIMITE_DE_MANUAIS`. | RN-314 |
| P-12 | Ordenação da lista de presenças (`GET /encontros/:id/presencas`) | Ordem cronológica crescente de registro (`registradaEm` ascendente). Empate: alfabética por identificador/nome do participante. | contrato-api.md, RN-314 |
| P-13 | Fronteira do escopo (Fora de escopo de M3) | Fora de escopo: login/senha (usa `X-Usuario`), check-out, múltiplos eventos, notificações push/e-mail, biometria/GPS, edição/exclusão de presenças (imutável). | Requisitos Seção 6 e Seção 7 |

---

## Rodada 1 — Levantamento Inicial de Regras e Fronteiras

❓ **P-01 — Janela para obter código QR (`GET /encontros/:id/codigo`)**: A organização precisa projetar o QR code. Quanto tempo antes do início oficial do encontro a rota passa a liberar o código, e até quando após o encerramento do encontro o código ainda pode ser consultado?
Opções:
a) 15 minutos antes do início até o término do encontro.
b) 30 minutos antes do início até o término do encontro.
c) 15 minutos antes do início até 15 minutos após o término.
d) Apenas estritamente durante o encontro (início até fim).

➡️ **Recomendação**: 15 minutos antes do início do encontro até o fim do encontro.

✅ **Resposta**: A janela de registro vai de 15 minutos antes a 30 minutos depois do início do encontro, com as bordas incluídas. Fora dessa janela, ou se a atividade estiver cancelada, a organização não obtém o código (retorna `422 FORA_DA_JANELA`).
📌 **Fonte**: RN-301 e RN-302.

---

❓ **P-02 — Frequência de rotação e tolerância do QR Code (`trocaEm` e `validoAte`)**: Com que frequência o código troca (`trocaEm`) e qual é a tolerância/grace period (`validoAte`) para aceitar um código que acabou de girar?
Opções:
a) Troca a cada 30 segundos; válido por 60 segundos (30s de tolerância).
b) Troca a cada 60 segundos; válido por 90 segundos (30s de tolerância).
c) Troca a cada 30 segundos; válido até a próxima troca (sem tolerância extra).

➡️ **Recomendação**: Troca a cada 30 segundos; válido por 60 segundos.

✅ **Resposta**: O código muda a cada minuto, em janelas alinhadas ao relógio (de hh:mm:00 a hh:mm:59). Na validação pelo backend, vale o código do minuto atual e o do minuto anterior; qualquer outro código, ou código pertencente a outro encontro, é recusado com 422 `CODIGO_INVALIDO`.
📌 **Fonte**: RN-303 e RN-304.

---

❓ **P-03 — Janela para registro de presença online pelo participante (`POST /encontros/:id/presencas`)**: Qual é o período exato em que o participante pode registrar presença online?
Opções:
a) Desde a abertura da geração do código até o encerramento do encontro.
b) Apenas a partir do início oficial do encontro até o término do encontro.
c) A partir do início com tolerância de até 15 minutos após o término.

➡️ **Recomendação**: Desde o início do encontro até o término do encontro (com a tolerância do código válido).

✅ **Resposta**: É exatamente a mesma janela: vai de 15 minutos antes até 30 minutos depois do início do encontro, com as bordas incluídas. Fora desse período, a tentativa de registro online retorna 422 `FORA_DA_JANELA`.
📌 **Fonte**: RN-301.

---

❓ **P-04 — Status de inscrição válido para registrar presença (`NAO_INSCRITO`)**: Para registrar presença (QR ou manual), quais status de inscrição são aceitos? Participante com status `em_espera`, `convocada`, `cancelada`, `expirada` ou sem registro recebe `403 NAO_INSCRITO`?
Opções:
a) Apenas participantes com inscrição no status `confirmada`.
b) Participantes com status `confirmada` ou `convocada`.

➡️ **Recomendação**: Apenas participantes com status `confirmada`; qualquer outro status ou ausência de inscrição retorna `403 NAO_INSCRITO`.

✅ **Resposta**: Apenas participantes com inscrição no status confirmada podem registrar presença (seja via QR online, QR offline ou manual). Participantes sem inscrição ou em qualquer outro status (em_espera, convocada, cancelada ou expirada) recebem 403 `NAO_INSCRITO`.
📌 **Fonte**: RN-306 e RN-311.

---

❓ **P-05 — Idempotência e reenvio de presença**: O contrato diz: "201 Presenca na primeira vez; 200 Presenca depois". Se o participante já registrou presença válida e envia uma nova requisição, quando responde 200? A presença existente garante 200 imediato ou valida código/janela novamente?
Opções:
a) Se o participante já tem presença registrada naquele encontro, qualquer nova chamada válida de participante retorna 200 com o registro já existente (idempotente).
b) Valida código e janela primeiro; só responde 200 se a nova requisição também atender aos critérios de código válido e janela.

➡️ **Recomendação**: Validar o participante primeiro; se já possui presença registrada no encontro, retorna 200 com os dados da presença original sem alterar nada.

✅ **Resposta**: É idempotência estrita: a presença é única por participante e encontro. Repetir o envio devolve 200 com os dados do registro original antes de qualquer outra regra deste módulo (ou seja, não valida código nem janela novamente, permitindo que o app offline reenvie sem medo). O primeiro registro é que devolve 201.
📌 **Fonte**: RN-307 e RN-314.

---

❓ **P-06 — Leitura offline (`lidoEm`) e prazo de sincronização (`SINCRONIZACAO_TARDIA`)**: Quando o participante lê offline e envia `lidoEm`:
1) O `lidoEm` precisa estar dentro do período em que o código gerado era válido?
2) Qual o prazo limite após o encontro (ou após `lidoEm`) para sincronizar antes de acusar `422 SINCRONIZACAO_TARDIA`?
Opções:
a) O código deve ter sido válido no instante `lidoEm`, e o envio à API pode ocorrer até 2 horas após o término do encontro.
b) O código deve ter sido válido no instante `lidoEm`, e o envio pode ocorrer até 24 horas após `lidoEm`.
c) O `lidoEm` precisa ser durante o encontro e enviado até as 23:59:59 do mesmo dia.

➡️ **Recomendação**: O código deve ter sido válido no instante `lidoEm`, e a sincronização deve ocorrer em até 2 horas após o término do encontro.

✅ **Resposta**: 1) Com lidoEm, a janela de presença e a validade do código são conferidas exatamente no instante informado pela leitura, e não no instante do envio. Caso lidoEm seja posterior ao envio (celular adiantado), vale como o instante do envio. 2) O prazo limite para sincronizar é de até 2 horas após o fim do encontro. Envios com lidoEm recebidos após esse prazo retornam 422 `SINCRONIZACAO_TARDIA`.
📌 **Fonte**: RN-308, RN-309 e RN-310.

---

❓ **P-07 — Janela para presença manual pela organização (`POST /encontros/:id/presencas/manual`)**: Até quando a organização pode registrar presença manual para um participante?
Opções:
a) Durante o encontro e até 24 horas após o término do encontro.
b) Apenas durante a realização do encontro.
c) A qualquer momento antes da atividade ser encerrada (ou até a emissão de certificados).

➡️ **Recomendação**: Durante o encontro e até 24 horas após o término do encontro.

✅ **Resposta**: A presença manual tem prazo estendido: ela pode ser registrada desde a abertura da janela do encontro (15 minutos antes do início) até 2 horas depois do fim do encontro. Fora desse intervalo, retorna 422 `FORA_DA_JANELA`.
📌 **Fonte**: RN-312.

---

❓ **P-08 — Justificativa para presença manual (`JUSTIFICATIVA_OBRIGATORIA`)**: O contrato exige justificativa. Qual é a regra de validação do texto?
Opções:
a) Texto não vazio com pelo menos 5 caracteres não-espaço após trim.
b) Qualquer texto não vazio (tamanho > 0 após trim).
c) Texto com pelo menos 10 caracteres.

➡️ **Recomendação**: Texto não vazio com pelo menos 5 caracteres válidos (após trim).

✅ **Resposta**: A justificativa é obrigatória e deve ter pelo menos 10 caracteres. Se estiver ausente ou tiver menos de 10 caracteres, retorna 422 `JUSTIFICATIVA_OBRIGATORIA`.
📌 **Fonte**: RN-311.

---

❓ **P-09 — Teto de presenças manuais (`LIMITE_DE_MANUAIS`)**: Quando a rota retorna `422 LIMITE_DE_MANUAIS`? Como é calculado o limite de manuais por encontro?
Opções:
a) Teto percentual: até 10% do total de vagas da atividade por encontro (arredondado para cima ou mínimo de 1).
b) Teto fixo: no máximo 3 presenças manuais por encontro.
c) Teto fixo: no máximo 5 presenças manuais por encontro.

➡️ **Recomendação**: Teto percentual de 10% das vagas da atividade (mínimo de 1).

✅ **Resposta**: Por encontro, no máximo 10% das inscrições confirmadas, arredondando para cima (`Math.ceil`), podem ser manuais. Se esse teto for atingido, novas tentativas retornam 422 `LIMITE_DE_MANUAIS`.
📌 **Fonte**: RN-313.

---

❓ **P-10 — Ordem de precedência dos erros em `POST /encontros/:id/presencas`**: Quando uma requisição de presença online violar múltiplas regras, qual a ordem de precedência das regras de recurso?
Opções:
a) `ATIVIDADE_CANCELADA` → `NAO_INSCRITO` → `FORA_DA_JANELA` → `CODIGO_INVALIDO` → `SINCRONIZACAO_TARDIA`.
b) `FORA_DA_JANELA` → `ATIVIDADE_CANCELADA` → `CODIGO_INVALIDO` → `NAO_INSCRITO`.
c) `CODIGO_INVALIDO` → `FORA_DA_JANELA` → `NAO_INSCRITO` → `ATIVIDADE_CANCELADA`.

➡️ **Recomendação**: `ATIVIDADE_CANCELADA` → `NAO_INSCRITO` → `FORA_DA_JANELA` → `CODIGO_INVALIDO` → `SINCRONIZACAO_TARDIA`.

✅ **Resposta**: A ordem exata de precedência para o registro feito pelo participante (online ou offline) é:
1. Inexistente / 404
2. Presença já existente (devolve 200 com os dados originais)
3. Não inscrito (403 `NAO_INSCRITO`)
4. Sincronização tardia (422 `SINCRONIZACAO_TARDIA`)
5. Fora da janela (422 `FORA_DA_JANELA`)
6. Código inválido (422 `CODIGO_INVALIDO`)
📌 **Fonte**: RN-314.

---

❓ **P-11 — Ordem de precedência dos erros em `POST /encontros/:id/presencas/manual`**: Quando múltiplas regras falharem para a presença manual, qual a ordem de precedência?
Opções:
a) `ATIVIDADE_CANCELADA` → `FORA_DA_JANELA` → `NAO_INSCRITO` → `JUSTIFICATIVA_OBRIGATORIA` → `LIMITE_DE_MANUAIS`.
b) `NAO_INSCRITO` → `JUSTIFICATIVA_OBRIGATORIA` → `LIMITE_DE_MANUAIS` → `FORA_DA_JANELA`.
c) `JUSTIFICATIVA_OBRIGATORIA` → `ATIVIDADE_CANCELADA` → `NAO_INSCRITO` → `FORA_DA_JANELA` → `LIMITE_DE_MANUAIS`.

➡️ **Recomendação**: `ATIVIDADE_CANCELADA` → `FORA_DA_JANELA` → `NAO_INSCRITO` → `JUSTIFICATIVA_OBRIGATORIA` → `LIMITE_DE_MANUAIS`.

✅ **Resposta**: A ordem exata de precedência para o registro manual pela organização é:
1. Justificativa ausente ou com menos de 10 caracteres (422 `JUSTIFICATIVA_OBRIGATORIA`)
2. Presença já existente (devolve 200 com os dados originais)
3. Não inscrito (403 `NAO_INSCRITO`)
4. Fora da janela estendida (422 `FORA_DA_JANELA`)
5. Limite de manuais atingido (422 `LIMITE_DE_MANUAIS`)
📌 **Fonte**: RN-314.

---

❓ **P-12 — Ordenação da lista de presenças (`GET /encontros/:id/presencas`)**: Em qual ordem a lista `[Presenca]` deve ser retornada?
Opções:
a) Ordem cronológica crescente de registro (`registradaEm`).
b) Ordem alfabética do nome do participante.
c) Ordem cronológica decrescente de registro.

➡️ **Recomendação**: Ordem cronológica crescente de registro (`registradaEm`).

✅ **Resposta**: A ordenação padrão das presenças do encontro é por ordem cronológica crescente de registro (`registradaEm` ascendente). Se houver empate, ordena alfabeticamente pelo identificador/nome do participante.
📌 **Fonte**: contrato-api.md e RN-314.

---

❓ **P-13 — Fronteira do escopo (Fora de escopo de M3)**: O que o módulo M3 NÃO faz explicitamente?
Confirmar se os seguintes itens estão fora de escopo de M3:
- Sem validação de GPS/geolocalização ou IP;
- Sem emissão ou checagem de regras de certificado (pertence ao M4);
- Sem cálculo de percentual de frequência e bloqueio por falta (pertence ao M5);
- Sem rota para cancelamento ou exclusão de presença já registrada.

➡️ **Recomendação**: Confirmar todos esses itens como fora de escopo de M3.

✅ **Resposta**: Estão expressamente fora de escopo: login e senha (autenticação é feita exclusivamente via cabeçalho `X-Usuario`), check-out de participante, múltiplos eventos, envio de e-mails ou notificações push, além de qualquer validação de biometria ou geolocalização. A presença também é imutável após registrada (sem rotas de edição/exclusão).
📌 **Fonte**: Seção 6 e Seção 7 (Fora de escopo) do documento de requisitos.
