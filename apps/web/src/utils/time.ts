const UTC8_TIMEZONE = 'Asia/Shanghai'

export const formatDateTimeUTC8 = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString(undefined, { timeZone: UTC8_TIMEZONE })
}

export const formatDateUTC8 = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(undefined, { timeZone: UTC8_TIMEZONE })
}

export const formatRelativeTimeUTC8 = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 0) {
    return value
  }

  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) {
    return '刚刚'
  }

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}小时前`
  }

  return formatDateTimeUTC8(value)
}
