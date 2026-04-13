export type ExternalAnnotatorLabel = {
  id: string
  name: string
}

export class ExternalAnnotator {
  name: string
  baseUrl: string
  headers: Record<string, string>
  labels: Record<string, ExternalAnnotatorLabel>
  constructor(
    name: string,
    baseUrl: string,
    headers: Record<string, string> = {},
    labels: Record<string, ExternalAnnotatorLabel> = {}
  ) {
    this.name = name
    this.baseUrl = baseUrl
    this.headers = headers
    this.labels = labels
  }
}
