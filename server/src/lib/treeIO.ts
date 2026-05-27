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
  children?: PersonNodeShape[];
};

export const treeDocumentSchema = z.object({
  formatVersion: z.literal(1),
  tree: z.object({ name: z.string().min(1).max(100) }),
  people: z.array(personNodeSchema),
});
export type TreeDocument = z.infer<typeof treeDocumentSchema>;
