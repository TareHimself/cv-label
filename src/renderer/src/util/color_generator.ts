import { indexToHex } from '@shared/color'

export class ColorGenerator {
  private index: number = 0
  private released: string[] = []
  make() {
    const popped = this.released.pop()
    if (popped !== undefined) {
      return popped
    }
    return indexToHex(this.index++)
  }

  free(color: string) {
    this.released.push(color)
  }
}
