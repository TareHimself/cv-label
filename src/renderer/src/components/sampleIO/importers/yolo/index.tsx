import { BsBoundingBoxCircles } from 'react-icons/bs'
import type { SampleImporter } from '../../types'
import { YoloImporterComponent } from './YoloImporterComponent'

export const yoloImporter: SampleImporter = {
  id: 'yolo',
  name: 'YOLO Dataset',
  description:
    'Import a YOLO-format dataset (zip or folder) and map its classes to project labels.',
  icon: <BsBoundingBoxCircles size={20} />,
  Component: YoloImporterComponent
}
