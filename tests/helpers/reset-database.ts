import {
  prisma
} from "../../src/lib/database.js";

export async function resetDatabase():
  Promise<void> {
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.guestPlayer.deleteMany();
  await prisma.guestSession.deleteMany();
  await prisma.user.deleteMany();
}
