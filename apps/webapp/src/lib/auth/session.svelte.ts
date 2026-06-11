import type { EffectiveGrantsSnapshot, SessionSnapshot } from '$lib/auth/types';
import type { School, StaffMember } from '$lib/data/school';
import { browser } from '$app/environment';
import { schools, staff } from '$lib/data/school';
import { authClient } from './client';

const STORAGE_USER = 'edaya:userId';
const STORAGE_SCHOOL = 'edaya:schoolId';

/** Comptes proposés sur l'écran de connexion démo. */
export const DEMO_ACCOUNTS = staff.filter(s =>
  ['st5', 'st3', 'st1', 'st7'].includes(s.id),
);

class AuthSession {
  userId = $state<string | null>(null);
  schoolId = $state<string | null>(null);
  userProfile = $state<StaffMember | null>(null);
  grants = $state<EffectiveGrantsSnapshot | null>(null);
  ready = $state(false);

  constructor() {
    if (browser)
      this.hydrate();
    else this.ready = true;
  }

  hydrate() {
    this.userId = sessionStorage.getItem(STORAGE_USER);
    this.schoolId = sessionStorage.getItem(STORAGE_SCHOOL) ?? schools[0]?.id ?? null;
    this.ready = true;
  }

  get isLoggedIn(): boolean {
    return Boolean(this.userId);
  }

  user = $derived.by((): StaffMember | null => {
    if (this.userProfile)
      return this.userProfile;
    if (!this.userId)
      return null;
    return staff.find(member => member.id === this.userId) ?? null;
  });

  school = $derived.by((): School | null => {
    if (!this.schoolId)
      return null;
    return schools.find(entry => entry.id === this.schoolId) ?? null;
  });

  setFromServer(session: SessionSnapshot | null, staffProfile?: StaffMember | null) {
    if (!session)
      return;

    this.userId = session.actorId;
    this.schoolId = session.schoolId;
    this.grants = session.effectiveGrants;
    if (staffProfile)
      this.userProfile = staffProfile;

    if (browser) {
      sessionStorage.setItem(STORAGE_USER, session.actorId);
      sessionStorage.setItem(STORAGE_SCHOOL, session.schoolId);
    }
    this.ready = true;
  }

  setSession(userId: string | null, schoolId: string | null) {
    this.userId = userId;
    if (schoolId) {
      this.schoolId = schoolId;
      if (browser) {
        sessionStorage.setItem(STORAGE_SCHOOL, schoolId);
      }
    }
    if (browser) {
      if (userId) {
        sessionStorage.setItem(STORAGE_USER, userId);
      }
      else {
        sessionStorage.removeItem(STORAGE_USER);
      }
    }
    this.ready = true;
  }

  login(userId: string, schoolId: string) {
    this.userId = userId;
    this.schoolId = schoolId;
    if (browser) {
      sessionStorage.setItem(STORAGE_USER, userId);
      sessionStorage.setItem(STORAGE_SCHOOL, schoolId);
    }
  }

  setSchool(schoolId: string) {
    this.schoolId = schoolId;
    if (browser)
      sessionStorage.setItem(STORAGE_SCHOOL, schoolId);
  }

  async logout() {
    this.userId = null;
    this.userProfile = null;
    this.grants = null;
    if (browser) {
      sessionStorage.removeItem(STORAGE_USER);
      try {
        await authClient.signOut();
      }
      catch {
        // Ignore sign out errors on client
      }
    }
  }
}

export const authSession = new AuthSession();
