import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DateRangePickerProps {
  value: string
  onChange: (value: string) => void
}

const presetOptions = [
  { label: 'Hoje', value: '0' },
  { label: 'Últimos 7 dias', value: '7' },
  { label: 'Últimos 14 dias', value: '14' },
  { label: 'Últimos 28 dias', value: '28' },
  { label: 'Últimos 30 dias', value: '30' },
  { label: 'Esta semana', value: 'this_week' },
  { label: 'Semana passada', value: 'last_week' },
  { label: 'Este mês', value: 'this_month' },
  { label: 'Mês passado', value: 'last_month' },
  { label: 'Últimos 90 dias', value: '90' },
  { label: 'Últimos 6 meses', value: '180' },
  { label: 'Máximo (1 ano)', value: '365' },
]

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Selecionar período" />
      </SelectTrigger>
      <SelectContent>
        {presetOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}