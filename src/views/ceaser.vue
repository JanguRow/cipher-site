<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventListener, useTitle } from '@vueuse/core'

// Adjust this import to match your project.
import { useStore } from '@/store'

const cipherStore = useStore()
const { encryptedText } = storeToRefs(cipherStore)

type CipherMode = 'encrypt' | 'decrypt'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const letters = alphabet.split('')
const LETTER_ANGLE = 360 / 26

// State
const mode = ref<CipherMode>('encrypt')
const message = ref('')
const rotationDegrees = ref(0)
const isDragging = ref(false)
const animateMotion = ref(false)

const title = computed(() =>
  mode.value === 'encrypt' ? 'Encrypt | Caesar Cipher' : 'Decrypt | Caesar Cipher',
)

useTitle(title)

// Template refs
const wheelRef = ref<HTMLDivElement | null>(null)
const outerWheelRef = ref<HTMLDivElement | null>(null)
const innerWheelRef = ref<HTMLDivElement | null>(null)

// Shift may be positive or negative, without limits.
const shift = computed<number>({
  get() {
    return Math.round(-rotationDegrees.value / LETTER_ANGLE)
  },

  set(value) {
    const number = Number(value)

    if (!Number.isFinite(number)) return

    rotationDegrees.value = -Math.trunc(number) * LETTER_ANGLE
  },
})

const shownormlized = computed(() => (shift.value < 0 || shift.value > 25 ? '1' : '0'))

const normalizedShift = computed(() => ((shift.value % 26) + 26) % 26)

// Only the active wheel rotates.
const outerRotation = computed(() => (mode.value === 'decrypt' ? rotationDegrees.value : 0))

const innerRotation = computed(() => (mode.value === 'encrypt' ? rotationDegrees.value : 0))

// Position alphabet letters around a circle.
function letterPosition(index: number, radius: number) {
  const angle = index * ((2 * Math.PI) / 26) - Math.PI / 2

  return {
    left: `${50 + radius * Math.cos(angle)}%`,
    top: `${50 + radius * Math.sin(angle)}%`,
  }
}

// Switch modes without spinning the inactive wheel
// through all its previous revolutions.
function setMode(nextMode: CipherMode): void {
  if (mode.value === nextMode) return

  // End an active drag if necessary.
  if (activePointerId !== null) {
    finishDrag()
  }

  animateMotion.value = false
  mode.value = nextMode
}

// Rotate using the buttons.
function rotateWheel(amount: number): void {
  animateMotion.value = true
  shift.value += amount
}

// Editable shift input.
// Keeping a draft allows typing negative numbers.
const shiftInput = ref('0')
const editingShift = ref(false)

watch(
  shift,
  (value) => {
    if (!editingShift.value) {
      shiftInput.value = String(value)
    }
  },
  { immediate: true },
)

function commitShift(): void {
  const raw = shiftInput.value.trim()

  if (raw !== '') {
    const value = Number(raw)

    if (Number.isFinite(value)) {
      animateMotion.value = true
      shift.value = Math.trunc(value)
    }
  }

  editingShift.value = false
  shiftInput.value = String(shift.value)
}

function onShiftEnter(event: KeyboardEvent): void {
  ;(event.target as HTMLInputElement).blur()
}

// ----------------------------------
// Touch / mouse / stylus dragging
// ----------------------------------

let activePointerId: number | null = null
let activeElement: HTMLDivElement | null = null
let previousAngle = 0

function getPointerAngle(event: PointerEvent): number {
  if (!wheelRef.value) return 0

  const rect = wheelRef.value.getBoundingClientRect()

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  return Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI)
}

function startDrag(event: PointerEvent, targetMode: CipherMode): void {
  // Only the correct wheel is draggable.
  if (mode.value !== targetMode) return
  if (activePointerId !== null) return
  if (!event.isPrimary) return

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  const element = targetMode === 'encrypt' ? innerWheelRef.value : outerWheelRef.value

  if (!element || !wheelRef.value) return

  event.preventDefault()

  activePointerId = event.pointerId
  activeElement = element
  previousAngle = getPointerAngle(event)

  isDragging.value = true
  animateMotion.value = false

  // Continue receiving events even when the finger
  // moves beyond the wheel.
  element.setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent): void {
  if (!isDragging.value) return
  if (event.pointerId !== activePointerId) return

  const currentAngle = getPointerAngle(event)

  let delta = currentAngle - previousAngle

  // Handle crossing the +/-180 degree boundary.
  if (delta > 180) {
    delta -= 360
  } else if (delta < -180) {
    delta += 360
  }

  rotationDegrees.value += delta
  previousAngle = currentAngle
}

function finishDrag(): void {
  const pointerId = activePointerId
  const element = activeElement

  activePointerId = null
  activeElement = null
  isDragging.value = false

  // Snap to the nearest letter.
  const nearestShift = Math.round(-rotationDegrees.value / LETTER_ANGLE)

  animateMotion.value = true
  rotationDegrees.value = -nearestShift * LETTER_ANGLE

  if (pointerId !== null && element?.hasPointerCapture(pointerId)) {
    element.releasePointerCapture(pointerId)
  }
}

function stopDrag(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return
  finishDrag()
}

// Attach listeners through VueUse.
useEventListener(outerWheelRef, 'pointerdown', (event) => {
  startDrag(event, 'decrypt')
})

useEventListener(innerWheelRef, 'pointerdown', (event) => {
  startDrag(event, 'encrypt')
})

// Pointer events bubble to the stationary wheel.
useEventListener(wheelRef, 'pointermove', moveDrag)
useEventListener(wheelRef, 'pointerup', stopDrag)
useEventListener(wheelRef, 'pointercancel', stopDrag)
useEventListener(wheelRef, 'lostpointercapture', stopDrag)

// ----------------------------------
// Encryption / decryption
// ----------------------------------

const transformedText = computed<string>(() => {
  const amount = mode.value === 'encrypt' ? normalizedShift.value : -normalizedShift.value

  return message.value
    .toUpperCase()
    .split('')
    .map((char) => {
      const index = alphabet.indexOf(char)

      if (index === -1) return char

      const newIndex = (((index + amount) % 26) + 26) % 26

      return alphabet.charAt(newIndex)
    })
    .join('')
})

// Keep your existing Pinia state updated.
// In decrypt mode, encryptedText holds decrypted output.
watch(
  transformedText,
  (value) => {
    encryptedText.value = value
  },
  { immediate: true },
)
</script>

<template>
  <main class="cipher-container">
    <h1>Caesar Cipher Wheel</h1>

    <!-- Encrypt / Decrypt toggle -->
    <div class="mode-toggle" role="group" aria-label="Cipher mode">
      <button
        type="button"
        :class="{ selected: mode === 'encrypt' }"
        :aria-pressed="mode === 'encrypt'"
        @click="setMode('encrypt')"
      >
        Encrypt
      </button>

      <button
        type="button"
        :class="{ selected: mode === 'decrypt' }"
        :aria-pressed="mode === 'decrypt'"
        @click="setMode('decrypt')"
      >
        Decrypt
      </button>
    </div>

    <p class="subtitle">
      Rotate the
      <b>{{ mode === 'encrypt' ? 'inner wheel' : 'outer wheel' }}</b>
      {{ mode === 'encrypt' ? 'to encrypt.' : 'to decrypt.' }}
    </p>

    <div class="cipher-layout">
      <!-- Wheel -->
      <section class="wheel-section">
        <div ref="wheelRef" class="wheel">
          <!-- Outer wheel -->
          <div
            ref="outerWheelRef"
            class="disc outer-wheel"
            :class="{
              active: mode === 'decrypt',
              dragging: isDragging && mode === 'decrypt',
              animated: animateMotion,
            }"
            :style="{
              '--disc-angle': `${outerRotation}deg`,
            }"
            @contextmenu.prevent
          >
            <span
              v-for="(letter, index) in letters"
              :key="`outer-${index}`"
              class="letter outer-letter"
              :style="letterPosition(index, 43)"
            >
              {{ letter }}
            </span>
          </div>

          <!-- Inner wheel -->
          <div
            ref="innerWheelRef"
            class="disc inner-wheel"
            :class="{
              active: mode === 'encrypt',
              dragging: isDragging && mode === 'encrypt',
              animated: animateMotion,
            }"
            :style="{
              '--disc-angle': `${innerRotation}deg`,
            }"
            @contextmenu.prevent
          >
            <span
              v-for="(letter, index) in letters"
              :key="`inner-${index}`"
              class="letter inner-letter"
              :style="letterPosition(index, 39)"
            >
              {{ letter }}
            </span>
          </div>

          <!-- Fixed centre label -->
          <div class="wheel-center">
            <span>SHIFT</span>
            <strong>{{ shift }}</strong>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button
            type="button"
            class="shift-button"
            aria-label="Decrease shift"
            @click="rotateWheel(-1)"
          >
            −
          </button>

          <div class="shift-display">
            <input id="shift-input" v-model="shift" type="number" step="1" />
          </div>

          <button
            type="button"
            class="shift-button"
            aria-label="Increase shift"
            @click="rotateWheel(1)"
          >
            +
          </button>
        </div>

        <p class="effective-shift" :style="{ opacity: shownormlized }">
          Effective cipher shift: {{ normalizedShift }}
        </p>
      </section>

      <!-- Input and output -->
      <section class="message-section">
        <label for="cipher-message">
          {{ mode === 'encrypt' ? 'Message to encrypt' : 'Message to decrypt' }}
        </label>

        <textarea
          id="cipher-message"
          v-model="message"
          :placeholder="
            mode === 'encrypt' ? 'Enter your plaintext...' : 'Enter your encrypted text...'
          "
          rows="6"
        ></textarea>

        <div class="result">
          <div class="result-header">
            <span>
              {{ mode === 'encrypt' ? 'Encrypted message' : 'Decrypted message' }}
            </span>
          </div>

          <p>
            {{ encryptedText || 'Your result will appear here...' }}
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.cipher-container {
  min-height: 100vh;
  padding: 32px 16px;
  box-sizing: border-box;
  background: var(--light);
  color: var(--dark);
  font-family: Arial, sans-serif;
  text-align: center;
}

h1 {
  margin: 0 0 24px;
  color: black;
}

/* Mode toggle */

.mode-toggle {
  display: inline-flex;
  padding: 5px;
  gap: 4px;
  border-radius: 12px;
  background: #d8ebe7;
}

.mode-toggle button {
  min-width: 120px;
  padding: 12px 20px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--dark);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.mode-toggle button.selected {
  background: var(--primary);
  color: white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 1px solid var(--primary);
}

.subtitle {
  margin: 20px 0;
  color: #52736e;
  font-size: 14px;
}

/* Responsive layout */

.cipher-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.wheel-section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Stationary wheel container */

.wheel {
  position: relative;
  width: min(350px, 100%);
  aspect-ratio: 1;
  margin: 20px auto;
  border-radius: 50%;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Both rotating discs */

.disc {
  position: absolute;
  border-radius: 50%;
  box-sizing: border-box;
  transform-origin: center;
  user-select: none;
  -webkit-user-select: none;
}

.disc.active {
  cursor: grab;
  touch-action: none;
}

.disc.dragging {
  cursor: grabbing;
}

/* Animate button changes and snap-to-letter */
.outer-wheel.animated,
.inner-wheel.animated {
  transition: transform 0.2s ease;
}

.disc.animated .letter {
  transition: transform 0.2s ease;
}

/* Outer wheel */

.outer-wheel {
  inset: 0;
  z-index: 1;
  background: var(--primary);

  box-shadow: 0 8px 25px rgba(27, 153, 139, 0.18);

  transform: rotate(var(--disc-angle));
}

/* Inner wheel */

.inner-wheel {
  width: 71.4286%;
  height: 71.4286%;
  top: 50%;
  left: 50%;
  z-index: 2;

  background: var(--accent);
  border: 3px solid var(--dark);

  transform: translate(-50%, -50%) rotate(var(--disc-angle));
}

/* Letters */

.letter {
  position: absolute;
  font-size: clamp(11px, 3.6vw, 15px);
  font-weight: bold;

  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;

  /* Cancel the rotation of the parent disc */
  transform: translate(-50%, -50%) rotate(calc(-1 * var(--disc-angle)));
}

.outer-letter {
  color: white;
}

.inner-letter {
  color: var(--dark);
}

/* Fixed centre */

.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;

  width: 90px;
  height: 90px;

  transform: translate(-50%, -50%);

  border-radius: 50%;
  background: var(--dark);
  color: white;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 5px;

  pointer-events: none;
  box-shadow: 0 0 0 3px var(--accent);
}

.wheel-center span {
  font-size: 12px;
  letter-spacing: 1px;
}

.wheel-center strong {
  font-size: 25px;
}

/* Shift controls */

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
}

.shift-button {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 12px;
  background: var(--primary);
  color: white;
  font-size: 24px;
  cursor: pointer;
  touch-action: manipulation;
}

.shift-button:hover {
  background: #147d72;
}

.shift-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
}

.shift-display label {
  font-size: 12px;
  color: #52736e;
}

.shift-display input {
  width: 80px;
  padding: 0;
  margin: 0;

  border: none;
  outline: none;
  background: transparent;

  color: black;
  font-size: 24px;
  font-weight: bold;
  font-family: inherit;
  text-align: center;

  appearance: textfield;
  -moz-appearance: textfield;
}

.shift-display input::-webkit-inner-spin-button,
.shift-display input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.shift-display input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
  border-radius: 4px;
}

.effective-shift {
  font-size: 12px;
  color: #52736e;
}

/* Message section */

.message-section {
  width: 100%;
  max-width: 450px;
  min-width: 0;
  margin: 0 auto;

  display: flex;
  flex-direction: column;
  gap: 12px;

  text-align: left;
}

.message-section > label {
  font-size: 14px;
  font-weight: bold;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 14px;

  border: 2px solid #c6e5df;
  border-radius: 10px;

  background: white;
  color: var(--dark);
  font-family: inherit;
  font-size: 16px;

  resize: vertical;
}

textarea:focus {
  border-color: var(--primary);
}

/* Output */

.result {
  padding: 18px;
  margin-top: 8px;
  border: 1px solid var(--primary);
  border-radius: 12px;
  background: white;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.result-header > span:first-child {
  font-size: 13px;
  font-weight: bold;
}

.result-tag {
  padding: 5px 8px;
  border-radius: 5px;
  background: var(--accent);
  color: var(--dark);
  font-size: 10px;
  font-weight: bold;
}

.result p {
  margin-bottom: 0;
  font-size: 18px;
  font-weight: bold;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* Desktop layout */

@media (min-width: 850px) {
  .cipher-layout {
    grid-template-columns:
      minmax(0, 1fr)
      minmax(0, 1fr);
    align-items: center;
    gap: 60px;
  }

  .message-section {
    max-width: none;
    margin: 0;
  }

  .cipher-container {
    padding: 50px 32px;
  }
}

/* Large desktop */

@media (min-width: 1200px) {
  .cipher-layout {
    gap: 100px;
  }

  .wheel {
    width: 380px;
  }
}

/* Small phones */

@media (max-width: 400px) {
  .wheel-center {
    width: 75px;
    height: 75px;
  }

  .wheel-center strong {
    font-size: 22px;
  }

  .mode-toggle button {
    min-width: 105px;
  }
}
</style>
