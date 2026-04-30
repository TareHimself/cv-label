import React, { useMemo, useRef, useState } from 'react'
export type ColorPickerProps = {
  initial?: string
  onChange?: (color: string) => void
  style?: React.CSSProperties
}

export const ColorPicker = ({ initial, onChange, style: styles }: ColorPickerProps) => {
  const colorPickerRef = useRef<HTMLInputElement | null>(null)
  const [color, setColor] = useState<string>(initial ?? '#000000')
  const memoStyles = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: color,
      boxSizing: 'border-box',
      position: 'relative',
      ...(styles ?? {})
    }),
    [styles, color]
  )

  return (
    <div
      style={memoStyles}
      onClick={() => {
        colorPickerRef?.current?.click()
      }}
    >
      <input
        ref={colorPickerRef}
        value={color}
        type="color"
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          visibility: 'hidden',
          top: 0,
          left: 0
        }}
        onChange={(e) => {
          const newColor = e.target.value
          setColor(newColor)
          onChange?.(newColor)
        }}
      />
    </div>
  )
}
