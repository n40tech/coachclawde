import type { UserProfile } from '../types'

/**
 * Test athletes whose profiles came from the pre-1.1 onboarding goal tree
 * (deleted; it's on the `cardio-archive` branch). Real accounts from those
 * builds still carry goals like these, so the prompt must keep handling them.
 * Each was built on 2026-10-01 12:00 local time.
 */
export const LEGACY_GOAL_PATCHES = {
  /** Gym lifter chasing bigger squat, bench and deadlift, 3 × 60 min. */
  gymLifter: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "strength",
      "statement": "Bigger squat, bench and deadlift",
      "starting": {
        "level": "advanced",
        "lifting": "1y+"
      },
      "constraints": {
        "daysPerWeek": 3,
        "sessionMinutes": 60,
        "facilities": [
          "full-gym"
        ]
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "coaching-tone"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "strength": {
        "kind": "lifts"
      }
    },
    "goals": [
      "Bigger squat, bench and deadlift"
    ],
    "experienceLevel": "advanced",
    "fitnessBackground": "Experience (derived): advanced. Lifting: consistently, a year+. Wants to train about 3 days a week, 60 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "get-strong"
      ],
      "exerciseTypes": [
        "weights"
      ],
      "facilities": [
        "full-gym"
      ],
      "sports": [],
      "coachingStyle": "balanced",
      "lengthWeeks": 12,
      "startDate": "2026-09-28",
      "daysPerWeek": 3
    },
    "gymAccess": true,
    "programWeek": 1
  },
  /** 10 km runner with no equipment, 3 × 45 min. */
  runnerNoStrength: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "event",
      "statement": "10K on Sun 6 Dec 2026 (10 weeks), aiming to finish strong",
      "starting": {
        "level": "intermediate",
        "runKmPerWeek": [
          10,
          25
        ]
      },
      "constraints": {
        "daysPerWeek": 3,
        "sessionMinutes": 45,
        "facilities": [],
        "strengthWork": false
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "runs-with",
        "coaching-tone"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "event": {
        "kind": "10k",
        "date": "2026-12-06",
        "aim": "finish-strong"
      }
    },
    "goals": [
      "10K on Sun 6 Dec 2026 (10 weeks), aiming to finish strong"
    ],
    "experienceLevel": "intermediate",
    "fitnessBackground": "Experience (derived): intermediate. Running 10–25 km a week. Wants to train about 3 days a week, 45 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "get-fit"
      ],
      "exerciseTypes": [
        "cardio"
      ],
      "facilities": [],
      "sports": [
        "Running"
      ],
      "coachingStyle": "balanced",
      "lengthWeeks": 10,
      "startDate": "2026-09-28",
      "daysPerWeek": 3
    },
    "gymAccess": false,
    "programWeek": 1
  },
  /** Recomp at home with bodyweight only, 3 × 30 min. */
  homeBodyweight: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "physique",
      "statement": "Get leaner and more toned (long-term)",
      "starting": {
        "level": "beginner",
        "lifting": "none"
      },
      "constraints": {
        "daysPerWeek": 3,
        "sessionMinutes": 30,
        "facilities": [
          "yoga-mat"
        ]
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "nutrition",
        "coaching-tone",
        "focus-areas"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "physique": {
        "change": "recomp"
      }
    },
    "goals": [
      "Get leaner and more toned (long-term)"
    ],
    "experienceLevel": "beginner",
    "fitnessBackground": "Experience (derived): beginner. Lifting: none. Wants to train about 3 days a week, 30 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "look-great"
      ],
      "exerciseTypes": [
        "weights",
        "cardio"
      ],
      "facilities": [
        "yoga-mat"
      ],
      "sports": [],
      "coachingStyle": "balanced",
      "lengthWeeks": 12,
      "startDate": "2026-09-28",
      "daysPerWeek": 3
    },
    "gymAccess": false,
    "programWeek": 1
  },
  /** All-round strength with weights at home, 3 × 45 min. */
  homeWeights: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "strength",
      "statement": "All-round strength",
      "starting": {
        "level": "returning",
        "lifting": "on-off"
      },
      "constraints": {
        "daysPerWeek": 3,
        "sessionMinutes": 45,
        "facilities": [
          "weights-at-home"
        ]
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "coaching-tone"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "strength": {
        "kind": "all-round"
      }
    },
    "goals": [
      "All-round strength"
    ],
    "experienceLevel": "returning",
    "fitnessBackground": "Experience (derived): returning. Lifting: on and off. Wants to train about 3 days a week, 45 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "get-strong"
      ],
      "exerciseTypes": [
        "weights"
      ],
      "facilities": [
        "weights-at-home"
      ],
      "sports": [],
      "coachingStyle": "balanced",
      "lengthWeeks": 12,
      "startDate": "2026-09-28",
      "daysPerWeek": 3
    },
    "gymAccess": true,
    "programWeek": 1
  },
  /** In-season rugby player wanting power, match on Saturday, 2 × 45 min. */
  rugby: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "sport",
      "statement": "Rugby: in-season training to support my sport",
      "starting": {
        "level": "intermediate"
      },
      "constraints": {
        "daysPerWeek": 2,
        "sessionMinutes": 45,
        "facilities": [
          "full-gym"
        ]
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "coaching-tone"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "sport": {
        "name": "Rugby",
        "season": "in",
        "fixed": [
          {
            "day": "Sat",
            "kind": "match"
          }
        ],
        "wants": [
          "power"
        ]
      }
    },
    "goals": [
      "Rugby: in-season training to support my sport"
    ],
    "experienceLevel": "intermediate",
    "fitnessBackground": "Experience (derived): intermediate. Plays Rugby (in season). Wants to train about 2 days a week, 45 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "get-fit",
        "get-strong"
      ],
      "exerciseTypes": [
        "weights"
      ],
      "facilities": [
        "full-gym"
      ],
      "sports": [],
      "coachingStyle": "balanced",
      "lengthWeeks": 12,
      "startDate": "2026-09-28",
      "daysPerWeek": 2
    },
    "gymAccess": true,
    "programWeek": 1
  },
  /** New lifter, all-round strength in a gym, 3 × 45 min. */
  gymAllRound: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "strength",
      "statement": "All-round strength",
      "starting": {
        "level": "beginner",
        "lifting": "none"
      },
      "constraints": {
        "daysPerWeek": 3,
        "sessionMinutes": 45,
        "facilities": [
          "full-gym"
        ]
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "coaching-tone"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "strength": {
        "kind": "all-round"
      }
    },
    "goals": [
      "All-round strength"
    ],
    "experienceLevel": "beginner",
    "fitnessBackground": "Experience (derived): beginner. Lifting: none. Wants to train about 3 days a week, 45 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "get-strong"
      ],
      "exerciseTypes": [
        "weights"
      ],
      "facilities": [
        "full-gym"
      ],
      "sports": [],
      "coachingStyle": "balanced",
      "lengthWeeks": 12,
      "startDate": "2026-09-28",
      "daysPerWeek": 3
    },
    "gymAccess": true,
    "programWeek": 1
  },
  /** The gym lifter above, with a knee niggle. */
  kneeLifter: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "strength",
      "statement": "Bigger squat, bench and deadlift",
      "starting": {
        "level": "advanced",
        "lifting": "1y+"
      },
      "constraints": {
        "daysPerWeek": 3,
        "sessionMinutes": 60,
        "facilities": [
          "full-gym"
        ]
      },
      "health": {
        "flags": [
          "injury"
        ]
      },
      "deferred": [
        "coaching-tone"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "strength": {
        "kind": "lifts"
      }
    },
    "goals": [
      "Bigger squat, bench and deadlift"
    ],
    "experienceLevel": "advanced",
    "fitnessBackground": "Experience (derived): advanced. Lifting: consistently, a year+. Wants to train about 3 days a week, 60 min a session.",
    "injuries": [
      "Left knee aches on stairs"
    ],
    "program": {
      "goals": [
        "get-strong"
      ],
      "exerciseTypes": [
        "weights"
      ],
      "facilities": [
        "full-gym"
      ],
      "sports": [],
      "coachingStyle": "balanced",
      "lengthWeeks": 12,
      "startDate": "2026-09-28",
      "daysPerWeek": 3
    },
    "gymAccess": true,
    "programWeek": 1
  },
  /** Half marathon on 2027-03-14 aiming for 1:45:00, 4 × 60 min. */
  halfMarathoner: {
    "goal": {
      "version": 1,
      "origin": "onboarding",
      "pursuit": "event",
      "statement": "Half marathon on Sun 14 Mar 2027 (24 weeks), aiming for 1:45:00",
      "starting": {
        "level": "intermediate",
        "runKmPerWeek": [
          10,
          25
        ],
        "recentResult": {
          "meters": 5000,
          "seconds": 1470
        }
      },
      "constraints": {
        "daysPerWeek": 4,
        "sessionMinutes": 60,
        "facilities": [
          "full-gym"
        ],
        "strengthWork": true
      },
      "health": {
        "flags": []
      },
      "deferred": [
        "runs-with",
        "coaching-tone",
        "long-run-day"
      ],
      "createdAt": "2026-10-01T19:00:00.000Z",
      "updatedAt": "2026-10-01T19:00:00.000Z",
      "event": {
        "kind": "half",
        "date": "2027-03-14",
        "aim": "time",
        "targetSeconds": 6300
      }
    },
    "goals": [
      "Half marathon on Sun 14 Mar 2027 (24 weeks), aiming for 1:45:00"
    ],
    "experienceLevel": "intermediate",
    "fitnessBackground": "Experience (derived): intermediate. Running 10–25 km a week. Recent result: 5K in 24:30. Wants to train about 4 days a week, 60 min a session.",
    "injuries": [],
    "program": {
      "goals": [
        "get-fit"
      ],
      "exerciseTypes": [
        "cardio",
        "weights"
      ],
      "facilities": [
        "full-gym"
      ],
      "sports": [
        "Running"
      ],
      "coachingStyle": "balanced",
      "lengthWeeks": 24,
      "startDate": "2026-09-28",
      "daysPerWeek": 4
    },
    "gymAccess": true,
    "programWeek": 1
  },
} satisfies Record<string, Partial<UserProfile>>
