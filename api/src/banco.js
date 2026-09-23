import { DatabaseSync } from 'node:sqlite';

export const USUARIOS_INICIAIS = [
  { id: 'org-ana', nome: 'Ana Beatriz Lima', papel: 'organizacao' },
  { id: 'org-bruno', nome: 'Bruno Tavares', papel: 'organizacao' },
  { id: 'p-carla', nome: 'Carla Mendes Souza', papel: 'participante' },
  { id: 'p-diego', nome: 'Diego Alves', papel: 'participante' },
  { id: 'p-elisa', nome: 'Elisa Fernandes da Rocha', papel: 'participante' },
  { id: 'p-fabio', nome: 'Fábio Nogueira', papel: 'participante' },
  { id: 'p-gabriela', nome: 'Gabriela Moura Castro', papel: 'participante' },
  { id: 'p-heitor', nome: 'Heitor Campos', papel: 'participante' },
  { id: 'p-isadora', nome: 'Isadora Ribeiro dos Santos', papel: 'participante' },
  { id: 'p-joao', nome: 'João Pedro Martins', papel: 'participante' }
];

export const SALAS_INICIAIS = [
  { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
  { id: 'sala-101', nome: 'Sala 101', capacidade: 40 },
  { id: 'sala-102', nome: 'Sala 102', capacidade: 40 },
  { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 }
];

export function resetarBanco(db) {
  db.exec(`
    DROP TABLE IF EXISTS encontros;
    DROP TABLE IF EXISTS atividades;
    DROP TABLE IF EXISTS salas;
    DROP TABLE IF EXISTS usuarios;

    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      papel TEXT NOT NULL
    );

    CREATE TABLE salas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      capacidade INTEGER NOT NULL
    );

    CREATE TABLE atividades (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      sala_id TEXT NOT NULL REFERENCES salas(id),
      vagas INTEGER NOT NULL,
      cancelada INTEGER NOT NULL DEFAULT 0,
      criada_em TEXT NOT NULL
    );

    CREATE TABLE encontros (
      id TEXT PRIMARY KEY,
      atividade_id TEXT NOT NULL REFERENCES atividades(id),
      inicio TEXT NOT NULL,
      fim TEXT NOT NULL,
      ordem INTEGER NOT NULL
    );
  `);

  const insereUsuario = db.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
  for (const u of USUARIOS_INICIAIS) {
    insereUsuario.run(u.id, u.nome, u.papel);
  }

  const insereSala = db.prepare('INSERT INTO salas (id, nome, capacidade) VALUES (?, ?, ?)');
  for (const s of SALAS_INICIAIS) {
    insereSala.run(s.id, s.nome, s.capacidade);
  }
}

export function criarBanco(caminho = ':memory:') {
  const db = new DatabaseSync(caminho);
  resetarBanco(db);
  return db;
}
