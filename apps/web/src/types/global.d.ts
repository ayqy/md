interface Window {
  __MP_Editor_JSAPI__: {
    invoke: (params: {
      apiName: string
      apiParam: any
      sucCb: (res: any) => void
      errCb: (err: any) => void
    }) => void
  }

  __AYQYMD_IMAGE_UPLOAD_BRIDGE__?: {
    uploadImage: (file: File) => Promise<{ proxyUrl: string }>
  }
}
