import type { AuthCacheInvalidationEvent, AuthCacheInvalidationPort } from "@edaya/authorization";
import {
  invalidateEffectiveGrantsCacheForActor,
  invalidateEffectiveGrantsCacheForStaff,
} from "@/lib/authorization/grants-cache/resolve-cached";
import { invalidateActorScopeCacheForActor } from "@/lib/authorization/scope-cache/resolve-cached";

export const apiAuthCacheInvalidationPort: AuthCacheInvalidationPort = {
  invalidateForEvent(event: AuthCacheInvalidationEvent) {
    switch (event.kind) {
      case "staff-grants":
        invalidateEffectiveGrantsCacheForStaff(event.staffMemberId, event.schoolId);
        return;
      case "guardian-scope":
        invalidateEffectiveGrantsCacheForActor(event.guardianId, "guardian", event.schoolId);
        invalidateActorScopeCacheForActor(event.guardianId, "guardian", event.schoolId);
        return;
      case "student-scope":
        invalidateEffectiveGrantsCacheForActor(event.studentId, "student", event.schoolId);
        invalidateActorScopeCacheForActor(event.studentId, "student", event.schoolId);
        return;
      case "teacher-scope":
        invalidateActorScopeCacheForActor(event.teacherId, "teacher", event.schoolId);
        return;
      default: {
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }
  },
};
