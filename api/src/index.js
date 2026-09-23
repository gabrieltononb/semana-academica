import { criarApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = criarApp();

app.listen(PORT, () => {
  console.log(`API da Semana Acadêmica rodando na porta ${PORT}`);
});
