// cardRepository.test.js
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { CardRepository } = require('./cardRepository');

// ---------- Fake database (replaces Supabase/PostgreSQL) ----------
class FakeDb {
  constructor(users = ['u1', 'u2']) {
    this.users = new Set(users);
    this.cards = new Map();
    this.nextId = 1;
  }
  async userExists(userId) { return this.users.has(userId); }
  async insertCard(row) {
    const id = this.nextId++;
    this.cards.set(id, { id, ...row, tags: [...row.tags] });
    return id;
  }
  async getCard(id) {
    const c = this.cards.get(id);
    return c ? { ...c, tags: [...c.tags] } : null;
  }
  async getCardsByUser(userId) {
    return [...this.cards.values()]
      .filter((c) => c.ownerId === userId)
      .map((c) => ({ ...c, tags: [...c.tags] }));
  }
  async updateCard(id, fields) {
    const updated = { ...this.cards.get(id), ...fields };
    this.cards.set(id, updated);
    return { ...updated, tags: [...updated.tags] };
  }
  async deleteCard(id) { this.cards.delete(id); }
}

function setup() {
  const db = new FakeDb();
  return { db, repo: new CardRepository(db) };
}

const bioCard = {
  question: 'What is the powerhouse of the cell?',
  answer: 'Mitochondria',
  hint: 'Starts with M',
  priority: 'high',
  tags: ['Biology', 'Cells'],
};

async function seedCards(repo) {
  await repo.saveCard('u1', { question: 'q1', answer: 'a', tags: ['Biology', 'Cells'] }); // 1
  await repo.saveCard('u1', { question: 'q2', answer: 'a', tags: ['Biology', 'Genetics'] }); // 2
  await repo.saveCard('u1', { question: 'q3', answer: 'a', tags: ['Chemistry'] }); // 3
  await repo.saveCard('u2', { question: 'q4', answer: 'a', tags: ['Biology'] }); // 4 (other user)
}

// =====================================================================
// 1. Save a record
// =====================================================================
test('save (expected): stores card fields, owner, unused ID, and understanding 0', async () => {
  const { db, repo } = setup();
  const saved = await repo.saveCard('u1', bioCard);

  assert.equal(saved.id, 1);
  assert.equal(saved.ownerId, 'u1');
  assert.equal(saved.question, 'What is the powerhouse of the cell?');
  assert.equal(saved.answer, 'Mitochondria');
  assert.equal(saved.priority, 'high');
  assert.deepEqual(saved.tags, ['Biology', 'Cells']);
  assert.equal(saved.understanding, 0);
  assert.equal(db.cards.size, 1);
});

test('save (edge): empty tags and no hint are saved as [] and ""', async () => {
  const { repo } = setup();
  const saved = await repo.saveCard('u1', { question: 'Q', answer: 'A' });
  assert.deepEqual(saved.tags, []);
  assert.equal(saved.hint, '');
  assert.equal(saved.priority, 'moderate');
});

test('save (invalid): SQL code in fields is stored as plain text, nothing deleted', async () => {
  const { db, repo } = setup();
  await repo.saveCard('u1', bioCard);
  const evil = "x'); DELETE FROM cards; --";
  const saved = await repo.saveCard('u1', { question: evil, answer: 'A', tags: [evil] });

  assert.equal(db.cards.size, 2);
  assert.equal(db.cards.get(saved.id).question, evil);
  assert.deepEqual(db.cards.get(saved.id).tags, [evil]);
  assert.equal(db.cards.get(1).question, bioCard.question);
});

// =====================================================================
// 2. Retrieve records matching a Boolean query
// =====================================================================
test('retrieve (expected): AND, OR, and NOT return the matching IDs for the owner only', async () => {
  const { repo } = setup();
  await seedCards(repo);
  assert.deepEqual(await repo.retrieveCardIds('u1', 'Biology AND Cells'), [1]);
  assert.deepEqual(await repo.retrieveCardIds('u1', 'Biology OR Chemistry'), [1, 2, 3]);
  assert.deepEqual(await repo.retrieveCardIds('u1', 'Biology AND NOT Cells'), [2]);
});

test('retrieve (edge): empty query returns all of the user\'s cards', async () => {
  const { repo } = setup();
  await seedCards(repo);
  assert.deepEqual(await repo.retrieveCardIds('u1', ''), [1, 2, 3]);
});

test('retrieve (invalid): badly formed queries are rejected', async () => {
  const { repo } = setup();
  await seedCards(repo);
  await assert.rejects(repo.retrieveCardIds('u1', 'Biology AND'), { name: 'QueryError' });
  await assert.rejects(repo.retrieveCardIds('u1', '(Biology AND Cells'), { name: 'QueryError' });
  await assert.rejects(repo.retrieveCardIds('u1', null), { name: 'QueryError' });
});

// =====================================================================
// 3. Update a record
// =====================================================================
test('update (expected): changes only the given fields and returns the updated card', async () => {
  const { db, repo } = setup();
  const { id } = await repo.saveCard('u1', bioCard);
  const updated = await repo.updateCard('u1', id, { answer: 'Mitochondrion', understanding: 75 });

  assert.equal(updated.answer, 'Mitochondrion');
  assert.equal(updated.understanding, 75);
  assert.equal(updated.question, bioCard.question);
  assert.deepEqual(updated.tags, ['Biology', 'Cells']);
  assert.equal(db.cards.get(id).answer, 'Mitochondrion');
});

test('update (edge): understanding boundaries 0 and 100 are accepted', async () => {
  const { repo } = setup();
  const { id } = await repo.saveCard('u1', bioCard);
  assert.equal((await repo.updateCard('u1', id, { understanding: 100 })).understanding, 100);
  assert.equal((await repo.updateCard('u1', id, { understanding: 0 })).understanding, 0);
});

test('update (invalid): out-of-range value, empty text, and another user\'s card are rejected', async () => {
  const { db, repo } = setup();
  const { id } = await repo.saveCard('u1', bioCard);
  await assert.rejects(repo.updateCard('u1', id, { understanding: 101 }), { name: 'ValidationError' });
  await assert.rejects(repo.updateCard('u1', id, { question: '   ' }), { name: 'ValidationError' });
  await assert.rejects(repo.updateCard('u2', id, { answer: 'x' }), { name: 'NotFoundError' });
  assert.equal(db.cards.get(id).understanding, 0);
  assert.equal(db.cards.get(id).question, bioCard.question);
  assert.equal(db.cards.get(id).answer, 'Mitochondria');
});

// =====================================================================
// 4. Delete a record
// =====================================================================
test('delete (expected): removes the card and leaves other cards untouched', async () => {
  const { db, repo } = setup();
  const a = await repo.saveCard('u1', bioCard);
  const b = await repo.saveCard('u1', bioCard);

  assert.equal(await repo.deleteCard('u1', a.id), true);
  assert.equal(db.cards.has(a.id), false);
  assert.equal(db.cards.has(b.id), true);
  assert.deepEqual(await repo.retrieveCardIds('u1', ''), [b.id]);
});

test('delete (edge): deleting an already deleted card is rejected', async () => {
  const { repo } = setup();
  const { id } = await repo.saveCard('u1', bioCard);
  await repo.deleteCard('u1', id);
  await assert.rejects(repo.deleteCard('u1', id), { name: 'NotFoundError' });
});

test('delete (invalid): null, non-numeric, and SQL-style card IDs are rejected', async () => {
  const { db, repo } = setup();
  await repo.saveCard('u1', bioCard);
  await assert.rejects(repo.deleteCard('u1', null), { name: 'ValidationError' });
  await assert.rejects(repo.deleteCard('u1', 'abc'), { name: 'ValidationError' });
  await assert.rejects(repo.deleteCard('u1', '1; DELETE FROM cards'), { name: 'ValidationError' });
  assert.equal(db.cards.size, 1);
});
