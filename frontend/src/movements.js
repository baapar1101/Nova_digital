const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const frame = (at, pan, tilt) => ({ at, pan, tilt })

export const MOVEMENT_CATEGORIES = [
  { id: 'social', label: 'Social' },
  { id: 'dance', label: 'Dance' },
  { id: 'emotion', label: 'Emotion' },
  { id: 'idle', label: 'Idle' },
]

export const MOVEMENTS = [
  {
    id: 'hello',
    category: 'social',
    label: 'Hello',
    description: 'A warm side-to-side greeting with a soft head lift.',
    duration: 3400,
    face: 'winking',
    frames: [
      frame(0.00, 0, 0),
      frame(0.15, -24, 6),
      frame(0.30, 28, 10),
      frame(0.46, -20, 8),
      frame(0.63, 22, 12),
      frame(0.82, 8, 6),
      frame(1.00, 0, 0),
    ],
  },
  {
    id: 'yes',
    category: 'social',
    label: 'Yes',
    description: 'Two gentle nods with a small attentive sway.',
    duration: 2700,
    face: 'blinking',
    frames: [
      frame(0.00, 0, 2),
      frame(0.18, 4, 18),
      frame(0.34, -3, 4),
      frame(0.52, 3, 21),
      frame(0.70, -2, 5),
      frame(1.00, 0, 0),
    ],
  },
  {
    id: 'no',
    category: 'social',
    label: 'No',
    description: 'A smooth, friendly head shake rather than a hard stop.',
    duration: 3000,
    face: 'blinking',
    frames: [
      frame(0.00, 0, 4),
      frame(0.16, -30, 7),
      frame(0.34, 32, 8),
      frame(0.52, -25, 7),
      frame(0.70, 24, 6),
      frame(1.00, 0, 0),
    ],
  },
  {
    id: 'curious',
    category: 'social',
    label: 'Curious',
    description: 'Leans into a question, pauses, then returns naturally.',
    duration: 4300,
    face: 'blinking',
    frames: [
      frame(0.00, 0, 0),
      frame(0.20, 16, 10),
      frame(0.42, 30, 28),
      frame(0.62, 24, 31),
      frame(0.78, 10, 18),
      frame(1.00, 0, 0),
    ],
  },

  {
    id: 'groove',
    category: 'dance',
    label: 'Groove',
    description: 'A balanced rhythmic sway with soft vertical accents.',
    duration: 6200,
    face: 'giggling',
    frames: [
      frame(0.00, 0, 4),
      frame(0.10, -28, 10),
      frame(0.20, 0, 20),
      frame(0.30, 30, 10),
      frame(0.40, 0, 25),
      frame(0.50, -34, 12),
      frame(0.60, 0, 29),
      frame(0.70, 34, 12),
      frame(0.80, 0, 22),
      frame(0.90, -18, 8),
      frame(1.00, 0, 4),
    ],
  },
  {
    id: 'bounce',
    category: 'dance',
    label: 'Bounce',
    description: 'Bouncy beat-driven tilts with compact left-right motion.',
    duration: 5200,
    face: 'giggling',
    frames: [
      frame(0.00, 0, 4),
      frame(0.10, -12, 22),
      frame(0.20, 12, 6),
      frame(0.30, -16, 25),
      frame(0.40, 16, 7),
      frame(0.50, -18, 28),
      frame(0.60, 18, 8),
      frame(0.70, -14, 23),
      frame(0.80, 14, 6),
      frame(0.90, 0, 15),
      frame(1.00, 0, 4),
    ],
  },
  {
    id: 'swing',
    category: 'dance',
    label: 'Swing',
    description: 'Long, elegant arcs for a slower musical movement.',
    duration: 7000,
    face: 'loving',
    frames: [
      frame(0.00, 0, 7),
      frame(0.12, -42, 12),
      frame(0.25, -18, 26),
      frame(0.38, 38, 14),
      frame(0.50, 18, 30),
      frame(0.63, -38, 15),
      frame(0.76, -16, 24),
      frame(0.88, 32, 11),
      frame(1.00, 0, 7),
    ],
  },
  {
    id: 'celebrate',
    category: 'dance',
    label: 'Celebrate',
    description: 'A lively finish with quick turns and an upbeat lift.',
    duration: 5000,
    face: 'heart-eying',
    frames: [
      frame(0.00, 0, 3),
      frame(0.12, -38, 14),
      frame(0.24, 40, 22),
      frame(0.36, -30, 30),
      frame(0.50, 32, 38),
      frame(0.64, -22, 24),
      frame(0.78, 20, 34),
      frame(0.90, 0, 18),
      frame(1.00, 0, 3),
    ],
  },

  {
    id: 'happy',
    category: 'emotion',
    label: 'Happy',
    description: 'Small joyful bobs and playful side glances.',
    duration: 4500,
    face: 'giggling',
    frames: [
      frame(0.00, 0, 4),
      frame(0.14, -16, 16),
      frame(0.28, 14, 7),
      frame(0.42, -12, 20),
      frame(0.56, 16, 8),
      frame(0.70, -8, 18),
      frame(0.84, 10, 9),
      frame(1.00, 0, 4),
    ],
  },
  {
    id: 'love-sway',
    category: 'emotion',
    label: 'Love sway',
    description: 'Slow affectionate sways paired with the heart expression.',
    duration: 6600,
    face: 'heart-eying',
    frames: [
      frame(0.00, 0, 8),
      frame(0.18, -22, 14),
      frame(0.36, 20, 20),
      frame(0.54, -18, 24),
      frame(0.72, 18, 18),
      frame(0.88, 8, 12),
      frame(1.00, 0, 8),
    ],
  },
  {
    id: 'shy',
    category: 'emotion',
    label: 'Shy',
    description: 'Looks away, peeks back, and settles softly.',
    duration: 4700,
    face: 'winking',
    frames: [
      frame(0.00, 0, 4),
      frame(0.22, -26, 14),
      frame(0.44, -34, 28),
      frame(0.62, -12, 22),
      frame(0.78, 12, 11),
      frame(1.00, 0, 4),
    ],
  },
  {
    id: 'startled',
    category: 'emotion',
    label: 'Startled',
    description: 'A quick surprise reaction that resolves smoothly.',
    duration: 3100,
    face: 'afraiding',
    frames: [
      frame(0.00, 0, 3),
      frame(0.12, 0, 34),
      frame(0.24, -26, 26),
      frame(0.36, 26, 24),
      frame(0.50, -18, 20),
      frame(0.66, 14, 14),
      frame(1.00, 0, 3),
    ],
  },

  {
    id: 'breathe',
    category: 'idle',
    label: 'Breathe',
    description: 'Very subtle living motion for an always-on idle state.',
    duration: 7600,
    face: 'blinking',
    frames: [
      frame(0.00, 0, 5),
      frame(0.25, -4, 9),
      frame(0.50, 2, 12),
      frame(0.75, 5, 8),
      frame(1.00, 0, 5),
    ],
  },
  {
    id: 'scan',
    category: 'idle',
    label: 'Scan',
    description: 'Slow environmental scan without looking mechanical.',
    duration: 8200,
    face: 'blinking',
    frames: [
      frame(0.00, 0, 5),
      frame(0.18, -48, 8),
      frame(0.36, -18, 12),
      frame(0.54, 46, 9),
      frame(0.72, 20, 13),
      frame(0.88, -10, 7),
      frame(1.00, 0, 5),
    ],
  },
  {
    id: 'focus',
    category: 'idle',
    label: 'Focus',
    description: 'A calm attentive pose with tiny natural corrections.',
    duration: 5600,
    face: 'blinking',
    frames: [
      frame(0.00, 0, 6),
      frame(0.20, 7, 10),
      frame(0.40, -5, 12),
      frame(0.60, 4, 9),
      frame(0.80, -3, 8),
      frame(1.00, 0, 6),
    ],
  },
]

export function getMovementById(id) {
  return MOVEMENTS.find((movement) => movement.id === id) || MOVEMENTS[0]
}

function smootherStep(value) {
  const t = clamp(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function sampleMovement(movement, progress) {
  const t = clamp(progress, 0, 1)
  const frames = movement.frames

  if (t <= frames[0].at) {
    return { pan: frames[0].pan, tilt: frames[0].tilt }
  }

  for (let index = 1; index < frames.length; index += 1) {
    const next = frames[index]
    const previous = frames[index - 1]

    if (t <= next.at) {
      const span = next.at - previous.at || 1
      const local = smootherStep((t - previous.at) / span)

      return {
        pan: previous.pan + (next.pan - previous.pan) * local,
        tilt: previous.tilt + (next.tilt - previous.tilt) * local,
      }
    }
  }

  const last = frames[frames.length - 1]
  return { pan: last.pan, tilt: last.tilt }
}
