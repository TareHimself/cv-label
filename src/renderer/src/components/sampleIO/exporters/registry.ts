import type { SampleExporter } from '../types'
import { cvLabelJsonExporter } from './cvLabelJson'

export enum ExporterId {
  CvLabelJson = 'cv-label-json'
}

export const exporters: Record<ExporterId, SampleExporter> = {
  [ExporterId.CvLabelJson]: cvLabelJsonExporter
}
