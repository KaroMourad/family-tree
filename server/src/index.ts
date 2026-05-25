import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { optionalAuth } from "./auth.js";
import authRouter from "./routes/auth.js";
import meRouter from "./routes/me.js";
import treesRouter from "./routes/trees.js";

const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(optionalAuth);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/trees", treesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
