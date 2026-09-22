import type { Repository } from '../../../kernel/ports.js';
import type { User } from '../domain/user.js';

export type UserRepository = Repository<User, string>;
