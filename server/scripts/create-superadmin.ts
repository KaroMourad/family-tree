/**
 * Bootstrap a super-admin user.
 * Usage: pnpm create-superadmin <email> <password>
 *        pnpm --filter @family-tree/server create-superadmin <email> <password>
 *
 * If a user with that email already exists, their role is upgraded to
 * 'superadmin' and their password is reset to the one provided. Idempotent.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: pnpm create-superadmin <email> <password>");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const normalised = email.toLowerCase();

  const user = await prisma.user.upsert({
    where: { email: normalised },
    update: { role: "superadmin", passwordHash },
    create: { email: normalised, passwordHash, role: "superadmin" },
  });

  console.log(`Super-admin ready: ${user.email} (id=${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
