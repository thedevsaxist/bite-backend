import { eq } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import { users, type NewUser } from '../../db/schema/index.js';

export const usersRepository = {
  findById(id: string, executor: Executor = db) {
    return executor.select().from(users).where(eq(users.id, id)).get();
  },

  findByEmail(email: string, executor: Executor = db) {
    return executor.select().from(users).where(eq(users.email, email)).get();
  },

  create(data: NewUser, executor: Executor = db) {
    return executor.insert(users).values(data).returning().get();
  },
};
