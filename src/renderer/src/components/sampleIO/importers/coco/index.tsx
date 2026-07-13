import { TbBoxMultiple } from 'react-icons/tb'
import type { SampleImporter } from '../../types'
import { CocoImporterComponent } from './CocoImporterComponent'

export const cocoImporter: SampleImporter = {
  id: 'coco',
  name: 'COCO Dataset',
  description: 'Import a COCO-format dataset (zip or folder) and map its categories to labels.',
  icon: <TbBoxMultiple size={20} />,
  Component: CocoImporterComponent
}
