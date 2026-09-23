import { api } from '../api/client.js';

export async function obterCodigoDoEncontro(encontroId, usuarioId = 'org-ana') {
  const res = await api.get(`/encontros/${encontroId}/codigo`, { usuarioId });
  return res.data;
}

export async function registrarPresenca(encontroId, { codigo, lidoEm }, usuarioId = 'p-carla') {
  const payload = { codigo };
  if (lidoEm) {
    payload.lidoEm = lidoEm;
  }
  const res = await api.post(`/encontros/${encontroId}/presencas`, payload, { usuarioId });
  return {
    status: res.status,
    presenca: res.data,
  };
}

export async function registrarPresencaManual(
  encontroId,
  { participanteId, justificativa },
  usuarioId = 'org-ana'
) {
  const payload = { participanteId, justificativa };
  const res = await api.post(`/encontros/${encontroId}/presencas/manual`, payload, { usuarioId });
  return {
    status: res.status,
    presenca: res.data,
  };
}

export async function listarPresencas(encontroId, usuarioId = 'org-ana') {
  const res = await api.get(`/encontros/${encontroId}/presencas`, { usuarioId });
  return res.data;
}
