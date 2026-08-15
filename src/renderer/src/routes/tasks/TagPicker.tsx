import { MultiSelect } from '@mantine/core'
import { useState, type FC } from 'react'
import type { ITag } from '@shared/types'
import { ZIndex } from '@renderer/zIndex'

const CREATE_PREFIX = '__create-tag__:'

export type TagPickerProps = {
  label?: string
  placeholder?: string
  allTags: ITag[]
  /** Selected tag ids. */
  value: string[]
  onChange: (ids: string[]) => void
  onCreate: (name: string) => Promise<ITag>
}

/** A single combobox that's both "pick an existing tag" (click, no typing needed) and
 *  "create a new one" (typing only reveals a "+ Create …" option when nothing matches -
 *  clicking that is what actually creates it, never automatic on Enter). Selected tags
 *  render as removable pills in the input itself, standard MultiSelect behavior. */
export const TagPicker: FC<TagPickerProps> = ({
  label,
  placeholder,
  allTags,
  value,
  onChange,
  onCreate
}) => {
  const [search, setSearch] = useState('')
  // Bridges the gap between a tag being created and useTags' invalidate-triggered
  // refetch landing - without this, the just-created pill would briefly show no label
  // (allTags won't contain it yet).
  const [pendingNewTags, setPendingNewTags] = useState<ITag[]>([])

  const knownTags = [
    ...allTags,
    ...pendingNewTags.filter((tag) => !allTags.some((t) => t.id === tag.id))
  ]

  const trimmedSearch = search.trim()
  const hasExactMatch = knownTags.some(
    (tag) => tag.name.toLowerCase() === trimmedSearch.toLowerCase()
  )

  const data = [
    ...knownTags.map((tag) => ({ value: tag.id, label: tag.name })),
    ...(trimmedSearch.length > 0 && !hasExactMatch
      ? [{ value: `${CREATE_PREFIX}${trimmedSearch}`, label: `+ Create "${trimmedSearch}"` }]
      : [])
  ]

  const handleChange = (nextValues: string[]) => {
    const createValue = nextValues.find((v) => v.startsWith(CREATE_PREFIX))
    if (createValue === undefined) {
      onChange(nextValues)
      return
    }

    const name = createValue.slice(CREATE_PREFIX.length)
    void onCreate(name).then((tag) => {
      setPendingNewTags((current) => [...current, tag])
      setSearch('')
      onChange([...nextValues.filter((v) => v !== createValue), tag.id])
    })
  }

  return (
    <MultiSelect
      label={label}
      placeholder={placeholder}
      data={data}
      value={value}
      onChange={handleChange}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      hidePickedOptions
      comboboxProps={{ zIndex: ZIndex.actionModalContent }}
    />
  )
}
