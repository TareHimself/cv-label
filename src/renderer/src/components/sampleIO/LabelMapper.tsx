import { Group, ScrollArea, Select, Stack, Text } from '@mantine/core'
import type { ILabel } from '@shared/types'
import { ZIndex } from '@renderer/zIndex'

const EXCLUDE_VALUE = '__exclude__'

export type LabelMapperProps<K extends string | number> = {
  /** Rows to map - a source class/label for importers, or the project's own labels for exporters (same list as `options` there). */
  items: { id: K; name: string }[]
  /** Selectable mapping targets - always the project's labels. */
  options: ILabel[]
  /** `null` means explicitly excluded; absent means no choice has been made yet. */
  mapping: Map<K, string | null>
  onChange: (id: K, target: string | null) => void
  /** Label for the "don't include this" option - importers default to "Ignore", exporters pass "Don't Export". */
  excludeLabel?: string
  disabled?: boolean
}

/** One `Text` + `Select` row per item, mapping it to one of `options` or excluding it - shared by every importer and exporter. */
export const LabelMapper = <K extends string | number>({
  items,
  options,
  mapping,
  onChange,
  excludeLabel = 'Ignore',
  disabled
}: LabelMapperProps<K>) => (
  <ScrollArea style={{ maxHeight: 260 }} type="always" scrollbars="y">
    <Stack gap="sm">
      {items.map((item) => (
        <Group key={item.id} wrap="nowrap">
          <Text size="sm" flex={1} truncate>
            {item.name}
          </Text>
          <Select
            flex={1}
            data={[
              { value: EXCLUDE_VALUE, label: excludeLabel },
              ...options.map((label) => ({ value: label.id, label: label.name }))
            ]}
            value={mapping.get(item.id) ?? EXCLUDE_VALUE}
            onChange={(value) => onChange(item.id, value === EXCLUDE_VALUE ? null : value)}
            // These importers/exporters all live inside a modal - without an explicit
            // zIndex above the modal's own, this dropdown renders behind the modal body
            // and can't be clicked.
            comboboxProps={{ zIndex: ZIndex.actionModalContent }}
            disabled={disabled}
            allowDeselect={false}
          />
        </Group>
      ))}
    </Stack>
  </ScrollArea>
)
