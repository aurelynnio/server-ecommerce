require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const connectDB = require('../db/connect.db');
const { upsertSourceDocuments } = require('../services/knowledge.service');

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node src/scripts/index-knowledge.js <approved-source.json>');
  await connectDB();
  const sourcePath = path.resolve(process.cwd(), input);
  const documents = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  const result = await upsertSourceDocuments(documents);
  process.stdout.write(`Indexed ${result.indexed} approved knowledge documents\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
