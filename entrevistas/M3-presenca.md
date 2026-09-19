# Entrevista — Módulo M3 (Presença por QR)

## Tabela de Rastreabilidade

| # | Pergunta | Resposta | Fonte |
|---|---|---|---|
| P-01 | Janela para obter código QR (`GET /encontros/:id/codigo`) | PENDENTE | Rodada 1 |
| P-02 | Frequência de rotação e tolerância do QR Code (`trocaEm` e `validoAte`) | PENDENTE | Rodada 1 |
| P-03 | Janela para registro de presença online pelo participante (`POST /encontros/:id/presencas`) | PENDENTE | Rodada 1 |
| P-04 | Status de inscrição válido para registrar presença (`NAO_INSCRITO`) | PENDENTE | Rodada 1 |
| P-05 | Idempotência e reenvio de presença | PENDENTE | Rodada 1 |
| P-06 | Leitura offline (`lidoEm`) e prazo de sincronização (`SINCRONIZACAO_TARDIA`) | PENDENTE | Rodada 1 |
| P-07 | Janela para presença manual pela organização (`POST /encontros/:id/presencas/manual`) | PENDENTE | Rodada 1 |
| P-08 | Justificativa para presença manual (`JUSTIFICATIVA_OBRIGATORIA`) | PENDENTE | Rodada 1 |
| P-09 | Teto de presenças manuais (`LIMITE_DE_MANUAIS`) | PENDENTE | Rodada 1 |
| P-10 | Ordem de precedência dos erros em `POST /encontros/:id/presencas` | PENDENTE | Rodada 1 |
| P-11 | Ordem de precedência dos erros em `POST /encontros/:id/presencas/manual` | PENDENTE | Rodada 1 |
| P-12 | Ordenação da lista de presenças (`GET /encontros/:id/presencas`) | PENDENTE | Rodada 1 |
| P-13 | Fronteira do escopo (Fora de escopo de M3) | PENDENTE | Rodada 1 |

---

## Rodada 1 — Levantamento Inicial de Regras e Fronteiras

❓ **P-01 — Janela para obter código QR (`GET /encontros/:id/codigo`)**: A organização precisa projetar o QR code. Quanto tempo antes do início oficial do encontro a rota passa a liberar o código, e até quando após o encerramento do encontro o código ainda pode ser consultado?
Opções:
a) 15 minutos antes do início até o término do encontro.
b) 30 minutos antes do início até o término do encontro.
c) 15 minutos antes do início até 15 minutos após o término.
d) Apenas estritamente durante o encontro (início até fim).

➡️ **Recomendação**: 15 minutos antes do início do encontro até o fim do encontro.

---

❓ **P-02 — Frequência de rotação e tolerância do QR Code (`trocaEm` e `validoAte`)**: Com que frequência o código troca (`trocaEm`) e qual é a tolerância/grace period (`validoAte`) para aceitar um código que acabou de girar?
Opções:
a) Troca a cada 30 segundos; válido por 60 segundos (30s de tolerância).
b) Troca a cada 60 segundos; válido por 90 segundos (30s de tolerância).
c) Troca a cada 30 segundos; válido até a próxima troca (sem tolerância extra).

➡️ **Recomendação**: Troca a cada 30 segundos; válido por 60 segundos.

---

❓ **P-03 — Janela para registro de presença online pelo participante (`POST /encontros/:id/presencas`)**: Qual é o período exato em que o participante pode registrar presença online?
Opções:
a) Desde a abertura da geração do código até o encerramento do encontro.
b) Apenas a partir do início oficial do encontro até o término do encontro.
c) A partir do início com tolerância de até 15 minutos após o término.

➡️ **Recomendação**: Desde o início do encontro até o término do encontro (com a tolerância do código válido).

---

❓ **P-04 — Status de inscrição válido para registrar presença (`NAO_INSCRITO`)**: Para registrar presença (QR ou manual), quais status de inscrição são aceitos? Participante com status `em_espera`, `convocada`, `cancelada`, `expirada` ou sem registro recebe `403 NAO_INSCRITO`?
Opções:
a) Apenas participantes com inscrição no status `confirmada`.
b) Participantes com status `confirmada` ou `convocada`.

➡️ **Recomendação**: Apenas participantes com status `confirmada`; qualquer outro status ou ausência de inscrição retorna `403 NAO_INSCRITO`.

---

❓ **P-05 — Idempotência e reenvio de presença**: O contrato diz: "201 Presenca na primeira vez; 200 Presenca depois". Se o participante já registrou presença válida e envia uma nova requisição, quando responde 200? A presença existente garante 200 imediato ou valida código/janela novamente?
Opções:
a) Se o participante já tem presença registrada naquele encontro, qualquer nova chamada válida de participante retorna 200 com o registro já existente (idempotente).
b) Valida código e janela primeiro; só responde 200 se a nova requisição também atender aos critérios de código válido e janela.

➡️ **Recomendação**: Validar o participante primeiro; se já possui presença registrada no encontro, retorna 200 com os dados da presença original sem alterar nada.

---

❓ **P-06 — Leitura offline (`lidoEm`) e prazo de sincronização (`SINCRONIZACAO_TARDIA`)**: Quando o participante lê offline e envia `lidoEm`:
1) O `lidoEm` precisa estar dentro do período em que o código gerado era válido?
2) Qual o prazo limite após o encontro (ou após `lidoEm`) para sincronizar antes de acusar `422 SINCRONIZACAO_TARDIA`?
Opções:
a) O código deve ter sido válido no instante `lidoEm`, e o envio à API pode ocorrer até 2 horas após o término do encontro.
b) O código deve ter sido válido no instante `lidoEm`, e o envio pode ocorrer até 24 horas após `lidoEm`.
c) O `lidoEm` precisa ser durante o encontro e enviado até as 23:59:59 do mesmo dia.

➡️ **Recomendação**: O código deve ter sido válido no instante `lidoEm`, e a sincronização deve ocorrer em até 2 horas após o término do encontro.

---

❓ **P-07 — Janela para presença manual pela organização (`POST /encontros/:id/presencas/manual`)**: Até quando a organização pode registrar presença manual para um participante?
Opções:
a) Durante o encontro e até 24 horas após o término do encontro.
b) Apenas durante a realização do encontro.
c) A qualquer momento antes da atividade ser encerrada (ou até a emissão de certificados).

➡️ **Recomendação**: Durante o encontro e até 24 horas após o término do encontro.

---

❓ **P-08 — Justificativa para presença manual (`JUSTIFICATIVA_OBRIGATORIA`)**: O contrato exige justificativa. Qual é a regra de validação do texto?
Opções:
a) Texto não vazio com pelo menos 5 caracteres não-espaço após trim.
b) Qualquer texto não vazio (tamanho > 0 após trim).
c) Texto com pelo menos 10 caracteres.

➡️ **Recomendação**: Texto não vazio com pelo menos 5 caracteres válidos (após trim).

---

❓ **P-09 — Teto de presenças manuais (`LIMITE_DE_MANUAIS`)**: Quando a rota retorna `422 LIMITE_DE_MANUAIS`? Como é calculado o limite de manuais por encontro?
Opções:
a) Teto percentual: até 10% do total de vagas da atividade por encontro (arredondado para cima ou mínimo de 1).
b) Teto fixo: no máximo 3 presenças manuais por encontro.
c) Teto fixo: no máximo 5 presenças manuais por encontro.

➡️ **Recomendação**: Teto percentual de 10% das vagas da atividade (mínimo de 1).

---

❓ **P-10 — Ordem de precedência dos erros em `POST /encontros/:id/presencas`**: Quando uma requisição de presença online violar múltiplas regras, qual a ordem de precedência das regras de recurso?
Opções:
a) `ATIVIDADE_CANCELADA` → `NAO_INSCRITO` → `FORA_DA_JANELA` → `CODIGO_INVALIDO` → `SINCRONIZACAO_TARDIA`.
b) `FORA_DA_JANELA` → `ATIVIDADE_CANCELADA` → `CODIGO_INVALIDO` → `NAO_INSCRITO`.
c) `CODIGO_INVALIDO` → `FORA_DA_JANELA` → `NAO_INSCRITO` → `ATIVIDADE_CANCELADA`.

➡️ **Recomendação**: `ATIVIDADE_CANCELADA` → `NAO_INSCRITO` → `FORA_DA_JANELA` → `CODIGO_INVALIDO` → `SINCRONIZACAO_TARDIA`.

---

❓ **P-11 — Ordem de precedência dos erros em `POST /encontros/:id/presencas/manual`**: Quando múltiplas regras falharem para a presença manual, qual a ordem de precedência?
Opções:
a) `ATIVIDADE_CANCELADA` → `FORA_DA_JANELA` → `NAO_INSCRITO` → `JUSTIFICATIVA_OBRIGATORIA` → `LIMITE_DE_MANUAIS`.
b) `NAO_INSCRITO` → `JUSTIFICATIVA_OBRIGATORIA` → `LIMITE_DE_MANUAIS` → `FORA_DA_JANELA`.
c) `JUSTIFICATIVA_OBRIGATORIA` → `ATIVIDADE_CANCELADA` → `NAO_INSCRITO` → `FORA_DA_JANELA` → `LIMITE_DE_MANUAIS`.

➡️ **Recomendação**: `ATIVIDADE_CANCELADA` → `FORA_DA_JANELA` → `NAO_INSCRITO` → `JUSTIFICATIVA_OBRIGATORIA` → `LIMITE_DE_MANUAIS`.

---

❓ **P-12 — Ordenação da lista de presenças (`GET /encontros/:id/presencas`)**: Em qual ordem a lista `[Presenca]` deve ser retornada?
Opções:
a) Ordem cronológica crescente de registro (`registradaEm`).
b) Ordem alfabética do nome do participante.
c) Ordem cronológica decrescente de registro.

➡️ **Recomendação**: Ordem cronológica crescente de registro (`registradaEm`).

---

❓ **P-13 — Fronteira do escopo (Fora de escopo de M3)**: O que o módulo M3 NÃO faz explicitamente?
Confirmar se os seguintes itens estão fora de escopo de M3:
- Sem validação de GPS/geolocalização ou IP;
- Sem emissão ou checagem de regras de certificado (pertence ao M4);
- Sem cálculo de percentual de frequência e bloqueio por falta (pertence ao M5);
- Sem rota para cancelamento ou exclusão de presença já registrada.

➡️ **Recomendação**: Confirmar todos esses itens como fora de escopo de M3.
