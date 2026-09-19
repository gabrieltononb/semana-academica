# Entrevista M1 — Grade de Atividades

Registro das rodadas de entrevista para alinhamento e levantamento de requisitos do módulo M1 (Grade de Atividades) da Semana Acadêmica 2026.

## Questões Gerais e Rotas

| ID | Pergunta | Resposta | Fonte | Status |
|---|---|---|---|---|

## Regras de Negócio e Códigos de Erro

| ID | Pergunta | Resposta | Fonte | Status |
|---|---|---|---|---|
| P-01 | No `POST /atividades`, o contrato prevê o erro `422 QUANTIDADE_DE_ENCONTROS`. Quais são as regras de quantidade de encontros permitida para cada tipo de atividade (`palestra` vs `minicurso`)? | Consultar requisitos | | PENDENTE |
| P-02 | No `POST /atividades`, o contrato prevê o erro `422 ENCONTRO_INVALIDO`. O que torna um encontro inválido (horários, duração, período do evento, datas passadas)? | Consultar requisitos | | PENDENTE |
| P-03 | No `POST /atividades` e `PATCH /atividades/:id`, o contrato prevê o erro `422 VAGAS_ACIMA_DA_CAPACIDADE`. A regra é estritamente `vagas > sala.capacidade` ou há alguma tolerância/exceção? | Consultar requisitos | | PENDENTE |
| P-04 | No `POST /atividades`, o contrato prevê o erro `409 CONFLITO_DE_SALA`. O que configura conflito de sala e como funciona a fronteira de horário (ex.: um encontro terminando às 10:00 e outro iniciando às 10:00 na mesma sala é permitido ou é conflito)? | Consultar requisitos | | PENDENTE |
| P-05 | Existe regra de conflito de horário para organizador ou palestrante na criação de atividade (mesmo o contrato não exigindo id de palestrante no corpo)? | Consultar requisitos | | PENDENTE |
| P-06 | Como é calculada a `cargaHorariaMinutos` (é estritamente a soma dos encontros?) e existem limites de carga horária e de vagas específicos por tipo (`palestra` vs `minicurso`)? | Consultar requisitos | | PENDENTE |
| P-07 | No `PATCH /atividades/:id`, quais campos são proibidos de alterar (`CAMPO_NAO_EDITAVEL`), o que acontece se já houver inscritos (`VAGAS_ABAIXO_DOS_INSCRITOS`) e se é permitido alterar sala, horários ou atividade cancelada? | Consultar requisitos | | PENDENTE |
| P-08 | No cancelamento de atividade (`POST /atividades/:id/cancelamento`), existe exclusão (DELETE)? Quando é considerado `ATIVIDADE_JA_INICIADA`, o que ocorre com inscritos/vagas e o que acontece se já estiver `ATIVIDADE_CANCELADA`? | Consultar requisitos | | PENDENTE |
| P-09 | No M1, quais papéis podem criar, alterar e cancelar atividades versus consultar, e quais são os códigos de erro quando o usuário não é identificado ou não tem permissão (`SOMENTE_ORGANIZACAO`, `USUARIO_DESCONHECIDO`)? | Consultar requisitos | | PENDENTE |
| P-10 | Na listagem de atividades (`GET /atividades`), qual é a ordenação padrão, como operam os filtros (`?dia`, `?tipo`), se atividades canceladas aparecem e como é o agrupamento por dia? | Consultar requisitos | | PENDENTE |
| P-11 | No detalhe da atividade (`GET /atividades/:id`), como a API calcula `vagasRestantes`, `ocupadas`, `emEspera` e os estados de `situacao` (`prevista`, `em_andamento`, `encerrada`, `cancelada`) em relação ao relógio? | Consultar requisitos | | PENDENTE |
| P-12 | Na validação de entrada de criação/edição de atividades, quais regras e formatos geram `422 DADOS_INVALIDOS` (tipos, campos obrigatórios, formatos de data/hora ISO 8601, tamanho do título, valores de vagas) e qual a ordem dessa verificação frente às regras de negócio? | Consultar requisitos | | PENDENTE |
| P-13 | Em relação às salas (`GET /salas`), elas são estritamente fixas (conforme os dados iniciais) sem rotas de cadastro/edição, e qual código de erro é retornado ao referenciar um `salaId` inexistente ao criar ou editar uma atividade? | Consultar requisitos | | PENDENTE |
| P-14 | Ao consultar (`GET /atividades/:id`), editar (`PATCH /atividades/:id`) ou cancelar (`POST /atividades/:id/cancelamento`) uma atividade inexistente (ou com formato de ID fora do padrão), qual é o código e comportamento de erro esperado (`404 NAO_ENCONTRADO`)? | Consultar requisitos | | PENDENTE |
