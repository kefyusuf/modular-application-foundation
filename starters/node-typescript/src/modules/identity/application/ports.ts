import type { Repository } from '../../../kernel/ports.js';
import type { User } from '../domain/user.js';

export interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;
}
