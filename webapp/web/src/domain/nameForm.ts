import { messageRef, type MessageRef } from '../i18n/messageRef'

// Shared by the meal, appellation and producer forms.
export function validateName(name: string): MessageRef | undefined {
  return name.trim() === '' ? messageRef('manage.common.nameRequired') : undefined
}
