import college3eme from '../../../data/onboarding/ivory-coast/college/3eme.json' with { type: 'json' }
import college4eme from '../../../data/onboarding/ivory-coast/college/4eme.json' with { type: 'json' }
import college5eme from '../../../data/onboarding/ivory-coast/college/5eme.json' with { type: 'json' }
import college6eme from '../../../data/onboarding/ivory-coast/college/6eme.json' with { type: 'json' }
import fixtureMaster from '../../../data/onboarding/ivory-coast/fixture.json' with { type: 'json' }
import lycee1era from '../../../data/onboarding/ivory-coast/lycee/1era.json' with { type: 'json' }
import lycee1erc from '../../../data/onboarding/ivory-coast/lycee/1erc.json' with { type: 'json' }
import lycee1erd from '../../../data/onboarding/ivory-coast/lycee/1erd.json' with { type: 'json' }
import lycee2nda from '../../../data/onboarding/ivory-coast/lycee/2nda.json' with { type: 'json' }
import lycee2ndc from '../../../data/onboarding/ivory-coast/lycee/2ndc.json' with { type: 'json' }
import lyceeTlea from '../../../data/onboarding/ivory-coast/lycee/tlea.json' with { type: 'json' }
import lyceeTlec from '../../../data/onboarding/ivory-coast/lycee/tlec.json' with { type: 'json' }
import lyceeTled from '../../../data/onboarding/ivory-coast/lycee/tled.json' with { type: 'json' }

/** Worker-safe Ivory Coast onboarding fixture (no filesystem reads at module load). */
export const IVORY_COAST_FIXTURE_MASTER = fixtureMaster as Record<string, unknown>

export const IVORY_COAST_LEVEL_FILES: Record<string, unknown> = {
  'college/3eme.json': college3eme,
  'college/4eme.json': college4eme,
  'college/5eme.json': college5eme,
  'college/6eme.json': college6eme,
  'lycee/1era.json': lycee1era,
  'lycee/1erc.json': lycee1erc,
  'lycee/1erd.json': lycee1erd,
  'lycee/2nda.json': lycee2nda,
  'lycee/2ndc.json': lycee2ndc,
  'lycee/tlea.json': lyceeTlea,
  'lycee/tlec.json': lyceeTlec,
  'lycee/tled.json': lyceeTled,
}
