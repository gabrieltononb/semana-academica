const { criarServidor } = require('./servidor.js');

const porta = process.env.PORT || 3000;
const app = criarServidor();

app.listen(porta, () => {
  console.log(`API da Semana Acadêmica rodando na porta ${porta}`);
});
