import { config } from 'zod';

// MV3 disallows runtime code generation, including Zod's optional JIT compiler.
config({ jitless: true });
