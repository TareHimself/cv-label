import { TbBoxMultiple } from 'react-icons/tb'
import type { SampleExporter } from '../../types'
import { CocoExporterComponent } from './CocoExporterComponent'

export const cocoExporter: SampleExporter = {
  id: 'coco',
  name: 'COCO Dataset',
  description: 'A COCO-format zip (train/valid/test, each with _annotations.coco.json).',
  icon: <TbBoxMultiple size={20} />,
  Component: CocoExporterComponent
}
