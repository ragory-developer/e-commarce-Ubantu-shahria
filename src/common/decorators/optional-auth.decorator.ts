// src/common/decorators/optional-auth.decorator.ts
// Use on endpoints where auth is welcome but not required
// (e.g. checkout — works for both guests and logged-in customers)

import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
