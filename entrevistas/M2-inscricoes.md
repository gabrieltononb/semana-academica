# Entrevista — Módulo M2 (Inscrições e Lista de Espera)

## Tabela de Rastreabilidade

| # | Pergunta | Resposta | Fonte |
|---|---|---|---|
| P-01 | Alocação de vagas e entrada na lista de espera (`POST /atividades/:id/inscricoes`) | Se houver vaga disponível (`ocupadas < vagas`), a inscrição é criada com status `confirmada`. Quando a atividade atinge a capacidade (`ocupadas >= vagas`), a inscrição é criada com status `em_espera`, recebendo a posição ordinal na fila (`posicaoNaEspera`). | RN-201, RN-202 |
| P-02 | Inscrição em atividade cancelada ou já iniciada | Não é permitida inscrição em atividade cancelada (`situacao == 'cancelada'`), retornando 422 `ATIVIDADE_CANCELADA`. Se o primeiro encontro já começou (`agora >= primeiroEncontro.inicio`), inscrições estão encerradas e retorna 422 `INSCRICOES_ENCERRADAS`. | RN-203, RN-204 |
| P-03 | Participante já inscrito na mesma atividade (`JA_INSCRITO`) | Se o participante já tiver inscrição ativa (`confirmada`, `em_espera` ou `convocada`) na mesma atividade, a requisição é recusada com 409 `JA_INSCRITO`. Se a inscrição anterior foi `cancelada` ou `expirada`, ele pode realizar nova inscrição. | RN-205 |
| P-04 | Conflito de horários entre atividades (`CONFLITO_DE_HORARIO`) | Um participante não pode ter inscrições simultaneamente ativas (`confirmada` ou `convocada`) em atividades cujos encontros colidam no tempo. O conflito ocorre se houver sobreposição estrita (`inicioA < fimB && inicioB < fimA`). Encontros consecutivos onde o término de um coincide com o início do outro (`fim1 == inicio2`) são permitidos. Em caso de sobreposição, retorna 409 `CONFLITO_DE_HORARIO`. | RN-206 |
| P-05 | Limite máximo de minicursos por participante (`LIMITE_DE_MINICURSOS`) | Cada participante pode estar inscrito (com status `confirmada` ou `convocada`) em no máximo 2 minicursos simultaneamente durante o evento. Se tentar se inscrever no 3º minicurso, retorna 422 `LIMITE_DE_MINICURSOS`. Palestras não possuem limite de quantidade. | RN-207 |
| P-06 | Cancelamento de inscrição pelo participante (`POST /inscricoes/:id/cancelamento`) | O participante pode cancelar sua inscrição desde que a atividade não tenha iniciado (`agora < primeiroEncontro.inicio`). Caso já tenha iniciado, retorna 422 `ATIVIDADE_JA_INICIADA`. Se a inscrição já estiver inativa (`cancelada` ou `expirada`), retorna 422 `INSCRICAO_INATIVA`. | RN-208 |
| P-07 | Funcionamento da convocação automática da lista de espera | Quando uma vaga é liberada (por cancelamento de inscrição `confirmada` ou `convocada`), o primeiro participante da lista de espera (`em_espera` com menor `criadaEm`) é automaticamente promovido para `convocada`. Sua `posicaoNaEspera` passa a ser `null`, e o campo `convocadaAte` é preenchido. As posições dos demais em espera avançam. | RN-209 |
| P-08 | Prazo de tolerância para confirmação da convocação (`convocadaAte`) | O participante convocado tem até 24 horas a partir do momento da convocação para confirmar seu interesse, ou até o início do primeiro encontro da atividade, o que ocorrer primeiro (`min(agora + 24h, primeiroEncontro.inicio)`). | RN-209, RN-210 |
| P-09 | Confirmação da convocação (`POST /inscricoes/:id/confirmacao`) | O participante com status `convocada` confirma sua vaga. Se a inscrição não estiver no status `convocada`, retorna 422 `SEM_CONVOCACAO`. Se o horário atual ultrapassou `convocadaAte`, retorna 422 `CONVOCACAO_EXPIRADA`, a vaga é perdida e a inscrição passa a `expirada`, convocando o próximo da fila. | RN-210 |
| P-10 | Recálculo de conflito de horário e limite de minicursos na confirmação | Ao confirmar uma convocação, o sistema revalida conflito de horário (RN-206) e limite de minicursos (RN-207), pois o participante pode ter ocupado a vaga em outra atividade enquanto aguardava na espera. Caso haja violação, recusa com 409 `CONFLITO_DE_HORARIO` ou 422 `LIMITE_DE_MINICURSOS`. | RN-206, RN-207, RN-210 |
| P-11 | Visibilidade e listagem de inscrições (`GET /inscricoes` e `GET /inscricoes/:id`) | Participantes só podem listar ou visualizar as suas próprias inscrições (`404 NAO_ENCONTRADO` se tentar acessar a de outro participante). A organização tem acesso total a todas as inscrições. Ambas suportam o filtro opcional `?atividadeId=<id>`. | contrato-api.md, Seção 1 e 5 |
| P-12 | Ordem de precedência dos erros em inscrição e confirmação | Precedência estrita: 1. Autenticação (401) → 2. Perfil Participante (403) → 3. Atividade Inexistente (404) → 4. Atividade Cancelada (422) → 5. Inscrições Encerradas (422) → 6. Já Inscrito (409) → 7. Conflito de Horário (409) → 8. Limite de Minicursos (422). | contrato-api.md, RN-211 |

---

## Rodada 1 — Levantamento Inicial de Regras e Fronteiras

❓ **P-01 — Alocação de vagas e entrada na lista de espera**: Quando um participante solicita inscrição via `POST /atividades/:id/inscricoes`, o que define se ele recebe vaga confirmada ou entra na espera?
- Opções:
  - a) Enquanto houver vagas livres (`totalConfirmadas < vagas`), status é `confirmada`; ao lotar, entra em `em_espera` com posição ordinal na fila.
  - b) Todos entram em espera e a organização aprova manualmente.
  - c) As vagas são sorteadas ao final do período de inscrições.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: Enquanto houver vagas livres, o status é `confirmada` e `posicaoNaEspera` é nulo. Atingindo a lotação (`ocupadas >= vagas`), novas inscrições assumem status `em_espera` com a posição numérica correspondente na fila da atividade.
- 📌 **Fonte**: RN-201, RN-202.

---

❓ **P-02 — Inscrição em atividade cancelada ou já iniciada**: Qual é o comportamento quando a atividade foi cancelada ou quando o primeiro encontro já começou?
- Opções:
  - a) Atividade cancelada retorna 422 `ATIVIDADE_CANCELADA`. Se o primeiro encontro já iniciou, inscrições estão encerradas e retorna 422 `INSCRICOES_ENCERRADAS`.
  - b) Permite inscrição até o último encontro da atividade.
  - c) Retorna sempre 400 Bad Request.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: Atividade cancelada devolve 422 `ATIVIDADE_CANCELADA`. Se o horário atual atingiu ou superou o início do primeiro encontro da atividade, retorna 422 `INSCRICOES_ENCERRADAS`.
- 📌 **Fonte**: RN-203, RN-204.

---

❓ **P-03 — Participante já inscrito na mesma atividade**: O que ocorre se o participante tentar se inscrever novamente na mesma atividade?
- Opções:
  - a) Se já tiver inscrição ativa (`confirmada`, `em_espera` ou `convocada`), recusa com 409 `JA_INSCRITO`. Se cancelou anteriormente, permite nova inscrição.
  - b) Sobrescreve a inscrição anterior sem aviso.
  - c) Retorna 200 OK de forma idempotente.
- ➡️ **Recomendação**: Alternativa a, conforme contrato.
- ✅ **Resposta**: Apenas uma inscrição ativa é permitida por participante em cada atividade. Qualquer tentativa com inscrição ativa existente retorna 409 `JA_INSCRITO`. Se o histórico for de inscrição `cancelada` ou `expirada`, uma nova inscrição pode ser aberta.
- 📌 **Fonte**: RN-205.

---

❓ **P-04 — Conflito de horários entre atividades**: Como o sistema trata participante querendo se inscrever em atividades concomitantes? Um minicurso que termina às 10:00 e outro que começa às 10:00 é permitido?
- Opções:
  - a) Conflito ocorre em caso de sobreposição estrita (`inicioA < fimB && inicioB < fimA`), retornando 409 `CONFLITO_DE_HORARIO`. Encontros adjacentes (`fim1 == inicio2`) são permitidos.
  - b) Exige intervalo de pelo menos 15 minutos entre atividades consecutivas.
  - c) Permite sobreposições parciais desde que menores que 30 minutos.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: Há conflito se e somente se houver sobreposição estrita entre qualquer encontro da nova atividade e os encontros de atividades em que o participante já tenha vaga `confirmada` ou `convocada`. Encontros que terminam exatamente no mesmo minuto em que outro começa não configuram sobreposição. Em caso de conflito, a inscrição ou confirmação é recusada com 409 `CONFLITO_DE_HORARIO`.
- 📌 **Fonte**: RN-206.

---

❓ **P-05 — Limite máximo de minicursos por participante**: Há limite de minicursos por aluno para evitar que uma única pessoa ocupe várias vagas limitadas? E palestras?
- Opções:
  - a) No máximo 2 minicursos confirmados/convocados por participante; palestras são ilimitadas. Ultrapassar retorna 422 `LIMITE_DE_MINICURSOS`.
  - b) No máximo 1 minicurso e 2 palestras.
  - c) Sem limites de quantidade.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: Cada participante pode estar matriculado (status `confirmada` ou `convocada`) em no máximo 2 minicursos no evento. Tentativa de obter vaga em um 3º minicurso é recusada com 422 `LIMITE_DE_MINICURSOS`. Palestras não sofrem essa restrição.
- 📌 **Fonte**: RN-207.

---

❓ **P-06 — Cancelamento de inscrição**: Quando e como o participante pode cancelar sua inscrição?
- Opções:
  - a) A qualquer momento antes do início oficial da atividade (`agora < primeiroEncontro.inicio`). Após isso, retorna 422 `ATIVIDADE_JA_INICIADA`. Inscrição inativa retorna 422 `INSCRICAO_INATIVA`.
  - b) Apenas com justificativa enviada por e-mail à organização.
  - c) Até 48h antes do evento apenas.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: O participante pode cancelar qualquer inscrição própria antes do início da atividade. Se a atividade já começou, retorna 422 `ATIVIDADE_JA_INICIADA`. Se já estava cancelada ou expirada, retorna 422 `INSCRICAO_INATIVA`.
- 📌 **Fonte**: RN-208.

---

❓ **P-07 — Avanço da lista de espera (convocação automática)**: O que acontece imediatamente após uma inscrição confirmada ser cancelada?
- Opções:
  - a) A fila anda sozinha: o primeiro da fila (`em_espera` mais antigo) muda automaticamente para `convocada` e recebe um prazo em `convocadaAte`. Os demais avançam uma posição.
  - b) A organização precisa entrar no painel e convocar manualmente um aluno.
  - c) A vaga fica aberta para quem clicar primeiro no site.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: A convocação é totalmente automática. O participante no topo da fila de espera (`posicaoNaEspera == 1`) passa imediatamente para o status `convocada`, seu campo `convocadaAte` é preenchido com o prazo limite e sua posição se torna nula. Os demais participantes da lista de espera têm suas posições decrementadas em 1.
- 📌 **Fonte**: RN-209.

---

❓ **P-08 — Prazo de convocação (`convocadaAte`)**: Quanto tempo o participante convocado tem para aceitar a vaga?
- Opções:
  - a) 24 horas a partir do momento da convocação, limitado ao início da atividade se faltar menos de 24h.
  - b) 12 horas fixas.
  - c) 2 horas antes de cada encontro.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: O prazo é de 24 horas contadas a partir do instante da convocação, ou até o horário de início do primeiro encontro da atividade, o que for menor (`min(agora + 24h, primeiroEncontro.inicio)`).
- 📌 **Fonte**: RN-209, RN-210.

---

❓ **P-09 — Confirmação e expiração da convocação**: Como o participante convocado assegura sua vaga? E se o prazo expirar?
- Opções:
  - a) O participante envia `POST /inscricoes/:id/confirmacao`. Se dentro do prazo, torna-se `confirmada`. Se fora do prazo, retorna 422 `CONVOCACAO_EXPIRADA`, passa para `expirada` e convoca o próximo da espera.
  - b) A vaga é confirmada automaticamente pelo sistema sem intervenção do aluno.
  - c) A convocação não expira nunca.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: O participante convocado deve chamar a rota de confirmação. Se chamar no prazo, o status vira `confirmada`. Se chamar após `convocadaAte`, retorna 422 `CONVOCACAO_EXPIRADA`, a inscrição é marcada como `expirada` e o sistema convoca o próximo candidato da fila de espera. Se tentar confirmar sem estar convocado, retorna 422 `SEM_CONVOCACAO`.
- 📌 **Fonte**: RN-210.

---

❓ **P-10 — Checagens no momento da confirmação**: Um aluno em espera pode ter se inscrito em outra atividade concomitante enquanto esperava. A confirmação revalida conflito e limite?
- Opções:
  - a) Sim, se houver conflito de horário no momento de confirmar retorna 409 `CONFLITO_DE_HORARIO` e se exceder minicursos retorna 422 `LIMITE_DE_MINICURSOS`.
  - b) Não, a aprovação é cega.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: Sim. Ao confirmar a convocação, o sistema verifica novamente se o participante possui conflito de horários com outras inscrições confirmadas ou se já atingiu o teto de 2 minicursos. Caso positivo, recusa a confirmação permitindo que o participante cancele o outro compromisso antes de expirar a convocação.
- 📌 **Fonte**: RN-206, RN-207, RN-210.

---

❓ **P-11 — Controle de Acesso e Privacidade das Inscrições**: Quem pode listar e ver quais inscrições?
- Opções:
  - a) Participante recebe apenas as suas próprias inscrições (`WHERE participanteId = req.usuario.id`). Organização vê de todos. Ambas aceitam filtro por `?atividadeId=`.
  - b) Qualquer pessoa pode listar todas as inscrições de todos.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: Apenas os próprios participantes podem consultar suas inscrições e detalhes individuais (`GET /inscricoes` e `GET /inscricoes/:id`). A organização possui permissão irrestrita para visualizar todas as inscrições.
- 📌 **Fonte**: contrato-api.md, Seção 1 e 5.

---

❓ **P-12 — Precedência dos Erros**: Quando múltiplos critérios de validação falharem simultaneamente na inscrição, qual a ordem de precedência?
- Opções:
  - a) 401 Autenticação → 403 Perfil → 404 Existência → 422 Cancelada → 422 Encerradas → 409 Já Inscrito → 409 Conflito Horário → 422 Limite Minicursos.
  - b) Ordem aleatória.
- ➡️ **Recomendação**: Alternativa a.
- ✅ **Resposta**: A ordem de precedência adotada segue rigorosamente a convenção do contrato e regras de negócio: identificação, perfil, existência do recurso, atividade cancelada, inscrições encerradas por início, duplicidade de inscrição, conflito de horário e limite de minicursos.
- 📌 **Fonte**: contrato-api.md Seção 1 e 6, RN-211.
