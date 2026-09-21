import { api } from '../api/client.js';

export async function listarAtividades(usuarioId) {
  const { data } = await api.get('/atividades', { usuarioId });
  return data;
}

export async function obterAtividade(atividadeId, usuarioId) {
  const { data } = await api.get(`/atividades/${atividadeId}`, { usuarioId });
  return data;
}

export async function listarMinhasInscricoes(usuarioId) {
  const { data } = await api.get('/inscricoes', { usuarioId });
  return data;
}

export async function inscreverEmAtividade(atividadeId, usuarioId) {
  const { data } = await api.post(`/atividades/${atividadeId}/inscricoes`, undefined, { usuarioId });
  return data;
}

export async function cancelarInscricao(inscricaoId, usuarioId) {
  const { data } = await api.post(`/inscricoes/${inscricaoId}/cancelamento`, undefined, { usuarioId });
  return data;
}

export async function confirmarConvocacao(inscricaoId, usuarioId) {
  const { data } = await api.post(`/inscricoes/${inscricaoId}/confirmacao`, undefined, { usuarioId });
  return data;
}
