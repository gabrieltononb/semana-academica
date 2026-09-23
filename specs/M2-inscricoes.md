# Spec — M2: Inscrições e Lista de Espera

## 1. Objetivo
Gerenciar o ciclo de vida completo de inscrições de participantes nas atividades (palestras e minicursos) da Semana Acadêmica 2026. A solução controla a alocação de vagas disponíveis, impede conflitos de horário entre atividades e excesso de minicursos por participante, gerencia a fila de espera quando a atividade atinge a lotação máxima e executa a convocação automática e transparente de participantes em espera sempre que vagas forem liberadas por desistência ou expiração de prazos.

## 2. Fora de escopo
- Pagamento ou cobrança de taxa de inscrição (evento gratuito).
- Autenticação por login e senha (feita exclusivamente via cabeçalho `X-Usuario`).
- Transferência direta de inscrição entre participantes.
- Inscrição em lote ou por terceiros (cada participante inscreve a si próprio).
- Emissão de certificados (escopo de M4).
- Registro e controle de presença nos encontros (escopo de M3).
- Cadastro e alteração de atividades e salas (escopo de M1).

## 3. Modelo

### Inscricao
Representa o vínculo formal de um participante com uma atividade acadêmica.
- `id`: string — identificador único no padrão `ins_` seguido de 8 caracteres hexadecimais minúsculos (`ins_1a2b3c4d`).
- `atividadeId`: string — identificador da atividade inscrita (`atv_...`).
- `participanteId`: string — identificador do participante (`p-...`) extraído do cabeçalho `X-Usuario`.
- `status`: string (`"confirmada"` | `"em_espera"` | `"convocada"` | `"cancelada"` | `"expirada"`).
- `posicaoNaEspera`: integer ou null — posição numérica ordinal (1, 2, 3...) na fila daquela atividade apenas quando `status == "em_espera"`; `null` em todos os outros status.
- `convocadaAte`: string (ISO 8601 com fuso) ou null — instante limite para confirmação da vaga apenas quando `status == "convocada"`; `null` nos demais status.
- `criadaEm`: string (ISO 8601 com fuso) — instante de criação do registro no banco de dados.

## 4. Endpoints

| Método | Rota | Quem | Sucesso |
|---|---|---|---|
| `POST` | `/atividades/:id/inscricoes` | participante | `201 Inscricao` (sem corpo na entrada) |
| `GET` | `/inscricoes` | todos | `200 [Inscricao]` — participante recebe apenas as próprias; suporte ao filtro `?atividadeId=` |
| `GET` | `/inscricoes/:id` | todos | `200 Inscricao` — participante acessa apenas a própria |
| `POST` | `/inscricoes/:id/cancelamento` | participante | `200 Inscricao` |
| `POST` | `/inscricoes/:id/confirmacao` | participante | `200 Inscricao` |

## 5. Regras

- **R1 — Alocação de vaga e entrada na fila de espera (P-01; RN-201, RN-202)**: Ao solicitar inscrição em uma atividade (`POST /atividades/:id/inscricoes`):
  - Se a contagem de inscrições ativas com status `confirmada` for estritamente menor que a capacidade de vagas da atividade (`totalConfirmadas < vagas`), a inscrição é criada com status `"confirmada"`, `posicaoNaEspera: null` e `convocadaAte: null`.
  - Se a capacidade de vagas já estiver esgotada (`totalConfirmadas >= vagas`), a inscrição é criada com status `"em_espera"`, `convocadaAte: null` e o campo `posicaoNaEspera` recebe a posição ordinal correspondente na fila (quantidade de participantes já na espera + 1).

- **R2 — Restrição por atividade cancelada (P-02; RN-203)**: Não é permitido solicitar inscrição em atividades cuja situação seja `"cancelada"`. A requisição é recusada com status HTTP `422 ATIVIDADE_CANCELADA`.

- **R3 — Encerramento de inscrições no início da atividade (P-02; RN-204)**: As inscrições para uma atividade são encerradas no instante em que seu primeiro encontro tiver início (`relogio.agora() >= primeiroEncontro.inicio`). Qualquer tentativa posterior de inscrição é recusada com status HTTP `422 INSCRICOES_ENCERRADAS`.

- **R4 — Unicidade de inscrição ativa por participante (P-03; RN-205)**: O participante só pode ter uma inscrição ativa por atividade (status `"confirmada"`, `"em_espera"` ou `"convocada"`). Caso já possua inscrição nesses status, nova tentativa de inscrição na mesma atividade é recusada com status HTTP `409 JA_INSCRITO`. Se a inscrição anterior estiver com status `"cancelada"` ou `"expirada"`, nova inscrição é permitida.

- **R5 — Detecção de conflito de horário (P-04; RN-206)**: Um participante não pode ter inscrições simultâneas em atividades cujos encontros colidam temporalmente.
  - Ocorre conflito se e somente se houver sobreposição estrita entre qualquer encontro da atividade solicitada e qualquer encontro de uma atividade na qual o participante já possua inscrição com status `"confirmada"` ou `"convocada"`.
  - Dois encontros com intervalos `[inicioA, fimA]` e `[inicioB, fimB]` colidem se: `inicioA < fimB && inicioB < fimA`.
  - Encontros adjacentes (onde o término de um é igual ao início do outro, `fimA == inicioB`) não colidem.
  - Havendo conflito, a operação é recusada com status HTTP `409 CONFLITO_DE_HORARIO`.

- **R6 — Limite máximo de minicursos por participante (P-05; RN-207)**: Um participante pode manter no máximo 2 inscrições ativas (status `"confirmada"` ou `"convocada"`) em atividades do tipo `"minicurso"` simultaneamente durante o evento. Tentativa de inscrição que resulte no 3º minicurso ativo é recusada com status HTTP `422 LIMITE_DE_MINICURSOS`. Atividades do tipo `"palestra"` não são limitadas.

- **R7 — Cancelamento de inscrição pelo participante (P-06; RN-208)**: O participante titular pode cancelar sua própria inscrição ativa antes do início da atividade (`relogio.agora() < primeiroEncontro.inicio`).
  - Se a atividade já estiver iniciada, retorna `422 ATIVIDADE_JA_INICIADA`.
  - Se a inscrição já estiver em status `"cancelada"` ou `"expirada"`, retorna `422 INSCRICAO_INATIVA`.
  - Cancelamento bem-sucedido altera o status para `"cancelada"` e `posicaoNaEspera: null`.

- **R8 — Convocação automática da lista de espera (P-07, P-08; RN-209, RN-210)**: Sempre que uma vaga for desocupada em uma atividade (por cancelamento de inscrição `"confirmada"` ou `"convocada"`):
  - Caso haja participantes na fila de espera da atividade (`status == "em_espera"`):
    - O participante em espera com a inscrição mais antiga (`criadaEm` ascendente) é imediatamente promovido para o status `"convocada"`.
    - Seu campo `posicaoNaEspera` passa a ser `null`.
    - Seu campo `convocadaAte` é preenchido com o instante limite: 24 horas a partir do relógio atual, ou o horário de início do primeiro encontro da atividade, o que ocorrer primeiro (`min(agora + 24h, primeiroEncontro.inicio)`).
  - As posições dos demais participantes que continuam com status `"em_espera"` avançam em 1 posição (1, 2, 3...).

- **R9 — Confirmação de vaga convocada (P-09, P-10; RN-210)**: O participante convocado deve confirmar seu interesse chamando `POST /inscricoes/:id/confirmacao`.
  - Se a inscrição não estiver no status `"convocada"`, retorna `422 SEM_CONVOCACAO`.
  - Se o prazo de convocação tiver expirado (`relogio.agora() > convocadaAte`): a inscrição passa para o status `"expirada"`, convoca-se automaticamente o próximo participante da espera conforme R8, e a requisição retorna `422 CONVOCACAO_EXPIRADA`.
  - A confirmação revalida conflito de horário (R5) e limite de minicursos (R6). Se violados, retorna `409 CONFLITO_DE_HORARIO` ou `422 LIMITE_DE_MINICURSOS`.
  - Caso aprovada, o status passa para `"confirmada"`, com `convocadaAte: null` e `posicaoNaEspera: null`.

- **R10 — Precedência estrita na validação de inscrição (P-12; RN-211)**: Ao processar `POST /atividades/:id/inscricoes`:
  1. Identificação ausente ou desconhecida $\rightarrow$ `401 USUARIO_DESCONHECIDO`;
  2. Perfil não participante $\rightarrow$ `403 SOMENTE_PARTICIPANTE`;
  3. Atividade inexistente $\rightarrow$ `404 NAO_ENCONTRADO`;
  4. Atividade cancelada $\rightarrow$ `422 ATIVIDADE_CANCELADA`;
  5. Inscrições encerradas pelo início do primeiro encontro $\rightarrow$ `422 INSCRICOES_ENCERRADAS`;
  6. Já inscrito ativamente na atividade $\rightarrow$ `409 JA_INSCRITO`;
  7. Conflito de horário com outra atividade confirmada/convocada $\rightarrow$ `409 CONFLITO_DE_HORARIO`;
  8. Limite de minicursos atingido (para atividades do tipo minicurso) $\rightarrow$ `422 LIMITE_DE_MINICURSOS`.

- **R11 — Visibilidade e isolamento de dados de inscrição (P-11; Contrato Seção 1 e 5)**:
  - Participantes recebem apenas as suas próprias inscrições (`WHERE participanteId = req.usuario.id`) tanto em `GET /inscricoes` quanto em `GET /inscricoes/:id` (`404 NAO_ENCONTRADO` se tentar consultar inscrição alheia).
  - Usuários da organização recebem todas as inscrições registradas no sistema.
  - A rota `GET /inscricoes` aceita o parâmetro de busca opcional `?atividadeId=<id>`.

- **R12 — Integridade dos identificadores e datas (Contrato Seções 1, 3 e 5)**:
  - Todo identificador de inscrição gerado segue estritamente o formato `ins_` + 8 hexadecimais minúsculos (`ins_[0-9a-f]{8}`).
  - Todos os carimbos de data/hora (`criadaEm`, `convocadaAte`) e comparações temporais utilizam o relógio do sistema/modo de teste via `relogio.agora()`.
