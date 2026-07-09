import type { SampleImporter } from '../types'
import { plainImagesImporter } from './plainImages'

export enum ImporterId {
  PlainImages = 'plain-images'
}

export const importers: Record<ImporterId, SampleImporter> = {
  [ImporterId.PlainImages]: plainImagesImporter
}
