// TODO: Phase correspondante — useDateFilter
'use client'
import { useUiStore } from '@/store/uiStore'
import { inRange } from '@/lib/helpers'

/**
 * Hook filtre date — expose le filtre et un helper de test.
 * Usage :
 *   const { dateFrom, dateTo, filterByDate, clearDateFilter } = useDateFilter()
 *   const filtered = rows.filter(r => filterByDate(r.created_at))
 */
export function useDateFilter() {
  const { dateFrom, dateTo, setDateFrom, setDateTo, clearDateFilter } = useUiStore()

  const filterByDate = (dateStr) => inRange(dateStr, dateFrom, dateTo)

  const hasFilter = Boolean(dateFrom || dateTo)

  return { dateFrom, dateTo, setDateFrom, setDateTo, clearDateFilter, filterByDate, hasFilter }
}