const { DatabaseSync } = require('node:sqlite');

function criarBanco(caminho = ':memory:') {
  const db = new DatabaseSync(caminho);

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      papel TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS salas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      capacidade INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS atividades (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      salaId TEXT NOT NULL,
      vagas INTEGER NOT NULL,
      situacao TEXT NOT NULL DEFAULT 'prevista'
    );

    CREATE TABLE IF NOT EXISTS encontros (
      id TEXT PRIMARY KEY,
      atividadeId TEXT NOT NULL,
      inicio TEXT NOT NULL,
      fim TEXT NOT NULL,
      FOREIGN KEY(atividadeId) REFERENCES atividades(id)
    );

    CREATE TABLE IF NOT EXISTS inscricoes (
      id TEXT PRIMARY KEY,
      atividadeId TEXT NOT NULL,
      participanteId TEXT NOT NULL,
      status TEXT NOT NULL,
      criadaEm TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS presencas (
      id TEXT PRIMARY KEY,
      encontroId TEXT NOT NULL,
      participanteId TEXT NOT NULL,
      origem TEXT NOT NULL,
      lidoEm TEXT NOT NULL,
      registradaEm TEXT NOT NULL,
      justificativa TEXT,
      FOREIGN KEY(encontroId) REFERENCES encontros(id)
    );
  `);

  carregarDadosIniciais(db);

  return db;
}

function carregarDadosIniciais(db) {
  const insertUsuario = db.prepare('INSERT OR IGNORE INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
  const usuarios = [
    ['org-ana', 'Ana Beatriz Lima', 'organizacao'],
    ['org-bruno', 'Bruno Tavares', 'organizacao'],
    ['p-carla', 'Carla Mendes Souza', 'participante'],
    ['p-diego', 'Diego Alves', 'participante'],
    ['p-elisa', 'Elisa Fernandes da Rocha', 'participante'],
    ['p-fabio', 'Fábio Nogueira', 'participante'],
    ['p-gabriela', 'Gabriela Moura Castro', 'participante'],
    ['p-heitor', 'Heitor Campos', 'participante'],
    ['p-isadora', 'Isadora Ribeiro dos Santos', 'participante'],
    ['p-joao', 'João Pedro Martins', 'participante'],
  ];
  for (const u of usuarios) {
    insertUsuario.run(...u);
  }

  const insertSala = db.prepare('INSERT OR IGNORE INTO salas (id, nome, capacidade) VALUES (?, ?, ?)');
  const salas = [
    ['auditorio', 'Auditório Central', 200],
    ['sala-101', 'Sala 101', 40],
    ['sala-102', 'Sala 102', 40],
    ['lab-3', 'Laboratório 3', 20],
  ];
  for (const s of salas) {
    insertSala.run(...s);
  }
}

module.exports = { criarBanco, carregarDadosIniciais };
