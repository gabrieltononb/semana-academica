const { criarServidor } = require('./servidor.js');

const porta = process.env.PORT || 3000;
const app = criarServidor();

app.listen(porta, () => {
  console.log(`API escutando na porta ${porta}`);
});
