import { Router } from "express";
import { requireAuth } from "../auth.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  res.json({
    id: req.user!.sub,
    email: req.user!.email,
    role: req.user!.role,
  });
});

export default router;
