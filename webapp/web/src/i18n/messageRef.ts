// A translatable message produced by pure domain code: the view translates it with `t(ref.key, ref.params)`.
export interface MessageRef {
  key: string
  params?: Record<string, string | number>
}

export function messageRef(key: string, params?: MessageRef['params']): MessageRef {
  return params ? { key, params } : { key }
}
