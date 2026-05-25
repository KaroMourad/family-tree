export type Role = "user" | "superadmin";

export type AppUser = {
  id: string;
  email: string;
  role: Role;
};

export type TreeSummary = {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  peopleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Tree = TreeSummary;

export type Person = {
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
  sortOrder?: number;
};

export type TreeNode = Person & { children: TreeNode[] };
