import { Group, SegmentedControl, SegmentedControlItem, Text } from '@mantine/core'

export const LabeledSegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string
  value: T
  options: SegmentedControlItem[]
  onChange: (value: T) => void
  disabled?: boolean
}) => (
  <Group justify="space-between" align="center">
    <Text size="sm" fw={500}>
      {label}
    </Text>
    <SegmentedControl
      data={options}
      value={value}
      onChange={(v) => onChange(v as T)}
      disabled={disabled}
    />
  </Group>
)
