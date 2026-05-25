import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, requireTreeAccess } from "../auth.js";

const router = Router();

function randomId(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

const treeInputSchema = z.object({
  name: z.string().min(1).max(100),
});

const personInputSchema = z.object({
  id: z.string().min(1).optional(),
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
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

// --- /api/trees -------------------------------------------------------------

router.get("/", requireAuth, async (req, res) => {
  const where = req.user!.role === "superadmin" ? {} : { ownerId: req.user!.sub };
  const trees = await prisma.tree.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { people: true } }, owner: { select: { email: true } } },
  });
  res.json(
    trees.map((t) => ({
      id: t.id,
      name: t.name,
      ownerId: t.ownerId,
      ownerEmail: t.owner.email,
      peopleCount: t._count.people,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  );
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = treeInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tree = await prisma.tree.create({
    data: { name: parsed.data.name, ownerId: req.user!.sub },
  });
  res.status(201).json({
    id: tree.id,
    name: tree.name,
    ownerId: tree.ownerId,
    peopleCount: 0,
    createdAt: tree.createdAt,
    updatedAt: tree.updatedAt,
  });
});

router.get("/:treeId", requireTreeAccess, async (req, res) => {
  const t = req.tree!;
  const peopleCount = await prisma.person.count({ where: { treeId: t.id } });
  res.json({
    id: t.id,
    name: t.name,
    ownerId: t.ownerId,
    peopleCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  });
});

router.put("/:treeId", requireTreeAccess, async (req, res) => {
  const parsed = treeInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.tree.update({
    where: { id: req.tree!.id },
    data: { name: parsed.data.name },
  });
  res.json({
    id: updated.id,
    name: updated.name,
    ownerId: updated.ownerId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
});

router.delete("/:treeId", requireTreeAccess, async (req, res) => {
  await prisma.tree.delete({ where: { id: req.tree!.id } });
  res.status(204).end();
});

// --- /api/trees/:treeId/people ---------------------------------------------

router.get("/:treeId/people", requireTreeAccess, async (req, res) => {
  const people = await prisma.person.findMany({
    where: { treeId: req.tree!.id },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
  });
  res.json(people);
});

router.get("/:treeId/people/:id", requireTreeAccess, async (req, res) => {
  const person = await prisma.person.findUnique({
    where: { treeId_id: { treeId: req.tree!.id, id: req.params.id } },
    include: { children: { orderBy: { sortOrder: "asc" } } },
  });
  if (!person) return res.status(404).json({ error: "Not found" });
  res.json(person);
});

router.post("/:treeId/people", requireTreeAccess, async (req, res) => {
  const parsed = personInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const treeId = req.tree!.id;
  let id = data.id ?? randomId();
  while (
    await prisma.person.findUnique({ where: { treeId_id: { treeId, id } } })
  ) {
    id = randomId();
  }
  const created = await prisma.person.create({ data: { ...data, id, treeId } });
  res.status(201).json(created);
});

router.put("/:treeId/people/:id", requireTreeAccess, async (req, res) => {
  const parsed = personInputSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const updated = await prisma.person.update({
      where: { treeId_id: { treeId: req.tree!.id, id: req.params.id } },
      data: parsed.data,
    });
    res.json(updated);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

router.delete("/:treeId/people/:id", requireTreeAccess, async (req, res) => {
  try {
    await prisma.person.delete({
      where: { treeId_id: { treeId: req.tree!.id, id: req.params.id } },
    });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// --- /api/trees/:treeId/tree (nested-tree render) --------------------------

type PersonRow = Awaited<ReturnType<typeof prisma.person.findMany>>[number];
type TreeNode = Omit<PersonRow, "parentId" | "treeId" | "createdAt" | "updatedAt" | "sortOrder"> & {
  children: TreeNode[];
};

function toNode(p: PersonRow): TreeNode {
  const {
    parentId: _p,
    treeId: _t,
    createdAt: _c,
    updatedAt: _u,
    sortOrder: _s,
    ...rest
  } = p;
  return { ...rest, children: [] };
}

router.get("/:treeId/tree", requireTreeAccess, async (req, res) => {
  const all = await prisma.person.findMany({
    where: { treeId: req.tree!.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const byId = new Map<string, TreeNode>();
  for (const p of all) byId.set(p.id, toNode(p));
  const roots: TreeNode[] = [];
  for (const p of all) {
    const node = byId.get(p.id)!;
    if (p.parentId && byId.has(p.parentId)) {
      byId.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Empty tree → return [] (matches spec "Empty-tree state").
  if (all.length === 0) return res.json([]);
  if (roots.length === 1) return res.json(roots[0]);
  res.json(roots);
});

export default router;
