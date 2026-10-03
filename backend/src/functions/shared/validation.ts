import { ValidationError } from './errors.js';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/;

/**
 * Validate the fields required to create a new employee (or manager) via Cognito.
 * Throws ValidationError on the first failing field.
 */
export function validateCreateUserBody(body: {
  email?: string;
  first_name?: string;
  last_name?: string;
  temp_password?: string;
}): void {
  if (!body.email?.trim()) throw new ValidationError('email is required');
  if (!EMAIL_REGEX.test(body.email.trim()))
    throw new ValidationError('email must be a valid email address');
  if (!body.first_name?.trim()) throw new ValidationError('first_name is required');
  if (!body.last_name?.trim()) throw new ValidationError('last_name is required');
  if (!body.temp_password?.trim()) throw new ValidationError('temp_password is required');
}
