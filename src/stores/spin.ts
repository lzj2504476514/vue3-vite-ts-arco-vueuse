export const useSpinStore = defineStore('spin', () => {
  const visible = ref(false)
  function setSpinVisible(spinVisible: boolean) {
    visible.value = spinVisible
  }
  return { visible, setSpinVisible }
})
