/**
 * Import a hierarchical JSON tree (camelCase document) into a specific Tree.
 *
 * Reads ../legacy/family_tree.json — a bare nested array/object of people
 * (the legacy seed). Destructive within the target tree only.
 *
 * Usage (one of):
 *   pnpm import-json --tree <treeId>
 *   pnpm import-json --owner <email> --name "<tree name>"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/prisma.js";
import {
  treeDocumentSchema,
  flattenDocument,
  replaceTreePeople,
} from "../src/lib/treeIO.js";

function parseArgs(argv: string[]): { tree?: string; owner?: string; name?: string } {
  const out: { tree?: string; owner?: string; name?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tree" && argv[i + 1]) out.tree = argv[++i];
    else if (argv[i] === "--owner" && argv[i + 1]) out.owner = argv[++i];
    else if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
  }
  return out;
}

function usageAndExit(): never {
  console.error(
    "Usage:\n" +
      "  pnpm import-json --tree <treeId>\n" +
      '  pnpm import-json --owner <email> --name "<tree name>"',
  );
  process.exit(1);
}

async function resolveTree(
  args: ReturnType<typeof parseArgs>,
): Promise<{ id: string; name: string }> {
  if (args.tree) {
    const t = await prisma.tree.findUnique({ where: { id: args.tree } });
    if (!t) {
      console.error(`No tree with id=${args.tree}`);
      process.exit(1);
    }
    return { id: t.id, name: t.name };
  }
  if (args.owner && args.name) {
    const owner = await prisma.user.findUnique({
      where: { email: args.owner.toLowerCase() },
    });
    if (!owner) {
      console.error(`No user with email=${args.owner}`);
      process.exit(1);
    }
    const created = await prisma.tree.create({
      data: { name: args.name, ownerId: owner.id },
    });
    console.log(`Created tree "${created.name}" (id=${created.id}) owned by ${owner.email}`);
    return { id: created.id, name: created.name };
  }
  usageAndExit();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tree = await resolveTree(args);

  const jsonPath = resolve(process.cwd(), "..", "legacy", "family_tree.json");
  console.log(`Reading ${jsonPath}`);
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const people = Array.isArray(raw) ? raw : [raw];

  // legacy/family_tree.json is a bare people array/object — wrap it into the
  // canonical document, reusing the tree's own name.
  const doc = treeDocumentSchema.parse({
    formatVersion: 1,
    tree: { name: tree.name },
    people,
  });

  const rows = flattenDocument(doc, tree.id);
  console.log(`Flattened ${rows.length} people for tree ${tree.id}`);
  const inserted = await replaceTreePeople(tree.id, tree.name, rows);
  console.log(`Inserted ${inserted} people into tree ${tree.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
