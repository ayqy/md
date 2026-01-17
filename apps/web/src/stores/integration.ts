/**
 * 集成配置 Store
 * 控制宿主桥指定的功能开关
 */
import { defineStore } from 'pinia'
import { reactive, ref, shallowRef } from 'vue'

export interface FeatureFlags {
  ai: boolean
  postManagement: boolean
  cssEditor: boolean
  exportPanel: boolean
  uploadImage: boolean
  writeAiCreate: boolean
  writeAiPolish: boolean
  writeAiIllustrate: boolean
}

export const defaultFeatureFlags: FeatureFlags = {
  ai: true,
  postManagement: true,
  cssEditor: true,
  exportPanel: true,
  uploadImage: true,
  writeAiCreate: false,
  writeAiPolish: false,
  writeAiIllustrate: false,
}

export const useIntegrationStore = defineStore(`integration`, () => {
  const featureFlags = reactive({ ...defaultFeatureFlags })
  const readOnly = ref(false)
  const changeHandler = shallowRef<((value: string) => void) | null>(null)

  function setFeatureFlags(next: Partial<FeatureFlags>) {
    Object.assign(featureFlags, next)
  }

  function resetFeatureFlags() {
    Object.assign(featureFlags, defaultFeatureFlags)
  }

  function setReadOnlyState(value: boolean) {
    readOnly.value = value
  }

  function setChangeHandler(fn: ((value: string) => void) | null) {
    changeHandler.value = fn
  }

  function emitChange(value: string) {
    changeHandler.value?.(value)
  }

  return {
    featureFlags,
    setFeatureFlags,
    resetFeatureFlags,
    readOnly,
    setReadOnlyState,
    setChangeHandler,
    emitChange,
  }
})
