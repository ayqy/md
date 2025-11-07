export interface HostBridgeConfig {
  featureFlags?: Partial<{
    ai: boolean
    postManagement: boolean
    cssEditor: boolean
    exportPanel: boolean
    uploadImage: boolean
  }>
}
