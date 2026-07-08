import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { ColorPicker } from '../ColorPicker'

describe('ColorPicker', () => {
  it('defaults to black when no initial color is given', () => {
    const { container } = render(<ColorPicker />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.backgroundColor).toBe('rgb(0, 0, 0)')
  })

  it('uses the initial color as the background', () => {
    const { container } = render(<ColorPicker initial="#ff0000" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.backgroundColor).toBe('rgb(255, 0, 0)')
  })

  it('calls onChange and updates the background when the color input changes', () => {
    const onChange = vi.fn()
    const { container } = render(<ColorPicker initial="#000000" onChange={onChange} />)
    const input = container.querySelector('input[type="color"]') as HTMLInputElement

    fireEvent.change(input, { target: { value: '#00ff00' } })

    expect(onChange).toHaveBeenCalledWith('#00ff00')
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.backgroundColor).toBe('rgb(0, 255, 0)')
  })

  it('clicking the wrapper opens the native color input', () => {
    const { container } = render(<ColorPicker />)
    const input = container.querySelector('input[type="color"]') as HTMLInputElement
    const clickSpy = vi.fn()
    input.addEventListener('click', clickSpy)

    fireEvent.click(container.firstChild as HTMLElement)

    expect(clickSpy).toHaveBeenCalled()
  })
})
