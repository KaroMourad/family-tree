/**
 * Import a hierarchical JSON tree into a specific Tree.
 *
 * Usage (one of):
 *   pnpm import-json --tree <treeId>
 *   pnpm import-json --owner <email> --name "<tree name>"
 *
 * With --tree:  destructive within that tree only — every Person row in the
 *               target tree is deleted, then the JSON is inserted.
 * With --owner: a new Tree is created (owned by that user) and the JSON is
 *               inserted into it. Existing trees are untouched.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/prisma.js";

type RawPerson = {
  id: string;
  name: string;
  nickname?: string | null;
  surname_now?: string | null;
  surname_birth?: string | null;
  gender?: string | null;
  deceased?: string | null;
  father_id?: string | null;
  father_name?: string | null;
  mother_id?: string | null;
  mother_name?: string | null;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  birth_place?: string | null;
  death_place?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  profession?: string | null;
  bio?: string | null;
  children?: RawPerson[];
};

type FlatRow = {
  id: string;
  name: string;
  nickname: string | null;
  surnameNow: string | null;
  surnameBirth: string | null;
  gender: string | null;
  deceased: string | null;
  fatherId: string | null;
  fatherName: string | null;
  motherId: string | null;
  motherName: string | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  birthPlace: string | null;
  deathPlace: string | null;
  partnerId: string | null;
  partnerName: string | null;
  profession: string | null;
  bio: string | null;
  parentId: string | null;
  sortOrder: number;
  treeId: string;
  parentTreeId: string | null;
};

function flatten(node: RawPerson, parentId: string | null, sortOrder: number, treeId: string, out: FlatRow[]) {
  out.push({
    id: node.id,
    name: node.name,
    nickname: node.nickname ?? null,
    surnameNow: node.surname_now ?? null,
    surnameBirth: node.surname_birth ?? null,
    gender: node.gender ?? null,
    deceased: node.deceased ?? null,
    fatherId: node.father_id ?? null,
    fatherName: node.father_name ?? null,
    motherId: node.mother_id ?? null,
    motherName: node.mother_name ?? null,
    birthYear: node.birth_year ?? null,
    birthMonth: node.birth_month ?? null,
    birthDay: node.birth_day ?? null,
    deathYear: node.death_year ?? null,
    birthPlace: node.birth_place ?? null,
    deathPlace: node.death_place ?? null,
    partnerId: node.partner_id ?? null,
    partnerName: node.partner_name ?? null,
    profession: node.profession ?? null,
    bio: node.bio ?? null,
    parentId,
    sortOrder,
    treeId,
    parentTreeId: parentId == null ? null : treeId,
  });
  (node.children ?? []).forEach((c, i) => flatten(c, node.id, i, treeId, out));
}

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
      "  pnpm import-json --owner <email> --name \"<tree name>\"",
  );
  process.exit(1);
}

async function resolveTreeId(args: ReturnType<typeof parseArgs>): Promise<string> {
  if (args.tree) {
    const t = await prisma.tree.findUnique({ where: { id: args.tree } });
    if (!t) {
      console.error(`No tree with id=${args.tree}`);
      process.exit(1);
    }
    return t.id;
  }
  if (args.owner && args.name) {
    const owner = await prisma.user.findUnique({ where: { email: args.owner.toLowerCase() } });
    if (!owner) {
      console.error(`No user with email=${args.owner}`);
      process.exit(1);
    }
    const created = await prisma.tree.create({ data: { name: args.name, ownerId: owner.id } });
    console.log(`Created tree "${created.name}" (id=${created.id}) owned by ${owner.email}`);
    return created.id;
  }
  usageAndExit();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const treeId = await resolveTreeId(args);

  const jsonPath = resolve(process.cwd(), "..", "legacy", "family_tree.json");
  console.log(`Reading ${jsonPath}`);
  const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as RawPerson | RawPerson[];
  const roots = Array.isArray(raw) ? raw : [raw];

  const rows: FlatRow[] = [];
  roots.forEach((r, i) => flatten(r, null, i, treeId, rows));
  console.log(`Flattened ${rows.length} people for tree ${treeId}`);

  const existing = await prisma.person.count({ where: { treeId } });
  if (existing > 0) {
    console.log(`Wiping ${existing} existing Person rows in this tree...`);
    await prisma.person.deleteMany({ where: { treeId } });
  }

  const byParent = new Map<string | null, FlatRow[]>();
  for (const r of rows) {
    const list = byParent.get(r.parentId) ?? [];
    list.push(r);
    byParent.set(r.parentId, list);
  }
  const queue: (string | null)[] = [null];
  let inserted = 0;
  while (queue.length) {
    const pid = queue.shift()!;
    const layer = byParent.get(pid) ?? [];
    if (layer.length) {
      await prisma.person.createMany({ data: layer });
      inserted += layer.length;
      for (const child of layer) queue.push(child.id);
    }
  }
  console.log(`Inserted ${inserted} people into tree ${treeId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
