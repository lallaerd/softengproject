## Running the Database Component Unit Tests

### Requirements

| Requirement | Version |
|---|---|
| Node.js | **20 LTS or newer recommended** (18.0 is the minimum) |
| JavaScript | ES2020 or newer, CommonJS modules (`require`) |
| npm packages | None. The tests use Node's built-in `node:test` and `node:assert`. |

Node 18 or newer is required because the built-in test runner (`node --test`) was added in Node 18.

### Installation

1. Install Node.js 20 LTS or newer from https://nodejs.org, or with nvm:

   ```bash
   nvm install 20
   nvm use 20
   ```

2. Check your version:

   ```bash
   node --version
   ```

   The output should be `v18.0.0` or higher (for example `v20.11.0`).

3. Put these two files in the same folder:

   ```
   cardRepository.js        # database component (Save, Retrieve, Update, Delete)
   cardRepository.test.js   # unit tests with an in-memory fake database
   ```

No `npm install` step is needed.

### Running the tests

From the folder containing the two files, run all tests:

```bash
node --test
```

Or run only the test file:

```bash
node --test cardRepository.test.js
```

Optional: to run the tests with `npm test`, create a `package.json` and add a test script:

```bash
npm init -y
npm pkg set scripts.test="node --test"
npm test
```

### Expected output

A passing run ends with a summary like this:

```
# tests 12
# pass 12
# fail 0
```

If a test fails, the output shows the test name, the expected value, and the actual value.

### Notes

- The tests do not connect to Supabase or PostgreSQL. A `FakeDb` class in `cardRepository.test.js` replaces the real database, so no account, API key, or internet connection is needed.
- To test your real implementation, replace `cardRepository.js` with your own class, or pass your own database client to `new CardRepository(db)`. The client needs these methods: `userExists`, `insertCard`, `getCard`, `getCardsByUser`, `updateCard`, and `deleteCard`.
