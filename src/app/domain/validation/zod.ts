import { z } from 'zod';

// Configure before constructing schemas: CSP forbids JIT and even capability probes.
z.config({ jitless: true });

export { z };
export { ZodError } from 'zod';
