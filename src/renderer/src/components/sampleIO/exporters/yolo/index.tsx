import { BsBoundingBoxCircles } from 'react-icons/bs'
import type { SampleExporter } from '../../types'
import { YoloExporterComponent } from './YoloExporterComponent'

export const yoloExporter: SampleExporter = {
  id: 'yolo',
  name: 'YOLO Dataset',
  description: 'A YOLO-format zip (images/, labels/, data.yaml) with Box annotations.',
  icon: <BsBoundingBoxCircles size={20} />,
  Component: YoloExporterComponent
}
