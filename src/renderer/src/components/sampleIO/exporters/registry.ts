import type { SampleExporter } from '../types'
import { cvLabelJsonExporter } from './cvLabelJson'
import { yoloExporter } from './yolo'
import { cocoExporter } from './coco'

export enum ExporterId {
  CvLabelJson = 'cv-label-json',
  Yolo = 'yolo',
  Coco = 'coco'
}

export const exporters: Record<ExporterId, SampleExporter> = {
  [ExporterId.CvLabelJson]: cvLabelJsonExporter,
  [ExporterId.Yolo]: yoloExporter,
  [ExporterId.Coco]: cocoExporter
}
