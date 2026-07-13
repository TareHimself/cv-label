import { FaFileExport } from 'react-icons/fa'
import type { SampleExporter } from '../../types'
import { CvLabelJsonExporterComponent } from './CvLabelJsonExporterComponent'

export const cvLabelJsonExporter: SampleExporter = {
  id: 'cv-label-json',
  name: 'cv-label File',
  description: 'A .cvlabel file: a flat sample list plus labels, importable into any project.',
  icon: <FaFileExport size={20} />,
  Component: CvLabelJsonExporterComponent
}
