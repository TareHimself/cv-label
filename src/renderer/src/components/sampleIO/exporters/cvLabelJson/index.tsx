import { FaFileExport } from 'react-icons/fa'
import type { SampleExporter } from '../../types'
import { CvLabelJsonExporterComponent } from './CvLabelJsonExporterComponent'

export const cvLabelJsonExporter: SampleExporter = {
  id: 'cv-label-json',
  name: 'cv-label JSON',
  description: 'A native zip export with a JSON manifest and all sample images.',
  icon: <FaFileExport size={20} />,
  Component: CvLabelJsonExporterComponent
}
