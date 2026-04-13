import tinycolor from 'tinycolor2'

export type RGBColor = {
  r: number
  g: number
  b: number
}
export const hex2rgb = (hex: string) => new tinycolor(hex).toRgb() as RGBColor

export const rgb2hex = (rgb: RGBColor) => new tinycolor(rgb).toHexString()

export const randomRGBColor = () => tinycolor.random().toRgb() as RGBColor

export const randomHexColor = () => tinycolor.random().toHexString()
