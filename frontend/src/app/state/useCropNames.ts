import { useMemo } from 'react'
import { useWorkspace } from './workspace'

/** Crop id → display name, from the crops the API knows (verified and not). */
export function useCropNames(): Record<string, string> {
  const { presets, crops } = useWorkspace()
  return useMemo(
    () => ({ ...(presets.data?.crop_names ?? {}), ...Object.fromEntries((crops.data?.crops ?? []).map((c) => [c.id, c.name])) }),
    [presets.data, crops.data],
  )
}
