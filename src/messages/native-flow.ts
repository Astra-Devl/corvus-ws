import { assertCount, BUTTON_LIMITS, toNativeFlowButton } from './button-utils.js'
import type { InteractiveButton } from './button-types.js'
import type { MessageContent } from './message-utils.js'

export interface NativeFlowOptions {
  messageParamsJson?: string
  messageVersion?: number
  maxButtons?: number
}

/** Objek `nativeFlowMessage` untuk dipasang di `interactiveMessage`. */
export function buildNativeFlow(
  buttons: readonly InteractiveButton[],
  options: NativeFlowOptions = {},
): MessageContent {
  assertCount('buttons', buttons.length, options.maxButtons ?? BUTTON_LIMITS.nativeFlowButtons)
  return {
    buttons: buttons.map(toNativeFlowButton),
    messageParamsJson: options.messageParamsJson ?? '',
    messageVersion: options.messageVersion ?? 1,
  }
}
