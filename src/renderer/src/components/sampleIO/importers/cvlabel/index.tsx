import { FaFileImport } from 'react-icons/fa'
import type { SampleImporter } from '../../types'
import { CvLabelImporterComponent } from './CvLabelImporterComponent'

export const cvLabelImporter: SampleImporter = {
  id: 'cv-label',
  name: 'cv-label File',
  description: 'Import a .cvlabel file, mapping its labels to this project - id then name.',
  icon: <FaFileImport size={20} />,
  Component: CvLabelImporterComponent
}
