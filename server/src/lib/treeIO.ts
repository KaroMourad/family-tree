// server/src/lib/treeIO.ts
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

// One person node in an export/import document. camelCase, nested via `children`.
// Mirrors the Person fields the API already returns from GET /:treeId/tree.
const personNodeBase = {
  id: z.string().min(1),
  name: z.string().min(1),
  nickname: z.string().nullable().optional(),
  surnameNow: z.string().nullable().optional(),
  surnameBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  deceased: z.string().nullable().optional(),
  fatherId: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  motherId: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  birthMonth: z.number().int().nullable().optional(),
  birthDay: z.number().int().nullable().optional(),
  deathYear: z.number().int().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  deathPlace: z.string().nullable().optional(),
  partnerId: z.string().nullable().optional(),
  partnerName: z.string().nullable().optional(),
  profession: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
};

export type PersonNode = PersonNodeShape;
export const personNodeSchema: z.ZodType<PersonNodeShape> = z.lazy(() =>
  z.object({
    ...personNodeBase,
    children: z.array(personNodeSchema).optional(),
  }),
);

type PersonNodeShape = {
  id: string;
  name: string;
  nickname?: string | null;
  surnameNow?: string | null;
  surnameBirth?: string | null;
  gender?: string | null;
  deceased?: string | null;
  fatherId?: string | null;
  fatherName?: string | null;
  motherId?: string | null;
  motherName?: string | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  deathYear?: number | null;
  birthPlace?: string | null;
  deathPlace?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  profession?: string | null;
  bio?: string | null;
  sortOrder?: number;
  children?: PersonNodeShape[];
};

export const treeDocumentSchema = z.object({
  formatVersion: z.literal(1),
  tree: z.object({ name: z.string().min(1).max(100) }),
  people: z.array(personNodeSchema),
});
export type TreeDocument = z.infer<typeof treeDocumentSchema>;

type PersonCreate = Prisma.PersonCreateManyInput;

/**
 * Flatten a document's nested people into rows ready for createMany,
 * preserving the file's ids. Throws on duplicate ids within the document.
 */
export function flattenDocument(doc: TreeDocument, treeId: string): PersonCreate[] {
  const rows: PersonCreate[] = [];
  const seen = new Set<string>();

  function walk(node: PersonNodeShape, parentId: string | null, sortOrder: number) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate person id in document: ${node.id}`);
    }
    seen.add(node.id);
    rows.push({
      treeId,
      id: node.id,
      name: node.name,
      nickname: node.nickname ?? null,
      surnameNow: node.surnameNow ?? null,
      surnameBirth: node.surnameBirth ?? null,
      gender: node.gender ?? null,
      deceased: node.deceased ?? null,
      fatherId: node.fatherId ?? null,
      fatherName: node.fatherName ?? null,
      motherId: node.motherId ?? null,
      motherName: node.motherName ?? null,
      birthYear: node.birthYear ?? null,
      birthMonth: node.birthMonth ?? null,
      birthDay: node.birthDay ?? null,
      deathYear: node.deathYear ?? null,
      birthPlace: node.birthPlace ?? null,
      deathPlace: node.deathPlace ?? null,
      partnerId: node.partnerId ?? null,
      partnerName: node.partnerName ?? null,
      profession: node.profession ?? null,
      bio: node.bio ?? null,
      parentId,
      parentTreeId: parentId == null ? null : treeId,
      // Prefer the document's own sortOrder (faithful round-trip); fall back to
      // sibling array index for documents that omit it (e.g. the legacy seed).
      sortOrder: node.sortOrder ?? sortOrder,
    });
    (node.children ?? []).forEach((c, i) => walk(c, node.id, i));
  }

  doc.people.forEach((root, i) => walk(root, null, i));
  return rows;
}

/**
 * Atomically replace all Person rows of a tree with `rows`, and set the tree
 * name. Inserts BFS-by-layer so parent FKs resolve before children.
 * Runs inside a single transaction: any failure rolls back the whole replace.
 */
export async function replaceTreePeople(
  treeId: string,
  treeName: string,
  rows: PersonCreate[],
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.tree.update({ where: { id: treeId }, data: { name: treeName } });
    await tx.person.deleteMany({ where: { treeId } });

    const byParent = new Map<string | null, PersonCreate[]>();
    for (const r of rows) {
      const list = byParent.get(r.parentId ?? null) ?? [];
      list.push(r);
      byParent.set(r.parentId ?? null, list);
    }
    const queue: (string | null)[] = [null];
    let inserted = 0;
    while (queue.length) {
      const pid = queue.shift()!;
      const layer = byParent.get(pid) ?? [];
      if (layer.length) {
        await tx.person.createMany({ data: layer });
        inserted += layer.length;
        for (const child of layer) queue.push(child.id);
      }
    }
    return inserted;
  });
}
