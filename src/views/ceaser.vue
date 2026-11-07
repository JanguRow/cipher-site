<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { useEventListener } from '@vueuse/core'

// Change this import to your existing Pinia store.
import { useStore } from '@/store'

const cipherStore = useStore()
const { encryptedText } = storeToRefs(cipherStore)

// Constants
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const letters = alphabet.split('')
const LETTER_ANGLE = 360 / 26

// State
const message = ref('')
const rotationDegrees = ref(0)
const isDragging = ref(false)

// Template refs
const wheelRef = ref<HTMLDivElement | null>(null)
const innerWheelRef = ref<HTMLDivElement | null>(null)

// Continuous positive and negative shifts
const shift = computed<number>({
  get() {
    return Math.round(-rotationDegrees.value / LETTER_ANGLE)
  },

  set(value) {
    if (!Number.isFinite(value)) return

    rotationDegrees.value = -Math.trunc(value) * LETTER_ANGLE
  },
})
const showShift = computed(() => (shift.value < 0 || shift.value > 25 ? '1' : '0'))

const normalizedShift = computed(() => ((shift.value % 26) + 26) % 26)

// Position letters around their circles
function letterPosition(index: number, radius: number) {
  const angle = index * ((2 * Math.PI) / 26) - Math.PI / 2

  return {
    left: `${50 + radius * Math.cos(angle)}%`,
    top: `${50 + radius * Math.sin(angle)}%`,
  }
}

// Button rotation
function rotateWheel(amount: number): void {
  shift.value += amount
}

// -------------------------------
// Mouse / Touch / Stylus dragging
// -------------------------------

let activePointerId: number | null = null
let previousAngle = 0

function getPointerAngle(event: PointerEvent): number {
  if (!wheelRef.value) return 0

  const rect = wheelRef.value.getBoundingClientRect()

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  return Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI)
}

// Begin dragging
function startDrag(event: PointerEvent): void {
  if (!innerWheelRef.value || !wheelRef.value) return

  // Ignore additional fingers while dragging.
  if (activePointerId !== null) return

  // Ignore right-click and other mouse buttons.
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  event.preventDefault()

  activePointerId = event.pointerId
  previousAngle = getPointerAngle(event)
  isDragging.value = true

  // Keep receiving events even when the finger
  // moves outside the wheel.
  innerWheelRef.value.setPointerCapture(event.pointerId)
}

// Follow finger or mouse movement
function moveDrag(event: PointerEvent): void {
  if (!isDragging.value) return
  if (event.pointerId !== activePointerId) return

  const currentAngle = getPointerAngle(event)

  let delta = currentAngle - previousAngle

  // Prevent jumps when crossing +/-180 degrees.
  if (delta > 180) {
    delta -= 360
  } else if (delta < -180) {
    delta += 360
  }

  rotationDegrees.value += delta
  previousAngle = currentAngle
}

// Finish dragging and snap to nearest letter
function stopDrag(event: PointerEvent): void {
  if (event.pointerId !== activePointerId) return

  activePointerId = null
  isDragging.value = false

  const nearestShift = Math.round(-rotationDegrees.value / LETTER_ANGLE)

  rotationDegrees.value = -nearestShift * LETTER_ANGLE
}

// VueUse handles listener registration and cleanup.
useEventListener(innerWheelRef, 'pointerdown', startDrag)
useEventListener(innerWheelRef, 'pointermove', moveDrag)
useEventListener(innerWheelRef, 'pointerup', stopDrag)
useEventListener(innerWheelRef, 'pointercancel', stopDrag)
useEventListener(innerWheelRef, 'lostpointercapture', stopDrag)

// -------------------------------
// Encryption
// -------------------------------

function encrypt(text: string, amount: number): string {
  return text
    .toUpperCase()
    .split('')
    .map((char) => {
      const index = alphabet.indexOf(char)

      if (index === -1) return char

      return alphabet.charAt((index + amount) % 26)
    })
    .join('')
}

// Update Pinia automatically
watch(
  [message, normalizedShift],
  ([text, amount]) => {
    encryptedText.value = encrypt(text, amount)
  },
  { immediate: true },
)
</script>

<template>
  <main class="cipher-container">
    <h1>Caesar Cipher Wheel</h1>

    <p class="subtitle">Drag the inner wheel or use the buttons.</p>

    <div class="cipher-layout">
      <!-- LEFT: Wheel and controls -->
      <section class="wheel-section">
        <div ref="wheelRef" class="wheel">
          <span
            v-for="(letter, index) in letters"
            :key="`outer-${index}`"
            class="letter outer-letter"
            :style="letterPosition(index, 43)"
          >
            {{ letter }}
          </span>

          <div
            ref="innerWheelRef"
            class="inner-wheel"
            :class="{ dragging: isDragging }"
            :style="{
              '--rotation': `${rotationDegrees}deg`,
              '--counter-rotation': `${-rotationDegrees}deg`,
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

          <div class="wheel-center">
            <span>SHIFT</span>
            <strong>{{ shift }}</strong>
          </div>
        </div>

        <div class="controls">
          <button type="button" aria-label="Decrease shift" @click="rotateWheel(-1)">−</button>

          <div class="shift-display">
            <input v-model.number="shift" type="number" aria-label="Cipher shift" />
          </div>

          <button type="button" aria-label="Increase shift" @click="rotateWheel(1)">+</button>
        </div>

        <p class="effective-shift" :style="{ opacity: showShift }">
          Effective cipher shift: {{ normalizedShift }}
        </p>
      </section>

      <!-- RIGHT: Text input and result -->
      <section class="message-section">
        <label for="cipher-message">Your message</label>

        <textarea
          id="cipher-message"
          v-model="message"
          placeholder="Enter a message..."
          rows="5"
        ></textarea>

        <div class="result">
          <div class="result-header">
            <span>Encrypted message</span>
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
  --primary: #1b998b;
  --accent: #ffd166;
  --dark: #123c37;
  --light: #f6f8fb;

  min-height: 100vh;
  padding: 30px 16px;
  box-sizing: border-box;

  background: var(--light);
  color: var(--dark);
  font-family: Arial, sans-serif;
  text-align: center;
}

h1 {
  margin: 0 0 10px;
  color: black;
}

.subtitle {
  color: #52736e;
  font-size: 14px;
}

/* Outer wheel */
.wheel {
  position: relative;

  width: min(350px, 90vw);
  aspect-ratio: 1;

  margin: 30px auto;
  border-radius: 50%;
  background: var(--primary);

  box-shadow: 0 8px 25px rgba(27, 153, 139, 0.18);

  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Draggable inner wheel */
.inner-wheel {
  position: absolute;

  width: 71.4286%;
  height: 71.4286%;
  top: 50%;
  left: 50%;

  border-radius: 50%;
  background: var(--accent);
  border: 3px solid var(--dark);
  box-sizing: border-box;

  transform: translate(-50%, -50%) rotate(var(--rotation));

  transition: transform 0.2s ease;

  /* Critical for touchscreen dragging */
  touch-action: none;
  -ms-touch-action: none;

  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;

  cursor: grab;
}

/* No animation lag while dragging */
.inner-wheel.dragging {
  transition: none;
  cursor: grabbing;
}

/* Letters */
.letter {
  position: absolute;

  transform: translate(-50%, -50%);

  font-size: clamp(11px, 3.6vw, 15px);
  font-weight: bold;

  user-select: none;
  -webkit-user-select: none;

  pointer-events: none;
}

.outer-letter {
  color: white;
}

.inner-letter {
  color: var(--dark);

  /* Counter-rotation keeps letters upright */
  transform: translate(-50%, -50%) rotate(var(--counter-rotation));

  transition: transform 0.2s ease;
}

.inner-wheel.dragging .inner-letter {
  transition: none;
}

/* Centre */
.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;

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
  font-size: 26px;
}

/* Controls */
.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;

  margin-top: 20px;
}

button {
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

button:hover {
  background: #147d72;
}

button:active {
  transform: scale(0.95);
}

.shift-display {
  min-width: 80px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.shift-display span {
  font-size: 12px;
  color: Black;
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

  /* Remove default input appearance */
  appearance: textfield;
  -moz-appearance: textfield;
}

/* Remove number input spinner arrows */
.shift-display input::-webkit-inner-spin-button,
.shift-display input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Subtle focus indicator */
.shift-display input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
  border-radius: 4px;
}

.effective-shift {
  font-size: 12px;
  color: #52736e;
}

/* Message */
.message-section {
  max-width: 400px;
  margin: 35px auto 0;

  display: flex;
  flex-direction: column;
  gap: 12px;

  text-align: left;
}

.message-section label {
  font-size: 14px;
  font-weight: bold;
}

textarea {
  width: 100%;
  box-sizing: border-box;

  padding: 14px;
  border: 2px solid #c6e5df;
  border-radius: 4px;

  background: white;
  color: var(--dark);
  font-family: inherit;
  font-size: 16px;
  resize: vertical;
  outline: none;
}

textarea:focus {
  border-color: var(--primary);
}

/* Encrypted output */
.result {
  padding: 18px;
  margin-top: 8px;

  background: white;
  border: 1px solid black;
  border-radius: 4px;
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

/* Mobile */
@media (max-width: 400px) {
  .wheel-center {
    width: 75px;
    height: 75px;
  }

  .wheel-center strong {
    font-size: 22px;
  }
}

/* Mobile-first: stacked layout */
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

.message-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-width: 450px;
  min-width: 0;
  margin: 0 auto;
}

/* Ensure wheel fits its container */
.wheel {
  width: min(350px, 100%);
  margin: 20px auto;
}

/* Desktop: wheel left, text right */
@media (min-width: 850px) {
  .cipher-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 60px;
  }

  .wheel-section {
    width: 100%;
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
</style>
