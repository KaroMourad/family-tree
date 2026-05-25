import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { prisma } from "./prisma.js";

export type Role = "user" | "superadmin";

export type AuthPayload = {
  sub: string;
  email: string;
  role: Role;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
      tree?: { id: string; name: string; ownerId: string; createdAt: Date; updatedAt: Date };
    }
  }
}

const TOKEN_TTL = "30d";

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { algorithm: "HS256", expiresIn: TOKEN_TTL });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const decoded = jwt.verify(header.slice(7), env.jwtSecret, {
      algorithms: ["HS256"],
    }) as AuthPayload;
    req.user = { sub: decoded.sub, email: decoded.email, role: decoded.role };
  } catch {
    // ignore invalid/expired tokens; request is treated as anonymous
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export async function requireTreeAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const treeId = req.params.treeId;
  if (!treeId) return res.status(400).json({ error: "Missing treeId" });
  const tree = await prisma.tree.findUnique({ where: { id: treeId } });
  if (!tree) return res.status(404).json({ error: "Tree not found" });
  const isOwner = tree.ownerId === req.user.sub;
  const isSuper = req.user.role === "superadmin";
  if (!isOwner && !isSuper) return res.status(404).json({ error: "Tree not found" });
  req.tree = tree;
  next();
}
