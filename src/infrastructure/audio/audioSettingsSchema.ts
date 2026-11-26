import { z } from 'zod';

/** Ajustes de audio guardados (design 0035 D9): versión 1, música y efectos 0..100 y silencio. */
export const AudioSettingsSchema = z.strictObject({
  version: z.literal(1),
  music: z.number().int().min(0).max(100),
  effects: z.number().int().min(0).max(100),
  muted: z.boolean(),
});

export type StoredAudioSettings = z.infer<typeof AudioSettingsSchema>;
