import * as db from './db.js';
import { createProfileService } from '../../shared/profile-service.js';

export const { getProfile, updateProfile } = createProfileService(db);
