import { FaRegImages } from 'react-icons/fa'
import type { SampleImporter } from '../../types'
import { PlainImagesImporterComponent } from './PlainImagesImporterComponent'

export const plainImagesImporter: SampleImporter = {
  id: 'plain-images',
  name: 'Plain Images',
  description: 'Import image files directly with no annotations.',
  icon: <FaRegImages size={20} />,
  Component: PlainImagesImporterComponent
}
