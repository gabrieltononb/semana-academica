const BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

let usuarioAtual = 'p-carla';

export function setUsuarioAtual(usuario) {
  usuarioAtual = usuario;
}

export function getUsuarioAtual() {
  return usuarioAtual;
}

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(usuarioAtual ? { 'X-Usuario': usuarioAtual } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { erro: 'ERRO_DESCONHECIDO', mensagem: response.statusText };
    }
    const error = new Error(errorData.mensagem || 'Erro na requisição');
    error.status = response.status;
    error.erro = errorData.erro;
    error.mensagem = errorData.mensagem;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getAtividades({ dia, tipo } = {}, usuario) {
  const params = new URLSearchParams();
  if (dia) params.append('dia', dia);
  if (tipo) params.append('tipo', tipo);
  const query = params.toString() ? `?${params.toString()}` : '';
  const headers = usuario ? { 'X-Usuario': usuario } : {};
  return request(`/atividades${query}`, { method: 'GET', headers });
}

export async function getAtividade(id, usuario) {
  const headers = usuario ? { 'X-Usuario': usuario } : {};
  return request(`/atividades/${id}`, { method: 'GET', headers });
}

export async function getSalas(usuario) {
  const headers = usuario ? { 'X-Usuario': usuario } : {};
  return request('/salas', { method: 'GET', headers });
}

export async function criarAtividade(dados, usuario = 'org-ana') {
  const headers = usuario ? { 'X-Usuario': usuario } : {};
  return request('/atividades', {
    method: 'POST',
    headers,
    body: JSON.stringify(dados),
  });
}
