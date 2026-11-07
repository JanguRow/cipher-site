import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useStore = defineStore('store', () => {
  const encryptedText = ref('')

  function setEncryptedText(value: string) {
    encryptedText.value = value
  }

  return { encryptedText, setEncryptedText }
})
