// cardRepository.js
// Database component for FlashFocus. The real db client (Supabase/PostgreSQL)
// is injected, so tests can replace it with an in-memory fake.
// The db client must provide:
//   userExists(userId), insertCard(row) -> id, getCard(id),
//   getCardsByUser(userId), updateCard(id, fields), deleteCard(id)
// In the real client, every call must use parameterized queries.

//Error messages
class ValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'ValidationError'; }
}
class QueryError extends Error {
  constructor(msg) { super(msg); this.name = 'QueryError'; }
}
class NotFoundError extends Error {
  constructor(msg) { super(msg); this.name = 'NotFoundError'; }
}

//constants
const PRIORITIES = ['low', 'moderate', 'high'];
const UPDATABLE = ['question', 'answer', 'hint', 'priority', 'tags', 'understanding'];

// ---------- Boolean query (AND, OR, NOT, parentheses, "quoted tags") ----------
// Tokenize the query
function tokenize(query) 
{

  //query.match(/"/g) returns an array of every " in the string, or null if there are none
  //If the count is odd, a quote was opened and never closed (like "CSCI 5870)
  //Then the function throws a QueryError. This is one of the “badly formed query” error cases.
  if ((query.match(/"/g) || []).length % 2 !== 0) {
    throw new QueryError('Unmatched quote');
  }
  //initialize an empty array to store the tokens
  const tokens = [];

  //Splits the query and assign corresponding type to operator etc
  //"([^"]*)" = a quoted phrase. Parentheses capture what is inside the quote
  // \( or \) = a single parenthesis
  //[^\s()"]+ = a string of characters that are not whitespace, parentheses or quotes
  //Because quoted text is checked first, 
  //"AND" in quotes becomes a tag named and, not an operator. This lets users search for a tag with an operator’s name.
  //Every tag is lowercased with .toLowerCase(), and makes the search case-insensitive
  for (const m of query.matchAll(/"([^"]*)"|\(|\)|[^\s()"]+/g)) {
    if (m[1] !== undefined) tokens.push({ type: 'tag', value: m[1].trim().toLowerCase() });
    else if (m[0] === '(') tokens.push({ type: 'lparen' });
    else if (m[0] === ')') tokens.push({ type: 'rparen' });
    else if (['AND', 'OR', 'NOT'].includes(m[0])) tokens.push({ type: 'op', value: m[0] });
    else tokens.push({ type: 'tag', value: m[0].toLowerCase() });
  }
  return tokens;
}

//find if cards match the query
function parseQuery(query) 
{
  const tokens = tokenize(query);
  //pos = pointer to current token
  let pos = 0;
  //look at current token without mowing forward
  const peek = () => tokens[pos];
  //check  which operator it is + peek to not go over the list
  const isOp = (v) => peek() && peek().type === 'op' && peek().value === v;

  function parseOr() 
  {
    //Parse the left side, then loop as long as the next token is OR. 
    // each call skip the operator (pos++), parse the right side, and combine both into a new function. 
    // This loop is lets A OR B OR C chain.
    let left = parseAnd();
    while (isOp('OR')) { pos++; const l = left, r = parseAnd(); left = (t) => l(t) || r(t); }
    return left;
  }

  function parseAnd() 
  {
    let left = parseNot();
    while (isOp('AND')) { pos++; const l = left, r = parseNot(); left = (t) => l(t) && r(t); }
    return left;
  }

  function parseNot() 
  {
    //If the token is NOT, skip it, parse what is next, 
    // and wrap the result with !. It calls itself, so NOT NOT A works.
    if (isOp('NOT')) { pos++; const inner = parseNot(); return (t) => !inner(t); }
    return parsePrimary();
  }

  //is the base case
  function parsePrimary() 
  {
    const tok = peek();
    // if not token left, throw error message
    if (!tok) throw new QueryError('Unexpected end of query');
    //moves forward and returns (t) => t.has(tok.value), which checks whether the card’s tag set contains that tag
    if (tok.type === 'tag') { pos++; return (t) => t.has(tok.value); }
    //moves forward, calls parseOr() to parse everything inside, then requires a ). 
    //If missing, it throws 'Unmatched parenthesis'. 
    //Calls back into parseOr is the recursion that allows nesting like (A OR (B AND C))
    if (tok.type === 'lparen') {
      pos++;
      const inner = parseOr();
      if (!peek() || peek().type !== 'rparen') throw new QueryError('Unmatched parenthesis');
      pos++;
      return inner;
    }
    //Anything else like a stray parenthese) or an operator in the wrong place, such as AND Biology) throws 'Unexpected token'
    throw new QueryError('Unexpected token');
  }

  const predicate = parseOr();
  if (pos < tokens.length) throw new QueryError('Unexpected token');
  return predicate;
}

// ---------- Repository ----------
class CardRepository 
{
  constructor(db) { this.db = db; }

  //throw if the user Id is missing or not in the database
  //await this.db.userExists(userId) asks the database,so the method is async. 
  // The ! flips the result, so the error is thrown when the user does not exist.
  async _requireUser(userId) {
    if (userId === null || userId === undefined || !(await this.db.userExists(userId))) {
      throw new NotFoundError('User does not exist');
    }
  }

  //only checks the format of the ID. It doesn’t check whether the card exists.
  //A SQL-style string is rejected before it gets anywhere near the database.
  _requireCardId(cardId) {
    if (!Number.isInteger(cardId) || cardId <= 0) {
      throw new ValidationError('Card ID must be a positive integer');
    }
  }

  //rejects two things: values that aren’t strings (such as undefined or a number), and strings that are empty or only whitespace.
  _checkText(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ValidationError(`${field} must not be empty`);
    }
  }

  //It rejects anything that isn’t an array, or any array containing a non-string item (for example ['Biology', 42]).
  //If the input is valid, it trims whitespace from each tag and drops tags that were empty or whitespace-only, 
  // then returns the cleaned array
  _checkTags(tags) {
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
      throw new ValidationError('Tags must be an array of strings');
    }
    return tags.map((t) => t.trim()).filter((t) => t !== '');
  }

  // 1. Save
  async saveCard(userId, card) 
  {
    //throws NotFoundError if the user ID is missing or doesn’t exist. 
    //This happens first, so no work is done for an invalid user.
    await this._requireUser(userId);

    //check that a card was given
    if (!card || typeof card !== 'object') throw new ValidationError('Flashcard is missing');

    //chcek the required text (non empty). Whitespace-only text counts as empty
    this._checkText(card.question, 'Question');
    this._checkText(card.answer, 'Answer');

    //check the priority 
    //If the caller doesn’t provide a priority, it defaults to 'moderate'. If one is provided, it must be 'low', 'moderate', or 'high'
    const priority = card.priority === undefined ? 'moderate' : card.priority;
    if (!PRIORITIES.includes(priority)) throw new ValidationError('Invalid priority');

    //Missing tags default to an empty array. _checkTags then confirms it’s an array of strings, trims each tag, and drops blank ones.
    const tags = this._checkTags(card.tags === undefined ? [] : card.tags);

    const row = 
    {
      ownerId: userId,                //links the card to its owner
      question: card.question,        //makes the hint optional
      answer: card.answer,            
      hint: card.hint || '',
      priority,
      tags,
      understanding: 0,               // set understanding to 0
    };
    //database client inserts the row and returns the new ID, which is generated by the database
    const id = await this.db.insertCard(row);
    return { id, ...row };
  }

  // 2. Retrieve (returns a list of card IDs)
  async retrieveCardIds(userId, query) 
  {
    //throws NotFoundError if the user is missing or doesn’t exist
    await this._requireUser(userId);

    //query must be a string. null, undefined, numbers, and objects all throw QueryError
    if (query === null || query === undefined || typeof query !== 'string') {
      throw new QueryError('Query must be a string');
    }

    //fetches only this user’s cards
    const cards = await this.db.getCardsByUser(userId);

    //An empty or whitespace-only query means “no filter,” so every card ID is returned
    if (query.trim() === '') return cards.map((c) => c.id);

    //calls the tokenizer and parser
    const predicate = parseQuery(query);
    return cards
      .filter((c) => predicate(new Set(c.tags.map((t) => t.toLowerCase()))))    //lowercase the tag because case sensitive + turn it into a set
      .map((c) => c.id);
  }

  // 3. Update (only the given fields change)
  async updateCard(userId, cardId, fields) 
  {
    //throws NotFoundError if the user is missing or doesn’t exist
    await this._requireUser(userId);

    //throws ValidationError unless the card ID is a positive integer
    this._requireCardId(cardId);

    //loads the card. If it doesn’t exist or belongs to another user, it throws the same NotFoundError
    const card = await this.db.getCard(cardId);
    if (!card || card.ownerId !== userId) throw new NotFoundError('Card not found');

    //check given fields: null, undefined, and non-objects are rejected.
    if (!fields || typeof fields !== 'object') throw new ValidationError('Fields are missing');

    //validate each field
    const changes = {};
    for (const key of Object.keys(fields)) 
      {

      //Only question, answer, hint, priority, tags, and understanding may change.
      //Anything else, such as id or ownerId, throws ValidationError
      if (!UPDATABLE.includes(key)) throw new ValidationError(`Cannot update field ${key}`);
      const value = fields[key];

      //Must be non-empty text, using _checkText.
      if (key === 'question' || key === 'answer') this._checkText(value, key);

      //Must be 'low', 'moderate', or 'high'.
      if (key === 'priority' && !PRIORITIES.includes(value)) {
        throw new ValidationError('Invalid priority');
      }

      //Must be a finite number from 0 to 100
      if (key === 'understanding' && !(Number.isFinite(value) && value >= 0 && value <= 100)) {
        throw new ValidationError('Understanding must be between 0 and 100');
      }

      //Validated and cleaned by _checkTags
      if (key === 'tags') { changes.tags = this._checkTags(value); continue; }
      changes[key] = value;
    }
    //skip the database if nothing has changed
    if (Object.keys(changes).length === 0) return card;

    //write and return
    return this.db.updateCard(cardId, changes);
  }

  // 4. Delete
  async deleteCard(userId, cardId) 
  {
    //throws NotFoundError if the user is missing or doesn’t exist
    await this._requireUser(userId);

    //throws ValidationError unless the card ID is a positive integer
    this._requireCardId(cardId);

    //loads the card and throws NotFoundError if it doesn’t exist or belongs to a different user
    const card = await this.db.getCard(cardId);
    if (!card || card.ownerId !== userId) throw new NotFoundError('Card not found');

    //after both checks pass does it ask the database to delete the card. 
    //It returns true to tell the caller the delete happened. Errors are signaled by exceptions, so a caller never gets false
    await this.db.deleteCard(cardId);
    return true;
  }
}

module.exports = { CardRepository, ValidationError, QueryError, NotFoundError };
