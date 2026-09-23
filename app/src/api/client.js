export const API_BASE_URL = 'http://localhost:3000';

export class ApiError extends Error {
  constructor(status, erro, mensagem, data = null) {
    super(mensagem || erro || `Erro HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.erro = erro;
    this.mensagem = mensagem;
    this.data = data;
    this.isNetworkError = false;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Falha na conexão com a rede') {
    super(message);
    this.name = 'NetworkError';
    this.isNetworkError = true;
  }
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.usuarioId ? { 'X-Usuario': options.usuarioId } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new NetworkError(err.message || 'Falha de rede ao conectar à API');
  }

  let body = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const erro = body?.erro || `HTTP_${response.status}`;
    const mensagem = body?.mensagem || response.statusText || 'Erro inesperado na API';
    throw new ApiError(response.status, erro, mensagem, body);
  }

  return {
    status: response.status,
    data: body,
  };
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) =>
    request(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
