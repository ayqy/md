<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/stores/editor'
import { useIntegrationStore } from '@/stores/integration'
import { toast } from '@/utils/toast'
import { Undo2 } from 'lucide-vue-next'

type WriteAssistAction = 'create' | 'polish' | 'illustrate'

type BridgeOk = { ok: true; markdown: string }
type BridgeErr = { ok: false; code: 'NEED_LOGIN' | 'NO_TOKEN' | 'ERROR'; message: string }
type BridgeResult = BridgeOk | BridgeErr

declare global {
  interface Window {
    __WRITE_ASSIST_BRIDGE__?: {
      runAction: (params: { action: WriteAssistAction; markdown: string; origin?: string }) => Promise<BridgeResult>
    }
  }
}

const editorStore = useEditorStore()
const integrationStore = useIntegrationStore()
const { featureFlags } = storeToRefs(integrationStore)

const bridgeAvailable = computed(() => {
  if (typeof window === `undefined`)
    return false
  return !!window.__WRITE_ASSIST_BRIDGE__?.runAction
})

const showCreate = computed(() => featureFlags.value.writeAiCreate && bridgeAvailable.value)
const showPolish = computed(() => featureFlags.value.writeAiPolish && bridgeAvailable.value)
const showIllustrate = computed(() => featureFlags.value.writeAiIllustrate && bridgeAvailable.value)
const showAny = computed(() => showCreate.value || showPolish.value || showIllustrate.value)

const activeAction = ref<WriteAssistAction | null>(null)
const originalMarkdown = ref(``)
const loadingAction = ref<WriteAssistAction | null>(null)

const isBusy = computed(() => loadingAction.value != null)

const labelFor = (action: WriteAssistAction) => {
  if (activeAction.value !== action) {
    return action === `create` ? `AI创作` : action === `polish` ? `润色` : `配图`
  }
  return action === `create` ? `重新创作` : action === `polish` ? `重新润色` : `重新配图`
}

async function runAction(action: WriteAssistAction) {
  if (isBusy.value)
    return
  if (!bridgeAvailable.value) {
    toast.error(`宿主未注入写作辅助桥接`)
    return
  }

  // 切换功能：清空上一个功能的“可丢弃原始内容”状态
  if (activeAction.value && activeAction.value !== action) {
    activeAction.value = null
    originalMarkdown.value = ``
  }

  const current = editorStore.getContent()
  const input = (activeAction.value === action && originalMarkdown.value)
    ? originalMarkdown.value
    : current

  loadingAction.value = action
  try {
    const bridge = window.__WRITE_ASSIST_BRIDGE__!
    const res = await bridge.runAction({
      action,
      markdown: input,
      ...(action === `illustrate` ? { origin: window.location.origin } : {}),
    })

    if (!res.ok) {
      toast.error(res.message || `生成失败`)
      return
    }

    editorStore.importContent(res.markdown)

    // 仅在“首次成功执行某 action 后”记录原始内容并进入 active 状态
    if (activeAction.value !== action) {
      activeAction.value = action
      originalMarkdown.value = current
    }
  }
  catch (e) {
    toast.error((e as Error).message || `生成失败`)
  }
  finally {
    loadingAction.value = null
  }
}

function discard() {
  if (isBusy.value)
    return
  if (!activeAction.value)
    return

  const raw = originalMarkdown.value
  activeAction.value = null
  originalMarkdown.value = ``

  if (raw) {
    editorStore.importContent(raw)
  }
  toast.success(`已丢弃`)
}
</script>

<template>
  <div v-if="showAny" class="flex flex-wrap items-center gap-2">
    <template v-if="showCreate">
      <div class="flex items-center gap-0">
        <Button
          variant="outline"
          class="h-8 px-3 text-sm"
          :class="{ 'rounded-r-none': activeAction === 'create' }"
          :disabled="isBusy"
          @click="runAction('create')"
        >
          {{ labelFor('create') }}
        </Button>
        <Button
          v-if="activeAction === 'create'"
          variant="outline"
          class="h-8 px-2 text-sm rounded-l-none border-l-0 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100"
          :disabled="isBusy"
          @click="discard"
        >
          <Undo2 class="size-4" />
        </Button>
      </div>
    </template>

    <template v-if="showPolish">
      <div class="flex items-center gap-0">
        <Button
          variant="outline"
          class="h-8 px-3 text-sm"
          :class="{ 'rounded-r-none': activeAction === 'polish' }"
          :disabled="isBusy"
          @click="runAction('polish')"
        >
          {{ labelFor('polish') }}
        </Button>
        <Button
          v-if="activeAction === 'polish'"
          variant="outline"
          class="h-8 px-2 text-sm rounded-l-none border-l-0 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100"
          :disabled="isBusy"
          @click="discard"
        >
          <Undo2 class="size-4" />
        </Button>
      </div>
    </template>

    <template v-if="showIllustrate">
      <div class="flex items-center gap-0">
        <Button
          variant="outline"
          class="h-8 px-3 text-sm"
          :class="{ 'rounded-r-none': activeAction === 'illustrate' }"
          :disabled="isBusy"
          @click="runAction('illustrate')"
        >
          {{ labelFor('illustrate') }}
        </Button>
        <Button
          v-if="activeAction === 'illustrate'"
          variant="outline"
          class="h-8 px-2 text-sm rounded-l-none border-l-0 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100"
          :disabled="isBusy"
          @click="discard"
        >
          <Undo2 class="size-4" />
        </Button>
      </div>
    </template>
  </div>
</template>

