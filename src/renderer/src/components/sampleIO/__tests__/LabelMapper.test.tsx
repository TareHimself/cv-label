import { describe, expect, it, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@renderer/__tests__/renderWithProviders'
import { ILabel } from '@shared/types'
import { LabelMapper } from '../LabelMapper'

const options: ILabel[] = [
  { id: 'l1', name: 'Person', color: '#ff0000' },
  { id: 'l2', name: 'Car', color: '#00ff00' }
]

describe('LabelMapper', () => {
  it('renders one row per item, showing its currently mapped target', () => {
    renderWithProviders(
      <LabelMapper
        items={[
          { id: 1, name: 'person' },
          { id: 2, name: 'car' }
        ]}
        options={options}
        mapping={
          new Map([
            [1, 'l1'],
            [2, 'l2']
          ])
        }
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('person')).toBeInTheDocument()
    expect(screen.getByText('car')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Person')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Car')).toBeInTheDocument()
  })

  it('defaults an unmapped item to the exclude option', () => {
    renderWithProviders(
      <LabelMapper
        items={[{ id: 1, name: 'truck' }]}
        options={options}
        mapping={new Map()}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('Ignore')).toBeInTheDocument()
  })

  it('uses a custom exclude label when provided', () => {
    renderWithProviders(
      <LabelMapper
        items={[{ id: 1, name: 'Person' }]}
        options={options}
        mapping={new Map()}
        onChange={vi.fn()}
        excludeLabel="Don't Export"
      />
    )

    expect(screen.getByDisplayValue("Don't Export")).toBeInTheDocument()
  })

  it('reports null when the exclude option is chosen', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <LabelMapper
        items={[{ id: 1, name: 'person' }]}
        options={options}
        mapping={new Map([[1, 'l1']])}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByDisplayValue('Person'))
    fireEvent.click(screen.getByText('Ignore'))

    expect(onChange).toHaveBeenCalledWith(1, null)
  })

  it('reports the target id when a real option is chosen', () => {
    const onChange = vi.fn()
    renderWithProviders(
      <LabelMapper
        items={[{ id: 1, name: 'person' }]}
        options={options}
        mapping={new Map()}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByDisplayValue('Ignore'))
    fireEvent.click(screen.getByText('Car'))

    expect(onChange).toHaveBeenCalledWith(1, 'l2')
  })
})
